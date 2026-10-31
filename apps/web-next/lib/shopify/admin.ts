import 'server-only';
import { getAppUrl } from '../env';
import { normalizeShopDomain } from './shop-authorization';
import { retireRejectedShopToken } from './tokens';

/* Shopify Admin GraphQL client. The app requests no write scopes for
   orders; app-data metafields need no additional scope. Version is pinned
   to the one shopify.app.toml declares for webhooks. */

export const SHOPIFY_ADMIN_API_VERSION = '2026-07';

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RETRY_DELAY_MS = 3_000;

export class ShopifyAdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ShopifyAdminError';
  }
}

function retryDelayMs(response: Response): number {
  // Shopify sends Retry-After in seconds on 429. Honour it, but never sleep
  // longer than a support chat can wait for an answer.
  const header = Number(response.headers.get('retry-after'));
  const suggested = Number.isFinite(header) && header > 0 ? header * 1000 : 500;
  return Math.min(suggested, MAX_RETRY_DELAY_MS);
}

export async function adminGraphql<T>(input: {
  shopDomain: string;
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const shop = normalizeShopDomain(input.shopDomain);
  if (!shop) throw new ShopifyAdminError('Invalid shop', 400);
  const url = `https://${shop}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;
  const body = JSON.stringify({ query: input.query, variables: input.variables ?? {} });

  let lastStatus = 0;
  // One retry, and only for the two conditions retrying can fix.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Shopify-Access-Token': input.accessToken,
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store', redirect: 'error',
    });

    if (response.status === 429 || response.status >= 500) {
      lastStatus = response.status;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(response)));
        continue;
      }
      throw new ShopifyAdminError(`Shopify Admin API returned ${response.status}`, response.status);
    }

    if (!response.ok) {
      if (response.status === 401) await retireRejectedShopToken(shop, input.accessToken).catch(() => {});
      // 401/403 here means the merchant revoked access or the scope is gone.
      throw new ShopifyAdminError(`Shopify Admin API returned ${response.status}`, response.status);
    }

    const payload = (await response.json()) as { data?: T; errors?: Array<{ message?: string }> };
    if (payload.errors?.length) {
      throw new ShopifyAdminError(payload.errors[0]?.message ?? 'GraphQL error', 200);
    }
    if (!payload.data) throw new ShopifyAdminError('Shopify Admin API returned no data', 200);
    return payload.data;
  }
  throw new ShopifyAdminError(`Shopify Admin API returned ${lastStatus}`, lastStatus);
}

export async function syncShopifyAppOrigin(shopDomain: string, accessToken: string): Promise<void> {
  let stage = 'configuration';
  try {
    // Use this deployment's configured public URL, never request headers.
    const url = new URL(getAppUrl());
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid app origin');
    stage = 'installation_lookup';
    const data = await adminGraphql<{
      currentAppInstallation: { id: string; metafield: { value: string } | null } | null;
    }>({
      shopDomain, accessToken,
      query: '{ currentAppInstallation { id metafield(namespace: "grindctrl", key: "app_origin") { value } } }',
    });
    const installation = data.currentAppInstallation;
    if (!installation?.id) throw new Error('Missing app installation');
    if (installation.metafield?.value === url.origin) return;

    stage = 'metafield_write';
    const result = await adminGraphql<{
      metafieldsSet: { metafields: Array<{ id: string }> | null; userErrors: Array<{ message: string }> } | null;
    }>({
      shopDomain, accessToken,
      query: `mutation SetAppOrigin($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) { metafields { id } userErrors { message } }
      }`,
      variables: { metafields: [{
        ownerId: installation.id, namespace: 'grindctrl', key: 'app_origin', type: 'url', value: url.origin,
      }] },
    });
    if (result.metafieldsSet?.userErrors?.length || !result.metafieldsSet?.metafields?.[0]?.id) {
      throw new Error('App origin write failed');
    }
  } catch {
    console.warn('[shopify] app origin sync failed', { shopDomain, stage });
  }
}
