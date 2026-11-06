import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BRAND_COLORS, SallaLogo, ShopifyLogo, WooCommerceLogo, ZidLogo } from './brand-marks';

describe('platform colour logos', () => {
  it('are hidden from assistive tech by default and named only when given a title', () => {
    const { container } = render(
      <>
        <ShopifyLogo />
        <WooCommerceLogo />
        <SallaLogo />
        <ZidLogo title="Zid" />
      </>,
    );
    const [shopify, woo, salla, zid] = Array.from(container.querySelectorAll('svg'));
    for (const el of [shopify, woo, salla]) expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(zid).toHaveAttribute('role', 'img');
    expect(zid).toHaveAttribute('aria-label', 'Zid');
    expect(zid).not.toHaveAttribute('aria-hidden');
  });

  it('use official colours and keep Woo at its wide aspect ratio', () => {
    const { container } = render(
      <>
        <ShopifyLogo />
        <WooCommerceLogo size={16} />
      </>,
    );
    const [shopify, woo] = Array.from(container.querySelectorAll('svg'));
    expect(shopify).toHaveAttribute('fill', BRAND_COLORS.shopify);
    expect(woo).toHaveAttribute('fill', BRAND_COLORS.woo);
    expect(Number(woo.getAttribute('width'))).toBeGreaterThan(Number(woo.getAttribute('height')) * 3);
  });
});
