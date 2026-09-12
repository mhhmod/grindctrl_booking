import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationsPanel, type ConversationListItem } from './conversations-panel';

const fetchConversationMessages = vi.fn();
const staffReply = vi.fn();
const pingStaffTyping = vi.fn();
const addInternalNote = vi.fn();
const takeoverConversation = vi.fn();
const assignConversationAction = vi.fn();
const releaseConversation = vi.fn();
const closeConversationAction = vi.fn();
const markConversationRead = vi.fn();
const addCannedReply = vi.fn();
const updateCannedReplyStatus = vi.fn();
const deleteCannedReply = vi.fn();

const actions = {
  fetchConversationMessages,
  staffReply,
  pingStaffTyping,
  addInternalNote,
  takeoverConversation,
  assignConversationAction,
  releaseConversation,
  closeConversationAction,
  markConversationRead,
  addCannedReply,
  updateCannedReplyStatus,
  deleteCannedReply,
};

const CONVERSATIONS: ConversationListItem[] = [
  {
    id: 'conv-1',
    status: 'open',
    startedAt: '2026-08-30T10:00:00.000Z',
    lastMessageAt: '2026-08-30T10:05:00.000Z',
    visitorEmail: 'shopper@example.com',
    visitorName: null,
    handoffReason: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  fetchConversationMessages.mockResolvedValue({
    ok: true,
    status: 'open',
    messages: [{ id: 'm-1', role: 'user', content: 'Where is my order?', createdAt: '2026-08-30T10:00:00.000Z' }],
    attachments: {},
  });
  pingStaffTyping.mockResolvedValue({ ok: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('ConversationsPanel', () => {
  it('loads messages through the injected actions prop, not a direct import', async () => {
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);

    await waitFor(() => expect(fetchConversationMessages).toHaveBeenCalledWith('site-1', 'conv-1'));
    expect(await screen.findByText('Where is my order?')).toBeInTheDocument();
  });

  it('takes over the conversation through actions.takeoverConversation', async () => {
    takeoverConversation.mockResolvedValue({ ok: true });
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);
    await screen.findByText('Where is my order?');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Take over' }));
    });

    expect(takeoverConversation).toHaveBeenCalledWith('site-1', 'conv-1');
  });

  it('sends a staff reply through actions.staffReply', async () => {
    staffReply.mockResolvedValue({ ok: true });
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);
    await screen.findByText('Where is my order?');

    fireEvent.change(screen.getByLabelText('Type your reply…'), { target: { value: 'Shipped yesterday!' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    expect(staffReply).toHaveBeenCalledWith('site-1', 'conv-1', 'Shipped yesterday!');
  });
});

/* Saved replies live with the composer: picking one only pre-fills the
   draft — it must never send by itself — and the inline manager routes
   add/disable/delete through the matching host actions. */
describe('ConversationsPanel canned replies', () => {
  const REPLIES = [
    {
      id: 'r-1',
      title: 'Shipping times',
      content: 'We ship in 2 days.',
      status: 'active' as const,
      sort_order: 0,
      updated_at: '2026-08-30T10:00:00.000Z',
    },
    {
      id: 'r-2',
      title: 'Old policy',
      content: 'No longer offered.',
      status: 'disabled' as const,
      sort_order: 1,
      updated_at: '2026-08-29T10:00:00.000Z',
    },
  ];

  beforeEach(() => {
    addCannedReply.mockResolvedValue({ ok: true });
    updateCannedReplyStatus.mockResolvedValue({ ok: true });
    deleteCannedReply.mockResolvedValue({ ok: true });
  });

  it('fills the draft with the reply content without sending it', async () => {
    render(
      <ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} cannedReplies={REPLIES} actions={actions} />,
    );
    await screen.findByText('Where is my order?');

    fireEvent.click(screen.getByRole('button', { name: 'Saved replies' }));
    fireEvent.click(screen.getByRole('button', { name: 'Shipping times' }));

    expect(screen.getByLabelText('Type your reply…')).toHaveValue('We ship in 2 days.');
    expect(staffReply).not.toHaveBeenCalled();
  });

  it('lists only active replies in the insert list', async () => {
    render(
      <ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} cannedReplies={REPLIES} actions={actions} />,
    );
    await screen.findByText('Where is my order?');

    fireEvent.click(screen.getByRole('button', { name: 'Saved replies' }));

    expect(screen.getByRole('button', { name: 'Shipping times' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Old policy' })).not.toBeInTheDocument();
  });

  it('hides the insert control entirely when no active reply exists', async () => {
    render(
      <ConversationsPanel
        locale="en"
        siteId="site-1"
        conversations={CONVERSATIONS}
        cannedReplies={[REPLIES[1]]}
        actions={actions}
      />,
    );
    await screen.findByText('Where is my order?');

    expect(screen.queryByRole('button', { name: 'Saved replies' })).not.toBeInTheDocument();
    // The manager is still discoverable — it is how the first reply gets added.
    expect(screen.getByRole('button', { name: 'Manage saved replies' })).toBeInTheDocument();
  });

  it('adds a reply through actions.addCannedReply', async () => {
    render(
      <ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} cannedReplies={[]} actions={actions} />,
    );
    await screen.findByText('Where is my order?');

    fireEvent.click(screen.getByRole('button', { name: 'Manage saved replies' }));
    fireEvent.change(screen.getByLabelText('Reply title…'), { target: { value: 'Shipping' } });
    fireEvent.change(screen.getByLabelText('Reply text…'), { target: { value: 'Ships fast' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add reply' }));
    });

    expect(addCannedReply).toHaveBeenCalledWith('site-1', 'Shipping', 'Ships fast');
  });

  it('toggles a reply status through actions.updateCannedReplyStatus', async () => {
    render(
      <ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} cannedReplies={REPLIES} actions={actions} />,
    );
    await screen.findByText('Where is my order?');

    fireEvent.click(screen.getByRole('button', { name: 'Manage saved replies' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    });

    expect(updateCannedReplyStatus).toHaveBeenCalledWith('site-1', 'r-1', 'disabled');
  });

  it('deletes a reply through actions.deleteCannedReply', async () => {
    render(
      <ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} cannedReplies={REPLIES} actions={actions} />,
    );
    await screen.findByText('Where is my order?');

    fireEvent.click(screen.getByRole('button', { name: 'Manage saved replies' }));
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    });

    expect(deleteCannedReply).toHaveBeenCalledWith('site-1', 'r-1');
  });
});

/* A moderator with no technical background cannot parse a raw handoff_reason
   code like 'shopper_requested_human' — it must never render verbatim. */
describe('ConversationsPanel handoff reason', () => {
  it('shows a human-readable label for a known handoff reason, never the raw code', async () => {
    render(
      <ConversationsPanel
        locale="en"
        siteId="site-1"
        conversations={[{ ...CONVERSATIONS[0], handoffReason: 'shopper_requested_human' }]}
        actions={actions}
      />,
    );

    expect(await screen.findByText('Shopper asked for a human')).toBeInTheDocument();
    expect(screen.queryByText('shopper_requested_human')).not.toBeInTheDocument();
  });

  it('shows a human-readable label for the AI-escalated reason', () => {
    render(
      <ConversationsPanel
        locale="en"
        siteId="site-1"
        conversations={[{ ...CONVERSATIONS[0], handoffReason: 'assistant_escalated' }]}
        actions={actions}
      />,
    );

    expect(screen.getByText('AI handed this off')).toBeInTheDocument();
    expect(screen.queryByText('assistant_escalated')).not.toBeInTheDocument();
  });

  it('falls back to a plain label instead of leaking an unrecognized code', () => {
    render(
      <ConversationsPanel
        locale="en"
        siteId="site-1"
        conversations={[{ ...CONVERSATIONS[0], handoffReason: 'some_future_internal_code' }]}
        actions={actions}
      />,
    );

    expect(screen.getByText('Handed off to your team')).toBeInTheDocument();
    expect(screen.queryByText('some_future_internal_code')).not.toBeInTheDocument();
  });
});

/* The inbox had no notion of read at all: a conversation holding a question
   nobody had seen looked identical to one already answered. */
describe('ConversationsPanel unread', () => {
  const UNREAD: ConversationListItem[] = [
    { ...CONVERSATIONS[0], id: 'conv-1', unreadCount: 3 },
    {
      id: 'conv-2',
      status: 'open',
      startedAt: '2026-08-30T09:00:00.000Z',
      lastMessageAt: '2026-08-30T09:30:00.000Z',
      visitorEmail: null,
      visitorName: 'Read already',
      handoffReason: null,
      unreadCount: 0,
    },
  ];

  it('shows a per-conversation count and a total', () => {
    render(
      <ConversationsPanel
        locale="en"
        siteId="site-1"
        conversations={UNREAD}
        actions={actions}
      />,
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('3 unread')).toBeInTheDocument();
  });

  it('says so plainly when nothing is waiting', () => {
    render(
      <ConversationsPanel
        locale="en"
        siteId="site-1"
        conversations={[{ ...CONVERSATIONS[0], unreadCount: 0 }]}
        actions={actions}
      />,
    );

    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });

  it('marks a conversation read when it is opened, and only if it was unread', () => {
    render(
      <ConversationsPanel
        locale="en"
        siteId="site-1"
        conversations={UNREAD}
        actions={actions}
      />,
    );

    fireEvent.click(screen.getByText('Read already'));
    expect(markConversationRead).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('shopper@example.com'));
    expect(markConversationRead).toHaveBeenCalledWith('site-1', 'conv-1');
  });
});

/* The inbox shows who each taken-over conversation is assigned to, and a
   signed-in dashboard viewer can filter to their own. The embedded Shopify
   surface has no per-staff-member identity, so it never passes
   currentProfileId — and then no filter control may render at all. */
describe('ConversationsPanel assignee', () => {
  const ASSIGNED: ConversationListItem[] = [
    {
      ...CONVERSATIONS[0],
      id: 'conv-1',
      visitorName: 'Shopper One',
      assigneeId: 'me-1',
      assigneeName: 'Sara Khan',
    },
    {
      ...CONVERSATIONS[0],
      id: 'conv-2',
      visitorName: 'Shopper Two',
      assigneeId: 'other-9',
      assigneeName: 'Omar',
    },
  ];

  it('renders the assignee name next to an assigned conversation', () => {
    render(
      <ConversationsPanel locale="en" siteId="site-1" conversations={ASSIGNED} actions={actions} />,
    );

    expect(screen.getByText('Assigned to Sara Khan')).toBeInTheDocument();
    expect(screen.getByText('Assigned to Omar')).toBeInTheDocument();
  });

  it('renders no "Assigned to me" filter without a currentProfileId', () => {
    render(
      <ConversationsPanel locale="en" siteId="site-1" conversations={ASSIGNED} actions={actions} />,
    );

    expect(screen.queryByRole('button', { name: 'Assigned to me' })).not.toBeInTheDocument();
    expect(screen.getByText('Shopper One')).toBeInTheDocument();
    expect(screen.getByText('Shopper Two')).toBeInTheDocument();
  });

  it('filters the list to only my conversations when the toggle is active', () => {
    render(
      <ConversationsPanel
        locale="en"
        siteId="site-1"
        conversations={ASSIGNED}
        actions={actions}
        currentProfileId="me-1"
      />,
    );

    expect(screen.getByText('Shopper One')).toBeInTheDocument();
    expect(screen.getByText('Shopper Two')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Assigned to me' }));

    expect(screen.getByText('Shopper One')).toBeInTheDocument();
    expect(screen.queryByText('Shopper Two')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(screen.getByText('Shopper One')).toBeInTheDocument();
    expect(screen.getByText('Shopper Two')).toBeInTheDocument();
  });

  it('shows an empty state instead of a blank list when nothing is assigned to me', () => {
    render(
      <ConversationsPanel
        locale="en"
        siteId="site-1"
        conversations={[ASSIGNED[1]]}
        actions={actions}
        currentProfileId="me-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Assigned to me' }));

    expect(screen.getByText('No conversations match')).toBeInTheDocument();
  });
});
/* Search and status filters are pure client-side filters over the already
   loaded `conversations` prop — no round trip, no query param. All three
   filters (search, status, mineOnly) compose with AND semantics. */
describe('ConversationsPanel search and status filters', () => {
  const FILTERABLE: ConversationListItem[] = [
    {
      id: 'conv-alice',
      status: 'open',
      startedAt: '2026-08-30T10:00:00.000Z',
      lastMessageAt: '2026-08-30T10:05:00.000Z',
      visitorEmail: 'alice@example.com',
      visitorName: 'Alice Shopper',
      handoffReason: null,
      preview: 'Where is my refund?',
    },
    {
      id: 'conv-bob',
      status: 'handoff_requested',
      startedAt: '2026-08-30T09:00:00.000Z',
      lastMessageAt: '2026-08-30T09:30:00.000Z',
      visitorEmail: 'bob@example.com',
      visitorName: null,
      handoffReason: null,
      preview: 'I need a human urgently',
    },
    {
      id: 'conv-cara',
      status: 'handoff_active',
      startedAt: '2026-08-30T08:00:00.000Z',
      lastMessageAt: '2026-08-30T08:30:00.000Z',
      visitorEmail: null,
      visitorName: 'Cara',
      handoffReason: null,
      preview: null,
    },
    {
      id: 'conv-dan',
      status: 'closed',
      startedAt: '2026-08-29T10:00:00.000Z',
      lastMessageAt: '2026-08-29T10:05:00.000Z',
      visitorEmail: 'dan@example.com',
      visitorName: 'Dan',
      handoffReason: null,
      preview: 'Thanks, all good!',
    },
  ];

  function renderFilterable(extra?: { currentProfileId?: string }) {
    render(
      <ConversationsPanel
        locale="en"
        siteId="site-1"
        conversations={FILTERABLE}
        actions={actions}
        currentProfileId={extra?.currentProfileId}
      />,
    );
  }

  it('shows every conversation before any filter is applied', () => {
    renderFilterable();

    expect(screen.getByText('Alice Shopper')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('Cara')).toBeInTheDocument();
    expect(screen.getByText('Dan')).toBeInTheDocument();
  });

  it('narrows the list by visitor name, case-insensitively', () => {
    renderFilterable();

    fireEvent.change(screen.getByLabelText('Search conversations'), { target: { value: 'ALICE' } });

    expect(screen.getByText('Alice Shopper')).toBeInTheDocument();
    expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('Cara')).not.toBeInTheDocument();
    expect(screen.queryByText('Dan')).not.toBeInTheDocument();
  });

  it('matches against visitor email and message preview too', () => {
    renderFilterable();

    // Email match (null visitorName on conv-bob must not crash).
    fireEvent.change(screen.getByLabelText('Search conversations'), { target: { value: 'bob@example' } });
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Alice Shopper')).not.toBeInTheDocument();

    // Preview match.
    fireEvent.change(screen.getByLabelText('Search conversations'), { target: { value: 'refund' } });
    expect(screen.getByText('Alice Shopper')).toBeInTheDocument();
    expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument();
  });

  it('restores the full list when the search box is cleared', () => {
    renderFilterable();

    const search = screen.getByLabelText('Search conversations');
    fireEvent.change(search, { target: { value: 'alice' } });
    expect(screen.queryByText('Dan')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getByText('Alice Shopper')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('Cara')).toBeInTheDocument();
    expect(screen.getByText('Dan')).toBeInTheDocument();
  });

  it('each status pill shows only its bucket; All statuses restores everything', () => {
    renderFilterable();

    fireEvent.click(screen.getByRole('button', { name: 'Needs a reply' }));
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Alice Shopper')).not.toBeInTheDocument();
    expect(screen.queryByText('Cara')).not.toBeInTheDocument();
    expect(screen.queryByText('Dan')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'In progress' }));
    expect(screen.getByText('Alice Shopper')).toBeInTheDocument();
    expect(screen.getByText('Cara')).toBeInTheDocument();
    expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('Dan')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resolved' }));
    expect(screen.getByText('Dan')).toBeInTheDocument();
    expect(screen.queryByText('Alice Shopper')).not.toBeInTheDocument();
    expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('Cara')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All statuses' }));
    expect(screen.getByText('Alice Shopper')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('Cara')).toBeInTheDocument();
    expect(screen.getByText('Dan')).toBeInTheDocument();
  });

  it('applies search AND status together — a text match outside the bucket is excluded', () => {
    renderFilterable();

    // "human" only appears in conv-bob's preview, which is handoff_requested,
    // not "In progress" — so combining both filters must hide it.
    fireEvent.change(screen.getByLabelText('Search conversations'), { target: { value: 'human' } });
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'In progress' }));
    expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('No conversations match')).toBeInTheDocument();
  });

  it('renders the filtered empty state when a combination matches nothing', () => {
    renderFilterable();

    fireEvent.change(screen.getByLabelText('Search conversations'), { target: { value: 'no-such-shopper-zzz' } });

    expect(screen.getByText('No conversations match')).toBeInTheDocument();
    expect(screen.queryByText('Alice Shopper')).not.toBeInTheDocument();
  });

  it('still renders the true empty state when the host sends zero conversations', () => {
    render(
      <ConversationsPanel locale="en" siteId="site-1" conversations={[]} actions={actions} />,
    );

    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search conversations')).not.toBeInTheDocument();
  });
});
/* The panel renders `attachments[message.id]` for every message. When a host
   returns a result without that field the lookup throws during render, React
   unmounts the panel, and the merchant is left with a blank Conversations tab
   and nothing said about why — the worst possible failure for an inbox. */
describe('ConversationsPanel resilience', () => {
  it('still renders the thread when the host omits attachments entirely', async () => {    fetchConversationMessages.mockResolvedValue({
      ok: true,
      status: 'open',
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Where is my order?',
          createdAt: '2026-08-30T10:05:00.000Z',
        },
      ],
      // attachments deliberately absent
    });

    render(
      <ConversationsPanel
        locale="en"
        siteId="site-1"
        conversations={CONVERSATIONS}
        actions={actions}
      />,
    );

    expect(await screen.findByText('Where is my order?')).toBeInTheDocument();
  });
});

/* An internal note shares role 'system' with the handoff line, so without
   its own branch it would render as nothing. It must instead render as a
   clearly-marked block — never a normal chat bubble on either side — and
   the composer must route Note-mode submits to addInternalNote, resetting
   to Reply whenever another conversation is picked. */
describe('ConversationsPanel internal notes', () => {
  const TWO: ConversationListItem[] = [
    { ...CONVERSATIONS[0], id: 'conv-1', visitorName: 'Shopper One' },
    {
      ...CONVERSATIONS[0],
      id: 'conv-2',
      visitorName: 'Shopper Two',
      lastMessageAt: '2026-08-30T09:30:00.000Z',
    },
  ];

  beforeEach(() => {
    fetchConversationMessages.mockResolvedValue({
      ok: true,
      status: 'open',
      messages: [
        { id: 'm-1', role: 'user', content: 'Where is my order?', createdAt: '2026-08-30T10:00:00.000Z' },
        { id: 'm-2', role: 'system', content: 'VIP — comp shipping', createdAt: '2026-08-30T10:01:00.000Z', internal: true, noteAuthorName: 'Sara Khan' },
      ],
      attachments: {},
    });
  });

  it('renders an internal note in the distinct note style with its author, not as a chat bubble', async () => {
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);

    const note = await screen.findByTestId('internal-note');
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent('VIP — comp shipping');
    expect(note).toHaveTextContent('Sara Khan');
    // Still a normal bubble for the real shopper message alongside it.
    expect(await screen.findByText('Where is my order?')).toBeInTheDocument();
  });

  it('submits Note-mode text through addInternalNote, never staffReply', async () => {
    addInternalNote.mockResolvedValue({ ok: true });
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);
    await screen.findByText('Where is my order?');

    fireEvent.click(screen.getByRole('button', { name: 'Note' }));
    fireEvent.change(screen.getByLabelText('Type a private note…'), { target: { value: 'VIP — comp shipping' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    expect(addInternalNote).toHaveBeenCalledWith('site-1', 'conv-1', 'VIP — comp shipping');
    expect(staffReply).not.toHaveBeenCalled();
  });

  it('resets to Reply mode when another conversation is selected', async () => {
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={TWO} actions={actions} />);
    await screen.findByText('Where is my order?');

    fireEvent.click(screen.getByRole('button', { name: 'Note' }));
    expect(screen.getByRole('button', { name: 'Note' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByText('Shopper Two'));

    // Switching threads clears the status until the reload lands, so the
    // footer (and its toggle) briefly unmounts — wait for it to come back.
    expect(await screen.findByRole('button', { name: 'Reply' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Note' })).toHaveAttribute('aria-pressed', 'false');
  });
});

/* The shopper's per-reply 👍/👎 surfaces in the moderator inbox as a
   read-only glyph next to the rated reply — staff see how an answer landed,
   but this view never submits a rating itself. */
describe('ConversationsPanel message feedback', () => {
  beforeEach(() => {
    fetchConversationMessages.mockResolvedValue({
      ok: true,
      status: 'open',
      messages: [
        { id: 'm-1', role: 'user', content: 'Is this in stock?', createdAt: '2026-08-30T10:00:00.000Z' },
        { id: 'm-2', role: 'assistant', content: 'Yes — ships today.', createdAt: '2026-08-30T10:01:00.000Z', author: 'ai', feedback: 'up' },
        { id: 'm-3', role: 'assistant', content: 'Anything else?', createdAt: '2026-08-30T10:02:00.000Z', author: 'ai', feedback: 'down' },
        { id: 'm-4', role: 'assistant', content: 'Unrated reply.', createdAt: '2026-08-30T10:03:00.000Z', author: 'ai' },
      ],
      attachments: {},
    });
  });

  it('shows the shopper rating beside each rated reply', async () => {
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);

    expect(await screen.findByLabelText('Rated helpful')).toHaveTextContent('👍');
    expect(await screen.findByLabelText('Rated not helpful')).toHaveTextContent('👎');
    expect(await screen.findByText('Unrated reply.')).toBeInTheDocument();
  });

  it('never renders a clickable rating control in the staff view', async () => {
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);
    await screen.findByText('Yes — ships today.');

    expect(screen.queryByRole('button', { name: 'Helpful' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Not helpful' })).not.toBeInTheDocument();
    // The indicators themselves are glyphs, not buttons.
    expect(screen.getByLabelText('Rated helpful').tagName).not.toBe('BUTTON');
  });
});

/* Staff "typing…" presence: the Reply composer pings (debounced, fire and
   forget) so the shopper sees the dots — but the Note composer must NEVER
   ping. A note is staff-only; even a "someone is typing" signal while a
   moderator writes a private note about the shopper would breach that
   boundary. These two tests are the lock on that gate. */
describe('ConversationsPanel staff typing ping', () => {
  it('pings while typing in the Reply composer', async () => {
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);
    await screen.findByText('Where is my order?');

    fireEvent.change(screen.getByLabelText('Type your reply…'), { target: { value: 'On it, checking now' } });

    expect(pingStaffTyping).toHaveBeenCalledWith('site-1', 'conv-1');
  });

  it('pings at most once per window while typing continues', async () => {
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);
    await screen.findByText('Where is my order?');

    const box = screen.getByLabelText('Type your reply…');
    fireEvent.change(box, { target: { value: 'a' } });
    fireEvent.change(box, { target: { value: 'ab' } });
    fireEvent.change(box, { target: { value: 'abc' } });

    expect(pingStaffTyping).toHaveBeenCalledTimes(1);
  });

  it('NEVER pings while typing a private note', async () => {
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);
    await screen.findByText('Where is my order?');

    fireEvent.click(screen.getByRole('button', { name: 'Note' }));
    fireEvent.change(screen.getByLabelText('Type a private note…'), { target: { value: 'VIP — comp shipping' } });

    expect(pingStaffTyping).not.toHaveBeenCalled();
  });

  it('still sends the note through addInternalNote without pinging', async () => {
    addInternalNote.mockResolvedValue({ ok: true });
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);
    await screen.findByText('Where is my order?');

    fireEvent.click(screen.getByRole('button', { name: 'Note' }));
    fireEvent.change(screen.getByLabelText('Type a private note…'), { target: { value: 'VIP — comp shipping' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    expect(addInternalNote).toHaveBeenCalledWith('site-1', 'conv-1', 'VIP — comp shipping');
    expect(pingStaffTyping).not.toHaveBeenCalled();
  });
});


describe('ConversationsPanel teammate assignment', () => {
  const members = [{ profileId: 'p-1', name: 'Sara Khan' }, { profileId: 'p-2', name: 'عمر أحمد' }];

  it.each(['open', 'handoff_requested', 'handoff_active'])('offers assignment for %s and reflects the current assignee', async (status) => {
    fetchConversationMessages.mockResolvedValue({ ok: true, status, messages: [], attachments: {} });
    assignConversationAction.mockResolvedValue({ ok: true });
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={[{ ...CONVERSATIONS[0], status, assigneeId: 'p-1' }]} actions={actions} assignableMembers={members} />);
    const select = await screen.findByRole('combobox', { name: 'Assign conversation to a teammate' });
    expect(select).toHaveValue('p-1');
    await act(async () => { fireEvent.change(select, { target: { value: 'p-2' } }); });
    expect(assignConversationAction).toHaveBeenCalledWith('site-1', 'conv-1', 'p-2');
    expect(takeoverConversation).not.toHaveBeenCalled();
  });

  it.each([0, 1])('hides assignment for %s assignable members', async (count) => {
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} assignableMembers={members.slice(0, count)} />);
    await screen.findByText('Where is my order?');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('hides assignment for a closed conversation', async () => {
    fetchConversationMessages.mockResolvedValue({ ok: true, status: 'closed', messages: [], attachments: {} });
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={[{ ...CONVERSATIONS[0], status: 'closed' }]} actions={actions} assignableMembers={members} />);
    await screen.findByLabelText('Type a private note…');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('disables assignment while pending and keeps server failures visible after refresh', async () => {
    let finish!: (value: { ok: false; error: string }) => void;
    assignConversationAction.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} assignableMembers={members} />);
    const select = await screen.findByRole('combobox', { name: 'Assign conversation to a teammate' });
    fireEvent.change(select, { target: { value: 'p-2' } });
    await waitFor(() => expect(select).toBeDisabled());
    await act(async () => { finish({ ok: false, error: 'Not a member of this workspace.' }); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Not a member of this workspace.');
    expect(select).not.toBeDisabled();
    expect(select).toHaveValue('');
  });

  it('reflects revalidated assignments and the newly selected thread', async () => {
    const rows = [{ ...CONVERSATIONS[0], assigneeId: 'p-1' }, { ...CONVERSATIONS[0], id: 'conv-2', visitorEmail: 'second@example.com', assigneeId: 'p-2' }];
    const { rerender } = render(<ConversationsPanel locale="en" siteId="site-1" conversations={rows} actions={actions} assignableMembers={members} />);
    const select = await screen.findByRole('combobox', { name: 'Assign conversation to a teammate' });
    expect(select).toHaveValue('p-1');
    rerender(<ConversationsPanel locale="en" siteId="site-1" conversations={[{ ...rows[0], assigneeId: 'p-2' }, rows[1]]} actions={actions} assignableMembers={members} />);
    expect(select).toHaveValue('p-2');
    fireEvent.click(screen.getByRole('button', { name: /second@example.com/ }));
    expect(await screen.findByRole('combobox', { name: 'Assign conversation to a teammate' })).toHaveValue('p-2');
  });

  it('localizes the placeholder and accessible label in RTL', async () => {
    render(<ConversationsPanel locale="ar" siteId="site-1" conversations={CONVERSATIONS} actions={actions} assignableMembers={members} />);
    const select = await screen.findByRole('combobox', { name: 'إسناد المحادثة إلى زميل' });
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: 'إسناد إلى…' })).toBeDisabled();
    expect(select.closest('[dir]')).toHaveAttribute('dir', 'rtl');
  });
});
