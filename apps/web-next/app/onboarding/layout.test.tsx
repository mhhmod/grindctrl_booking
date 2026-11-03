import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const locale = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: locale.get }));
vi.mock('@/components/mantine/provider', () => ({
  MantineUiProvider: ({ dir, children }: { dir: string; children: React.ReactNode }) => (
    <div data-testid="mantine-provider" data-dir={dir}>
      {children}
    </div>
  ),
}));

import OnboardingLayout from './layout';

beforeEach(() => locale.get.mockResolvedValue('en'));

describe('OnboardingLayout', () => {
  it.each([
    ['en', 'ltr'],
    ['ar', 'rtl'],
  ])('mounts the Mantine provider for the segment, in the request language (%s)', async (language, dir) => {
    locale.get.mockResolvedValue(language);
    render(await OnboardingLayout({ children: <p>Segment page</p> }));
    expect(screen.getByTestId('mantine-provider')).toHaveAttribute('data-dir', dir);
    expect(screen.getByTestId('mantine-provider')).toHaveTextContent('Segment page');
  });
});
