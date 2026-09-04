/* What a shopper is allowed to be told when a try-on fails.

   A shopper on a merchant's storefront was shown, verbatim:

     "Insufficient credits. Add more using
      https://openrouter.ai/settings/credits"

   That is our image provider's billing error, forwarded straight through
   `error.message` into the job's `message` field and rendered in the widget.
   It names our vendor, states that our account is out of credit, and links
   to our billing page — to the merchant's customers, on the merchant's
   store. None of that is theirs to see, and none of it is actionable by
   them; the only person who can fix it is us.

   So provider text never reaches a storefront. Errors are classified into a
   small set of outcomes, each with a sentence that says what the shopper
   should do next and nothing about why. The real message keeps flowing to
   logs, Sentry, and the job record the merchant's dashboard reads — those
   are the places where the detail is useful. */

export type TryOnFailureKind =
  /** Our account, our problem: quota, billing, auth with the provider. */
  | 'service_unavailable'
  /** Provider is up but refused this request right now — rate limit, overload. */
  | 'busy'
  /** The photo itself cannot be used. The shopper CAN act on this one. */
  | 'photo_rejected'
  /** Anything we have not classified. */
  | 'unknown';

const BILLING_PATTERNS = [
  /insufficient\s+credit/i,
  /quota/i,
  /billing/i,
  /payment\s+required/i,
  /\b402\b/,
  /api\s*key/i,
  /unauthor/i,
  /forbidden/i,
  /\b40[13]\b/,
];

const BUSY_PATTERNS = [
  /rate[\s_-]?limit/i,
  /too\s+many\s+requests/i,
  /\b429\b/,
  /overload/i,
  /capacity/i,
  /timed?\s*out/i,
  /timeout/i,
  /\b5\d{2}\b/,
];

const PHOTO_PATTERNS = [
  /safety/i,
  /moderat/i,
  /nsfw/i,
  /no\s+(face|person)/i,
  /face\s+not\s+detected/i,
  /unsupported\s+(image|format)/i,
  /image\s+too\s+(large|small)/i,
];

export function classifyTryOnFailure(error: unknown): TryOnFailureKind {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!raw) return 'unknown';
  // Photo first: it is the only kind the shopper can act on, so a message
  // that looks like both should be reported as the actionable one.
  if (PHOTO_PATTERNS.some((re) => re.test(raw))) return 'photo_rejected';
  if (BILLING_PATTERNS.some((re) => re.test(raw))) return 'service_unavailable';
  if (BUSY_PATTERNS.some((re) => re.test(raw))) return 'busy';
  return 'unknown';
}

const EN: Record<TryOnFailureKind, string> = {
  service_unavailable:
    'Try-on is unavailable right now. Please try again later — nothing was charged to you.',
  busy: 'Try-on is busy at the moment. Please try again in a minute.',
  photo_rejected:
    'That photo could not be used. Try a clear, front-facing photo of one person in good light.',
  unknown: 'Try-on could not finish. Please try again.',
};

const AR: Record<TryOnFailureKind, string> = {
  service_unavailable: 'خدمة التجربة غير متاحة حالياً. حاول لاحقاً — لم يُخصم منك شيء.',
  busy: 'خدمة التجربة مزدحمة الآن. حاول بعد دقيقة.',
  photo_rejected:
    'تعذّر استخدام هذه الصورة. جرّب صورة واضحة لشخص واحد من الأمام وبإضاءة جيدة.',
  unknown: 'تعذّر إكمال التجربة. حاول مرة أخرى.',
};

/** The only failure text a storefront is ever given. */
export function toShopperFailureMessage(error: unknown, locale?: string): string {
  const table = locale === 'ar' ? AR : EN;
  return table[classifyTryOnFailure(error)];
}
