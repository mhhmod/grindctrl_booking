/* ─── Try-On Agent — Mock Runner ───
 *
 * ⚠️  MVP / DEMO-ONLY — This module returns a static placeholder image.
 * It does NOT perform any real AI generation.  Replace with a live
 * provider (e.g. Replicate / OpenAI) before production launch.
 */

import type { TryOnJob } from './types';

/**
 * Simulates an AI try-on generation with a mock delay.
 * Returns a completed job pointing at a **static demo image** —
 * no real image generation occurs.
 */
export async function runMockGeneration(
  sessionId: string,
  productId: string,
): Promise<TryOnJob> {
  const jobId = `tryon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  // Simulate processing time (1.5–2.5s)
  await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));

  return {
    jobId,
    sessionId,
    productId,
    status: 'completed',
    resultImageUrl: '/try-on/mock-result.png',
    message: 'Demo preview generated (mock mode — not a real AI result).',
    createdAt: now,
    completedAt: new Date().toISOString(),
    meta: {
      runtime: 'mock',
      provider: 'mock',
      costEstimate: 0,
    },
  };
}
