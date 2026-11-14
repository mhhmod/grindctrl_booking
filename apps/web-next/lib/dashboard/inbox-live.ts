import type { ConversationListItem } from '@/components/dashboard/messenger/conversations-panel';

/** Preserve order for existing rows (and hence scroll anchoring); insert new
 * rows at the start. Selection and local read markers live outside the list. */
export function mergeInbox(current: ConversationListItem[], changes: ConversationListItem[]): ConversationListItem[] {
  const updates = new Map(changes.map((c) => [c.id, c]));
  const known = new Set(current.map((c) => c.id));
  return [...changes.filter((c) => !known.has(c.id)), ...current.map((c) => {
    const update = updates.get(c.id);
    return update && (!c.updatedAt || !update.updatedAt || update.updatedAt >= c.updatedAt) ? update : c;
  })];
}

export function notifyHandoff(title: string, id: string): void {
  if (document.visibilityState !== 'hidden' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try { new Notification(title, { tag: `inbox-${id}` }); } catch { /* Unsupported browser: title still signals. */ }
}

export type PageAlerts = 'unsupported' | NotificationPermission;

/** Whether this page can show its own alerts. Phone browsers either lack the
 *  Notification constructor or refuse it without a service worker, so they
 *  never show one: say so instead of offering a button that does nothing. */
export function pageAlerts(): PageAlerts {
  if (typeof Notification === 'undefined' || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return 'unsupported';
  return Notification.permission;
}
