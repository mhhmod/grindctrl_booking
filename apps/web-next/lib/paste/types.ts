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
  status: 'active' | 'disconnected';
  secret_version: number;
  previous_secret_version: number | null;
  previous_valid_until: string | null;
};

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
    | 'preview' | 'holdout' | 'garment_unsafe' | 'out_of_looks' | 'paused' | 'not_installed' | 'plan_inactive';
};
export type PasteContextResult = PasteContextResponse | PasteContextFailure;
