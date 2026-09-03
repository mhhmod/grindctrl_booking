import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PreviewFrame } from './preview-frame';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';

const PAYLOAD: PublicMessengerPayload = {
  v: 1,
  key: 'gc_test_key',
  storeName: "Sara's Store",
  active: true,
  available: true,
  aiEnabled: true,
  attachmentsEnabled: false,
  appearance: {
    accentColor: '#2a2826',
    launcherIcon: 'chat',
    launcherCustomIconUrl: null,
    launcherLabel: { en: 'Support', ar: 'الدعم' },
    launcherSizePx: 56,
  languageMode: 'auto',
    position: 'bottom-right',
    radiusStyle: 'soft',
    themeMode: 'light',
    assistantAvatarUrl: null,
  },
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

describe('PreviewFrame', () => {
  it('reserves space at the bottom for the launcher instead of letting the open panel fill the whole box', async () => {
    render(<PreviewFrame payload={PAYLOAD} initialLocale="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    const launcher = await screen.findByRole('button', { name: 'Support' });
    // The panel's wrapper must stop short of the box's bottom edge by at
    // least the launcher's own footprint (20px offset + its height), or the
    // launcher — positioned absolutely at bottom:20 with z-10 — renders on
    // top of the panel's footer instead of below it.
    const panelWrapper = launcher.parentElement?.querySelector('.absolute.inset-x-0.top-0');
    expect(panelWrapper).not.toBeNull();
    expect(panelWrapper).toHaveClass('bottom-[88px]');
  });

  it('does not reserve bottom space when the panel is closed, since there is no panel to overlap', () => {
    render(<PreviewFrame payload={PAYLOAD} initialLocale="en" />);
    expect(document.querySelector('.bottom-\\[88px\\]')).not.toBeInTheDocument();
  });
});
