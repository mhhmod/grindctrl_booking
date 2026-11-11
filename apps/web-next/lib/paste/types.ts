export type PastePlatform = 'website' | 'shopify';

/** The current pasted Shopify snippet (`data-gc-v`). 1 is the code without
 *  the attribute (product page only); 2 adds signed product cards for the
 *  collection pill. Website code has no version: it never changed. */
export const PASTE_SHOPIFY_CODE_VERSION = 2;
/** Most product cards one Liquid render signs. */
export const PASTE_CARD_LIMIT = 50;

export type PasteErrorCode =
  | 'forbidden' | 'unavailable' | 'schema_not_ready' | 'rate_limited'
  | 'invalid_domain' | 'limit_reached' | 'not_found' | 'proof_required'
  | 'proof_failed' | 'invalid_platform' | 'connection_conflict';

export type PasteResult<T> = { ok: true; data: T } | { ok: false; code: PasteErrorCode; retryAfterSeconds?: number };

export class PasteError extends Error {
  constructor(readonly code: PasteErrorCode) { super(code); this.name = 'PasteError'; }
}

/** What our server's last check of a domain's home page found.
 *  `verified`: this site's snippet (messenger.js with its embed key) is on it,
 *    or the DNS/meta proof passed. Try-On and the free plan need this.
 *  `not_found`: the page loaded without our code (not pasted or not saved yet,
 *    or added by a tag manager after the page loads).
 *  `wrong_site`: the page carries another GRINDCTRL site's code.
 *  `unreachable`: the home page did not answer with a page we can read
 *    (timeout, error status, bot challenge, redirect to another host). */
export type PasteDomainCheckOutcome = 'verified' | 'not_found' | 'wrong_site' | 'unreachable';

/** Data for the dashboard's copy, not the copy itself.
 *  `awaiting_code`: no check has found the code yet; we confirm by ourselves
 *    once the code is live ("We'll confirm automatically once your code is live").
 *  `code_not_found`: the last check loaded the page without the code.
 *  `wrong_site`: the page carries another account's code.
 *  `unreachable`: we could not open the home page (blocked, error, redirect).
 *  `held_elsewhere`: another account uses this address; finding this site's
 *    code on it moves it here.
 *  `proven_elsewhere`: another account proved this address after this one. */
export type PasteDomainVerificationReason =
  | 'awaiting_code' | 'code_not_found' | 'wrong_site' | 'unreachable' | 'held_elsewhere' | 'proven_elsewhere';

export type PasteDomain = {
  id: string;
  domain: string;
  /** `trusted`: Store Chat may load here now. `claimed`: another site holds
   *  the host until this site's snippet (or DNS/meta proof) moves it here. */
  state: 'trusted' | 'claimed' | 'disputed';
  /** Our server confirmed this site's code on this domain. Trusted but not
   *  verified: chat loads, Try-On and the free looks wait for the check. */
  domainVerified: boolean;
  verifiedAt: string | null;
  /** Why the domain is not verified yet, for the dashboard; null once it is. */
  verificationReason: PasteDomainVerificationReason | null;
  /** The last check of this domain; null before the first one. */
  check: { outcome: PasteDomainCheckOutcome; checkedAt: string } | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  proof: { txtName: string; txtValue: string; meta: { name: 'grindctrl-verification'; content: string } };
};

export type PasteConnection = {
  widget_site_id: string;
  platform: PastePlatform;
  shop_domain: string | null;
  /** Shopify starts `pending` until a signed render proves the shop. */
  status: 'pending' | 'active' | 'disconnected';
  secret_version: number;
  previous_secret_version: number | null;
  previous_valid_until: string | null;
  /** Signals on the signed Shopify shop host, which is trusted through this
   *  connection rather than a widget_domains row. Always null for websites. */
  first_seen_at: string | null;
  last_seen_at: string | null;
  /** When the storefront proof (our fetch found this site's signed snippet
   *  on the shop, plus a signed render) made this site the shop's holder. */
  shop_proven_at: string | null;
  /** Pending Shopify only: the last verified signed render (second factor). */
  shop_render_at: string | null;
  /** The last storefront check our server ran for this connection. */
  shop_check_outcome: PasteShopCheckOutcome | null;
  shop_checked_at: string | null;
  /** `displaced`: another site proved the same shop after this one. */
  disconnected_reason: 'displaced' | null;
  /** Read live from shopify_installations, never stored: the app wins the shop. */
  app_installed: boolean;
};

/** What our server's last storefront fetch for a pending Shopify shop found.
 *  `proven`: this site's snippet is on the storefront and a signed render
 *    arrived, so this site holds the shop.
 *  `awaiting_visit`: this site's snippet is on the storefront, but no signed
 *    render arrived from it in the last day: open any product page.
 *  `not_found`: the storefront does not show our code yet.
 *  `outdated_code`: it shows this site's code, but signed with a retired
 *    secret (the snippet was rotated) or for another shop: paste it again.
 *  `wrong_site`: it shows another GRINDCTRL site's code, not this one's.
 *  `password_required`: the store is password protected (Shopify's password
 *    page); check again with the storefront password.
 *  `password_rejected`: the supplied storefront password did not open it.
 *  `unreachable`: the storefront did not answer with a page we can check
 *    (timeout, error status, bot challenge, foreign redirect, oversize). */
export type PasteShopCheckOutcome = 'proven' | 'awaiting_visit' | 'not_found' | 'outdated_code' | 'wrong_site'
  | 'password_required' | 'password_rejected' | 'unreachable';

/** The result of a storefront check ("Check my store" or a render). */
export type PasteShopProof = {
  shopProof: 'pending' | 'proven';
  shopProvenAt: string | null;
  /** `rate_limited` is never stored: no check ran this time. */
  outcome: PasteShopCheckOutcome | 'rate_limited';
  /** When the reported outcome was observed; null when rate limited. */
  checkedAt: string | null;
  /** Seconds until another check can run; null when one can run now. */
  retryAfterSeconds: number | null;
  /** Only from a check that just found the code: a product page the
   *  storefront links to (null when none), and whether the storefront showed
   *  its password page first. Never stored. */
  storefront?: { productUrl: string | null; passwordPage: boolean };
};

/** The result of a domain snippet check ("Check my store" on a website
 *  domain, or the check that runs when a domain is added). */
export type PasteDomainCheck = {
  domain: PasteDomain;
  /** `rate_limited` is never stored: no check ran this time. */
  outcome: PasteDomainCheckOutcome | 'rate_limited';
  /** Seconds until another check can run; null when one can run now. */
  retryAfterSeconds: number | null;
};

/** Why a connection is (not) trusted for origins, signals and Try-On. */
export type PasteTrust = 'trusted' | 'not_connected' | 'shop_proof_pending' | 'shopify_app_installed';

/** Data, not localized UI instructions. Claude's UI chooses the labels. */
export type PasteStep =
  | { kind: 'open'; target: 'shopify_theme_editor' | 'website_html' }
  | { kind: 'select'; target: 'footer' | 'custom_liquid' }
  | { kind: 'paste'; target: 'custom_liquid' | 'before_body_end' }
  | { kind: 'save' }
  | { kind: 'visit'; target: 'product_page' | 'trusted_domain' };

export type PasteSnippet = {
  platform: PastePlatform;
  /** The version this snippet carries (`data-gc-v`); null for website code. */
  codeVersion: number | null;
  snippet: string;
  steps: PasteStep[];
  contextEndpoint: '/api/try-on/paste-context';
};

export type PasteContextRequest = {
  key: string;
  productId: string;
  variantId?: string | null;
  title?: string;
  imageUrl: string;
  pageUrl: string;
  locale?: 'en' | 'ar';
  visitorId: string;
  originToken?: string;
  preview?: string;
  /** Shopify: the snippet's `data-gc-v` (1 when absent). Unsigned; recorded
   *  after the render verifies, as a dashboard hint only. */
  codeVersion?: number;
  signed?: {
    siteId: string; shopDomain: string; productId: string; variantId: string;
    issuedAt: string; customerId: string; signature: string;
  };
};

export type PasteContextResponse = {
  context: { token: string; nonce: string; productId: string; variantId: string | null; expiresAt: string };
  embedUrl: string;
  settings: Record<string, unknown>;
  turnstile: { siteKey: string | null; action: 'paste_tryon' } | null;
};

export type PasteContextFailure = {
  error: 'invalid_request' | 'not_found' | 'paste_not_connected' | 'site_disconnected' | 'origin_not_allowed'
    | 'bad_signature' | 'stale_signature' | 'replayed' | 'rate_limited' | 'unavailable' | 'free_plan_taken'
    /** A pending shop's render verified, but the storefront proof is not complete. */
    | 'shop_proof_pending' | 'shopify_app_installed'
    | 'preview' | 'holdout' | 'garment_unsafe' | 'out_of_looks' | 'paused' | 'not_installed' | 'plan_inactive';
  /** With `garment_unsafe` only. `garment_host_untrusted`: the image is not
   *  on the site's trusted domains nor its detected platform's image servers. */
  reason?: 'garment_host_untrusted' | 'garment_unsafe';
};
export type PasteContextResult = PasteContextResponse | PasteContextFailure;
