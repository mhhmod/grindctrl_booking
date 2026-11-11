import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInboxLive, type InboxLiveActions } from './use-inbox-live';
import type { ConversationListItem } from './conversations-panel';
import { mergeInbox, notifyHandoff } from '@/lib/dashboard/inbox-live';

const first: ConversationListItem = { id: 'c1', status: 'open', startedAt: '2026-11-11T00:00:00Z', lastMessageAt: '2026-11-11T00:00:00Z', updatedAt: '2026-11-11T00:00:00Z', visitorName: 'Amira', visitorEmail: null, preview: 'Hi', handoffReason: null, unreadCount: 1 };
const initial = [first];
let visibility: 'visible' | 'hidden';
beforeEach(() => {
  vi.useFakeTimers(); visibility = 'visible'; document.title = 'Inbox';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function actions(): InboxLiveActions {
  return { listInboxConversations: vi.fn(async () => ({ ok: true as const, conversations: initial, cursor: null, checkedAt: new Date().toISOString() })),
    inboxChangesSince: vi.fn(async () => ({ ok: true as const, conversations: [], cursor: null, checkedAt: new Date().toISOString() })) };
}
describe('Inbox live data', () => {
  it('debounces server search by 300ms and pauses list requests when hidden', async () => {
    const api = actions();
    const hook = renderHook(({ query }) => useInboxLive(initial, 'site', api, query, 'all', false, 'c1', 'Needs you'), { initialProps: { query: '' } });
    hook.rerender({ query: 'a' }); await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    hook.rerender({ query: 'am' }); await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(api.listInboxConversations).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(api.listInboxConversations).toHaveBeenCalledWith(expect.objectContaining({ query: 'am' }));
    visibility = 'hidden'; await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(api.inboxChangesSince).not.toHaveBeenCalled();
    visibility = 'visible'; await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(api.inboxChangesSince).toHaveBeenCalledTimes(1); hook.unmount();
  });
  it('merges changes without removing the selected row and appends load-more pages', async () => {
    const api = actions(), next = { ...first, id: 'c2', visitorName: 'Nour' };
    vi.mocked(api.listInboxConversations!).mockResolvedValueOnce({ ok: true, conversations: initial, cursor: { id: 'c1', at: first.lastMessageAt }, checkedAt: new Date().toISOString() })
      .mockResolvedValueOnce({ ok: true, conversations: [next], cursor: null, checkedAt: new Date().toISOString() });
    vi.mocked(api.inboxChangesSince!).mockResolvedValue({ ok: true, conversations: [{ ...first, status: 'handoff_requested', preview: 'Help', updatedAt: '2026-11-11T01:00:00Z' }], cursor: null, checkedAt: new Date().toISOString() });
    const hook = renderHook(() => useInboxLive(initial, 'site', api, '', 'all', false, 'c1', 'Needs you'));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => { await hook.result.current.loadMore(); });
    expect(hook.result.current.rows.map((r) => r.id)).toEqual(['c1', 'c2']);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(hook.result.current.rows[0]).toMatchObject({ id: 'c1', status: 'handoff_requested', preview: 'Help' });
    hook.unmount();
  });
  it('preserves row order and ignores older updates', () => {
    const next = { ...first, id: 'c2' };
    expect(mergeInbox([first, next], [{ ...first, updatedAt: '2025-01-01', visitorName: 'stale' }])).toEqual([first, next]);
  });
  it('never requests notification permission on load and signals hidden handoffs only when granted', async () => {
    const notification = Object.assign(vi.fn(), { permission: 'granted', requestPermission: vi.fn() }); vi.stubGlobal('Notification', notification);
    const api = { ...actions(), inboxHandoffsSince: vi.fn(async () => ({ ok: true as const, ids: ['c2'], cursor: null, checkedAt: new Date().toISOString() })) };
    const hook = renderHook(() => useInboxLive(initial, 'site', api, '', 'all', false, 'c1', 'Needs you'));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(notification.requestPermission).not.toHaveBeenCalled();
    visibility = 'hidden'; await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(30_000); });
    expect(api.inboxChangesSince).not.toHaveBeenCalled(); expect(notification).toHaveBeenCalledTimes(1); expect(document.title).toBe('(1) Inbox');
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); }); expect(notification).toHaveBeenCalledTimes(1);
    visibility = 'visible'; await act(async () => { document.dispatchEvent(new Event('visibilitychange')); }); expect(document.title).toBe('Inbox');
    hook.unmount();
  });
  it.each(['default', 'denied'])('does not notify with permission %s', (permission) => {
    const notification = vi.fn(); Object.assign(notification, { permission }); vi.stubGlobal('Notification', notification);
    visibility = 'hidden'; notifyHandoff('Needs you', 'c1'); expect(notification).not.toHaveBeenCalled();
  });
});
