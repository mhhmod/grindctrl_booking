// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: session.auth }));

import { isTryOnPlatformOperator, requireTryOnPlatformOperator, PlatformOperatorRequiredError } from './platform-operator';

beforeEach(() => {
  session.auth.mockReset().mockResolvedValue({ userId: 'user_operator' });
});
afterEach(() => vi.unstubAllEnvs());

describe('server-derived platform operator permission', () => {
  it.each([undefined, '', ' , ', 'user_other', 'user_operator_extra'])('denies display and mutation permission for allowlist %s', async (allowlist) => {
    vi.stubEnv('TRYON_PLATFORM_OPERATOR_CLERK_IDS', allowlist);
    expect(await isTryOnPlatformOperator()).toBe(false);
    await expect(requireTryOnPlatformOperator()).rejects.toBeInstanceOf(PlatformOperatorRequiredError);
  });

  it('uses the same exact authenticated ID and trimmed allowlist for display and enforcement', async () => {
    vi.stubEnv('TRYON_PLATFORM_OPERATOR_CLERK_IDS', 'user_other, user_operator ,');
    expect(await isTryOnPlatformOperator()).toBe(true);
    expect(await requireTryOnPlatformOperator()).toBe('user_operator');
    session.auth.mockResolvedValue({ userId: 'user_merchant' });
    expect(await isTryOnPlatformOperator()).toBe(false);
    await expect(requireTryOnPlatformOperator()).rejects.toBeInstanceOf(PlatformOperatorRequiredError);
  });

  it('denies anonymous callers despite configured operators', async () => {
    vi.stubEnv('TRYON_PLATFORM_OPERATOR_CLERK_IDS', 'user_operator');
    session.auth.mockResolvedValue({ userId: null });
    expect(await isTryOnPlatformOperator()).toBe(false);
    await expect(requireTryOnPlatformOperator()).rejects.toBeInstanceOf(PlatformOperatorRequiredError);
  });

  it('hides privileged UI if auth resolution fails without weakening the mutation guard', async () => {
    const error = new Error('Session unavailable');
    session.auth.mockRejectedValue(error);
    expect(await isTryOnPlatformOperator()).toBe(false);
    await expect(requireTryOnPlatformOperator()).rejects.toBe(error);
  });
});
