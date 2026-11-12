import { describe, expect, it, vi } from 'vitest';

const redirect = vi.hoisted(() => vi.fn((href: string) => {
  throw new Error(`redirect:${href}`);
}));
vi.mock('next/navigation', () => ({ redirect }));

import LoginPage from './page';

describe('/login', () => {
  it('goes to sign-in with no query when it has none', async () => {
    await expect(LoginPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/sign-in');
  });

  it('keeps the destination it was given, encoded, for sign-in to check', async () => {
    await expect(
      LoginPage({ searchParams: Promise.resolve({ redirect_url: '/claim?token=abc&x=1' }) }),
    ).rejects.toThrow('redirect:/sign-in?redirect_url=%2Fclaim%3Ftoken%3Dabc%26x%3D1');
  });
});
