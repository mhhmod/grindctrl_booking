import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

import ClaimError from './error';

beforeEach(() => {
  document.cookie = 'gc-locale=; max-age=0';
});

describe('the claim error boundary', () => {
  it('retries, and names the fallback of reopening the app from Shopify', () => {
    const reset = vi.fn();
    const { container } = render(<ClaimError error={Object.assign(new Error('x'), { digest: 'd1' })} reset={reset} />);
    expect(screen.getByRole('heading', { name: 'This did not go through' })).toBeInTheDocument();
    expect(screen.getByText(/reopen GRINDCTRL from your Shopify admin/)).toBeInTheDocument();
    expect(container.querySelector('section')).toHaveAttribute('dir', 'ltr');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('is right to left in Arabic', async () => {
    document.cookie = 'gc-locale=ar';
    const { container } = render(<ClaimError error={new Error('x')} reset={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'لم تكتمل هذه العملية' })).toBeInTheDocument();
    expect(container.querySelector('section')).toHaveAttribute('dir', 'rtl');
  });
});
