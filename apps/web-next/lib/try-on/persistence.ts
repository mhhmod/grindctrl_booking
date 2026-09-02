/* Try-on job persistence (Supabase, service role).
   Source photos stay ephemeral. Completed provider results for billable
   storefront jobs are stored briefly in a private bucket so idempotent
   replay survives process restarts. */

import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { TryOnJob } from './types';
import {
  finalizeCreditJob,
  getShopEntitlement,
  reserveCredit,
  type CreditReservation,
  type ShopEntitlement,
} from './entitlement';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import type { VerifiedTryOnSession } from './storefront-context';
import {
  TryOnResultPersistenceError,
  TryOnResultSchemaNotReadyError,
  TryOnResultUnavailableError,
} from './result-errors';

const RESULT_BUCKET = 'tryon-results';
const RESULT_MAX_BYTES = 16 * 1024 * 1024;
export const TRYON_RESULT_RETENTION_MS = 30 * 60 * 1000;
export const TRYON_CLEANUP_BATCH_LIMIT = 50;
export const TRYON_ORPHAN_SWEEP_LIMIT = 25;
export const TRYON_ORPHAN_SAFETY_GRACE_MS = 15 * 60 * 1000;
const MAX_SIGNED_URL_SECONDS = 5 * 60;
const RESULT_DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const RESULT_MAX_BASE64_CHARS = Math.ceil(RESULT_MAX_BYTES / 3) * 4;
const RESULT_MAX_DATA_URL_CHARS = 'data:image/jpeg;base64,'.length + RESULT_MAX_BASE64_CHARS;
const RESULT_PATH_RE = /^jobs\/[A-Za-z0-9_-]{1,160}\/result\.(?:jpg|png|webp)$/;
const JOB_ID_RE = /^tryon_[A-Za-z0-9_-]{1,154}$/;

type DurableTryOnResultRow = {
  id: string;
  session_id: string;
  product_id: string;
  shop: string | null;
  status: string;
  request_key: string | null;
  model_key: string | null;
  provider: string | null;
  cost_usd: number | null;
  message: string | null;
  created_at: string;
  result_storage_path: string | null;
  result_persisted_at: string | null;
  result_expires_at: string | null;
  result_deleted_at: string | null;
};

export type DurableTryOnResult = {
  storagePath: string;
  persistedAt: string;
  expiresAt: string;
};

export type TryOnResultCleanupSummary = {
  scanned: number;
  deleted: number;
  failed: number;
};

export type TryOnOrphanSweepSummary = {
  foldersScanned: number;
  objectsScanned: number;
  candidates: number;
  deleted: number;
  skipped: number;
  failed: number;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function requireServiceClient(jobId: string) {
  const client = getServiceClient();
  if (!client) throw new TryOnResultSchemaNotReadyError(jobId);
  return client;
}

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const candidate = error as { code?: unknown; message?: unknown; error?: unknown };
  return [candidate.code, candidate.message, candidate.error]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function isSchemaNotReady(error: unknown): boolean {
  const text = errorText(error);
  return (
    text.includes('42703') ||
    text.includes('pgrst204') ||
    text.includes('schema cache') ||
    text.includes('column') ||
    text.includes('bucket not found') ||
    text.includes('bucket does not exist')
  );
}

function isMissingObject(error: unknown): boolean {
  const text = errorText(error);
  return text.includes('not found') || text.includes('no such object');
}

function persistenceError(jobId: string, error: unknown): Error {
  return isSchemaNotReady(error)
    ? new TryOnResultSchemaNotReadyError(jobId)
    : new TryOnResultPersistenceError(jobId);
}

function decodeResultDataUrl(resultImageUrl: string, jobId: string): {
  bytes: Buffer;
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
} {
  if (resultImageUrl.length > RESULT_MAX_DATA_URL_CHARS) {
    throw new TryOnResultPersistenceError(jobId);
  }
  const match = RESULT_DATA_URL_RE.exec(resultImageUrl);
  if (!match) throw new TryOnResultPersistenceError(jobId);
  const mime = match[1] as 'image/jpeg' | 'image/png' | 'image/webp';
  const encoded = match[2];
  if (encoded.length % 4 === 1) throw new TryOnResultPersistenceError(jobId);

  const bytes = Buffer.from(encoded, 'base64');
  const canonical = bytes.toString('base64').replace(/=+$/u, '');
  if (
    bytes.length === 0 ||
    bytes.length > RESULT_MAX_BYTES ||
    canonical !== encoded.replace(/=+$/u, '') ||
    !matchesDeclaredImageType(bytes, mime)
  ) {
    throw new TryOnResultPersistenceError(jobId);
  }

  return {
    bytes,
    mime,
    extension: mime === 'image/jpeg' ? 'jpg' : mime.slice('image/'.length) as 'png' | 'webp',
  };
}

function matchesDeclaredImageType(
  bytes: Buffer,
  mime: 'image/jpeg' | 'image/png' | 'image/webp',
): boolean {
  if (mime === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  return (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

function durableRowMatchesJob(
  row: DurableTryOnResultRow,
  job: TryOnJob,
  normalizedShop: string,
): boolean {
  return (
    row.session_id === job.sessionId &&
    row.product_id === job.productId &&
    normalizeShopDomain(row.shop) === normalizedShop &&
    row.request_key === job.requestKey
  );
}

async function selectDurableResultRow(
  jobId: string,
): Promise<DurableTryOnResultRow | null> {
  const client = requireServiceClient(jobId);
  const { data, error } = await client
    .from('tryon_jobs')
    .select(
      'id, session_id, product_id, shop, status, request_key, model_key, provider, cost_usd, message, created_at, result_storage_path, result_persisted_at, result_expires_at, result_deleted_at',
    )
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw persistenceError(jobId, error);
  return (data as DurableTryOnResultRow | null) ?? null;
}

function activeDurableResult(
  row: DurableTryOnResultRow,
  now: number,
): row is DurableTryOnResultRow & {
  result_storage_path: string;
  result_persisted_at: string;
  result_expires_at: string;
} {
  return Boolean(
    row.result_storage_path &&
      RESULT_PATH_RE.test(row.result_storage_path) &&
      row.result_persisted_at &&
      row.result_expires_at &&
      !row.result_deleted_at &&
      Date.parse(row.result_expires_at) > now,
  );
}

async function removeUploadedResult(jobId: string, storagePath: string): Promise<void> {
  const client = requireServiceClient(jobId);
  const { error } = await client.storage.from(RESULT_BUCKET).remove([storagePath]);
  if (error && !isMissingObject(error)) {
    console.error('[try-on] result_storage_cleanup_required', {
      reason: 'row_update_failed_object_cleanup_failed',
      jobId,
    });
  }
}

export async function persistGeneratedTryOnResult(
  job: TryOnJob,
  now: number = Date.now(),
): Promise<DurableTryOnResult> {
  if (job.status !== 'completed' || !job.resultImageUrl || !JOB_ID_RE.test(job.jobId)) {
    throw new TryOnResultPersistenceError(job.jobId);
  }
  const normalizedShop = normalizeShopDomain(job.shop);
  if (!normalizedShop || !job.requestKey) {
    throw new TryOnResultPersistenceError(job.jobId);
  }

  const decoded = decodeResultDataUrl(job.resultImageUrl, job.jobId);
  const storagePath = `jobs/${job.jobId}/result.${decoded.extension}`;
  const existing = await selectDurableResultRow(job.jobId);
  if (existing && !durableRowMatchesJob(existing, job, normalizedShop)) {
    throw new TryOnResultPersistenceError(job.jobId);
  }
  if (existing && activeDurableResult(existing, now)) {
    return {
      storagePath: existing.result_storage_path,
      persistedAt: existing.result_persisted_at,
      expiresAt: existing.result_expires_at,
    };
  }
  if (!existing) throw new TryOnResultPersistenceError(job.jobId);

  const client = requireServiceClient(job.jobId);
  const bucket = client.storage.from(RESULT_BUCKET);
  const upload = await bucket.upload(storagePath, decoded.bytes, {
    contentType: decoded.mime,
    cacheControl: '300',
    upsert: false,
  });
  if (upload.error) {
    const replay = await selectDurableResultRow(job.jobId);
    if (replay && activeDurableResult(replay, now)) {
      return {
        storagePath: replay.result_storage_path,
        persistedAt: replay.result_persisted_at,
        expiresAt: replay.result_expires_at,
      };
    }
    throw persistenceError(job.jobId, upload.error);
  }

  const persistedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + TRYON_RESULT_RETENTION_MS).toISOString();
  const update = await client
    .from('tryon_jobs')
    .update({
      result_storage_path: storagePath,
      result_persisted_at: persistedAt,
      result_expires_at: expiresAt,
      result_deleted_at: null,
    })
    .eq('id', job.jobId)
    .eq('session_id', job.sessionId)
    .eq('product_id', job.productId)
    .eq('shop', normalizedShop)
    .eq('request_key', job.requestKey)
    .is('result_deleted_at', null)
    .select('id')
    .maybeSingle();

  if (update.error || !update.data) {
    await removeUploadedResult(job.jobId, storagePath);
    throw persistenceError(job.jobId, update.error ?? new Error('job result row not found'));
  }

  return { storagePath, persistedAt, expiresAt };
}

export async function loadAuthorizedDurableTryOnJob(
  authorization: VerifiedTryOnSession,
  jobId: string,
  now: number = Date.now(),
): Promise<TryOnJob | null> {
  const row = await selectDurableResultRow(jobId);
  if (!row) return null;

  const rowShop = normalizeShopDomain(row.shop);
  if (
    row.session_id !== authorization.sessionId ||
    row.product_id !== authorization.productId ||
    rowShop !== authorization.shop
  ) {
    return null;
  }

  const baseJob: TryOnJob = {
    jobId: row.id,
    sessionId: row.session_id,
    productId: row.product_id,
    shop: rowShop,
    requestKey: row.request_key ?? undefined,
    modelKey: row.model_key ?? undefined,
    status: row.status as TryOnJob['status'],
    message: row.message ?? undefined,
    createdAt: row.created_at,
    meta: {
      runtime: 'live',
      provider: row.provider ?? row.model_key ?? 'unknown',
      costEstimate: Number(row.cost_usd ?? 0),
    },
  };

  if (activeDurableResult(row, now)) {
    const resultRemainingSeconds = Math.floor(
      (Date.parse(row.result_expires_at) - now) / 1000,
    );
    const sessionRemainingSeconds = authorization.exp - Math.ceil(now / 1000);
    const signedForSeconds = Math.min(
      MAX_SIGNED_URL_SECONDS,
      resultRemainingSeconds,
      sessionRemainingSeconds,
    );
    if (signedForSeconds <= 0) throw new TryOnResultUnavailableError(jobId);

    const client = requireServiceClient(jobId);
    const bucket = client.storage.from(RESULT_BUCKET);
    // Check only after the row identity has been authorized. This avoids
    // issuing a capability URL for an orphaned lifecycle row and keeps object
    // existence from becoming a cross-tenant oracle.
    const existence = await bucket.exists(row.result_storage_path);
    if (!existence.data) {
      if (!existence.error || isMissingObject(existence.error)) {
        throw new TryOnResultUnavailableError(jobId);
      }
      throw persistenceError(jobId, existence.error);
    }

    const { data, error } = await bucket.createSignedUrl(
      row.result_storage_path,
      signedForSeconds,
    );
    if (error || !data?.signedUrl) {
      if (error && isMissingObject(error)) throw new TryOnResultUnavailableError(jobId);
      throw persistenceError(jobId, error ?? new Error('signed URL unavailable'));
    }
    return {
      ...baseJob,
      status: 'completed',
      resultImageUrl: data.signedUrl,
      completedAt: row.result_persisted_at,
    };
  }

  if (
    row.status === 'completed' ||
    row.result_storage_path ||
    row.result_persisted_at ||
    row.result_expires_at ||
    row.result_deleted_at
  ) {
    if (
      row.status === 'completed' &&
      !row.result_storage_path &&
      !row.result_persisted_at &&
      !row.result_expires_at &&
      !row.result_deleted_at
    ) {
      console.error('[try-on] reconciliation_required', {
        reason: 'completed_result_missing',
        jobId,
      });
    }
    throw new TryOnResultUnavailableError(jobId);
  }

  return baseJob;
}

export async function cleanupExpiredTryOnResults(
  limit = 50,
  now: number = Date.now(),
): Promise<TryOnResultCleanupSummary> {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const client = requireServiceClient('cleanup');
  const query = await client
    .from('tryon_jobs')
    .select('id, result_storage_path')
    .not('result_storage_path', 'is', null)
    .is('result_deleted_at', null)
    .lte('result_expires_at', new Date(now).toISOString())
    .order('result_expires_at', { ascending: true })
    .limit(boundedLimit);
  if (query.error) throw persistenceError('cleanup', query.error);

  const rows = (query.data ?? []) as Array<{ id: string; result_storage_path: string }>;
  let deleted = 0;
  let failed = 0;
  for (const row of rows) {
    if (!RESULT_PATH_RE.test(row.result_storage_path)) {
      failed += 1;
      continue;
    }

    const removal = await client.storage.from(RESULT_BUCKET).remove([row.result_storage_path]);
    if (removal.error && !isMissingObject(removal.error)) {
      failed += 1;
      continue;
    }

    const update = await client
      .from('tryon_jobs')
      .update({
        result_storage_path: null,
        result_deleted_at: new Date(now).toISOString(),
      })
      .eq('id', row.id)
      .eq('result_storage_path', row.result_storage_path)
      .select('id')
      .maybeSingle();
    if (update.error || !update.data) {
      failed += 1;
      continue;
    }
    deleted += 1;
  }

  return { scanned: rows.length, deleted, failed };
}

type StorageListEntry = {
  name: string;
  id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function storageObjectTimestamp(entry: StorageListEntry): number | null {
  const timestamps = [entry.created_at, entry.updated_at]
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter(Number.isFinite);
  return timestamps.length ? Math.max(...timestamps) : null;
}

/**
 * Finds unreferenced private result objects without relying on a new schema
 * cursor. Work is deliberately bounded; successful deletions expose later
 * backlog to the next scheduled run. A recent upload is always skipped so an
 * upload-to-row-bind race cannot be mistaken for an orphan.
 */
export async function sweepOrphanedTryOnResults(
  limit = TRYON_ORPHAN_SWEEP_LIMIT,
  now: number = Date.now(),
  safetyGraceMs = TRYON_ORPHAN_SAFETY_GRACE_MS,
): Promise<TryOnOrphanSweepSummary> {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const safeGraceMs = Math.max(TRYON_ORPHAN_SAFETY_GRACE_MS, Math.trunc(safetyGraceMs));
  const client = requireServiceClient('orphan-sweep');
  const bucket = client.storage.from(RESULT_BUCKET);
  const foldersResult = await bucket.list('jobs', {
    limit: boundedLimit,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (foldersResult.error) throw persistenceError('orphan-sweep', foldersResult.error);

  let foldersScanned = 0;
  let objectsScanned = 0;
  let skipped = 0;
  let failed = 0;
  const candidatePaths: string[] = [];

  for (const rawFolder of foldersResult.data ?? []) {
    const folder = rawFolder as StorageListEntry;
    if (candidatePaths.length >= boundedLimit) break;
    if (folder.id !== null || !JOB_ID_RE.test(folder.name)) {
      skipped += 1;
      continue;
    }
    foldersScanned += 1;

    const objectResult = await bucket.list(`jobs/${folder.name}`, {
      limit: 4,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (objectResult.error) {
      failed += 1;
      continue;
    }

    for (const rawObject of objectResult.data ?? []) {
      if (candidatePaths.length >= boundedLimit) break;
      const object = rawObject as StorageListEntry;
      const storagePath = `jobs/${folder.name}/${object.name}`;
      if (object.id === null || !RESULT_PATH_RE.test(storagePath)) {
        skipped += 1;
        continue;
      }
      objectsScanned += 1;

      const objectTime = storageObjectTimestamp(object);
      if (objectTime === null || objectTime > now - safeGraceMs) {
        skipped += 1;
        continue;
      }
      candidatePaths.push(storagePath);
    }
  }

  if (candidatePaths.length === 0) {
    return {
      foldersScanned,
      objectsScanned,
      candidates: 0,
      deleted: 0,
      skipped,
      failed,
    };
  }

  const activeResult = await client
    .from('tryon_jobs')
    .select('result_storage_path')
    .in('result_storage_path', candidatePaths)
    .is('result_deleted_at', null)
    .limit(candidatePaths.length);
  if (activeResult.error) throw persistenceError('orphan-sweep', activeResult.error);

  const activePaths = new Set(
    ((activeResult.data ?? []) as Array<{ result_storage_path: string | null }>)
      .map((row) => row.result_storage_path)
      .filter((path): path is string => typeof path === 'string'),
  );
  let deleted = 0;
  for (const storagePath of candidatePaths) {
    if (activePaths.has(storagePath)) {
      skipped += 1;
      continue;
    }
    const removal = await bucket.remove([storagePath]);
    if (removal.error && !isMissingObject(removal.error)) {
      failed += 1;
      continue;
    }
    deleted += 1;
  }

  return {
    foldersScanned,
    objectsScanned,
    candidates: candidatePaths.length,
    deleted,
    skipped,
    failed,
  };
}

export async function persistTryOnJob(job: TryOnJob, durationMs?: number): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;

  const { error } = await supabase.from('tryon_jobs').insert({
    id: job.jobId,
    session_id: job.sessionId,
    product_id: job.productId,
    shop: normalizeShopDomain(job.shop),
    status: job.status,
    provider: job.meta.provider,
    cost_usd: job.meta.costEstimate,
    duration_ms: durationMs ?? null,
    message: job.message ?? null,
  });

  if (error) {
    console.error('tryon_jobs insert failed:', error.message);
  }
}

export async function beginTryOnJob(input: {
  shop: string;
  jobId: string;
  requestKey: string;
  modelKey: string;
  sessionId: string;
  productId: string;
}): Promise<CreditReservation> {
  return reserveCredit(input);
}

export async function finalizeTryOnJob(job: TryOnJob, durationMs: number): Promise<void> {
  await finalizeCreditJob({
    jobId: job.jobId,
    status: job.status === 'completed' ? 'completed' : 'failed',
    provider: job.meta.provider,
    costUsd: job.meta.costEstimate,
    durationMs,
    message: job.message,
  });
}

export async function getShopEntitlementState(shop: unknown): Promise<ShopEntitlement> {
  return getShopEntitlement(shop);
}

export type TryOnJobRow = {
  id: string;
  product_id: string;
  /** null for demo-page jobs; a myshopify domain for storefront traffic. */
  shop: string | null;
  status: string;
  provider: string | null;
  cost_usd: number | null;
  duration_ms: number | null;
  message: string | null;
  created_at: string;
};

/** shopDomains: the caller's own owned shops (from listManagedTryOnShops).
 *  Empty means "owns nothing yet" -- returns no rows rather than every
 *  tenant's jobs. */
export async function listRecentTryOnJobs(
  shopDomains: readonly string[],
  limit = 20,
): Promise<TryOnJobRow[]> {
  if (shopDomains.length === 0) return [];

  const supabase = getServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('tryon_jobs')
    .select('id, product_id, shop, status, provider, cost_usd, duration_ms, message, created_at')
    .in('shop', shopDomains)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('tryon_jobs select failed:', error.message);
    return [];
  }
  return data ?? [];
}
