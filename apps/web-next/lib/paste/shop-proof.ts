import 'server-only';
import { pasteShopCheckShopRatelimit, pasteShopCheckSiteRatelimit } from '@/lib/ratelimit';
import { requireRateLimit, RequestRateLimitError } from '@/lib/request-rate-limit';
import { scheduleStoreConnectedEmail } from '@/lib/email/store-connected-sender';
import { beginPasteShopCheck, finishPasteShopCheck, provePasteShop, recordPasteShopRender, releasePasteShopCheck } from './store';
import { recordedStorefrontEvidence, scanShopStorefront, type StorefrontEvidence } from './storefront-scan';
import { PasteError, type PasteConnection, type PasteShopCheckOutcome, type PasteShopProof } from './types';

/* Proving a pending Shopify paste shop takes two factors:
   1. Our server fetched the shop's own storefront and found this site's
      snippet there, signed for this site and shop (storefront-scan.ts):
      proof of theme control.
   2. A signed render for this site arrived from the storefront through
      /api/try-on/paste-context within the last day (shop_render_at): the
      code really runs there.
   prove_paste_shop requires both, then displaces every other claim. A
   check runs from a verified render (passively) or from the owner's
   "Check my store" action, which may carry the storefront password. */

/** A failed check is reused instead of fetching again for this long. */
export const SHOP_CHECK_RETRY_SECONDS = { render: 120, owner: 30 } as const;
/** How long a caller should wait while another check holds the lease. */
const BUSY_RETRY_SECONDS = 10;
const STOREFRONT_PASSWORD_MAX_LENGTH = 256;

export type ShopCheckTrigger = { kind: 'render' } | { kind: 'owner'; password?: string };

function pending(outcome: PasteShopProof['outcome'], checkedAt: string | null, retryAfterSeconds: number | null): PasteShopProof {
  return { shopProof: 'pending', shopProvenAt: null, outcome, checkedAt, retryAfterSeconds };
}

/** The stored outcome of the last failed check, while it is still reused. */
export function cachedShopCheck(connection: PasteConnection, ttlSeconds: number, nowMs: number): PasteShopProof | null {
  const outcome = connection.shop_check_outcome;
  const at = connection.shop_checked_at ? Date.parse(connection.shop_checked_at) : NaN;
  if (!outcome || outcome === 'proven' || outcome === 'awaiting_visit' || !Number.isFinite(at)) return null;
  const remaining = Math.ceil(ttlSeconds - (nowMs - at) / 1000);
  return remaining > 0 ? pending(outcome, connection.shop_checked_at, Math.min(remaining, ttlSeconds)) : null;
}

/** Outcomes of a check that could not look at the storefront at all. They
 *  say nothing about the code, so they never replace an unexpired finding. */
const COULD_NOT_LOOK: ReadonlySet<PasteShopProof['outcome']> = new Set(['password_required', 'password_rejected', 'unreachable', 'rate_limited']);

/** The stored finding, unchanged, when `outcome` could not look and the
 *  finding has not expired; otherwise null. Its time stays the time our
 *  server saw the code, so this never extends its life. */
function keptFinding(connection: PasteConnection, outcome: PasteShopProof['outcome'], now: Date,
  retryAfterSeconds: number | null): PasteShopProof | null {
  return COULD_NOT_LOOK.has(outcome) && recordedStorefrontEvidence(connection, now.getTime())
    ? pending('awaiting_visit', connection.shop_checked_at, retryAfterSeconds) : null;
}

async function prove(connection: PasteConnection, evidence: StorefrontEvidence, now: Date,
  storefront?: PasteShopProof['storefront']): Promise<PasteShopProof> {
  const result = await provePasteShop(connection, evidence);
  if (result === 'shopify_app_installed') throw new PasteError('connection_conflict');
  if (result === 'not_pending') throw new PasteError('not_found');
  if (result === 'render_required') {
    // The code is on the storefront, but no signed render came from it yet.
    await finishPasteShopCheck(connection, 'awaiting_visit');
    return { ...pending('awaiting_visit', now.toISOString(), null), ...(storefront ? { storefront } : {}) };
  }
  scheduleStoreConnectedEmail(connection.widget_site_id, { path: 'shopify_paste', host: connection.shop_domain ?? '' });
  return { shopProof: 'proven', shopProvenAt: now.toISOString(), outcome: 'proven', checkedAt: now.toISOString(), retryAfterSeconds: null,
    ...(storefront ? { storefront } : {}) };
}

function log(connection: PasteConnection, trigger: ShopCheckTrigger, outcome: PasteShopProof['outcome'], failure?: string) {
  // Never the password, the page or the URL: site, trigger and outcome only.
  console.info('[paste] storefront check', {
    code: 'paste_shop_check', site: connection.widget_site_id, trigger: trigger.kind, outcome, ...(failure ? { failure } : {}),
  });
}

/** Runs (or reuses) the storefront proof for a pending Shopify paste shop.
 *  A render trigger must come only from the context route after
 *  verifyLiquidSignature accepted a render for this connection.
 *  Throws PasteError: not_found (not a pending/proven Shopify connection,
 *  or displaced meanwhile), connection_conflict (the Shopify app holds the
 *  shop), unavailable (database, Redis or signing configuration). */
export async function checkPasteShop(connection: PasteConnection | null, trigger: ShopCheckTrigger,
  options: { scan?: typeof scanShopStorefront; now?: Date } = {}): Promise<PasteShopProof> {
  if (!connection || connection.platform !== 'shopify' || !connection.shop_domain || connection.status === 'disconnected') {
    throw new PasteError('not_found');
  }
  if (connection.app_installed) throw new PasteError('connection_conflict');
  if (connection.status === 'active' && connection.shop_proven_at) {
    return { shopProof: 'proven', shopProvenAt: connection.shop_proven_at, outcome: 'proven',
      checkedAt: connection.shop_checked_at ?? connection.shop_proven_at, retryAfterSeconds: null };
  }
  const now = options.now ?? new Date();
  const password = trigger.kind === 'owner' && trigger.password ? trigger.password : undefined;

  if (trigger.kind === 'render') {
    const render = await recordPasteShopRender(connection);
    if (render === 'shopify_app_installed') throw new PasteError('connection_conflict');
    if (render === 'not_pending') throw new PasteError('not_found');
    // A recent check already found the code (perhaps behind the password):
    // this render was the missing factor.
    const recorded = recordedStorefrontEvidence(connection, now.getTime());
    if (recorded) {
      const result = await prove(connection, recorded, now);
      log(connection, trigger, result.outcome);
      return result;
    }
  }

  // No storefront password is this long: refuse it without sending it.
  if (password && password.length > STOREFRONT_PASSWORD_MAX_LENGTH) return pending('password_rejected', now.toISOString(), null);
  // A password is new input, so it may retry a failed check at once.
  const cached = password ? null : cachedShopCheck(connection, SHOP_CHECK_RETRY_SECONDS[trigger.kind], now.getTime());
  if (cached) return cached;

  try {
    await requireRateLimit(pasteShopCheckSiteRatelimit, `paste-shop-check:site:${connection.widget_site_id}`);
    await requireRateLimit(pasteShopCheckShopRatelimit, `paste-shop-check:shop:${connection.shop_domain}`);
  } catch (error) {
    if (error instanceof RequestRateLimitError && error.status === 429) {
      log(connection, trigger, 'rate_limited');
      return keptFinding(connection, 'rate_limited', now, error.retryAfterSeconds) ?? pending('rate_limited', null, error.retryAfterSeconds);
    }
    throw new PasteError('unavailable');
  }

  const lease = await beginPasteShopCheck(connection);
  if (lease === 'shopify_app_installed') throw new PasteError('connection_conflict');
  if (lease === 'not_pending') throw new PasteError('not_found');
  if (lease === 'busy') return keptFinding(connection, 'rate_limited', now, BUSY_RETRY_SECONDS) ?? pending('rate_limited', null, BUSY_RETRY_SECONDS);

  let scan: Awaited<ReturnType<typeof scanShopStorefront>>;
  try {
    scan = await (options.scan ?? scanShopStorefront)(connection, { password, nowSeconds: Math.floor(now.getTime() / 1000) });
  } catch (error) {
    // Our own signing configuration failed, not the store: record nothing
    // and let the 30 second lease lapse.
    throw error instanceof PasteError ? error : new PasteError('unavailable');
  }
  if (scan.outcome === 'found') {
    const result = await prove(connection, scan.evidence, now, { productUrl: scan.productUrl, passwordPage: scan.passwordPage });
    log(connection, trigger, result.outcome);
    return result;
  }
  const outcome: Exclude<PasteShopCheckOutcome, 'proven'> = scan.outcome;
  // Asked again without the password (or the store did not answer): the
  // code our server already saw is still there as far as anyone knows.
  const kept = keptFinding(connection, outcome, now, null);
  if (kept) {
    await releasePasteShopCheck(connection);
    log(connection, trigger, outcome, scan.failure);
    return kept;
  }
  await finishPasteShopCheck(connection, outcome);
  log(connection, trigger, outcome, scan.failure);
  return pending(outcome, now.toISOString(), SHOP_CHECK_RETRY_SECONDS[trigger.kind]);
}
