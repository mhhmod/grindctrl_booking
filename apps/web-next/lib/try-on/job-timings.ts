import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { TryOnJob } from './types';
import type { ClientLookTimings } from './look-preparation';

export function validClientTimings(value: unknown): ClientLookTimings | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const result: ClientLookTimings = {};
  for (const key of ['attempt_ms', 'check_ms', 'upload_ms'] as const) {
    const n = input[key];
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) result[key] = Math.min(n, 600_000);
  }
  if (typeof input.check_prewarmed === 'boolean') result.check_prewarmed = input.check_prewarmed;
  return Object.keys(result).length ? result : undefined;
}

/** Durations and byte counts only. Never attach this server diagnostic to a
 * public job response: source images, URLs and prompt text do not belong here. */
export type TryOnJobTimings = {
  client?: ClientLookTimings;
  plan_ms: number;
  reservation_ms: number;
  garment_ms: number;
  provider_attempts: Array<{ attempt: number; duration_ms: number; status: number | null }>;
  persistence_ms: number;
  result_lookup_ms: number;
  finalize_ms: number;
  total_ms: number;
  input_bytes: { photo: number; garment: number; provider_request: number };
};

export function createJobTimings(photoData?: string, client?: unknown): TryOnJobTimings {
  const base64 = photoData?.split(',', 2)[1] ?? '';
  return {
    ...(validClientTimings(client) ? { client: validClientTimings(client) } : {}),
    plan_ms: 0,
    reservation_ms: 0,
    garment_ms: 0,
    provider_attempts: [],
    persistence_ms: 0,
    result_lookup_ms: 0,
    finalize_ms: 0,
    total_ms: 0,
    input_bytes: { photo: Buffer.byteLength(base64, 'base64'), garment: 0, provider_request: 0 },
  };
}

let missingColumnLogged = false;
let missingColumnUntil = 0;

/** Best effort, separate from the credit transaction. Code may be deployed
 * before the additive migration, and a diagnostics failure must never refund
 * or fail an otherwise delivered look. Retry on later jobs after migration. */
export async function persistJobTimings(job: Pick<TryOnJob, 'jobId' | 'sessionId' | 'productId' | 'shop'>, timings: TryOnJobTimings | { client: ClientLookTimings }): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  if (Date.now() < missingColumnUntil) return;
  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    let error: { code?: string; message: string } | null = null;
    // Compare-and-set the JSON value so the acknowledgment report and the
    // provider's final diagnostics cannot overwrite each other, across workers.
    for (let attempt = 0; attempt < 3; attempt++) {
      let read = client.from('tryon_jobs').select('phase_timings')
        .eq('id', job.jobId).eq('session_id', job.sessionId).eq('product_id', job.productId);
      read = job.shop === null ? read.is('shop', null) : read.eq('shop', job.shop);
      const previous = await read.maybeSingle();
      if (previous.error) { error = previous.error; break; }
      if (!previous.data) return;
      const old = previous.data.phase_timings as Record<string, unknown> | null;
      const merged = { ...old, ...timings, client: { ...validClientTimings(old?.client), ...timings.client } };
      if (!Object.keys(merged.client).length) delete (merged as { client?: ClientLookTimings }).client;
      let query = client.from('tryon_jobs').update({ phase_timings: merged })
        .eq('id', job.jobId).eq('session_id', job.sessionId).eq('product_id', job.productId);
      query = job.shop === null ? query.is('shop', null) : query.eq('shop', job.shop);
      query = old === null ? query.is('phase_timings', null) : query.eq('phase_timings', JSON.stringify(old));
      const updated = await query.select('id');
      error = updated.error;
      if (error || updated.data?.length) break;
    }
    if (!error) {
      missingColumnUntil = 0;
      return;
    }
    const missing = (error.code === '42703' || error.code === 'PGRST204') &&
      /phase_timings/i.test(error.message);
    if (missing) {
      // Avoid a known-failing write on every look, but retry after a minute
      // so a manual migration becomes visible without a process restart.
      missingColumnUntil = Date.now() + 60_000;
      if (!missingColumnLogged) {
        missingColumnLogged = true;
        console.warn('[try-on] phase_timings_column_unavailable');
      }
      return;
    }
    console.warn('[try-on] phase_timings_write_failed', { jobId: job.jobId });
  } catch {
    console.warn('[try-on] phase_timings_write_failed', { jobId: job.jobId });
  }
}
