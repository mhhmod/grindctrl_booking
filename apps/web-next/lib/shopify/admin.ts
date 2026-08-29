import 'server-only';

/* Shopify Admin GraphQL client. Read-only by construction: nothing in this
   codebase calls it with a mutation, and the app requests no write scopes
   for orders. Version is pinned to the one shopify.app.toml declares for
   webhooks, so the two never drift apart. */

export const SHOPIFY_ADMIN_API_VERSION = '2026-10';

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
  const url = `https://${input.shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;
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
      cache: 'no-store',
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
