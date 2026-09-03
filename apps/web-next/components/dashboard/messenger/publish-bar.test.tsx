import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishBar } from './publish-bar';

/* These assertions moved here from overview.test.tsx along with the control
   itself. Publishing was never an Overview concern — burying it in that tab's
   "Config version" card is what made a saved change look finished when the
   store was still serving the old settings. */

const publishConfig = vi.fn();

function renderBar(hasDraft: boolean) {
  return render(
    <PublishBar locale="en" siteId="site-1" hasDraft={hasDraft} actions={{ publishConfig }} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  publishConfig.mockResolvedValue({
    ok: true,
    message: 'Published — live on your store within a minute.',
  });
});

describe('PublishBar', () => {
  it('stays out of the way when there is nothing to publish', () => {
    const { container } = renderBar(false);
    expect(container).toBeEmptyDOMElement();
  });

  it('says plainly that saved changes are not live yet', () => {
    renderBar(true);
    expect(screen.getByText('Not live yet')).toBeInTheDocument();
    expect(
      screen.getByText('Your changes are saved but shoppers still see the old version.'),
    ).toBeInTheDocument();
  });

  it('publishes the site and shows the server\'s success message', async () => {
    renderBar(true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish to your store' }));
    });

    expect(publishConfig).toHaveBeenCalledWith('site-1');
    expect(
      await screen.findByText('Published — live on your store within a minute.'),
    ).toBeInTheDocument();
  });

  it('shows a failed publish as an alert, never as success', async () => {
    publishConfig.mockResolvedValue({
      ok: false,
      error: 'Someone else published while you were editing. Refresh and try again.',
    });
    renderBar(true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish to your store' }));
    });

    const note = await screen.findByRole('alert');
    expect(note).toHaveTextContent(
      'Someone else published while you were editing. Refresh and try again.',
    );
    expect(note.className).toContain('text-destructive');
  });

  /* Publishing revalidates the page, so hasDraft flips to false underneath
     this component. Unmounting on that would delete the confirmation at the
     exact moment it appears — indistinguishable, to the merchant, from the
     publish having silently done nothing. */
  it('keeps the confirmation visible after the draft it published disappears', async () => {
    const { rerender } = renderBar(true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish to your store' }));
    });

    rerender(
      <PublishBar locale="en" siteId="site-1" hasDraft={false} actions={{ publishConfig }} />,
    );

    expect(
      screen.getByText('Published — live on your store within a minute.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Publish to your store' }),
    ).not.toBeInTheDocument();
  });
});
