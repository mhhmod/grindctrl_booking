// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

/* GET /api/dashboard/store-chat-waiting is the client-side refresh for the
   sidebar badge — app/dashboard/layout.tsx only computes the count once per
   full page load (see lib/dashboard/use-route-meta.ts for why a shared
   layout's server render goes stale across navigation). Same fail-quiet
   contract as the layout's own computation: a badge must never take the
   dashboard down. */

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));

const limitMock = vi.fn();
vi.mock('@/lib/request-rate-limit', () => ({
  merchantRateLimitResponse: (...args: unknown[]) => limitMock(...args),
}));

const listMessengerSiteIdsReadOnlyMock = vi.fn();
vi.mock('@/lib/messenger/provisioning', () => ({
  listMessengerSiteIdsReadOnly: (...args: unknown[]) => listMessengerSiteIdsReadOnlyMock(...args),
}));

const countAwaitingHandoffMock = vi.fn();
vi.mock('@/lib/messenger/conversations', () => ({
  countAwaitingHandoff: (...args: unknown[]) => countAwaitingHandoffMock(...args),
}));

import { GET } from './route';

describe('GET /api/dashboard/store-chat-waiting', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns 0 without querying for a signed-out caller', async () => {
    authMock.mockResolvedValue({ userId: null });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ count: 0 });
    expect(listMessengerSiteIdsReadOnlyMock).not.toHaveBeenCalled();
    expect(limitMock).not.toHaveBeenCalled();
  });

  it('returns the count from the same helpers the layout uses', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    listMessengerSiteIdsReadOnlyMock.mockResolvedValue(['site-1', 'site-2']);
    countAwaitingHandoffMock.mockResolvedValue(4);

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ count: 4 });
    expect(listMessengerSiteIdsReadOnlyMock).toHaveBeenCalledWith('user_1');
    expect(countAwaitingHandoffMock).toHaveBeenCalledWith(['site-1', 'site-2']);
    expect(limitMock).toHaveBeenCalledWith('account:user_1', 'read');
  });

  it('returns 0 rather than throw when a helper rejects — a badge must never take the dashboard down', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    listMessengerSiteIdsReadOnlyMock.mockRejectedValue(new Error('db down'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ count: 0 });
  });

  it.each([429, 503])('preserves %i and Retry-After without querying or fabricating a count', async (status) => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    limitMock.mockResolvedValue(Response.json({ error: 'unavailable' }, {
      status, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' },
    }));
    const response = await GET();
    expect(response.status).toBe(status);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(await response.json()).not.toHaveProperty('count');
    expect(listMessengerSiteIdsReadOnlyMock).not.toHaveBeenCalled();
    expect(countAwaitingHandoffMock).not.toHaveBeenCalled();
  });
});
