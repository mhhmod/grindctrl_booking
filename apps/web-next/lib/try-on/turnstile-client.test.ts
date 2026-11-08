// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attemptTurnstileToken } from './turnstile-client';

const binding = { siteKey: 'public-site-key', action: 'paste_tryon' as const, cData: 'attempt-bound' };
beforeEach(() => { window.history.replaceState({}, '', '/embed/try-on'); });
afterEach(() => { delete window.turnstile; vi.restoreAllMocks(); document.head.innerHTML = ''; document.body.innerHTML = ''; });

describe('attempt-bound website Turnstile', () => {
  it('does not load or render for Shopify, Woo, preview or demo attempts without a binding', async () => {
    expect(await attemptTurnstileToken(undefined)).toBeUndefined();
    expect(document.querySelector('script[src*="turnstile"]')).toBeNull();
  });
  it('fails before loading with a missing site key', async () => {
    await expect(attemptTurnstileToken({ ...binding, siteKey: null })).rejects.toThrow();
    expect(document.querySelector('script[src*="turnstile"]')).toBeNull();
  });
  it('renders interaction-only inside the embed and executes just before returning a fresh token', async () => {
    document.body.innerHTML = '<main></main>';
    let complete: (token: string) => void = () => {};
    const api: NonNullable<Window['turnstile']> = {
      render: vi.fn((container, options) => {
        expect(container.parentElement?.tagName).toBe('MAIN');
        expect(options).toMatchObject({ sitekey: binding.siteKey, action: binding.action, cData: binding.cData, appearance: 'interaction-only', execution: 'execute' });
        complete = options.callback;
        return 'widget-id';
      }),
      execute: vi.fn(() => complete('cloudflare-token')), remove: vi.fn(),
    };
    window.turnstile = api;
    expect(await attemptTurnstileToken(binding)).toBe('cloudflare-token');
    expect(api.execute).toHaveBeenCalledWith('widget-id');
    expect(api.remove).toHaveBeenCalledWith('widget-id');
    expect(document.querySelector('main')?.childElementCount).toBe(0);
  });
  it('handles a challenge rejection without leaving a widget behind', async () => {
    let fail = () => {};
    window.turnstile = { render: (_element, options) => { fail = options['error-callback']; return 'widget'; },
      execute: () => fail(), remove: vi.fn() };
    await expect(attemptTurnstileToken(binding)).rejects.toThrow();
    expect(window.turnstile.remove).toHaveBeenCalledWith('widget');
  });
});
