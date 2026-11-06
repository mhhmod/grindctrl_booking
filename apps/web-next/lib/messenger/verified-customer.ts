import 'server-only';

import { isActiveShopifyInstallation } from '@/lib/shopify/tokens';
import { isWooIdentityToken, verifyWooIdentityToken } from '@/lib/woo/identity-token';
import { verifyShopperTokenAnyApp } from './identity';
import type { OrderProviderPlatform } from './order-provider';
import type { ConversationRecord } from './types';

/* Whether this request proves the shopper is the customer the conversation is
   bound to. A saved identity binds a conversation but never extends a proof on
   its own for WooCommerce (the plugin's token lives ten minutes), so a Woo
   lookup needs a fresh token in the request. A token only confirms the
   customer already bound to the conversation, or binds an anonymous one; a
   token for someone else means the browser changed hands and is refused.
   Shared by the chat turn and the order lookup route so the two cannot
   drift. */

export interface VerifiedCustomer {
  verified: boolean;
  appClientId?: string;
  name: string | null;
}

export async function resolveVerifiedCustomer(input: {
  site: { id: string; domain?: string | null };
  conversation: Pick<ConversationRecord, 'metadata'>;
  wooPaired: boolean;
  shopperToken: string | null;
  anonymousId: string;
}): Promise<VerifiedCustomer> {
  const { site, conversation, shopperToken, anonymousId } = input;
  const identity = conversation.metadata.identity;
  let name = identity?.name ?? null;
  let appClientId = identity?.app_client_id;
  let verified = input.wooPaired
    ? false
    : Boolean(identity?.verified && appClientId && site.domain && (await isActiveShopifyInstallation(site.domain, appClientId)));

  if (shopperToken && isWooIdentityToken(shopperToken)) {
    const claims = input.wooPaired ? await verifyWooIdentityToken(shopperToken, { siteId: site.id, sid: anonymousId }) : null;
    const bound = identity?.woo_customer_id ?? null;
    if (claims && (!bound || bound === claims.wpUserId)) verified = true;
  } else if (shopperToken) {
    const claims = verifyShopperTokenAnyApp(shopperToken, anonymousId, site.domain);
    const bound = identity?.customer_id ?? null;
    if (
      claims?.customerId &&
      claims.appClientId &&
      site.domain &&
      (!bound || bound === claims.customerId) &&
      (await isActiveShopifyInstallation(site.domain, claims.appClientId))
    ) {
      appClientId = claims.appClientId;
      verified = true;
      name = claims.name ?? name;
    }
  }
  return { verified, appClientId, name };
}

/** The customer id the conversation is bound to, for the platform's provider. */
export function boundCustomerId(
  conversation: Pick<ConversationRecord, 'metadata'>,
  platform: OrderProviderPlatform,
): string | null {
  const identity = conversation.metadata.identity;
  return (platform === 'woocommerce' ? identity?.woo_customer_id : identity?.customer_id) ?? null;
}
