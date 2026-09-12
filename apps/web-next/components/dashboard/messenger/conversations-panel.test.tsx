import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationsPanel, type ConversationListItem } from './conversations-panel';

const fetchConversationMessages = vi.fn();
const staffReply = vi.fn();
const takeoverConversation = vi.fn();
const releaseConversation = vi.fn();
const closeConversationAction = vi.fn();
const markConversationRead = vi.fn();

const actions = {
  fetchConversationMessages,
  staffReply,
  takeoverConversation,
  releaseConversation,
  closeConversationAction,
  markConversationRead,
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

    expect(screen.getByText('Nothing assigned to you right now')).toBeInTheDocument();
  });
});
/* The panel renders `attachments[message.id]` for every message. When a host
   returns a result without that field the lookup throws during render, React
   unmounts the panel, and the merchant is left with a blank Conversations tab
   and nothing said about why — the worst possible failure for an inbox. */
describe('ConversationsPanel resilience', () => {
  it('still renders the thread when the host omits attachments entirely', async () => {
    fetchConversationMessages.mockResolvedValue({
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
