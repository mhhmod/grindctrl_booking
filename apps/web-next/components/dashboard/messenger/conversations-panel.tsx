'use client';

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from './textarea';
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';

/* Focused staff view: list + one thread. Progressive disclosure — customer
   details stay one click away in the store admin, not crammed here. */

const COPY = {
  en: {
    title: 'Conversations',
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
    errorRetry: 'Something went wrong — try again.',
    photoAlt: 'Photo sent by the shopper',
    triageDamaged: 'Looks damaged',
    triageWrongItem: 'Looks like the wrong item',
    triageWrongSize: 'Looks like a size problem',
    triageUnclear: 'Not clear from the photo',
    triageNotAnIssue: 'Nothing obviously wrong',
  },
  ar: {
    title: 'المحادثات',
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
    errorRetry: 'حدث خطأ — حاول مجدداً.',
    photoAlt: 'صورة أرسلها العميل',
    triageDamaged: 'يبدو تالفاً',
    triageWrongItem: 'يبدو منتجاً خاطئاً',
    triageWrongSize: 'يبدو أن المقاس غير مناسب',
    triageUnclear: 'غير واضح من الصورة',
    triageNotAnIssue: 'لا يوجد خطأ ظاهر',
  },
};

export interface ConversationListItem {
  id: string;
  status: string;
  startedAt: string;
  lastMessageAt: string | null;
  visitorEmail: string | null;
  visitorName: string | null;
  handoffReason: string | null;
}

interface WireMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  author?: string;
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
  actions,
}: {
  locale: 'en' | 'ar';
  siteId: string;
  conversations: ConversationListItem[];
  actions: Pick<
    MessengerHostActions,
    'fetchConversationMessages' | 'staffReply' | 'takeoverConversation' | 'releaseConversation' | 'closeConversationAction'
  >;
}) {
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [attachments, setAttachments] = useState<Record<string, WireAttachment>>({});
  const [status, setStatus] = useState<string>('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /* The 15s poll and the post-action refetch overlap. Without a sequence
     guard a slow earlier response can land last and put stale messages back
     on screen — right after a staff reply, which is exactly when it reads as
     "my message vanished". Only the newest request may write state. */
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    if (!selectedId) return;
    const seq = (loadSeq.current += 1);
    const result = await actions.fetchConversationMessages(siteId, selectedId);
    if (seq !== loadSeq.current) return;
    if (result.ok) {
      setMessages(result.messages);
      setAttachments(result.attachments);
      setStatus(result.status);
      setError(null);
    } else {
      setError(t.errorRetry);
    }
  }, [siteId, selectedId, t.errorRetry, actions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async loader; state settles after awaits
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 15000);
    return () => clearInterval(timer);
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
      if (result.ok) setDraft('');
      else setError(result.error);
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
    <div className="grid min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* List */}
      <ul className="grid max-h-[70vh] gap-2 overflow-y-auto" aria-label={t.title}>
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() => setSelectedId(conversation.id)}
              aria-current={selectedId === conversation.id ? 'true' : undefined}
              className={`w-full rounded-xl border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                selectedId === conversation.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {conversation.visitorName || conversation.visitorEmail || t.anonymous}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {relativeTime(conversation.lastMessageAt ?? conversation.startedAt, t)}
                </span>
              </span>
              <span className="mt-1 flex items-center gap-2">
                <Badge variant={statusBadge(conversation.status).variant}>
                  {statusBadge(conversation.status).label}
                </Badge>
                {conversation.handoffReason && (
                  <span className="truncate text-[11px] text-muted-foreground">{conversation.handoffReason}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Thread */}
      <section className="flex min-h-[420px] min-w-0 flex-col rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {status === 'handoff_requested' && (
              <p className="text-xs text-amber-600 dark:text-amber-400">↪ {t.systemHandoff}</p>
            )}
            <Badge variant={statusBadge(status).variant}>{statusBadge(status).label}</Badge>
          </div>
          <div className="flex gap-2">
            {(status === 'open' || status === 'handoff_requested') && selectedId && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => selectedId && act(() => actions.takeoverConversation(siteId, selectedId))}>
                {t.takeOver}
              </Button>
            )}
            {status === 'handoff_active' && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => selectedId && act(() => actions.releaseConversation(siteId, selectedId))}>
                {t.returnToAi}
              </Button>
            )}
            {status !== 'closed' && selectedId && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => selectedId && act(() => actions.closeConversationAction(siteId, selectedId))}>
                {t.resolve}
              </Button>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite">
          {messages.map((message) =>
            message.role === 'system' ? (
              <p key={message.id} className="text-center text-[11px] text-muted-foreground">
                {message.role === 'system' && message.author === 'system' && message.content.length > 0
                  ? message.content
                  : ''}
              </p>
            ) : (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
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
                  {message.content}
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

        {status !== 'closed' && (
          <footer className="border-t border-border p-3">
            {error && (
              <p role="alert" className="mb-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendReply();
              }}
            >
              <label htmlFor="staff-reply" className="sr-only">
                {t.replyPh}
              </label>
              <Textarea
                id="staff-reply"
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder={t.replyPh}
                className="min-h-[40px]"
              />
              <Button type="submit" size="sm" disabled={!draft.trim() || pending}>
                {t.send}
              </Button>
            </form>
          </footer>
        )}
      </section>
    </div>
  );
}

