/* ─── Try-On Agent — OpenRouter image runner (live mode) ───
   Provider-agnostic by design: TRYON_MODEL is any OpenRouter image-model
   slug (e.g. google/gemini-3.1-flash-image, openai/gpt-image-2) and can
   be swapped anytime without code changes. */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TryOnJob } from './types';
import { getProduct } from './products';
import { readProviderBody } from '@/lib/provider-http';
import { decodeRasterDataUrl, TRYON_RESULT_MAX_BYTES } from './image-data';
import { toShopperFailureMessage } from './shopper-errors';

const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images';
const DEFAULT_MODEL = 'google/gemini-3.1-flash-image';

/* Accepted upload formats for the live pipeline. HEIC/HEIF previews don't
   render in browsers anyway, so real uploads arrive as jpeg/png/webp. */
export function parsePhotoDataUrl(photoData: string): { mime: string } | null {
  const parsed = decodeRasterDataUrl(photoData, 8 * 1024 * 1024);
  return parsed ? { mime: parsed.mime } : null;
}

const MAX_GARMENT_BYTES = 8 * 1024 * 1024;
export const IMAGE_PROVIDER_TIMEOUT_MS = 120_000;
const MAX_PROVIDER_JSON_BYTES = Math.ceil(TRYON_RESULT_MAX_BYTES / 3) * 4 + 64 * 1024;

/* Only Shopify-controlled image hosts are allowed as remote garment
   sources (SSRF guard): the shared CDN, or a *.myshopify.com shop
   domain's /cdn/ path (modern image_url returns shop-domain URLs). */
export function isAllowedGarmentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return false;
    if (parsed.hostname === 'cdn.shopify.com') return true;
    return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(parsed.hostname) && parsed.pathname.startsWith('/cdn/');
  } catch {
    return false;
  }
}

async function loadGarmentDataUrl(productId: string, garmentUrl?: string): Promise<string> {
  if (garmentUrl) {
    if (!isAllowedGarmentUrl(garmentUrl)) {
      throw new Error('Garment image must come from the Shopify CDN.');
    }
    const res = await fetch(garmentUrl, {
      signal: AbortSignal.timeout(20_000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Garment image fetch failed (HTTP ${res.status}).`);
    const mime = res.headers.get('content-type')?.split(';')[0] ?? '';
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) {
      throw new Error('Garment image must be jpeg, png, or webp.');
    }
    const bytes = await readProviderBody(res, MAX_GARMENT_BYTES);
    const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`;
    if (!decodeRasterDataUrl(dataUrl, MAX_GARMENT_BYTES)) throw new Error('Invalid garment image.');
    return dataUrl;
  }

  const product = getProduct(productId);
  if (!product) throw new Error(`Unknown product: ${productId}`);
  const filePath = path.join(process.cwd(), 'public', product.imageUrl);
  const bytes = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

/**
 * Runs a real try-on generation through OpenRouter's Images API:
 * person photo + garment image as input references, composite image out.
 */
export async function runImageGeneration(
  sessionId: string,
  productId: string,
  photoData: string,
  shop: string | null,
  garmentUrl?: string,
  productName?: string,
): Promise<TryOnJob> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.TRYON_MODEL || DEFAULT_MODEL;
  const jobId = `tryon_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  let costEstimate: number | null = 0; // No provider attempt yet.

  const fail = (reason: string, status?: number): TryOnJob => {
    console.warn('[try-on] provider_failure', { reason, status, jobId });
    return {
      jobId,
      sessionId,
      productId,
      shop,
      status: 'failed',
      message: toShopperFailureMessage(status ? String(status) : reason),
      createdAt,
      meta: { runtime: 'live', provider: model, costEstimate },
    };
  };

  if (!apiKey) {
    return fail('provider_not_configured', 503);
  }

  if (!parsePhotoDataUrl(photoData)) {
    return fail('Photo must be a jpeg, png, or webp image.');
  }

  const product = getProduct(productId);
  const garmentName = productName || product?.name || 'the garment';
  let garmentDataUrl: string;
  try {
    garmentDataUrl = await loadGarmentDataUrl(productId, garmentUrl);
  } catch {
    return fail('garment_unavailable');
  }

  costEstimate = null; // An attempted/ambiguous call is not proven free.
  try {
    const res = await fetch(OPENROUTER_IMAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(IMAGE_PROVIDER_TIMEOUT_MS),
      redirect: 'error',
      cache: 'no-store',
      body: JSON.stringify({
        model,
        prompt:
          `Virtual try-on: show the person from the first reference image wearing the garment from the second reference image (${garmentName}). ` +
          'This must look like the SAME photograph, retaken with the person wearing the new garment: ' +
          'identical face, skin tone, hair, pose, body proportions, camera angle, background, and framing. ' +
          "Match the original photo's lighting direction, color temperature, grain, and sharpness so the garment blends seamlessly. " +
          'The garment must keep its true color, pattern, logo placement, and fabric texture, with natural drape, ' +
          "realistic wrinkles, and correct fit for the person's build. " +
          'No beautification, no body reshaping, no background changes, no added props. Photorealistic, indistinguishable from a real photo.',
        input_references: [
          { type: 'image_url', image_url: { url: photoData } },
          { type: 'image_url', image_url: { url: garmentDataUrl } },
        ],
        n: 1,
      }),
    });

    if (!res.ok) {
      await res.body?.cancel();
      return fail('provider_http_error', res.status);
    }

    const data = JSON.parse((await readProviderBody(res, MAX_PROVIDER_JSON_BYTES)).toString('utf8')) as {
      data?: { b64_json?: unknown; media_type?: unknown }[];
      usage?: { cost?: unknown };
      error?: unknown;
    };
    if (!data || typeof data !== 'object' || data.error) return fail('provider_invalid_response');
    const cost = data.usage?.cost;
    costEstimate = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null;
    const image = data.data?.[0];
    if (typeof image?.b64_json !== 'string') {
      return fail('provider_missing_image');
    }
    const resultImageUrl = `data:${image.media_type ?? 'image/png'};base64,${image.b64_json}`;
    if (!decodeRasterDataUrl(resultImageUrl, TRYON_RESULT_MAX_BYTES)) return fail('provider_invalid_image');

    return {
      jobId,
      sessionId,
      productId,
      shop,
      status: 'completed',
      resultImageUrl,
      createdAt,
      completedAt: new Date().toISOString(),
      meta: { runtime: 'live', provider: model, costEstimate },
    };
  } catch (error) {
    return fail(
      error instanceof Error && /timeout|abort/i.test(error.name) ? 'provider_timeout' : 'provider_response_failure',
    );
  }
}
