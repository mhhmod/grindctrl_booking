// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessengerLocale, MessengerNotifications } from './types';

/* The notifier sits after escalation has already landed — a lost email must
   never lose the handoff. These tests pin the gate order (recipients, then
   throttle, then claim LAST) and the "never throws" contract that makes that
   safe to call from a hot path without a try/catch at every call site. */

const mocks = vi.hoisted(() => {
  return {
    claimHandoffNotification: vi.fn(async () => true),
    listMessages: vi.fn(async () => [] as Array<{ role: string; content: string }>),
    recordEvent: vi.fn(async () => {}),
    sendHandoffNotification: vi.fn(async (_input: unknown) => ({ sent: true })),
    /** workspace_members query result, swapped per test. */
    membersResult: { current: { data: [] as unknown[], error: null as unknown } },
    /** widget_events head-count result, swapped per test. */
    eventsCountResult: { current: { count: 0 as number | null, error: null as unknown } },
  };
});

vi.mock('@/lib/messenger/conversations', () => ({
  claimHandoffNotification: mocks.claimHandoffNotification,
  listMessages: mocks.listMessages,
  recordEvent: mocks.recordEvent,
}));

vi.mock('@/lib/email/handoff-notification-sender', () => ({
  sendHandoffNotification: mocks.sendHandoffNotification,
}));

// Real semantics, stubbed to avoid pulling in @clerk/nextjs/server via provisioning.ts.
vi.mock('@/lib/messenger/provisioning', () => ({
  isPlaceholderEmail: (email: string | null | undefined) =>
    !email || email.endsWith('@users.noreply.clerk.dev'),
}));

/* Minimal PostgREST-shaped builder: every method chains, and awaiting it at
   any point yields the table's configured result. Same idiom as
   app/dashboard/messenger/actions.test.ts. */
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: (table: string) => {
      const result = table === 'workspace_members' ? mocks.membersResult : mocks.eventsCountResult;
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        gte: () => builder,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result.current).then(resolve),
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claimHandoffNotification.mockResolvedValue(true);
  mocks.listMessages.mockResolvedValue([]);
  mocks.sendHandoffNotification.mockResolvedValue({ sent: true });
  mocks.membersResult.current = { data: [], error: null };
  mocks.eventsCountResult.current = { count: 0, error: null };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('notifyHandoff', () => {
  it('does nothing when emailOnHandoff is false', async () => {
    await notifyHandoff(makeInput({ notifications: { emailOnHandoff: false } }));

    expect(mocks.claimHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.sendHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });

  it('sends to explicitly configured recipients when the claim succeeds, and records handoff_notified', async () => {
    await notifyHandoff(makeInput({ notifications: { recipients: ['owner@merchant.com'] } }));

    expect(mocks.claimHandoffNotification).toHaveBeenCalledWith('conv-1');
    expect(mocks.sendHandoffNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendHandoffNotification.mock.calls[0][0]).toMatchObject({ to: ['owner@merchant.com'] });
    expect(mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1', conversationId: 'conv-1', eventName: 'handoff_notified' }),
    );
  });

  it('sends nothing when the claim is lost to a concurrent request', async () => {
    mocks.claimHandoffNotification.mockResolvedValue(false);

    await notifyHandoff(makeInput());

    expect(mocks.sendHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });

  it('skips the send and records handoff_notify_throttled at 10+ handoff_notified events in the last hour', async () => {
    mocks.eventsCountResult.current = { count: 10, error: null };

    await notifyHandoff(makeInput());

    expect(mocks.claimHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.sendHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1', conversationId: 'conv-1', eventName: 'handoff_notify_throttled' }),
    );
  });

  it('records handoff_notify_skipped/no_recipient and does not claim when nobody is reachable', async () => {
    // Mirrors what the real .in('role', ['owner','admin']) filter would
    // already have excluded — the stub builder doesn't apply filters itself.
    mocks.membersResult.current = {
      data: [{ role: 'owner', profiles: { email: 'owner@users.noreply.clerk.dev' } }],
      error: null,
    };

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
