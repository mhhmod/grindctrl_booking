import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import type { MessengerAppearance } from '@/lib/messenger/types';

const { saveDraftSection } = vi.hoisted(() => ({ saveDraftSection: vi.fn() }));
vi.mock('@/app/dashboard/messenger/actions', () => ({ saveDraftSection }));

import { AppearanceEditor } from './appearance-editor';

const APPEARANCE: MessengerAppearance = {
  accentColor: '#2a2826',
  launcherIcon: 'chat',
  launcherCustomIconUrl: null,
  launcherLabel: { en: 'Support', ar: 'الدعم' },
  launcherSizePx: 56,
  position: 'bottom-right',
  radiusStyle: 'soft',
  themeMode: 'light',
  assistantAvatarUrl: null,
};

const PAYLOAD: PublicMessengerPayload = {
  v: 1,
  key: 'gc_test_key',
  storeName: 'Sara’s Store',
  active: true,
  available: true,
  aiEnabled: true,
  appearance: APPEARANCE,
  behaviour: {
    welcomeTitle: { en: 'Hi', ar: 'مرحباً' },
    welcomeSubtitle: { en: 'Ask us', ar: 'اسألنا' },
    inputPlaceholder: { en: 'Ask anything…', ar: 'اكتب سؤالك…' },
    greetingEnabled: false,
    greetingDelaySeconds: 0,
    greeting: null,
    proactiveEnabled: false,
    proactiveDelaySeconds: 30,
    targetingMode: 'everywhere',
    excludePatterns: [],
  },
};

function renderEditor(locale: 'en' | 'ar' = 'en') {
  return render(
    <AppearanceEditor locale={locale} siteId="site-1" initial={APPEARANCE} publishedPayload={PAYLOAD} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  saveDraftSection.mockResolvedValue({ ok: true });
});

describe('AppearanceEditor', () => {
  it('sends the edited appearance to the draft action', async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText('Brand color', { selector: 'input[type="text"], input:not([type])' }), {
      target: { value: '#ff0055' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    });

    expect(saveDraftSection).toHaveBeenCalledWith(
      'site-1',
      'appearance',
      expect.objectContaining({ accentColor: '#ff0055' }),
    );
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
  });

  it('shows a failed save as an alert, never as success', async () => {
    saveDraftSection.mockResolvedValue({ ok: false, error: 'Action failed. Please try again.' });
    renderEditor();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    });

    const note = await screen.findByRole('alert');
    expect(note).toHaveTextContent('Action failed. Please try again.');
    // The success styling must not be reused for a failure.
    expect(note.className).toContain('text-destructive');
    expect(screen.queryByText('Draft saved')).not.toBeInTheDocument();
  });

  it('previews the launcher first, then the panel, both in Arabic', async () => {
    renderEditor('ar');

    expect(screen.getByText('المظهر')).toBeInTheDocument();

    /* Closed is the default, because that is the state whose settings this
       editor configures — the launcher used to be invisible here. */
    const launcher = screen.getByRole('button', { name: 'الدعم' });
    expect(launcher).toBeInTheDocument();
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('مرحباً')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(launcher);
    });

    // Opening mounts the real shopper panel, in Arabic.
    expect(screen.getAllByText('مرحباً').length).toBeGreaterThan(0);
  });
});
