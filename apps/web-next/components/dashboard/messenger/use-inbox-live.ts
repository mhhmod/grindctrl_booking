'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
import type { InboxCursor, InboxFilter } from '@/lib/dashboard/inbox-query';
import { mergeInbox, notifyHandoff } from '@/lib/dashboard/inbox-live';
import type { ConversationListItem } from './conversations-panel';

export type InboxLiveActions = Pick<MessengerHostActions, 'listInboxConversations' | 'inboxChangesSince' | 'inboxHandoffsSince'>;

export function useInboxLive(initial: ConversationListItem[], siteId: string, actions: InboxLiveActions,
  query: string, filter: InboxFilter, mineOnly: boolean, selectedId: string | null, notificationTitle: string) {
  const [rows, setRows] = useState(initial);
  const [knownRows, setKnownRows] = useState(initial);
  const [cursor, setCursor] = useState<InboxCursor | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const selected = useRef(selectedId);
  const rowsRef = useRef(rows);
  useEffect(() => { selected.current = selectedId; rowsRef.current = rows; }, [selectedId, rows]);
  const seq = useRef(0);
  const cancelPage = useCallback(() => { seq.current++; }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconcile refreshed server props with locally read rows
    setRows((prev) => mergeInbox(prev, initial));
    setKnownRows((prev) => mergeInbox(prev, initial));
  }, [initial]);

  const fetchPage = actions.listInboxConversations;
  const loadPage = useCallback(async (next?: InboxCursor | null) => {
    if (!fetchPage || document.visibilityState !== 'visible') return;
    const version = ++seq.current;
    setBusy(true);
    try {
      const result = await fetchPage({ siteId, query, filter, mineOnly, cursor: next });
      if (version !== seq.current) return;
      setFailed(!result.ok);
      if (result.ok) {
        setCursor(result.cursor);
        setKnownRows((prev) => mergeInbox(prev, result.conversations));
        setRows((prev) => {
          // A slower search/page read cannot overwrite a newer changes read.
          const incoming = mergeInbox(result.conversations, prev.filter((r) => result.conversations.some((p) => p.id === r.id)));
          return next ? [...prev.map((r) => incoming.find((p) => p.id === r.id) ?? r), ...incoming.filter((r) => !prev.some((p) => p.id === r.id))] : [
            ...incoming, ...prev.filter((r) => r.id === selected.current && !incoming.some((p) => p.id === r.id)),
          ];
        });
      }
    } catch { if (version === seq.current) setFailed(true); }
    finally { if (version === seq.current) setBusy(false); }
  }, [fetchPage, siteId, query, filter, mineOnly]);

  useEffect(() => {
    cancelPage();
    const timer = setTimeout(() => void loadPage(), 300);
    return () => { clearTimeout(timer); cancelPage(); };
  }, [loadPage, cancelPage]);

  const readChanges = actions.inboxChangesSince;
  const readSignals = actions.inboxHandoffsSince;
  useEffect(() => {
    if (!readChanges) return;
    let cancelled = false, inFlight = false;
    // Overlap catches a write whose short transaction commits after the read.
    let since = new Date(Date.now() - 10_000).toISOString();
    let changeCursor: InboxCursor | null = null, until: string | undefined;
    let hiddenSince = since;
    let hiddenCursor: InboxCursor | null = null, hiddenUntil: string | undefined;
    let signalInFlight = false;
    const hiddenIds = new Set<string>();
    const knownHandoffs = new Set(rowsRef.current.filter((r) => r.status === 'handoff_requested').map((r) => r.id));
    const originalTitle = document.title;
    const signal = (id: string) => {
      if (knownHandoffs.has(id)) return;
      knownHandoffs.add(id);
      if (document.visibilityState === 'hidden') {
        hiddenIds.add(id);
        document.title = `(${hiddenIds.size}) ${originalTitle}`;
        notifyHandoff(notificationTitle, id);
      }
    };
    const poll = async () => {
      if (cancelled || inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const result = await readChanges(siteId, since, changeCursor, until);
        if (cancelled || !result.ok) return;
        for (const r of result.conversations) {
          if (r.status === 'handoff_requested') signal(r.id); else knownHandoffs.delete(r.id);
        }
        // A response in flight when the tab hid may signal, but does not
        // change the hidden list or advance its cursor until visible again.
        if (document.visibilityState !== 'visible') return;
        setRows((prev) => mergeInbox(prev, result.conversations));
        setKnownRows((prev) => mergeInbox(prev, result.conversations));
        changeCursor = result.cursor;
        until = result.cursor ? result.checkedAt : undefined;
        if (!result.cursor) since = new Date(Date.parse(result.checkedAt) - 10_000).toISOString();
      } catch { /* Transient read: keep cursor and retry next tick. */ }
      finally { inFlight = false; }
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') {
        hiddenIds.clear(); document.title = originalTitle;
        void poll(); void loadPage();
      } else { hiddenSince = new Date(Date.now() - 10_000).toISOString(); hiddenCursor = null; hiddenUntil = undefined; }
    };
    document.addEventListener('visibilitychange', visibility);
    const timer = setInterval(() => void poll(), 5000);
    // Separate, low-frequency hidden-tab signal. List and thread polling
    // stay paused; no previews/customer data are fetched by this read.
    const signalTimer = readSignals ? setInterval(async () => {
      if (cancelled || signalInFlight || document.visibilityState !== 'hidden') return;
      signalInFlight = true;
      try {
        const result = await readSignals(siteId, hiddenSince, hiddenCursor, hiddenUntil);
        if (cancelled || !result.ok) return;
        for (const id of result.ids) signal(id);
        hiddenCursor = result.cursor;
        hiddenUntil = result.cursor ? result.checkedAt : undefined;
        if (!result.cursor) hiddenSince = new Date(Date.parse(result.checkedAt) - 10_000).toISOString();
      } catch { /* Retry on next signal tick. */ }
      finally { signalInFlight = false; }
    }, 30_000) : null;
    return () => {
      cancelled = true; clearInterval(timer); if (signalTimer) clearInterval(signalTimer);
      document.removeEventListener('visibilitychange', visibility); document.title = originalTitle;
    };
  }, [readChanges, readSignals, siteId, notificationTitle, loadPage]);

  return { rows, knownRows, cursor, busy, failed, loadMore: () => loadPage(cursor), retry: () => loadPage() };
}
