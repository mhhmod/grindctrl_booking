/* ─── Try-On Agent — OpenAI gpt-image-2 runner (live mode) ─── */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { TryOnJob } from './types';
import { getProduct } from './products';

const OPENAI_IMAGES_EDIT_URL = 'https://api.openai.com/v1/images/edits';
const DEFAULT_MODEL = 'gpt-image-2';

/* Accepted upload formats for the live pipeline. HEIC/HEIF previews don't
   render in browsers anyway, so real uploads arrive as jpeg/png/webp. */
const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,/;

export function parsePhotoDataUrl(photoData: string): { blob: Blob; mime: string } | null {
  const match = DATA_URL_RE.exec(photoData);
  if (!match) return null;
  const mime = `image/${match[1]}`;
  const base64 = photoData.slice(photoData.indexOf(',') + 1);
  try {
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length === 0) return null;
    return { blob: new Blob([bytes], { type: mime }), mime };
  } catch {
    return null;
  }
}

async function loadGarmentBlob(productId: string): Promise<{ blob: Blob; name: string }> {
  const product = getProduct(productId);
  if (!product) throw new Error(`Unknown product: ${productId}`);
  const filePath = path.join(process.cwd(), 'public', product.imageUrl);
  const bytes = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return { blob: new Blob([bytes], { type: mime }), name: `garment${ext}` };
}

/**
 * Runs a real try-on generation through OpenAI's images/edit endpoint:
 * person photo + garment image in, composited try-on image out (base64).
 */
export async function runOpenAiGeneration(
  sessionId: string,
  productId: string,
  photoData: string,
): Promise<TryOnJob> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.TRYON_OPENAI_MODEL || DEFAULT_MODEL;
  const jobId = `tryon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();

  const fail = (message: string): TryOnJob => ({
    jobId,
    sessionId,
    productId,
    status: 'failed',
    message,
    createdAt,
    meta: { runtime: 'live', provider: 'openai', costEstimate: 0 },
  });

  if (!apiKey) {
    return fail('Live provider is not configured yet (missing OPENAI_API_KEY).');
  }

  const parsed = parsePhotoDataUrl(photoData);
  if (!parsed) {
    return fail('Photo must be a jpeg, png, or webp image.');
  }

  const garment = await loadGarmentBlob(productId);
  const product = getProduct(productId);

  const form = new FormData();
  form.append('model', model);
  form.append('image[]', parsed.blob, `person.${parsed.mime.split('/')[1]}`);
  form.append('image[]', garment.blob, garment.name);
  form.append(
    'prompt',
    `Virtual try-on: show the person from the first image wearing the garment from the second image (${product?.name ?? 'the garment'}). ` +
      'Keep the person\'s face, pose, body shape, and background unchanged. ' +
      'Fit the garment naturally with realistic drape, lighting, and shadows. Photorealistic.',
  );
  form.append('size', 'auto');

  const res = await fetch(OPENAI_IMAGES_EDIT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    return fail(errBody?.error?.message || `Image generation failed (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    return fail('Image generation returned no image.');
  }

  return {
    jobId,
    sessionId,
    productId,
    status: 'completed',
    resultImageUrl: `data:image/png;base64,${b64}`,
    createdAt,
    completedAt: new Date().toISOString(),
    meta: { runtime: 'live', provider: 'openai', costEstimate: 0.07 },
  };
}
