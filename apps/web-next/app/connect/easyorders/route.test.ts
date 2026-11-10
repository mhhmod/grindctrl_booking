// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), discard: vi.fn(), read: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('@/lib/easyorders/activation', () => ({ discardSignedOutInstall: mocks.discard, readReturnState: mocks.read }));
import { GET } from './route';

const CLAIMS = { siteId: 's', userId: 'u', nonce: 'n', exp: 0 };
const call = (q: string) => GET(new Request(`https://grindctrl.cloud/connect/easyorders${q}`));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://grindctrl.cloud');
  mocks.read.mockReturnValue(CLAIMS);
  mocks.discard.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('EasyOrders redirect_url', () => {
  it('discards the staged key when the approving browser is signed out, then forwards', async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const res = await call('?state=abc');
    expect(mocks.discard).toHaveBeenCalledWith(CLAIMS);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://grindctrl.cloud/dashboard/store-chat/easyorders/return?state=abc');
  });

  it('forwards a signed-in browser without discarding; the dashboard checks it is the creator', async () => {
    mocks.auth.mockResolvedValue({ userId: 'u' });
    const res = await call('?state=abc');
    expect(mocks.discard).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
  });

  it('fails closed when the discard cannot be written', async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    mocks.discard.mockRejectedValue(new Error('db down'));
    const res = await call('?state=abc');
    expect(res.status).toBe(503);
    expect(res.headers.get('location')).toBeNull();
  });

  it('ignores invalid or duplicated state without touching storage', async () => {
    mocks.read.mockReturnValue(null);
    mocks.auth.mockResolvedValue({ userId: null });
    const res = await call('?state=a&state=b');
    expect(mocks.discard).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get('location')!).searchParams.get('state')).toBe('');
  });
});
