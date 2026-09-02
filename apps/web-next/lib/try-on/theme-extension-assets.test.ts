// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, screen, waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const extensionRoot = path.resolve(
  process.cwd(),
  '../grindctrl-tryon/extensions/tryon-block/assets',
);
const productAsset = readFileSync(path.join(extensionRoot, 'tryon.js'), 'utf8');
const catalogAsset = readFileSync(path.join(extensionRoot, 'tryon-catalog.js'), 'utf8');

describe('Shopify Try-On extension failure transport', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows a localized accessible product-page failure and retries proof minting', async () => {
    document.body.innerHTML = `
      <div class="gc-tryon-root"
        data-product="premium-ringer-tee"
        data-title="Premium tee"
        data-garment="//cdn.shopify.com/s/files/garment.png"
        data-variant="123"
        data-shop="demo.myshopify.com"
        data-locale="ar">
        <button type="button" class="gc-tryon-btn">
          <span class="gc-tryon-label">جرّبه</span>
        </button>
      </div>`;
    let contextRequests = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/apps/grindctrl/config')) {
        return new Response('{}', { status: 503 });
      }
      contextRequests += 1;
      return new Response('{}', { status: 401 });
    }));

    window.eval(productAsset);
    fireEvent.click(document.querySelector('.gc-tryon-btn')!);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('تعذّر التحقق من تجربة هذا المنتج');
    const retry = screen.getByRole('button', { name: 'إعادة محاولة التجربة' });
    fireEvent.click(retry);
    await waitFor(() => expect(contextRequests).toBe(2));
  });

  it('keeps catalog errors localized, assertive, retryable, and refresh-aware', () => {
    expect(catalogAsset).toContain("unavailable: 'Try-on could not be verified for this product.'");
    expect(catalogAsset).toContain("unavailable: 'تعذّر التحقق من تجربة هذا المنتج.'");
    expect(catalogAsset).toContain("loading.setAttribute('role', 'alert')");
    expect(catalogAsset).toContain("retry.className = 'gc-cat-retry'");
    expect(catalogAsset).toContain("data.type === 'grindctrl-tryon:refresh'");
    expect(catalogAsset).not.toContain("loading.textContent = 'Try-on is unavailable.'");
  });
});
