// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LookPreparation } from './look-preparation';
import type { TryOnAttempt } from './types';

const binding = { siteKey: 'key', action: 'paste_tryon' as const, cData: 'bound' };
let options: Parameters<NonNullable<Window['turnstile']>['render']>[1];
const render = vi.fn<NonNullable<Window['turnstile']>['render']>((_el, opts) => { options = opts; return 'widget'; });
const remove = vi.fn();
const request = () => vi.fn(async (_signal: AbortSignal): Promise<TryOnAttempt> => ({
  attemptId: crypto.randomUUID(), expiresAt: new Date(Date.now() + 600_000).toISOString(), turnstile: binding,
}));
beforeEach(() => {
  window.history.replaceState({}, '', '/embed/try-on');
  window.turnstile = { render, execute: () => options.callback('token'), remove };
});
afterEach(() => { delete window.turnstile; vi.restoreAllMocks(); vi.clearAllMocks(); vi.useRealTimers(); });

describe('one prepared look per photo', () => {
  it('fetches once on acceptance, consumes at tap, then fetches a new attempt for a second look', async () => {
    const fetchAttempt = request();
    const preparation = new LookPreparation(fetchAttempt);
    preparation.warm(); preparation.warm();
    await vi.waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    const first = await preparation.take();
    expect(first).toMatchObject({ token: 'token', timings: { check_prewarmed: true } });
    expect(fetchAttempt).toHaveBeenCalledTimes(1);
    const second = await preparation.take();
    expect(second.attempt.attemptId).not.toBe(first.attempt.attemptId);
    expect(second.timings.check_prewarmed).toBe(false);
    expect(fetchAttempt).toHaveBeenCalledTimes(2);
  });
  it('a tap while the background check is still running waits for it instead of starting over', async () => {
    window.turnstile!.execute = () => { setTimeout(() => options.callback('late-token'), 30); };
    const fetchAttempt = request();
    const preparation = new LookPreparation(fetchAttempt);
    preparation.warm();
    expect(await preparation.take()).toMatchObject({ token: 'late-token', timings: { check_prewarmed: true } });
    expect(fetchAttempt).toHaveBeenCalledTimes(1);
  });
  it('discards a changed photo or closed sheet and aborts its pending attempt', async () => {
    const fetchAttempt = request();
    const firstPhoto = new LookPreparation(fetchAttempt);
    firstPhoto.warm();
    firstPhoto.abort();
    expect(fetchAttempt.mock.calls[0][0].aborted).toBe(true);
    const nextPhoto = new LookPreparation(fetchAttempt);
    nextPhoto.warm();
    await vi.waitFor(() => expect(remove).toHaveBeenCalled());
    expect((await nextPhoto.take()).timings.check_prewarmed).toBe(true);
    expect(fetchAttempt).toHaveBeenCalledTimes(2);
  });
  it('runs no Turnstile at all without a server binding', async () => {
    const preparation = new LookPreparation(async () => ({ attemptId: 'no-check', expiresAt: '' }));
    preparation.warm();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await preparation.take()).token).toBeUndefined();
    expect(render).not.toHaveBeenCalled();
  });
  it('never displays an interactive background challenge and fetches fresh at tap', async () => {
    window.turnstile!.execute = () => options['before-interactive-callback']();
    const fetchAttempt = request();
    const preparation = new LookPreparation(fetchAttempt);
    preparation.warm();
    await vi.waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(document.querySelector('main')?.childElementCount ?? document.body.childElementCount).toBe(0);
    window.turnstile!.execute = () => options.callback('interactive-token');
    expect(await preparation.take()).toMatchObject({ token: 'interactive-token', timings: { check_prewarmed: false } });
    expect(fetchAttempt).toHaveBeenCalledTimes(2);
  });
  it('rejects expired tokens and failed background attempts', async () => {
    const fetchAttempt = request();
    const preparation = new LookPreparation(fetchAttempt);
    preparation.warm();
    await vi.waitFor(() => expect(remove).toHaveBeenCalled());
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 300_001);
    expect((await preparation.take()).timings.check_prewarmed).toBe(false);
    expect(fetchAttempt).toHaveBeenCalledTimes(2);
    const failed = request().mockRejectedValueOnce(new Error('offline'));
    const retry = new LookPreparation(failed);
    retry.warm();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await retry.take()).token).toBe('token');
    expect(failed).toHaveBeenCalledTimes(2);
  });
});
