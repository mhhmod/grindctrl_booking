'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from './textarea';
import { PillToggle } from './appearance-editor';
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
import type { CannedReply } from '@/lib/messenger/canned-replies';
import { MessageText } from '@/components/messenger/message-text';

/* Focused staff view: list + one thread. Progressive disclosure — customer
   details stay one click away in the store admin, not crammed here. */

const COPY = {
  en: {
    title: 'Conversations',
    back: 'Back to conversations',
    loading: 'Loading conversation…',
    loadOlder: 'Load older messages',
    retry: 'Try again',
    subtitle: 'Shopper conversations from your storefront messenger.',
    empty: 'No conversations yet',
    emptyBody: 'When shoppers message you from the store, they will appear here.',
    waitingTeam: 'Needs a reply',
    aiActive: 'AI handling',
    humanActive: 'You are replying',
    closed: 'Resolved',
    replyPh: 'Type your reply…',
    send: 'Send',
    takeOver: 'Take over',
    returnToAi: 'Return to AI',
    resolve: 'Mark resolved',
    systemHandoff: 'AI handed this conversation to your team',
    justNow: 'now',
    minutesAgo: (n: number) => `${n}m ago`,
    hoursAgo: (n: number) => `${n}h ago`,
    daysAgo: (n: number) => `${n}d ago`,
    anonymous: 'Anonymous shopper',
    unreadOne: 'unread',
    unreadTotal: (n: number) => `${n} unread`,
    allRead: 'All caught up',
    errorRetry: 'Something went wrong — try again.',
    photoAlt: 'Photo sent by the shopper',
    triageDamaged: 'Looks damaged',
    triageWrongItem: 'Looks like the wrong item',
    triageWrongSize: 'Looks like a size problem',
    triageUnclear: 'Not clear from the photo',
    triageNotAnIssue: 'Nothing obviously wrong',
    handoffShopperAsked: 'Shopper asked for a human',
    handoffAiHandedOff: 'AI handed this off',
    handoffOther: 'Handed off to your team',
    assignedTo: (name: string) => `Assigned to ${name}`,
    filterAll: 'All',
    filterMine: 'Assigned to me',
    filteredEmpty: 'No conversations match',
    filteredEmptyBody: 'Try a different search or filter.',
    searchPlaceholder: 'Search conversations',
    statusAll: 'All statuses',
    statusNeedsReply: 'Needs a reply',
    statusInProgress: 'In progress',
    statusResolved: 'Resolved',
    composerReply: 'Reply',
    composerNote: 'Note',
    noteLabel: 'Private note — only your team sees this',
    notePh: 'Type a private note…',
    cannedInsert: 'Saved replies',
    cannedManage: 'Manage saved replies',
    cannedTitlePh: 'Reply title…',
    cannedContentPh: 'Reply text…',
    cannedAdd: 'Add reply',
    cannedAdding: 'Adding…',
    cannedAdded: 'Saved reply added.',
    cannedEmpty: 'No saved replies yet — add one above.',
    cannedActive: 'Active',
    cannedDisabled: 'Disabled',
    cannedEnable: 'Enable',
    cannedDisable: 'Disable',
    cannedDelete: 'Delete',
  },
  ar: {
    title: 'المحادثات',
    back: 'العودة إلى المحادثات',
    loading: 'جارٍ تحميل المحادثة…',
    loadOlder: 'تحميل الرسائل الأقدم',
    retry: 'حاول مجدداً',
    subtitle: 'محادثات العملاء من ماسنجر متجرك.',
    empty: 'لا محادثات بعد',
    emptyBody: 'عندما يراسلك العملاء من المتجر ستظهر هنا.',
    waitingTeam: 'تنتظر رداً',
    aiActive: 'الذكاء الاصطناعي يرد',
    humanActive: 'أنت ترد الآن',
    closed: 'تم الحل',
    replyPh: 'اكتب ردك…',
    send: 'إرسال',
    takeOver: 'تولّى المحادثة',
    returnToAi: 'إعادة للذكاء الاصطناعي',
    resolve: 'إغلاق المحادثة',
    systemHandoff: 'حوّل المساعد هذه المحادثة إلى فريقك',
    justNow: 'الآن',
    minutesAgo: (n: number) => `قبل ${n} د`,
    hoursAgo: (n: number) => `قبل ${n} س`,
    daysAgo: (n: number) => `قبل ${n} ي`,
    anonymous: 'عميل زائر',
    unreadOne: 'غير مقروء',
    unreadTotal: (n: number) => `${n} غير مقروء`,
    allRead: 'لا جديد',
    errorRetry: 'حدث خطأ — حاول مجدداً.',
    photoAlt: 'صورة أرسلها العميل',
    triageDamaged: 'يبدو تالفاً',
    triageWrongItem: 'يبدو منتجاً خاطئاً',
    triageWrongSize: 'يبدو أن المقاس غير مناسب',
    triageUnclear: 'غير واضح من الصورة',
    triageNotAnIssue: 'لا يوجد خطأ ظاهر',
    handoffShopperAsked: 'طلب العميل التحدث مع موظف',
    handoffAiHandedOff: 'حوّلها الذكاء الاصطناعي',
    handoffOther: 'تم تحويلها إلى فريقك',
    assignedTo: (name: string) => `مُسندة إلى ${name}`,
    filterAll: 'الكل',
    filterMine: 'مُسندة إليّ',
    filteredEmpty: 'لا توجد محادثات مطابقة',
    filteredEmptyBody: 'جرّب بحثاً أو تصفية مختلفة.',
    searchPlaceholder: 'ابحث في المحادثات',
    statusAll: 'كل الحالات',
    statusNeedsReply: 'تنتظر رداً',
    statusInProgress: 'قيد المعالجة',
    statusResolved: 'تم الحل',
    composerReply: 'رد',
    composerNote: 'ملاحظة',
    noteLabel: 'ملاحظة خاصة — لفريقك فقط',
    notePh: 'اكتب ملاحظة خاصة…',
    cannedInsert: 'ردود محفوظة',
    cannedManage: 'إدارة الردود المحفوظة',
    cannedTitlePh: 'عنوان الرد…',
    cannedContentPh: 'نص الرد…',
    cannedAdd: 'إضافة رد',
    cannedAdding: 'جارٍ الإضافة…',
    cannedAdded: 'تمت إضافة الرد المحفوظ.',
    cannedEmpty: 'لا ردود محفوظة بعد — أضف واحداً أعلاه.',
    cannedActive: 'مفعّل',
    cannedDisabled: 'معطّل',
    cannedEnable: 'تفعيل',
    cannedDisable: 'تعطيل',
    cannedDelete: 'حذف',
  },
};

/* handoff_reason is an internal code written by lib/messenger/escalate.ts's
   two call sites (app/api/messenger/send/route.ts) — a moderator with no
   technical background has no way to parse 'shopper_requested_human'.
   Unknown/future codes fall back to a plain, still-useful label instead of
   leaking another raw snake_case string. */
function handoffReasonLabel(reason: string, t: (typeof COPY)['en']): string {
  if (reason === 'shopper_requested_human') return t.handoffShopperAsked;
  if (reason === 'assistant_escalated') return t.handoffAiHandedOff;
  return t.handoffOther;
}

const MESSAGE_WINDOW = 50;

/* Staff typing pings fire at most this often while the moderator keeps
   typing. Coarse on purpose: the shopper polls every ~15s anyway, so a
   ~3s ping against an ~8s server freshness window keeps the dots lit
   without a keystroke-level write stream. */
const TYPING_PING_INTERVAL_MS = 3000;

export interface ConversationListItem {
  id: string;
  status: string;
  startedAt: string;
  lastMessageAt: string | null;
  visitorEmail: string | null;
  visitorName: string | null;
  handoffReason: string | null;
  /** Profile id this conversation is taken over by, if any. */
  assigneeId?: string | null;
  /** Server-resolved display name for assigneeId, if any. */
  assigneeName?: string | null;
  /** Shopper messages that arrived after this conversation was last opened
   *  in the dashboard. Absent on hosts that have not sent it yet. */
  unreadCount?: number;
  /** First line of the newest message. A list of names and timestamps with
   *  no content forces the merchant to open every row to find the one that
   *  matters. */
  preview?: string | null;
}

interface WireMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  author?: string;
  /** Staff-only note: rendered in a distinct style, never as a chat bubble. */
  internal?: boolean;
  /** Server-resolved display name of the note's staff author, if any. */
  noteAuthor?: string;
}

interface WireAttachment {
  url: string;
  mime: string;
  triage: { description: string; category: string; confidence: number } | null;
}

/* The model classifies; a human decides. The label is a hedge on purpose —
   staff should read it as a hint next to the photo, never as a verdict. */
function triageLabel(category: string, t: (typeof COPY)['en']): string {
  if (category === 'damaged') return t.triageDamaged;
  if (category === 'wrong_item') return t.triageWrongItem;
  if (category === 'wrong_size') return t.triageWrongSize;
  if (category === 'not_an_issue') return t.triageNotAnIssue;
  return t.triageUnclear;
}

/** First character of a display name, for the row avatar. */
function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

function relativeTime(iso: string | null, t: (typeof COPY)['en']): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t.justNow;
  if (minutes < 60) return t.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.hoursAgo(hours);
  return t.daysAgo(Math.floor(hours / 24));
}

export function ConversationsPanel({
  locale,
  siteId,
  conversations,
  cannedReplies = [],
  actions,
  currentProfileId,
}: {
  locale: 'en' | 'ar';
  siteId: string;
  conversations: ConversationListItem[];
  cannedReplies?: CannedReply[];
  actions: Pick<
    MessengerHostActions,
    | 'fetchConversationMessages'
    | 'staffReply'
    | 'pingStaffTyping'
    | 'addInternalNote'
    | 'takeoverConversation'
    | 'releaseConversation'
    | 'closeConversationAction'
    | 'markConversationRead'
    | 'addCannedReply'
    | 'updateCannedReplyStatus'
    | 'deleteCannedReply'
  >;
  /** Signed-in dashboard viewer's profile id. When absent (the embedded
   *  Shopify surface has no per-staff-member identity) the "assigned to me"
   *  filter is not rendered at all — there is no "me" to filter by. */
  currentProfileId?: string | null;
}) {
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MESSAGE_WINDOW);
  const panelRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const olderScroll = useRef<{ height: number; top: number } | null>(null);
  /* Last staff-typing ping sent. A plain timestamp check is enough — no
     debounce utility needed for presence data this coarse. */
  const lastTypingPing = useRef(0);
  /* Cleared locally the instant a conversation is opened. Waiting for the
     server round trip and a revalidate meant the badge sat there for as long
     as the whole page took to re-render, which read as the click not having
     registered at all. */
  const [readLocally, setReadLocally] = useState<Set<string>>(new Set());
  const unreadFor = (c: ConversationListItem) =>
    readLocally.has(c.id) ? 0 : c.unreadCount ?? 0;
  /* Client-side only: the list is already fully loaded, so no round trip is
     needed — and the toggle only exists when a viewer identity was passed. */
  const canFilterByMe = currentProfileId != null;
  const [mineOnly, setMineOnly] = useState(false);
  /* Search text and status bucket are likewise pure in-memory filters over
     the `conversations` prop — no server round trip, no query param. */
  const [search, setSearch] = useState('');
  type StatusFilter = 'all' | 'needs_reply' | 'in_progress' | 'resolved';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const matchesStatus = (s: string) =>
    statusFilter === 'all'
      ? true
      : statusFilter === 'needs_reply'
        ? s === 'handoff_requested'
        : statusFilter === 'in_progress'
          ? s === 'open' || s === 'handoff_active'
          : s === 'closed';
  const visibleConversations = conversations.filter((c) => {
    if (mineOnly && currentProfileId && c.assigneeId !== currentProfileId) return false;
    if (!matchesStatus(c.status)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.visitorName ?? '').toLowerCase().includes(q) ||
      (c.visitorEmail ?? '').toLowerCase().includes(q) ||
      (c.preview ?? '').toLowerCase().includes(q)
    );
  });
  const totalUnread = visibleConversations.reduce((sum, c) => sum + unreadFor(c), 0);
  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [attachments, setAttachments] = useState<Record<string, WireAttachment>>({});
  const [status, setStatus] = useState<string>('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /* Reply vs private note. Reset to Reply whenever another conversation is
     picked below — a mode that silently persists across threads is how a
     customer-visible reply gets typed where a note was meant, or vice versa. */
  const [composerMode, setComposerMode] = useState<'reply' | 'note'>('reply');
  /* Saved replies: the full list is already loaded for the management view,
     so the composer's insert list is derived client-side — no second fetch. */
  const activeCanned = cannedReplies.filter((reply) => reply.status === 'active');
  const [cannedOpen, setCannedOpen] = useState(false);
  const [manageCanned, setManageCanned] = useState(false);
  const [cannedTitle, setCannedTitle] = useState('');
  const [cannedContent, setCannedContent] = useState('');
  const [cannedPending, startCanned] = useTransition();
  const [cannedNote, setCannedNote] = useState<{ ok: boolean; text: string } | null>(null);

  /* Measure the space below the host's wrapping tabs/header, rather than
     guessing their height. The mobile view aligns below DashboardShell's
     h-14 sticky header; visualViewport also accounts for the soft keyboard. */
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const viewport = window.visualViewport;
    const measure = () => {
      panel.style.setProperty('--inbox-top', `${Math.max(0, panel.getBoundingClientRect().top - (viewport?.offsetTop ?? 0))}px`);
      panel.style.setProperty('--inbox-viewport', viewport ? `${viewport.height}px` : '100dvh');
    };
    if (window.matchMedia?.('(max-width: 1023px)').matches) {
      panel.style.setProperty('--inbox-top', '0px');
      panel.scrollIntoView({ block: 'start', behavior: 'instant' });
      (mobileThreadOpen ? backRef.current : selectedRowRef.current)?.focus({ preventScroll: true });
    }
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (panel.parentElement?.parentElement) observer?.observe(panel.parentElement.parentElement);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
    };
  }, [mobileThreadOpen, selectedId, conversations.length]);

  useLayoutEffect(() => {
    const log = logRef.current;
    if (!log) return;
    if (olderScroll.current) {
      log.scrollTop = olderScroll.current.top + log.scrollHeight - olderScroll.current.height;
      olderScroll.current = null;
    } else if (followLatest.current) {
      log.scrollTop = log.scrollHeight;
    }
  }, [messages, visibleCount, mobileThreadOpen]);

  /* The 15s poll and the post-action refetch overlap. Without a sequence
     guard a slow earlier response can land last and put stale messages back
     on screen — right after a staff reply, which is exactly when it reads as
     "my message vanished". Only the newest request may write state. */
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    if (!selectedId) return;
    const seq = (loadSeq.current += 1);
    const result = await actions.fetchConversationMessages(siteId, selectedId).catch(() => ({ ok: false as const }));
    if (seq !== loadSeq.current) return;
    if (result.ok) {
      setMessages(
        result.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          author: m.author,
          internal: m.internal,
          noteAuthor: m.noteAuthorName,
        })),
      );
      /* A host that omits this field must not take the tab down with it.
         `attachments[message.id]` on undefined throws during render, React
         unmounts the whole panel, and the merchant gets a blank Conversations
         tab with nothing said about why. */
      setAttachments(result.attachments ?? {});
      setStatus(result.status);
      setError(null);
    } else {
      setError(t.errorRetry);
    }
  }, [siteId, selectedId, t.errorRetry, actions, setMessages, setAttachments, setStatus, setError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async loader; state settles after awaits
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 15000);
    return () => {
      clearInterval(timer);
      loadSeq.current += 1;
    };
  }, [load]);

  function act(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      await load();
    });
  }

  function sendReply() {
    const text = draft.trim();
    if (!text || !selectedId) return;
    act(async () => {
      const result = await actions.staffReply(siteId, selectedId, text);
      if (result.ok) {
        setDraft('');
        followLatest.current = true;
      }
      else setError(result.error);
    });
  }

  function sendNote() {
    const text = draft.trim();
    if (!text || !selectedId) return;
    act(async () => {
      const result = await actions.addInternalNote(siteId, selectedId, text);
      if (result.ok) {
        setDraft('');
        followLatest.current = true;
      }
      else setError(result.error);
    });
  }

  function submitCannedReply() {
    const title = cannedTitle.trim();
    const content = cannedContent.trim();
    if (!title || !content) return;
    startCanned(async () => {
      const result = await actions.addCannedReply(siteId, title, content);
      if (result.ok) {
        setCannedTitle('');
        setCannedContent('');
        setCannedNote({ ok: true, text: t.cannedAdded });
      } else setCannedNote({ ok: false, text: result.error });
    });
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm font-semibold">{t.empty}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.emptyBody}</p>
      </div>
    );
  }

  const statusBadge = (s: string) =>
    s === 'handoff_requested'
      ? { label: t.waitingTeam, variant: 'default' as const }
      : s === 'handoff_active'
        ? { label: t.humanActive, variant: 'secondary' as const }
        : s === 'closed'
          ? { label: t.closed, variant: 'outline' as const }
          : { label: t.aiActive, variant: 'secondary' as const };

  return (
    <div
      ref={panelRef}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="flex h-[calc(var(--inbox-viewport,100dvh)-var(--inbox-top,0px)-1rem)] min-h-0 min-w-0 scroll-mt-14 flex-col gap-2"
    >
      {error && (
        <div role="alert" className="flex max-h-[20%] shrink-0 items-center justify-between gap-2 overflow-y-auto rounded-xl border border-border bg-card px-3 py-2 text-xs text-destructive">
          <p className="min-w-0 break-words">{error}</p>
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => void load()}>{t.retry}</Button>
        </div>
      )}
      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* List */}
      <div className={`${mobileThreadOpen ? 'hidden lg:flex' : 'flex'} h-full min-h-0 min-w-0 flex-col gap-2`}>
      <div className="shrink-0">
        <label htmlFor="conversation-search" className="sr-only">
          {t.searchPlaceholder}
        </label>
        <Input
          id="conversation-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          autoComplete="off"
        />
      </div>
      <div className="flex shrink-0 flex-wrap gap-1" role="group" aria-label={t.statusAll}>
        <PillToggle active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
          {t.statusAll}
        </PillToggle>
        <PillToggle active={statusFilter === 'needs_reply'} onClick={() => setStatusFilter('needs_reply')}>
          {t.statusNeedsReply}
        </PillToggle>
        <PillToggle active={statusFilter === 'in_progress'} onClick={() => setStatusFilter('in_progress')}>
          {t.statusInProgress}
        </PillToggle>
        <PillToggle active={statusFilter === 'resolved'} onClick={() => setStatusFilter('resolved')}>
          {t.statusResolved}
        </PillToggle>
      </div>
      {canFilterByMe && (
        <div className="flex shrink-0 gap-1">
          <PillToggle active={!mineOnly} onClick={() => setMineOnly(false)}>
            {t.filterAll}
          </PillToggle>
          <PillToggle active={mineOnly} onClick={() => setMineOnly(true)}>
            {t.filterMine}
          </PillToggle>
        </div>
      )}
      <p
        role="status"
        className={`shrink-0 text-xs font-medium ${
          totalUnread > 0 ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        {totalUnread > 0 ? t.unreadTotal(totalUnread) : t.allRead}
      </p>
      {visibleConversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-semibold">{t.filteredEmpty}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.filteredEmptyBody}</p>
        </div>
      ) : (
      <ul
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pe-1"
        aria-label={t.title}
      >
        {visibleConversations.map((conversation) => (
          <li key={conversation.id} className="shrink-0">
            <button
              type="button"
              onClick={(event) => {
                selectedRowRef.current = event.currentTarget;
                if (conversation.id !== selectedId) {
                  loadSeq.current += 1;
                  setSelectedId(conversation.id);
                  setStatus('');
                  setMessages([]);
                  setAttachments({});
                  setError(null);
                  setVisibleCount(MESSAGE_WINDOW);
                  olderScroll.current = null;
                  followLatest.current = true;
                  lastTypingPing.current = 0;
                  setComposerMode('reply');
                }
                setMobileThreadOpen(true);
                /* Opening it IS reading it. Fire and forget: the badge is a
                   convenience, and a failed write must not block the thread
                   from opening. The count clears on the next server read. */
                if (unreadFor(conversation) > 0) {
                  setReadLocally((prev) => new Set(prev).add(conversation.id));
                  void actions.markConversationRead(siteId, conversation.id);
                }
              }}
              aria-current={selectedId === conversation.id ? 'true' : undefined}
              className={`w-full rounded-xl border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                selectedId === conversation.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-transparent bg-card hover:border-border hover:bg-accent/40'
              }`}
            >
              <span className="flex min-w-0 items-start gap-2.5">
                {/* An initial, so rows are distinguishable at a glance rather
                    than being four identical lines of "Anonymous shopper". */}
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    unreadFor(conversation) > 0
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {initialOf(
                    conversation.visitorName || conversation.visitorEmail || t.anonymous,
                  )}
                </span>

                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={`truncate text-sm ${
                        unreadFor(conversation) > 0 ? 'font-semibold' : 'font-medium'
                      }`}
                    >
                      {conversation.visitorName || conversation.visitorEmail || t.anonymous}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {relativeTime(conversation.lastMessageAt ?? conversation.startedAt, t)}
                    </span>
                  </span>

                  {conversation.preview && (
                    <span
                      className={`truncate text-xs ${
                        unreadFor(conversation) > 0
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {conversation.preview}
                    </span>
                  )}

                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant={statusBadge(conversation.status).variant}>
                      {statusBadge(conversation.status).label}
                    </Badge>
                    {unreadFor(conversation) > 0 && (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary-foreground">
                        <span className="sr-only">{t.unreadOne}: </span>
                        {unreadFor(conversation)}
                      </span>
                    )}
                    {conversation.handoffReason && (
                      <span className="truncate text-[11px] text-muted-foreground">
                        {handoffReasonLabel(conversation.handoffReason, t)}
                      </span>
                    )}
                    {conversation.assigneeName && (
                      <Badge variant="outline" className="max-w-full">
                        <span className="truncate">{t.assignedTo(conversation.assigneeName)}</span>
                      </Badge>
                    )}
                  </span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      )}
      </div>

      {/* Thread */}
      <section className={`${mobileThreadOpen ? 'flex' : 'hidden lg:flex'} h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card`} aria-label={t.title}>
        <header className="flex max-h-[40%] shrink-0 flex-wrap items-center justify-between gap-2 overflow-y-auto overscroll-contain border-b border-border px-3 py-2 sm:px-4">
          <div className="w-full lg:hidden">
            <Button ref={backRef} variant="ghost" size="sm" className="min-h-11" onClick={() => setMobileThreadOpen(false)}>
              <span className="inline-block rtl:rotate-180" aria-hidden="true">←</span>
              {t.back}
            </Button>
          </div>
          <div className="min-w-0">
            {status === 'handoff_requested' && (
              <p className="text-xs text-amber-600 dark:text-amber-400">↪ {t.systemHandoff}</p>
            )}
            {status ? (
              <Badge variant={statusBadge(status).variant}>{statusBadge(status).label}</Badge>
            ) : !error ? (
              <div role="status" aria-label={t.loading}>
                <Skeleton className="h-5 w-28" />
                <span className="sr-only">{t.loading}</span>
              </div>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            {(status === 'open' || status === 'handoff_requested') && selectedId && (
              <Button size="sm" className="min-h-11" variant="outline" disabled={pending} onClick={() => selectedId && act(() => actions.takeoverConversation(siteId, selectedId))}>
                {t.takeOver}
              </Button>
            )}
            {status === 'handoff_active' && (
              <Button size="sm" className="min-h-11" variant="outline" disabled={pending} onClick={() => selectedId && act(() => actions.releaseConversation(siteId, selectedId))}>
                {t.returnToAi}
              </Button>
            )}
            {status && status !== 'closed' && selectedId && (
              <Button size="sm" className="min-h-11" variant="ghost" disabled={pending} onClick={() => selectedId && act(() => actions.closeConversationAction(siteId, selectedId))}>
                {t.resolve}
              </Button>
            )}
          </div>
        </header>

        <div
          ref={logRef}
          className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4"
          role="log"
          aria-label={t.title}
          aria-live="polite"
          aria-busy={!status && !error}
          tabIndex={0}
          onScroll={(event) => {
            const log = event.currentTarget;
            followLatest.current = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
          }}
        >
          {/* The host fetch contract has no history cursor. Keep its existing
              payload, but only mount recent messages until staff asks for more. */}
          {messages.length > visibleCount && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 w-full"
              onClick={() => {
                const log = logRef.current;
                if (log) olderScroll.current = { height: log.scrollHeight, top: log.scrollTop };
                followLatest.current = false;
                setVisibleCount((count) => count + MESSAGE_WINDOW);
              }}
            >
              {t.loadOlder}
            </Button>
          )}
          {messages.slice(-visibleCount).map((message) =>
            /* Staff-only note: a full-width amber block, unmistakable from a
               real shopper-visible reply. Checked before the system branch —
               a note also carries role 'system' but is not the handoff line. */
            message.internal ? (
              <div
                key={message.id}
                data-testid="internal-note"
                className="rounded-xl border border-amber-600/30 bg-amber-500/10 px-3 py-2"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  {t.noteLabel}
                  {message.noteAuthor ? ` · ${message.noteAuthor}` : ''}
                </p>
                <div className="mt-0.5 break-words text-sm">
                  <MessageText text={message.content} />
                </div>
                <span className="mt-0.5 block text-[10px] opacity-70">
                  {relativeTime(message.createdAt, t)}
                </span>
              </div>
            ) : message.role === 'system' ? (
              <p key={message.id} className="break-words text-center text-[11px] text-muted-foreground">
                {message.role === 'system' && message.author === 'system' && message.content.length > 0
                  ? message.content
                  : ''}
              </p>
            ) : (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`min-w-0 max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm sm:max-w-[80%] ${
                    message.role === 'user'
                      ? 'bg-muted'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  {attachments[message.id] && (
                    <figure className="mb-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element -- expiring signed URL, not an optimizable asset */}
                      <img
                        src={attachments[message.id].url}
                        alt={t.photoAlt}
                        className="max-h-64 w-full rounded-lg object-contain"
                      />
                      {attachments[message.id].triage && (
                        <figcaption className="mt-1 text-[10px] opacity-80">
                          {triageLabel(attachments[message.id].triage!.category, t)}
                          {attachments[message.id].triage!.confidence >= 0.4
                            ? ` — ${attachments[message.id].triage!.description}`
                            : ''}
                        </figcaption>
                      )}
                    </figure>
                  )}
                  <MessageText text={message.content} />
                  <span className="mt-0.5 block text-[10px] opacity-70">
                    {message.role === 'assistant'
                      ? message.author === 'human'
                        ? locale === 'ar' ? 'فريقك' : 'Your team'
                        : 'AI'
                      : ''}{' '}
                    {relativeTime(message.createdAt, t)}
                  </span>
                </div>
              </div>
            ),
          )}
        </div>

        {status && (
          <footer className="shrink-0 border-t border-border p-3">
            <div className="mb-2 flex gap-1" role="group" aria-label={`${t.composerReply} / ${t.composerNote}`}>
              {status !== 'closed' && (
                <PillToggle active={composerMode === 'reply'} onClick={() => setComposerMode('reply')}>
                  {t.composerReply}
                </PillToggle>
              )}
              <PillToggle active={composerMode === 'note' || status === 'closed'} onClick={() => setComposerMode('note')}>
                {t.composerNote}
              </PillToggle>
            </div>
            {/* Saved replies live with the composer, not in their own tab: the
                insert list only pre-fills the draft — the moderator still
                presses Send (or Note) themselves. */}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {activeCanned.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-9"
                  aria-expanded={cannedOpen}
                  onClick={() => setCannedOpen((open) => !open)}
                >
                  {t.cannedInsert}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-9 text-muted-foreground"
                aria-expanded={manageCanned}
                onClick={() => setManageCanned((open) => !open)}
              >
                {t.cannedManage}
              </Button>
            </div>
            {cannedOpen && activeCanned.length > 0 && (
              <ul aria-label={t.cannedInsert} className="mb-2 grid max-h-40 gap-1 overflow-y-auto overscroll-contain rounded-xl border border-border p-1.5">
                {activeCanned.map((reply) => (
                  <li key={reply.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(reply.content.slice(0, 2000));
                        setCannedOpen(false);
                      }}
                      title={reply.content}
                      className="w-full truncate rounded-lg px-2 py-1.5 text-start text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2"
                    >
                      {reply.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (composerMode === 'note' || status === 'closed') sendNote();
                else sendReply();
              }}
            >
              <label htmlFor={composerMode === 'note' || status === 'closed' ? 'staff-note' : 'staff-reply'} className="sr-only">
                {composerMode === 'note' || status === 'closed' ? t.notePh : t.replyPh}
              </label>
              <Textarea
                id={composerMode === 'note' || status === 'closed' ? 'staff-note' : 'staff-reply'}
                rows={1}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value.slice(0, 2000));
                  /* Reply-composer presence ping, at most one per ~3s while
                     the moderator keeps typing. Gated exactly like the submit
                     routing below (reply mode AND not closed): a private note
                     — including the note-style box of a resolved thread — must
                     NEVER leak even a "someone is typing" signal to the
                     shopper. Fire and forget, like markConversationRead above
                     — a failed ping must never block typing. */
                  if (composerMode === 'reply' && status !== 'closed' && selectedId) {
                    const now = Date.now();
                    if (now - lastTypingPing.current >= TYPING_PING_INTERVAL_MS) {
                      lastTypingPing.current = now;
                      void actions.pingStaffTyping(siteId, selectedId);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (composerMode === 'note' || status === 'closed') sendNote();
                    else sendReply();
                  }
                }}
                placeholder={composerMode === 'note' || status === 'closed' ? t.notePh : t.replyPh}
                className={`h-11 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto ${
                  composerMode === 'note' || status === 'closed' ? 'border-amber-600/50 bg-amber-500/10' : ''
                }`}
              />
              <Button type="submit" size="sm" className="min-h-11 min-w-11" disabled={!draft.trim() || pending}>
                {t.send}
              </Button>
            </form>
            {/* Supporting tool, deliberately secondary: a small inline manager
                so a moderator never leaves this screen to add, disable, or
                delete a saved reply. */}
            {manageCanned && (
              <div className="mt-2 grid gap-2 rounded-xl border border-border bg-muted/40 p-2.5">
                <div className="grid gap-1.5">
                  <Input
                    value={cannedTitle}
                    onChange={(e) => setCannedTitle(e.target.value.slice(0, 100))}
                    placeholder={t.cannedTitlePh}
                    maxLength={100}
                    aria-label={t.cannedTitlePh}
                    autoComplete="off"
                  />
                  <Textarea
                    value={cannedContent}
                    onChange={(e) => setCannedContent(e.target.value.slice(0, 2000))}
                    placeholder={t.cannedContentPh}
                    maxLength={2000}
                    rows={2}
                    aria-label={t.cannedContentPh}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!cannedTitle.trim() || !cannedContent.trim() || cannedPending}
                      onClick={submitCannedReply}
                    >
                      {cannedPending ? t.cannedAdding : t.cannedAdd}
                    </Button>
                    {cannedNote && (
                      <span
                        role={cannedNote.ok ? 'status' : 'alert'}
                        className={`text-xs ${cannedNote.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
                      >
                        {cannedNote.text}
                      </span>
                    )}
                  </div>
                </div>
                {cannedReplies.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">{t.cannedEmpty}</p>
                ) : (
                  <ul className="grid max-h-48 gap-1.5 overflow-y-auto overscroll-contain">
                    {cannedReplies.map((reply) => (
                      <li key={reply.id} className="rounded-lg border border-border bg-card p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-xs font-medium">{reply.title}</p>
                          <Badge variant={reply.status === 'active' ? 'default' : 'secondary'}>
                            {reply.status === 'active' ? t.cannedActive : t.cannedDisabled}
                          </Badge>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{reply.content}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={cannedPending}
                            onClick={() =>
                              startCanned(() =>
                                void actions.updateCannedReplyStatus(
                                  siteId,
                                  reply.id,
                                  reply.status === 'active' ? 'disabled' : 'active',
                                ),
                              )
                            }
                            className="rounded-full border border-border px-2.5 py-1 text-[11px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
                          >
                            {reply.status === 'active' ? t.cannedDisable : t.cannedEnable}
                          </button>
                          <button
                            type="button"
                            disabled={cannedPending}
                            onClick={() => startCanned(() => void actions.deleteCannedReply(siteId, reply.id))}
                            className="rounded-full border border-destructive/40 px-2.5 py-1 text-[11px] text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
                          >
                            {t.cannedDelete}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </footer>
        )}
      </section>
      </div>
    </div>
  );
}

