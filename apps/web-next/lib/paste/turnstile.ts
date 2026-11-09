import 'server-only';
import { createHash } from 'node:crypto';
import type { VerifiedTryOnSession } from '@/lib/try-on/storefront-context';

export const PASTE_TURNSTILE_ACTION = 'paste_tryon' as const;
export type TurnstileResult = { ok: true } | { ok: false; code: 'turnstile_not_configured' | 'turnstile_required' | 'turnstile_failed' | 'turnstile_unavailable' };

/** Read per request: a NEXT_PUBLIC_* value is inlined at build time, so the
 *  runtime TURNSTILE_SITE_KEY wins and the public name is only a fallback. */
export function pasteTurnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY?.trim() || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}

/** Available to the embed's future UI; the secret is never returned. */
export function pasteTurnstileConfig() {
  return { siteKey: pasteTurnstileSiteKey(), action: PASTE_TURNSTILE_ACTION };
}

/** Per-generation-attempt binding. Render Turnstile with this cData in our
 * /embed/try-on iframe. Single-use tokens cannot move to another look. */
export function pasteTurnstileBinding(authorization: Pick<VerifiedTryOnSession, 'shop' | 'requestKey'>): string {
  return createHash('sha256').update(`paste-look-v1:${authorization.shop}:${authorization.requestKey}`).digest('hex');
}

/** Every paid look on a pasted install, website or Shopify: a pasted
 *  Shopify render is public HTML that anyone can replay, so its signature
 *  alone does not show a person asked for the look. The Shopify app (no
 *  platform claim) and the owner's signed test looks are exempt. */
export function pasteTurnstileRequired(authorization: Pick<VerifiedTryOnSession, 'platform' | 'test'>): boolean {
  return (authorization.platform === 'paste-website' || authorization.platform === 'paste-shopify') && authorization.test !== true;
}

export async function verifyPasteTurnstile(input: {
  token: unknown; authorization: VerifiedTryOnSession; remoteIp?: string | null;
}, fetcher: typeof fetch = fetch): Promise<TurnstileResult> {
  if (!pasteTurnstileRequired(input.authorization)) return { ok: true };
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return { ok: false, code: 'turnstile_not_configured' };
  if (typeof input.token !== 'string' || !input.token || input.token.length > 2048) return { ok: false, code: 'turnstile_required' };
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: input.token,
        idempotency_key: input.authorization.requestKey,
        ...(input.remoteIp ? { remoteip: input.remoteIp } : {}) }),
    });
    if (!response.ok) return { ok: false, code: 'turnstile_unavailable' };
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') return { ok: false, code: 'turnstile_failed' };
    const result = data as Record<string, unknown>;
    const appHost = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://grindctrl.cloud').hostname;
    // No test-key bypass in application code. Mocks return the documented
    // shape with our hostname, action and per-attempt cData.
    if (result.success !== true || result.hostname !== appHost || result.action !== PASTE_TURNSTILE_ACTION
      || result.cdata !== pasteTurnstileBinding(input.authorization)) return { ok: false, code: 'turnstile_failed' };
    return { ok: true };
  } catch { return { ok: false, code: 'turnstile_unavailable' }; }
}
