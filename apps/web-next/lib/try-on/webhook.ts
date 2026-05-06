import { getProduct } from './products';
import type { TryOnJob } from './types';

export type TryOnCompletionCta = 'none' | 'download' | 'request_order' | 'start_trial';

export interface TryOnCompletedWebhookContext {
  hasPhoto: boolean;
  cta?: TryOnCompletionCta;
  userAgent?: string | null;
}

export interface TryOnCompletedWebhookResult {
  ok: boolean;
  skipped: boolean;
  status?: number;
  reason?: 'not_configured' | 'job_not_completed' | 'request_failed';
}

interface TryOnCompletedWebhookPayload {
  source: 'grindctrl_tryon';
  event: 'tryon_completed';
  jobId: string;
  productId: string;
  productName: string;
  status: 'completed';
  lead: {
    hasPhoto: boolean;
    cta: TryOnCompletionCta;
  };
  meta: {
    runtime: TryOnJob['meta']['runtime'];
    provider: string;
    timestamp: string;
    userAgent?: string;
  };
}

function buildCompletedPayload(
  job: TryOnJob,
  context: TryOnCompletedWebhookContext,
): TryOnCompletedWebhookPayload {
  const product = getProduct(job.productId);
  const payload: TryOnCompletedWebhookPayload = {
    source: 'grindctrl_tryon',
    event: 'tryon_completed',
    jobId: job.jobId,
    productId: job.productId,
    productName: product?.name ?? job.productId,
    status: 'completed',
    lead: {
      hasPhoto: context.hasPhoto,
      cta: context.cta ?? 'none',
    },
    meta: {
      runtime: job.meta.runtime,
      provider: job.meta.provider,
      timestamp: new Date().toISOString(),
    },
  };

  if (context.userAgent) {
    payload.meta.userAgent = context.userAgent;
  }

  return payload;
}

export async function notifyTryOnCompleted(
  job: TryOnJob,
  context: TryOnCompletedWebhookContext,
): Promise<TryOnCompletedWebhookResult> {
  if (job.status !== 'completed') {
    return { ok: true, skipped: true, reason: 'job_not_completed' };
  }

  const webhookUrl = process.env.TRYON_COMPLETED_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: true, skipped: true, reason: 'not_configured' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = process.env.TRYON_COMPLETED_WEBHOOK_TOKEN;
  if (token) {
    headers['x-grindctrl-tryon-token'] = token;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildCompletedPayload(job, context)),
    });

    if (!response.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Try-On completion webhook failed', { status: response.status });
      }

      return {
        ok: false,
        skipped: false,
        status: response.status,
        reason: 'request_failed',
      };
    }

    return { ok: true, skipped: false, status: response.status };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      const message = error instanceof Error ? error.message : 'Unknown webhook error';
      console.warn('Try-On completion webhook failed', { message });
    }

    return { ok: false, skipped: false, reason: 'request_failed' };
  }
}
