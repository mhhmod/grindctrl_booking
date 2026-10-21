// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

/* The embed chooses the v16 sheet (02-try-on.md) only when the loader asks
   for it and the store's v16_tryon flag is on. */
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers({ 'accept-language': 'en' }),
}));
const flags = vi.hoisted(() => ({ on: [] as string[], asked: [] as unknown[], timing: 0 }));
vi.mock('@/lib/flags/store-flags', () => ({
  storeFlags: async (store: unknown) => {
    flags.asked.push(store);
    return flags.on;
  },
}));
vi.mock('@/lib/try-on/look-timing', () => ({
  getTypicalLookSeconds: async () => {
    flags.timing += 1;
    return 25;
  },
}));
vi.mock('@/lib/try-on/settings', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/try-on/settings')>();
  return { ...real, getTryOnSettings: async () => real.DEFAULT_SETTINGS };
});
vi.mock('@/components/try-on/sheet/try-on-sheet', () => ({
  TryOnSheet: (props: { lookSeconds: number | null; variantTitle?: string; addressForm: string }) => (
    <div data-testid="sheet" data-seconds={String(props.lookSeconds)} data-variant={props.variantTitle} data-form={props.addressForm} />
  ),
}));
vi.mock('@/components/try-on/try-on-demo', () => ({ TryOnDemo: () => <div data-testid="today" /> }));
vi.mock('@/components/try-on/embed-frame-bridge', () => ({ EmbedFrameBridge: () => null }));

import EmbedTryOnPage from './page';

const BASE = {
  product: 'layla-abaya',
  shop: 'demo.myshopify.com',
  title: 'Layla Embroidered Abaya',
  garment: 'https://cdn.shopify.com/s/files/garment.png',
  locale: 'en',
  variant: '456',
};

async function renderPage(params: Record<string, string>) {
  render(await EmbedTryOnPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  flags.on = [];
  flags.asked = [];
  flags.timing = 0;
});

describe('the try-on embed', () => {
  it('opens the v16 sheet for a store with the flag, with its own time per look', async () => {
    flags.on = ['v16_tryon'];
    await renderPage({ ...BASE, sheet: '1', variantTitle: 'Black / M' });
    const sheet = screen.getByTestId('sheet');
    expect(sheet).toHaveAttribute('data-seconds', '25');
    expect(sheet).toHaveAttribute('data-variant', 'Black / M');
    expect(sheet).toHaveAttribute('data-form', 'everyone');
    expect(screen.queryByTestId('today')).toBeNull();
    expect(flags.asked).toEqual([{ shopDomain: 'demo.myshopify.com' }]);
  });

  it("keeps today's try-on for a store without the flag, even when asked for the sheet", async () => {
    await renderPage({ ...BASE, sheet: '1' });
    expect(screen.getByTestId('today')).toBeInTheDocument();
    expect(screen.queryByTestId('sheet')).toBeNull();
    expect(flags.timing).toBe(0);
  });

  it("keeps today's try-on when the loader did not ask for the sheet", async () => {
    flags.on = ['v16_tryon'];
    await renderPage(BASE);
    expect(screen.getByTestId('today')).toBeInTheDocument();
    expect(flags.asked).toEqual([]);
    expect(flags.timing).toBe(0);
  });
});
