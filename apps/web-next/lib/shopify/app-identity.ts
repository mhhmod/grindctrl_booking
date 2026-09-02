/* The app's Shopify client id. Public by design — it appears in the OAuth
   authorize URL and in theme-editor deep links — so unlike the API secret it
   is safe in a client bundle.

   It lives here rather than in lib/shopify/session-token.ts because that
   module is `server-only`: importing it from a client component to build a
   deep link would break the build. admin-settings.tsx had already worked
   around that with its own local copy, so this is the shared source both
   client surfaces use instead of a third literal drifting out of sync.

   session-token.ts deliberately keeps its own constant: there it is an
   authentication parameter (the expected `aud`), and coupling an auth check to
   a UI constant would let a presentation-layer edit change what verifies. */

export const SHOPIFY_APP_CLIENT_ID = 'fc095fe656d9029fdc249a4af2315f19';

/** Theme-editor deep link that opens the current theme's App embeds panel with
 *  one of this app's blocks pre-selected. `blockHandle` is the block's file
 *  name under extensions/tryon-block/blocks (e.g. `messenger`). */
export function appEmbedActivationUrl(shopDomain: string, blockHandle: string): string {
  return `https://${shopDomain}/admin/themes/current/editor?context=apps&activateAppId=${SHOPIFY_APP_CLIENT_ID}/${blockHandle}`;
}
