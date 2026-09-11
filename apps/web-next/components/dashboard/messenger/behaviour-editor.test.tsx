import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import type { MessengerBehaviour } from '@/lib/messenger/types';

const saveDraftSection = vi.fn();

import { BehaviourEditor } from './behaviour-editor';

/* Regression for a real data-loss bug: editing one day's hours used to
   silently overwrite every other enabled day's hours with the same window,
   because the picker was bound to a single shared start/end pair instead of
   the per-day AvailabilityHours[] rows the data model already has. */

const BEHAVIOUR: MessengerBehaviour = {
  welcomeTitle: { en: 'Hi', ar: 'مرحباً' },
  welcomeSubtitle: { en: 'Ask us', ar: 'اسألنا' },
  inputPlaceholder: { en: 'Ask anything…', ar: 'اكتب سؤالك…' },
  greetingEnabled: false,
  greetingDelaySeconds: 0,
  greeting: null,
  proactiveEnabled: false,
  proactiveDelaySeconds: 30,
  proactiveCapPerVisitor: 1,
  targetingMode: 'everywhere',
  excludePatterns: [],
  availabilityMode: 'hours',
  availabilityTimezone: 'Asia/Riyadh',
  availabilityHours: [
    { day: 1, startMinute: 9 * 60, endMinute: 17 * 60 }, // Mon 9-5
    { day: 6, startMinute: 10 * 60, endMinute: 14 * 60 }, // Sat 10-2
  ],
};

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
  behaviour: BEHAVIOUR,
};

function renderEditor(overrides: Partial<MessengerBehaviour> = {}) {
  return render(
    <BehaviourEditor
      locale="en"
      siteId="site-1"
      initial={{ ...BEHAVIOUR, ...overrides }}
      publishedPayload={PAYLOAD}
      actions={{ saveDraftSection }}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  saveDraftSection.mockResolvedValue({ ok: true });
});

describe('BehaviourEditor availability hours', () => {
  it('changing one day\'s start time does not touch a different day\'s hours', () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText('From · Sat'), { target: { value: '11:00' } });

    // Saturday's start moved...
    expect(screen.getByLabelText('From · Sat')).toHaveValue('11:00');
    // ...Monday's window is completely untouched.
    expect(screen.getByLabelText('From · Mon')).toHaveValue('09:00');
    expect(screen.getByLabelText('To · Mon')).toHaveValue('17:00');
  });

  it('changing one day\'s end time does not touch a different day\'s hours', () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText('To · Mon'), { target: { value: '18:30' } });

    expect(screen.getByLabelText('To · Mon')).toHaveValue('18:30');
    expect(screen.getByLabelText('From · Sat')).toHaveValue('10:00');
    expect(screen.getByLabelText('To · Sat')).toHaveValue('14:00');
  });

  it('renders one time-range row per enabled day, sorted by day', () => {
    renderEditor();

    // One From/To pair per enabled day (Mon, Sat) — not one shared pair.
    expect(screen.getAllByLabelText(/^From ·/)).toHaveLength(2);
    expect(screen.getAllByLabelText(/^To ·/)).toHaveLength(2);
  });
});

describe('BehaviourEditor timezone picker', () => {
  it('renders the configured availabilityTimezone selected, grouped by region', () => {
    const { container } = renderEditor();

    expect(screen.getByLabelText('Timezone')).toHaveValue('Asia/Riyadh');
    expect(container.querySelector('optgroup[label="Asia"]')).not.toBeNull();
  });

  it('changing the selection patches the timezone like the other fields', () => {
    renderEditor();

    const select = screen.getByLabelText('Timezone');
    fireEvent.change(select, { target: { value: 'Europe/Berlin' } });

    expect(select).toHaveValue('Europe/Berlin');
  });

  it('keeps a saved value missing from Intl.supportedValuesOf selected instead of resetting it', () => {
    const { container } = renderEditor({ availabilityTimezone: 'Custom/Zone' });

    const select = screen.getByLabelText('Timezone');
    expect(select).toHaveValue('Custom/Zone');
    expect(container.querySelector('option[value="Custom/Zone"]')).not.toBeNull();
  });
});
