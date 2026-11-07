import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { TryOnJob } from './types';

/** Durations and byte counts only. Never attach this server diagnostic to a
 * public job response: source images, URLs and prompt text do not belong here. */
export type TryOnJobTimings = {
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

export function createJobTimings(photoData?: string): TryOnJobTimings {
  const base64 = photoData?.split(',', 2)[1] ?? '';
  return {
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
export async function persistJobTimings(job: TryOnJob, timings: TryOnJobTimings): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  if (Date.now() < missingColumnUntil) return;
  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    let query = client.from('tryon_jobs').update({ phase_timings: timings })
      .eq('id', job.jobId).eq('session_id', job.sessionId).eq('product_id', job.productId);
    query = job.shop === null ? query.is('shop', null) : query.eq('shop', job.shop);
    const { error } = await query;
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
