// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));

import { GET } from './route';

function makeRequest(cookieHeader?: string) {
  const headers = cookieHeader ? { cookie: cookieHeader } : undefined;
  return new NextRequest('http://localhost/api/assistant/session', { headers });
}

describe('GET /api/assistant/session', () => {
  afterEach(() => {
    authMock.mockReset();
  });

  it('issues a fresh anon session with a new cookie and anon-tier budgets', async () => {
    authMock.mockResolvedValue({ userId: null });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.authenticated).toBe(false);
    expect(body.tenantId).toBeTruthy();
    expect(body.budgets.chat.remaining).toBe(8);
    expect(body.budgets.voice.remaining).toBe(3);

    const setCookie = response.cookies.get('gc_assistant_sid');
    expect(setCookie?.value).toBe(body.tenantId);
  });

  it('reuses an existing anon session cookie without minting a new one', async () => {
    authMock.mockResolvedValue({ userId: null });

    const response = await GET(makeRequest('gc_assistant_sid=sess_existing'));
    const body = await response.json();

    expect(body.tenantId).toBe('sess_existing');
    expect(response.cookies.get('gc_assistant_sid')).toBeUndefined();
  });

  it('reports authenticated with the Clerk user id as tenant and auth-tier budgets', async () => {
    authMock.mockResolvedValue({ userId: 'user_abc123' });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.authenticated).toBe(true);
    expect(body.tenantId).toBe('user_abc123');
    expect(body.budgets.chat.remaining).toBe(40); // 32000 / 800 per turn
  });
});
