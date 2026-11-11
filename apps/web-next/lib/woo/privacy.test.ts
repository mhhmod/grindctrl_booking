// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), queued: [] as unknown[] }));
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    rpc: mocks.rpc,
    from: () => {
      const builder = {
        select: () => builder,
        order: () => builder,
        limit: () => Promise.resolve({ data: mocks.queued, error: null }),
      };
      return builder;
    },
    storage: { from: () => ({ remove: vi.fn() }) },
  }),
}));

import { parsePrivacyRequest, redactDueWooSites, redactDuePasteSites } from './privacy';

const A = '123e4567-e89b-12d3-a456-426614174000';
const B = '223e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.queued = [];
});

describe('parsePrivacyRequest', () => {
  it('lowercases the email and defaults the page', () => {
    expect(parsePrivacyRequest({ email: ' A@B.co ' })).toEqual({ email: 'a@b.co', page: 1 });
  });
  it('rejects unusable input', () => {
    for (const body of [null, [], {}, { email: 'nope' }, { email: 'a@b.co', page: 0 }, { email: 'a@b.co', page: 1e9 }]) {
      expect(parsePrivacyRequest(body)).toBeNull();
    }
  });
});

describe('redactDueWooSites', () => {
  it('uses the same bounded worker and Storage queue for due paste sites', async () => {
    mocks.rpc.mockImplementation(async (fn: string) => fn === 'paste_sites_due_for_redaction'
      ? { data: [A], error: null } : { data: { done: true, redacted: true }, error: null });
    expect(await redactDuePasteSites()).toMatchObject({ sites: 1, completed: 1, failed: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith('paste_sites_due_for_redaction', { p_limit: 5 });
    expect(mocks.rpc).toHaveBeenCalledWith('paste_site_redact', { p_site: A });
    expect(mocks.rpc).not.toHaveBeenCalledWith('woo_site_redact', expect.anything());
  });
  it('redacts only the sites the database lists as due, in bounded batches', async () => {
    mocks.rpc.mockImplementation(async (fn: string, args: { p_site?: string }) => {
      if (fn === 'woo_sites_due_for_redaction') return { data: [A, B], error: null };
      return { data: { done: args.p_site === A, redacted: true }, error: null };
    });

    const summary = await redactDueWooSites();

    expect(summary).toMatchObject({ sites: 2, completed: 1, pending: 1, failed: 0 });
    const redactCalls = mocks.rpc.mock.calls.filter(([fn]) => fn === 'woo_site_redact');
    expect(redactCalls.filter(([, args]) => args.p_site === A)).toHaveLength(1);
    expect(redactCalls.filter(([, args]) => args.p_site === B)).toHaveLength(10);
    expect(redactCalls.every(([, args]) => [A, B].includes(args.p_site))).toBe(true);
  });

  it('skips without failing while the privacy migration is not applied', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });

    const summary = await redactDueWooSites();

    expect(summary).toMatchObject({ sites: 0, failed: 0, notReady: true });
    expect(mocks.rpc.mock.calls.filter(([fn]) => fn === 'woo_site_redact')).toHaveLength(0);
    warn.mockRestore();
  });

  it('still fails on any other listing error', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'canceling statement' } });
    expect((await redactDueWooSites()).failed).toBeGreaterThan(0);
  });

  it('treats a site that is no longer due as finished, not failed', async () => {
    mocks.rpc.mockImplementation(async (fn: string) =>
      fn === 'woo_sites_due_for_redaction'
        ? { data: [A], error: null }
        : { data: { redacted: false, done: false, reason: 'not_due' }, error: null });

    const summary = await redactDueWooSites();

    expect(summary).toMatchObject({ completed: 1, failed: 0 });
    expect(mocks.rpc.mock.calls.filter(([fn]) => fn === 'woo_site_redact')).toHaveLength(1);
  });

  it('continues to later sites after one fails, and counts the failure', async () => {
    mocks.rpc.mockImplementation(async (fn: string, args: { p_site?: string }) => {
      if (fn === 'woo_sites_due_for_redaction') return { data: [A, B], error: null };
      return args.p_site === A
        ? { data: null, error: { message: 'x' } }
        : { data: { done: true, redacted: true }, error: null };
    });

    expect(await redactDueWooSites()).toMatchObject({ sites: 2, completed: 1, failed: 1 });
  });

  it('counts a failed listing as a failure instead of succeeding silently', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    expect(await redactDueWooSites()).toMatchObject({ sites: 0, failed: 1 });
  });
});
