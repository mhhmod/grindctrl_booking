import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessengerConfigSectionDiff } from '@/lib/messenger/config';
import { PublishBar } from './publish-bar';

/* These assertions moved here from overview.test.tsx along with the control
   itself. Publishing was never an Overview concern — burying it in that tab's
   "Config version" card is what made a saved change look finished when the
   store was still serving the old settings. */

const publishConfig = vi.fn();

function renderBar(hasDraft: boolean, configDiff: MessengerConfigSectionDiff[] = [], locale = 'en') {
  return render(
    <PublishBar locale={locale} configDiff={configDiff} siteId="site-1" hasDraft={hasDraft} actions={{ publishConfig }} />,
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


const changes: MessengerConfigSectionDiff[] = [
  { section: 'appearance', changed: false, fields: [] },
  { section: 'behaviour', changed: true, fields: [
    { key: 'greetingEnabled', before: true, after: false },
    { key: 'welcomeTitle', before: { en: 'Hello', ar: 'مرحباً' }, after: { en: 'Welcome', ar: 'أهلاً' } },
    { key: 'excludePatterns', before: [], after: ['/private', '/checkout'] },
  ] },
];

describe('PublishBar change review', () => {
  it('hides review without a draft even if a diff is supplied', () => {
    renderBar(false, changes);
    expect(screen.queryByText(/Review/)).not.toBeInTheDocument();
  });

  it('hides review for unchanged sections without disabling publish', () => {
    renderBar(true, [changes[0]]);
    expect(screen.queryByText(/Review/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish to your store' })).toBeEnabled();
  });

  it('starts collapsed, counts fields and expands only changed sections with formatted values', () => {
    renderBar(true, changes);
    const trigger = screen.getByText('Review 3 changes');
    expect(trigger.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(trigger);
    expect(trigger.closest('details')).toHaveAttribute('open');
    expect(screen.getByRole('heading', { name: 'Behaviour' })).toBeVisible();
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument();
    for (const text of ['Greeting Enabled', 'On', 'Off', 'Welcome Title', 'Hello', 'Welcome', '0 items', '2 items']) {
      expect(screen.getByText(text)).toBeVisible();
    }
    for (const text of ['مرحباً', 'أهلاً', '/private', '/checkout']) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
  });

  it('localizes headings, booleans and counts in Arabic', () => {
    renderBar(true, changes, 'ar');
    fireEvent.click(screen.getByText('مراجعة 3 تغييرات'));
    for (const text of ['السلوك', 'مفعّل', 'معطّل', '0 عنصر', '2 عنصر', 'قبل', 'بعد', 'Hello', 'Welcome']) {
      expect(screen.getAllByText(text)[0]).toBeVisible();
    }
  });

  it('formats missing values, singular arrays and numbers and truncates long strings', () => {
    renderBar(true, [{ section: 'ai', changed: true, fields: [
      { key: 'instructions', before: null, after: 'x'.repeat(4000) },
      { key: 'example', before: undefined, after: ['secret'] },
      { key: 'delaySeconds', before: 5, after: 30 },
    ] }]);
    fireEvent.click(screen.getByText('Review 3 changes'));
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText('x'.repeat(80) + '…')).toBeVisible();
    expect(screen.queryByText('x'.repeat(4000))).not.toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeVisible();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByText('5')).toBeVisible();
    expect(screen.getByText('30')).toBeVisible();
  });

  it.each([false, true])('preserves publish pending and done states with review expanded=%s', async (expanded) => {
    let finish!: (value: { ok: true }) => void;
    publishConfig.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderBar(true, changes);
    if (expanded) fireEvent.click(screen.getByText('Review 3 changes'));
    expect(publishConfig).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Publish to your store' }));
    expect(screen.getByRole('button', { name: 'Publishing…' })).toBeDisabled();
    expect(publishConfig).toHaveBeenCalledExactlyOnceWith('site-1');
    await act(async () => { finish({ ok: true }); });
    expect(screen.getByRole('status')).toHaveTextContent('Published — your store is serving the new version.');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Review 3 changes')).not.toBeInTheDocument();
  });
});
