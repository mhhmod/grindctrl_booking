import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessengerOverview } from './overview';

const publishConfig = vi.fn();

function renderOverview(hasDraft: boolean) {
  return render(
    <MessengerOverview
      locale="en"
      siteId="site-1"
      siteName="Demo store"
      active
      aiEnabled={false}
      detectedAt={null}
      version={3}
      stats={null}
      hasDraft={hasDraft}
      actions={{ publishConfig }}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  publishConfig.mockResolvedValue({ ok: true, message: 'Published — live on your store within a minute.' });
});

describe('MessengerOverview publish control', () => {
  it('shows no Publish button when there is nothing to publish', () => {
    renderOverview(false);
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
  });

  it('publishes the site and shows the server\'s success message', async () => {
    renderOverview(true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    });

    expect(publishConfig).toHaveBeenCalledWith('site-1');
    expect(await screen.findByText('Published — live on your store within a minute.')).toBeInTheDocument();
  });

  it('shows a failed publish as an alert, never as success', async () => {
    publishConfig.mockResolvedValue({ ok: false, error: 'Someone else published while you were editing. Refresh and try again.' });
    renderOverview(true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    });

    const note = await screen.findByRole('alert');
    expect(note).toHaveTextContent('Someone else published while you were editing. Refresh and try again.');
    expect(note.className).toContain('text-destructive');
  });
});
