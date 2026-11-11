import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/app/dashboard/connect-shop/actions', () => ({ generateShopLinkCode: vi.fn() }));

import { V16NeedsStore, V16NoStore, V16StoreLookupFailed, V16StoreTaken } from './states';
import { getStatesCopy } from '@/lib/dashboard/states-copy';
import { getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';

beforeEach(() => mocks.refresh.mockClear());

describe.each(['en', 'ar'] as const)('the dashboard states in %s', (locale) => {
  const copy = getStatesCopy(locale);
  const connect = getTryOnDashboardCopy(locale);

  it('V16NoStore offers the two real ways in: a Shopify linking code, and Store Chat', () => {
    render(<V16NoStore locale={locale} />);
    expect(screen.getByRole('heading', { name: copy.noStore.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: connect.connectStore })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.noStore.setUpChat })).toHaveAttribute('href', '/dashboard/store#connect');
  });

  it('V16StoreLookupFailed announces the failure and retries by reading the stores again', () => {
    render(<V16StoreLookupFailed locale={locale} />);
    expect(screen.getByRole('alert')).toHaveTextContent(copy.lookupFailed.body);
    fireEvent.click(screen.getByRole('button', { name: copy.lookupFailed.retry }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it.each(['tryOn', 'plan'] as const)('V16NeedsStore for %s offers switching to a Shopify store the person has', (feature) => {
    render(
      <V16NeedsStore
        locale={locale}
        feature={feature}
        shops={[
          { domain: 'maison.myshopify.com', label: 'maison' },
          { domain: 'kids.myshopify.com', label: 'kids' },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: copy.needsStore[feature].title })).toBeInTheDocument();
    const path = feature === 'tryOn' ? '/dashboard/try-on' : '/dashboard/plan';
    expect(screen.getByRole('link', { name: copy.needsStore.switchTo('kids') })).toHaveAttribute('href', `${path}?shop=kids.myshopify.com`);
    expect(screen.getByRole('button', { name: connect.connectAnotherStore })).toBeInTheDocument();
  });

  it('V16NeedsStore with no Shopify store offers both ways to connect one, and no switch link', () => {
    render(<V16NeedsStore locale={locale} feature="tryOn" shops={[]} />);
    expect(screen.queryByRole('link', { name: /kids/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: connect.connectStore })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.needsStore.wooAction })).toHaveAttribute('href', '/dashboard/store#connect');
  });

  it('V16StoreTaken points at the linking code in Try-On', () => {
    render(<V16StoreTaken locale={locale} />);
    expect(screen.getByRole('link', { name: copy.storeTaken.action })).toHaveAttribute('href', '/dashboard/try-on');
  });
});

describe('states copy', () => {
  it('has the same keys in English and Arabic, and no empty or English-only Arabic string', () => {
    const flat = (value: unknown, path = ''): Array<[string, string]> =>
      typeof value === 'string'
        ? [[path, value]]
        : typeof value === 'function'
          ? [[path, (value as (x: string) => string)('X')]]
          : Object.entries(value as object).flatMap(([key, inner]) => flat(inner, path ? `${path}.${key}` : key));
    const en = flat(getStatesCopy('en'));
    const ar = flat(getStatesCopy('ar'));
    expect(ar.map(([key]) => key)).toEqual(en.map(([key]) => key));
    for (const [key, value] of ar) {
      expect(value.trim(), key).not.toBe('');
      expect(value.replace(/X|Shopify|WooCommerce|EasyOrders|GRINDCTRL|Store Chat/g, '').match(/[A-Za-z]{3,}/), `${key} still English`).toBeNull();
    }
  });
});
