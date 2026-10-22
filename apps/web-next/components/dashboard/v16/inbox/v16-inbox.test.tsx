import React from 'react';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { V16Inbox, V16InboxError, V16InboxNoStoreChat, type InboxActions } from './v16-inbox';

const actions = new Proxy({}, { get: () => vi.fn(async () => ({ ok: true, messages: [], attachments: {}, status: 'open' })) }) as InboxActions;
const data = (conversations: Parameters<typeof V16Inbox>[0]['data']['conversations']) => ({
  siteId: 'site_1',
  conversations,
  cannedReplies: [],
  currentProfileId: 'me',
  assignableMembers: [],
});

describe('the v16 Inbox', () => {
  it('shows today’s conversations under the board’s tabs', () => {
    renderWithMantine(
      <V16Inbox
        locale="en"
        actions={actions}
        data={data([
          { id: 'c1', status: 'handoff_requested', startedAt: '2026-10-22T09:00:00Z', lastMessageAt: null, visitorEmail: null, visitorName: 'Salma', handoffReason: null },
        ])}
      />,
    );
    expect(screen.getByRole('button', { name: /^Needs you/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('Salma').length).toBeGreaterThan(0);
  });

  it('says plainly when there are no conversations, when Store Chat is not set up, and when the inbox cannot load', () => {
    const { unmount } = renderWithMantine(<V16Inbox locale="en" actions={actions} data={data([])} />);
    expect(screen.getByRole('heading', { name: 'No conversations yet' })).toBeInTheDocument();
    unmount();

    const second = renderWithMantine(<V16InboxNoStoreChat locale="ar" />);
    expect(screen.getByRole('heading', { name: 'دردشة المتجر غير مُعدّة لهذا المتجر بعد' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'افتح دردشة المتجر' })).toHaveAttribute('href', '/dashboard/store-chat/setup');
    second.unmount();

    renderWithMantine(<V16InboxError locale="en" />);
    expect(screen.getByRole('status')).toHaveTextContent("The inbox couldn't load just now.");
  });
});
