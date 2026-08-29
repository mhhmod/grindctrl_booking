// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessengerLocale, MessengerNotifications } from './types';

/* The notifier sits after escalation has already landed — a lost email must
   never lose the handoff. These tests pin: the gate order (SMTP configured,
   then recipients, then throttle — all before the claim, and the claim
   taken LAST), the "never throws" contract, that a failed send releases the
   claim instead of burning it, and that the email carries the most RECENT
   messages in chronological order (not the oldest six). */

const mocks = vi.hoisted(() => {
  return {
    claimHandoffNotification: vi.fn(async () => true),
    releaseHandoffNotification: vi.fn(async () => {}),
    listMessages: vi.fn(async () => [] as Array<{ role: string; content: string }>),
    recordEvent: vi.fn(async () => {}),
    sendHandoffNotification: vi.fn(async (_input: unknown) => ({ sent: true })),
    hasSmtpConfigured: vi.fn(() => true),
    /** Row fixtures the mocked query builder filters against — see the
     *  db mock below, which actually applies .eq/.in/.gte instead of
     *  ignoring them, so a deleted filter makes the relevant test fail. */
    membersRows: { current: [] as Array<Record<string, unknown>> },
    eventsRows: { current: [] as Array<Record<string, unknown>> },
  };
});

vi.mock('@/lib/messenger/conversations', () => ({
  claimHandoffNotification: mocks.claimHandoffNotification,
  releaseHandoffNotification: mocks.releaseHandoffNotification,
  listMessages: mocks.listMessages,
  recordEvent: mocks.recordEvent,
}));

vi.mock('@/lib/email/handoff-notification-sender', () => ({
  sendHandoffNotification: mocks.sendHandoffNotification,
}));

vi.mock('@/lib/email/transport', () => ({
  hasSmtpConfigured: mocks.hasSmtpConfigured,
}));

/* PostgREST-shaped builder that actually filters the fixture rows by the
   predicates chained onto it, rather than ignoring them — a stub that
   returns its canned result regardless of .eq/.in/.gte lets a deleted
   filter in the real query pass every test undetected. */
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: (table: string) => {
      const source = table === 'workspace_members' ? mocks.membersRows : mocks.eventsRows;
      let rows = source.current;
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          rows = rows.filter((r) => r[col] === val);
          return builder;
        },
        in: (col: string, vals: unknown[]) => {
          rows = rows.filter((r) => vals.includes(r[col] as never));
          return builder;
        },
        gte: (col: string, val: unknown) => {
          rows = rows.filter((r) => (r[col] as string) >= (val as string));
          return builder;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve),
      };
      return builder;
    },
  }),
}));

import { notifyHandoff, type NotifyHandoffInput } from './notify';

function makeInput(overrides?: {
  notifications?: Partial<MessengerNotifications>;
  locale?: MessengerLocale;
  metadata?: Record<string, unknown>;
}): NotifyHandoffInput {
  return {
    site: {
      id: 'site-1',
      name: "Sara's Store",
      workspace_id: 'ws-1',
      locale: overrides?.locale ?? 'en',
      notifications: {
        emailOnHandoff: true,
        recipients: ['owner@merchant.com'],
        ...overrides?.notifications,
      },
    },
    conversation: {
      id: 'conv-1',
      handoff_reason: 'shopper asked for a human',
      handoff_summary: 'wants a refund',
      metadata: overrides?.metadata ?? {},
    },
  };
}

/** Last payload handed to sendHandoffNotification, typed for convenience. */
function lastSendCall() {
  return mocks.sendHandoffNotification.mock.calls.at(-1)?.[0] as {
    to: string[];
    recentMessages: Array<{ role: string; content: string }>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claimHandoffNotification.mockResolvedValue(true);
  mocks.releaseHandoffNotification.mockResolvedValue(undefined);
  mocks.listMessages.mockResolvedValue([]);
  mocks.sendHandoffNotification.mockResolvedValue({ sent: true });
  mocks.hasSmtpConfigured.mockReturnValue(true);
  mocks.membersRows.current = [];
  mocks.eventsRows.current = [];
});

describe('notifyHandoff', () => {
  it('does nothing when emailOnHandoff is false', async () => {
    await notifyHandoff(makeInput({ notifications: { emailOnHandoff: false } }));

    expect(mocks.hasSmtpConfigured).not.toHaveBeenCalled();
    expect(mocks.claimHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.sendHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });

  it('skips with handoff_notify_skipped/smtp_not_configured and does not claim when SMTP is unset', async () => {
    mocks.hasSmtpConfigured.mockReturnValue(false);

    await notifyHandoff(makeInput());

    expect(mocks.claimHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.sendHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: 'site-1',
        conversationId: 'conv-1',
        eventName: 'handoff_notify_skipped',
        payload: expect.objectContaining({ reason: 'smtp_not_configured' }),
      }),
    );
  });

  it('sends to explicitly configured recipients when the claim succeeds, and records handoff_notified', async () => {
    await notifyHandoff(makeInput({ notifications: { recipients: ['owner@merchant.com'] } }));

    expect(mocks.claimHandoffNotification).toHaveBeenCalledWith('conv-1');
    expect(mocks.sendHandoffNotification).toHaveBeenCalledTimes(1);
    expect(lastSendCall().to).toEqual(['owner@merchant.com']);
    expect(mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1', conversationId: 'conv-1', eventName: 'handoff_notified' }),
    );
  });

  it('emails the three most recent messages in chronological order, not the oldest six', async () => {
    // {limit: 3, newestFirst: true} comes back newest-first; notify.ts must
    // .reverse() it before handing it to the email builder.
    mocks.listMessages.mockResolvedValue([
      { role: 'assistant', content: 'newest reply' },
      { role: 'user', content: 'middle question' },
      { role: 'assistant', content: 'oldest reply' },
    ]);

    await notifyHandoff(makeInput());

    expect(mocks.listMessages).toHaveBeenCalledWith('conv-1', { limit: 3, newestFirst: true });
    expect(lastSendCall().recentMessages).toEqual([
      { role: 'assistant', content: 'oldest reply' },
      { role: 'user', content: 'middle question' },
      { role: 'assistant', content: 'newest reply' },
    ]);
  });

  it('sends nothing when the claim is lost to a concurrent request, but records why', async () => {
    mocks.claimHandoffNotification.mockResolvedValue(false);

    await notifyHandoff(makeInput());

    expect(mocks.sendHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: 'site-1',
        conversationId: 'conv-1',
        eventName: 'handoff_notify_skipped',
        payload: expect.objectContaining({ reason: 'already_claimed' }),
      }),
    );
  });

  it('releases the claim and records handoff_notify_failed when the send fails', async () => {
    mocks.sendHandoffNotification.mockResolvedValue({ sent: false });

    await notifyHandoff(makeInput());

    expect(mocks.claimHandoffNotification).toHaveBeenCalledWith('conv-1');
    expect(mocks.releaseHandoffNotification).toHaveBeenCalledWith('conv-1');
    expect(mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'handoff_notify_failed' }),
    );
    expect(mocks.recordEvent).not.toHaveBeenCalledWith(expect.objectContaining({ eventName: 'handoff_notified' }));
  });

  it('skips the send and records handoff_notify_throttled at 10+ handoff_notified events in the last hour', async () => {
    mocks.eventsRows.current = Array.from({ length: 10 }, () => ({
      widget_site_id: 'site-1',
      event_name: 'handoff_notified',
      created_at: new Date().toISOString(),
    }));

    await notifyHandoff(makeInput());

    expect(mocks.claimHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.sendHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'handoff_notify_throttled' }),
    );
  });

  it('is not fooled by events with the wrong name or events outside the hour window', async () => {
    const now = Date.now();
    const wrongName = Array.from({ length: 10 }, () => ({
      widget_site_id: 'site-1',
      event_name: 'handoff_notify_skipped', // not 'handoff_notified'
      created_at: new Date(now).toISOString(),
    }));
    const tooOld = Array.from({ length: 10 }, () => ({
      widget_site_id: 'site-1',
      event_name: 'handoff_notified',
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    }));
    mocks.eventsRows.current = [...wrongName, ...tooOld];

    await notifyHandoff(makeInput());

    expect(mocks.sendHandoffNotification).toHaveBeenCalledTimes(1);
    expect(mocks.recordEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'handoff_notify_throttled' }),
    );
  });

  it('excludes member-role recipients and recipients from a different workspace', async () => {
    mocks.membersRows.current = [
      { workspace_id: 'ws-1', role: 'owner', profiles: { email: 'owner@merchant.com' } },
      { workspace_id: 'ws-1', role: 'member', profiles: { email: 'member@merchant.com' } },
      { workspace_id: 'ws-other', role: 'owner', profiles: { email: 'other-workspace-owner@merchant.com' } },
    ];

    await notifyHandoff(makeInput({ notifications: { recipients: [] } }));

    expect(lastSendCall().to).toEqual(['owner@merchant.com']);
  });

  it('caps resolved workspace recipients at 5', async () => {
    mocks.membersRows.current = Array.from({ length: 6 }, (_, i) => ({
      workspace_id: 'ws-1',
      role: 'owner',
      profiles: { email: `owner${i}@merchant.com` },
    }));

    await notifyHandoff(makeInput({ notifications: { recipients: [] } }));

    expect(lastSendCall().to).toHaveLength(5);
  });

  it('normalizes recipient email case so the same address does not double up', async () => {
    mocks.membersRows.current = [
      { workspace_id: 'ws-1', role: 'owner', profiles: { email: 'Owner@Merchant.com' } },
      { workspace_id: 'ws-1', role: 'admin', profiles: { email: 'owner@merchant.com' } },
    ];

    await notifyHandoff(makeInput({ notifications: { recipients: [] } }));

    expect(lastSendCall().to).toEqual(['owner@merchant.com']);
  });

  it('records handoff_notify_skipped/no_recipient and does not claim when nobody is reachable', async () => {
    mocks.membersRows.current = [
      { workspace_id: 'ws-1', role: 'owner', profiles: { email: 'owner@users.noreply.clerk.dev' } },
    ];

    await notifyHandoff(makeInput({ notifications: { recipients: [] } }));

    expect(mocks.claimHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.sendHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: 'site-1',
        conversationId: 'conv-1',
        eventName: 'handoff_notify_skipped',
        payload: expect.objectContaining({ reason: 'no_recipient' }),
      }),
    );
  });

  it('never throws even when an inner call rejects', async () => {
    mocks.claimHandoffNotification.mockRejectedValue(new Error('db unreachable'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(notifyHandoff(makeInput())).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledWith('[messenger] notifyHandoff failed:', expect.anything());
  });
});
