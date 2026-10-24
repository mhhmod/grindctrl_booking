import { expect, test } from '@playwright/test';
test.skip(process.env.GC_SHOPIFY_MULTI_APP_TEST !== '1', 'Requires the dedicated local synthetic-registration configuration.');

/* Run against a LOCAL build with two synthetic Shopify registrations named
 * app-a and app-b. The browser blocks all external network and stubs App Bridge;
 * this proves routing/DOM behavior, not a real Shopify install or auth flow. */
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
    if (url.href === 'https://cdn.shopify.com/shopifycloud/app-bridge.js') {
      return route.fulfill({ contentType: 'text/javascript', body: 'window.shopify={idToken:async()=>"invalid-local-test-token"};' });
    }
    return route.abort();
  });
});
for (const app of ['app-a','app-b']) {
  test(`initializes the configured registration ${app}`, async ({ page }) => {
    await page.goto(`/shopify/app/${app}`);
    await expect(page.locator('meta[name="shopify-api-key"]')).toHaveAttribute('content',app);
    await expect(page.getByRole('navigation',{name:'GRINDCTRL sections'})).toBeVisible();
  });
}
test('refuses to guess the first app on the ambiguous original URL', async ({ page }) => {
  await page.goto('/shopify/app');
  await expect(page.locator('meta[name="shopify-api-key"]')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('configured Shopify app');
});
test('rejects an unknown registration', async ({ page }) => {
  await page.goto('/shopify/app/unknown');
  await expect(page.locator('meta[name="shopify-api-key"]')).toHaveCount(0);
});
