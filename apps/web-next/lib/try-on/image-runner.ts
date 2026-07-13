/* ─── Try-On Agent — OpenRouter image runner (live mode) ───
   Provider-agnostic by design: TRYON_MODEL is any OpenRouter image-model
   slug (e.g. google/gemini-3.1-flash-image, openai/gpt-image-2) and can
   be swapped anytime without code changes. */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { TryOnJob } from './types';
import { getProduct } from './products';

const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images';
const DEFAULT_MODEL = 'google/gemini-3.1-flash-image';

/* Accepted upload formats for the live pipeline. HEIC/HEIF previews don't
   render in browsers anyway, so real uploads arrive as jpeg/png/webp. */
const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,/;

export function parsePhotoDataUrl(photoData: string): { mime: string } | null {
  const match = DATA_URL_RE.exec(photoData);
  if (!match) return null;
  const base64 = photoData.slice(photoData.indexOf(',') + 1);
  if (base64.length === 0) return null;
  return { mime: `image/${match[1]}` };
}

async function loadGarmentDataUrl(productId: string): Promise<string> {
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
): Promise<TryOnJob> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.TRYON_MODEL || DEFAULT_MODEL;
  const jobId = `tryon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();

  const fail = (message: string): TryOnJob => ({
    jobId,
    sessionId,
    productId,
    status: 'failed',
    message,
    createdAt,
    meta: { runtime: 'live', provider: model, costEstimate: 0 },
  });

  if (!apiKey) {
    return fail('Live provider is not configured yet (missing OPENROUTER_API_KEY).');
  }

  if (!parsePhotoDataUrl(photoData)) {
    return fail('Photo must be a jpeg, png, or webp image.');
  }

  const product = getProduct(productId);
  const garmentDataUrl = await loadGarmentDataUrl(productId);

  const res = await fetch(OPENROUTER_IMAGES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt:
        `Virtual try-on: show the person from the first reference image wearing the garment from the second reference image (${product?.name ?? 'the garment'}). ` +
        "Keep the person's face, pose, body shape, and background unchanged. " +
        'Fit the garment naturally with realistic drape, lighting, and shadows. Photorealistic.',
      input_references: [
        { type: 'image_url', image_url: { url: photoData } },
        { type: 'image_url', image_url: { url: garmentDataUrl } },
      ],
      n: 1,
    }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    return fail(errBody?.error?.message || `Image generation failed (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as {
    data?: { b64_json?: string; media_type?: string }[];
    usage?: { cost?: number };
  };
  const image = data.data?.[0];
  if (!image?.b64_json) {
    return fail('Image generation returned no image.');
  }

  return {
    jobId,
    sessionId,
    productId,
    status: 'completed',
    resultImageUrl: `data:${image.media_type ?? 'image/png'};base64,${image.b64_json}`,
    createdAt,
    completedAt: new Date().toISOString(),
    meta: { runtime: 'live', provider: model, costEstimate: data.usage?.cost ?? 0 },
  };
}
