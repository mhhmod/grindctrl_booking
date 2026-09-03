import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessengerOverview } from './overview';

/* What this screen owes a merchant is a straight answer and a way to act on
   it. The publish control that used to live here has moved to PublishBar —
   see publish-bar.test.tsx. */

type Props = React.ComponentProps<typeof MessengerOverview>;

function renderOverview(overrides: Partial<Props> = {}) {
  const props: Props = {
    locale: 'en',
    siteName: 'Demo store',
    domain: 'demo.myshopify.com',
    active: true,
    aiEnabled: false,
    detectedAt: null,
    version: 3,
    stats: null,
    ...overrides,
  };
  return render(<MessengerOverview {...props} />);
}

describe('MessengerOverview status', () => {
  it('names the actual store rather than talking about a "storefront"', () => {
    renderOverview();
    expect(screen.getByText(/demo\.myshopify\.com/)).toBeInTheDocument();
    expect(screen.queryByText(/storefront/i)).not.toBeInTheDocument();
  });

  it('tells a set-up-but-unseen store what the remaining step is', () => {
    renderOverview({ active: true, detectedAt: null });
    expect(screen.getByRole('heading', { name: 'One step left' })).toBeInTheDocument();
  });

  it('confirms a live store and says when it was last seen', () => {
    renderOverview({ active: true, detectedAt: '2026-09-01T10:00:00.000Z' });
    expect(screen.getByRole('heading', { name: 'Store Chat is live' })).toBeInTheDocument();
    expect(screen.getByText(/Last seen on your store/)).toBeInTheDocument();
  });

  it('reports an off site as off, not as merely undetected', () => {
    renderOverview({ active: false, detectedAt: null });
    expect(screen.getByRole('heading', { name: 'Store Chat is turned off' })).toBeInTheDocument();
  });

  it('falls back to the site name when no domain is connected yet', () => {
    renderOverview({ domain: null });
    expect(screen.getByText(/Demo store/)).toBeInTheDocument();
  });
});

describe('MessengerOverview shortcuts', () => {
  it('sends an unfinished install straight to the Installation tab', () => {
    const onOpenTab = vi.fn();
    renderOverview({ active: true, detectedAt: null, onOpenTab });

    fireEvent.click(screen.getByRole('button', { name: 'Show me how' }));
    expect(onOpenTab).toHaveBeenCalledWith('installation');
  });

  /* "Off" is the state a merchant is most likely to be stuck in and least
     likely to connect to a specific tab, so it gets a button too. */
  it('offers a way out of the AI-is-off dead end', () => {
    const onOpenTab = vi.fn();
    renderOverview({ aiEnabled: false, onOpenTab });

    fireEvent.click(screen.getByRole('button', { name: 'Turn on AI replies' }));
    expect(onOpenTab).toHaveBeenCalledWith('ai');
  });

  it('offers no AI shortcut once AI is already on', () => {
    renderOverview({ aiEnabled: true, onOpenTab: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Turn on AI replies' })).not.toBeInTheDocument();
  });
});
