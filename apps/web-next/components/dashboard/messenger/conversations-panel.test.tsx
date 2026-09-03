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
