/* Browser-only handoff for the short-lived storefront capability.
 * instrumentation-client calls this before analytics initialization so the
 * bearer token and nonce are removed from the visible URL/history before any
 * vendor can snapshot location.href. The proof remains only in module memory
 * until React exchanges it for the longer-lived signed session. */

const NONCE_RE = /^[A-Za-z0-9_-]{22,128}$/;
const MAX_CONTEXT_LENGTH = 4096;

export type StorefrontProof = { token: string; nonce: string };

let pendingProof: StorefrontProof | null = null;

export function bootstrapStorefrontProof(): StorefrontProof | null {
  if (typeof window === 'undefined') return null;

  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = fragment.get('storefrontContext') ?? '';
  const nonce = fragment.get('storefrontNonce') ?? '';
  const carriedSensitiveMaterial =
    fragment.has('storefrontContext') || fragment.has('storefrontNonce');

  if (carriedSensitiveMaterial) {
    fragment.delete('storefrontContext');
    fragment.delete('storefrontNonce');
    const remaining = fragment.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}${remaining ? `#${remaining}` : ''}`,
    );
  }

  if (
    token.length > 0 &&
    token.length <= MAX_CONTEXT_LENGTH &&
    NONCE_RE.test(nonce)
  ) {
    pendingProof = { token, nonce };
  }
  return pendingProof;
}

export function getPendingStorefrontProof(): StorefrontProof | null {
  return pendingProof;
}

export function clearPendingStorefrontProof(): void {
  pendingProof = null;
}

export function resetStorefrontProofForTests(): void {
  pendingProof = null;
}
