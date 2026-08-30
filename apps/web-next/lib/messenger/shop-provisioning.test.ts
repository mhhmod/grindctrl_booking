// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureMessengerSite = vi.hoisted(() => vi.fn());
vi.mock('./provisioning', () => ({ ensureMessengerSite }));

import { ensureShopOwnedSite } from './shop-provisioning';

beforeEach(() => {
  ensureMessengerSite.mockReset();
  ensureMessengerSite.mockResolvedValue({ id: 's-1' });
});

describe('ensureShopOwnedSite', () => {
  it('provisions under a synthetic profile so no signup is needed', async () => {
    await ensureShopOwnedSite('Demo.MyShopify.com');

    // Namespaced so it can never collide with a Clerk id, canonicalised
    // because the DB constraint rejects anything else, and the domain
    // doubles as the display name because the merchant never typed one.
    expect(ensureMessengerSite).toHaveBeenCalledWith(
      'shop:demo.myshopify.com',
      'demo.myshopify.com',
      'demo.myshopify.com',
    );
  });

  it('accepts a shop domain with surrounding whitespace', async () => {
    await ensureShopOwnedSite('  demo.myshopify.com  ');
    expect(ensureMessengerSite).toHaveBeenCalledWith(
      'shop:demo.myshopify.com',
      'demo.myshopify.com',
      'demo.myshopify.com',
    );
  });

  it('returns whatever ensureMessengerSite resolved', async () => {
    ensureMessengerSite.mockResolvedValue({ id: 's-42' });
    await expect(ensureShopOwnedSite('demo.myshopify.com')).resolves.toEqual({ id: 's-42' });
  });

  it('refuses anything that is not a myshopify domain, without touching the database', async () => {
    /* The caller derives this from a verified Shopify session token, but this
       is the boundary that decides which row gets written — and a bad value
       here provisions a tenant for a store that does not exist. */
    for (const bad of ['evil.example.com', 'demo.myshopify.com.evil.com', '', '   ', 'myshopify.com', 'store-.myshopify.com']) {
      await expect(ensureShopOwnedSite(bad)).rejects.toThrow(/Refusing to provision/);
    }
    expect(ensureMessengerSite).not.toHaveBeenCalled();
  });
});
