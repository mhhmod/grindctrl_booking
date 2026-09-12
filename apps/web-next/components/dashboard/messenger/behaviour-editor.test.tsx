import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import type {
  MessengerAttachments,
  MessengerBehaviour,
  MessengerContactCapture,
  MessengerNotifications,
  MessengerOrderLookup,
} from '@/lib/messenger/types';

const saveDraftSections = vi.fn();
const addCannedReply = vi.fn();
const updateCannedReplyStatus = vi.fn();
const deleteCannedReply = vi.fn();
const REPLIES = [
  { id: 'r-1', title: 'Shipping', content: 'Ships fast', status: 'active' as const, sort_order: 0, updated_at: '' },
  { id: 'r-2', title: 'Old policy', content: 'Old text', status: 'disabled' as const, sort_order: 1, updated_at: '' },
];

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

function renderEditor(
  overrides: Partial<MessengerBehaviour> = {},
  desk: {
    notifications?: MessengerNotifications;
    contactCapture?: MessengerContactCapture;
    attachments?: MessengerAttachments;
    orderLookup?: MessengerOrderLookup;
    shopDomain?: string | null;
    cannedReplies?: typeof REPLIES;
  } = {},
) {
  return render(
    <BehaviourEditor
      locale="en"
      siteId="site-1"
      initial={{ ...BEHAVIOUR, ...overrides }}
      publishedPayload={PAYLOAD}
      shopDomain={desk.shopDomain ?? 'grindctrl.myshopify.com'}
      notifications={desk.notifications ?? { emailOnHandoff: true, recipients: ['owner@example.com'] }}
      contactCapture={desk.contactCapture ?? { enabled: false, askOutsideHours: false }}
      attachments={desk.attachments ?? { enabled: false, triageEnabled: false }}
      orderLookup={desk.orderLookup ?? { enabled: false }}
      cannedReplies={desk.cannedReplies}
      actions={{ saveDraftSections, addCannedReply, updateCannedReplyStatus, deleteCannedReply }}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  saveDraftSections.mockResolvedValue({ ok: true });
  addCannedReply.mockResolvedValue({ ok: true });
  updateCannedReplyStatus.mockResolvedValue({ ok: true });
  deleteCannedReply.mockResolvedValue({ ok: true });
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

/* The Behaviour tab used to be two separate <form>s with two save buttons
   (behaviour + support desk). They now save together through one
   saveDraftSections call — a merchant editing both must never walk away
   with one half saved and the other silently lost. */
describe('BehaviourEditor combined save', () => {
  it('renders exactly one form with one save button', () => {
    const { container } = renderEditor();

    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Save draft' })).toHaveLength(1);
  });

  it('submitting calls saveDraftSections once with all five sections correctly shaped', async () => {
    renderEditor();

    // Edit a behaviour field and a support-desk field, then save once.
    fireEvent.change(screen.getByLabelText('Timezone'), { target: { value: 'Europe/Berlin' } });
    fireEvent.click(screen.getByText('Ask a shopper where to reply when nobody can answer now'));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(saveDraftSections).toHaveBeenCalledTimes(1));
    const [siteId, sections] = saveDraftSections.mock.calls[0] as [
      string,
      Array<{ section: string; payload: unknown }>,
    ];
    expect(siteId).toBe('site-1');
    expect(sections.map((s) => s.section)).toEqual([
      'behaviour',
      'notifications',
      'contactCapture',
      'attachments',
      'orderLookup',
    ]);
    const bySection = Object.fromEntries(sections.map((s) => [s.section, s.payload]));
    expect(bySection.behaviour).toMatchObject({ availabilityTimezone: 'Europe/Berlin' });
    expect(bySection.notifications).toEqual({
      emailOnHandoff: true,
      recipients: ['owner@example.com'],
    });
    expect(bySection.contactCapture).toEqual({ enabled: true, askOutsideHours: false });
    expect(bySection.attachments).toEqual({ enabled: false, triageEnabled: false });
    expect(bySection.orderLookup).toEqual({ enabled: false });
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
  });

  it('sends the recipients textarea value in the notifications payload', async () => {
    renderEditor({}, { notifications: { emailOnHandoff: true, recipients: [] } });

    const textarea = screen.getByLabelText('Send to these addresses instead (one per line)');
    fireEvent.change(textarea, { target: { value: 'a@x.com\nb@y.com ' } });
    // The raw typed text stays put under the cursor (trailing space kept).
    expect(textarea).toHaveValue('a@x.com\nb@y.com ');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(saveDraftSections).toHaveBeenCalledTimes(1));
    const [, sections] = saveDraftSections.mock.calls[0] as [
      string,
      Array<{ section: string; payload: { recipients: string[] } }>,
    ];
    const notifications = sections.find((s) => s.section === 'notifications');
    expect(notifications?.payload.recipients).toEqual(['a@x.com', 'b@y.com']);
  });
});


describe('BehaviourEditor saved replies', () => {
  it('renders all replies and their status in its own section', () => {
    renderEditor({}, { cannedReplies: REPLIES });
    expect(screen.getByRole('heading', { name: 'Saved replies' })).toBeInTheDocument();
    expect(screen.getByText('Shipping')).toBeInTheDocument();
    expect(screen.getByText('Old policy')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('adds immediately without saving the Behaviour draft and clears the inputs', async () => {
    renderEditor();
    expect(screen.getByText('No saved replies yet — add one above.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Reply title…'), { target: { value: ' Shipping ' } });
    fireEvent.change(screen.getByLabelText('Reply text…'), { target: { value: ' Ships fast ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add reply' }));
    expect(await screen.findByText('Saved reply added.')).toBeInTheDocument();
    expect(addCannedReply).toHaveBeenCalledWith('site-1', 'Shipping', 'Ships fast');
    expect(screen.getByLabelText('Reply title…')).toHaveValue('');
    expect(screen.getByLabelText('Reply text…')).toHaveValue('');
    expect(saveDraftSections).not.toHaveBeenCalled();
  });

  it.each([['Disable', 'r-1', 'disabled'], ['Enable', 'r-2', 'active']])('handles %s immediately', async (name, id, status) => {
    renderEditor({}, { cannedReplies: REPLIES });
    fireEvent.click(screen.getByRole('button', { name }));
    await waitFor(() => expect(updateCannedReplyStatus).toHaveBeenCalledWith('site-1', id, status));
    expect(saveDraftSections).not.toHaveBeenCalled();
  });

  it('deletes immediately without saving the Behaviour draft', async () => {
    renderEditor({}, { cannedReplies: REPLIES });
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await waitFor(() => expect(deleteCannedReply).toHaveBeenCalledWith('site-1', 'r-1'));
    expect(saveDraftSections).not.toHaveBeenCalled();
  });

  it('adds on title Enter without submitting the outer draft form', async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText('Reply title…'), { target: { value: 'Shipping' } });
    fireEvent.change(screen.getByLabelText('Reply text…'), { target: { value: 'Ships fast' } });
    expect(fireEvent.keyDown(screen.getByLabelText('Reply title…'), { key: 'Enter' })).toBe(false);
    expect(await screen.findByText('Saved reply added.')).toBeInTheDocument();
    expect(saveDraftSections).not.toHaveBeenCalled();
  });

  it('keeps input and shows an add failure', async () => {
    addCannedReply.mockResolvedValueOnce({ ok: false, error: 'Could not add reply.' });
    renderEditor();
    fireEvent.change(screen.getByLabelText('Reply title…'), { target: { value: 'Shipping' } });
    fireEvent.change(screen.getByLabelText('Reply text…'), { target: { value: 'Ships fast' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add reply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not add reply.');
    expect(screen.getByLabelText('Reply title…')).toHaveValue('Shipping');
  });
});
