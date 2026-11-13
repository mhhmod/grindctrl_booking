// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';

const user = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({ currentUser: user }));
import { getSiteViewer } from './site-viewer-server';

beforeEach(() => { user.mockReset(); });

it('does not read a user for a signed-out request', async () => {
  expect(await getSiteViewer(null)).toEqual({ signedIn: false });
  expect(user).not.toHaveBeenCalled();
});

it('resolves the avatar before rendering, with no account identifiers in the client value', async () => {
  user.mockResolvedValue({ id: 'user_1', firstName: 'Sara', lastName: 'Adel', hasImage: true, imageUrl: 'https://img.clerk.com/avatar' });
  expect(await getSiteViewer('user_1')).toEqual({ signedIn: true, initials: 'SA', imageUrl: 'https://img.clerk.com/avatar' });
});

it('keeps the signed-in first paint when the avatar lookup fails', async () => {
  user.mockRejectedValue(new Error('Clerk unavailable'));
  expect(await getSiteViewer('user_1')).toEqual({ signedIn: true, initials: null, imageUrl: null });
});
