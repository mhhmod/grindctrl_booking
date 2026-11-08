export type PastePlatform = 'website' | 'shopify';

export type PasteErrorCode =
  | 'forbidden' | 'unavailable' | 'schema_not_ready' | 'rate_limited'
  | 'invalid_domain' | 'limit_reached' | 'not_found' | 'proof_required'
  | 'proof_failed' | 'invalid_platform' | 'connection_conflict';

export type PasteResult<T> = { ok: true; data: T } | { ok: false; code: PasteErrorCode; retryAfterSeconds?: number };

export class PasteError extends Error {
  constructor(readonly code: PasteErrorCode) { super(code); this.name = 'PasteError'; }
}

export type PasteDomain = {
  id: string;
  domain: string;
  state: 'trusted' | 'claimed' | 'disputed';
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
};
export type PasteContextResult = PasteContextResponse | PasteContextFailure;
