'use client';

import React, { useState } from 'react';
import { notFound } from 'next/navigation';
import { MessengerOverview } from '@/components/dashboard/messenger/overview';
import { PublishBar } from '@/components/dashboard/messenger/publish-bar';
import { MessageText } from '@/components/messenger/message-text';
import { ConversationsPanel, type ConversationListItem } from '@/components/dashboard/messenger/conversations-panel';

/* Dev-only mirror of the Store Chat Overview and the publish bar with mock
   data, so their layout and states can be checked in a browser without the
   Clerk wall — the same trick app/dev/ui-check uses for Try-On. Every state
   is on one page because the states are the point: the whole reason this
   screen was rebuilt is that a merchant could not tell which one they were
   in. Hidden outright in production. */

const STATS = {
  conversations7d: 38,
  aiResolved7d: 25,
  handedOff7d: 13,
  openNow: 2,
  medianFirstResponseSeconds7d: 41,
};

const SAMPLE_REPLY = `Here are the direct links to our collections:
- All Tees: https://grindctrl.myshopify.com/collections/tees
- Graphic Tees: https://grindctrl.myshopify.com/collections/graphic-tees
- Kids Tees: https://grindctrl.myshopify.com/collections/kids-tees
Feel free to explore, and let me know if you would like more details.`;

const CONVERSATIONS: ConversationListItem[] = [
  {
    id: 'c1',
    status: 'handoff_requested',
    startedAt: '2026-09-03T18:00:00.000Z',
    lastMessageAt: '2026-09-04T10:00:00.000Z',
    visitorEmail: 'm10sabry1505@gmail.com',
    visitorName: null,
    handoffReason: 'assistant_escalated',
    unreadCount: 7,
    preview: 'GIVE ME THE LINKS',
  },
  {
    id: 'c2',
    status: 'open',
    startedAt: '2026-09-03T17:00:00.000Z',
    lastMessageAt: '2026-09-04T09:00:00.000Z',
    visitorEmail: null,
    visitorName: null,
    handoffReason: null,
    unreadCount: 1,
    preview: 'Do you ship to Egypt, and how long does delivery take?',
  },
  {
    id: 'c3',
    status: 'closed',
    startedAt: '2026-09-02T12:00:00.000Z',
    lastMessageAt: '2026-09-02T12:30:00.000Z',
    visitorEmail: null,
    visitorName: 'Sara',
    handoffReason: null,
    unreadCount: 0,
    preview: 'Thanks, that answered it.',
  },
];

const NOOP = async () => ({ ok: true as const });
const CONVERSATION_ACTIONS = {
  // A long thread, because that is the shape the merchant actually has and
  // it is what drives the height of the grid row the list column sits in.
  fetchConversationMessages: async () => ({
    ok: true as const,
    status: 'handoff_requested',
    attachments: {},
    messages: Array.from({ length: 14 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content:
        i % 2 === 0
          ? 'WHAT PRODUCTS U HAVE'
          : 'We carry a range of items including graphic tees, hoodies, caps, and accessories like stickers and phone cases. Feel free to browse our collections on the site.',
      createdAt: new Date(Date.now() - (14 - i) * 60000).toISOString(),
      author: i % 2 === 0 ? undefined : 'ai',
    })),
  }),
  staffReply: NOOP,
  takeoverConversation: NOOP,
  releaseConversation: NOOP,
  closeConversationAction: NOOP,
  markConversationRead: NOOP,
};

const CASES = [
  {
    id: 'off',
    title: 'Site off',
    props: { active: false, aiEnabled: false, detectedAt: null, stats: null },
  },
  {
    id: 'not-detected',
    title: 'Active, never seen on the store (the state the merchant was stuck in)',
    props: { active: true, aiEnabled: false, detectedAt: null, stats: null },
  },
  {
    id: 'live',
    title: 'Live, AI on, with traffic',
    props: {
      active: true,
      aiEnabled: true,
      detectedAt: '2026-09-03T09:12:00.000Z',
      stats: STATS,
    },
  },
  {
    id: 'long-domain',
    title: 'Long domain, Arabic copy',
    locale: 'ar',
    domain: 'a-really-quite-long-development-store-name.myshopify.com',
    props: { active: true, aiEnabled: false, detectedAt: null, stats: null },
  },
] as const;

export default function StoreChatCheckPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <StoreChatCheck />;
}

function StoreChatCheck() {
  const [hasDraft, setHasDraft] = useState(true);

  return (
    <main className="mx-auto grid min-w-0 max-w-5xl gap-8 p-4 sm:p-6">
      <header className="grid gap-1">
        <h1 className="text-lg font-semibold">Store Chat — layout check</h1>
        <p className="text-sm text-muted-foreground">
          Dev only. Every Overview state plus the publish bar, no auth required.
        </p>
      </header>

      {CASES.map((c) => (
        <section key={c.id} dir={'locale' in c && c.locale === 'ar' ? 'rtl' : 'ltr'} className="grid min-w-0 gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{c.title}</h2>
          <MessengerOverview
            locale={'locale' in c ? c.locale : 'en'}
            siteName="Demo store"
            domain={'domain' in c ? c.domain : 'grindctrl.myshopify.com'}
            version={7}
            onOpenTab={(tab) => console.log('open tab', tab)}
            {...c.props}
          />
        </section>
      ))}

      <section className="grid min-w-0 gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Conversations list</h2>
        <ConversationsPanel
          locale="en"
          siteId="site-1"
          conversations={CONVERSATIONS}
          actions={CONVERSATION_ACTIONS as never}
        />
      </section>

      {/* The exact reply that rendered as one unbroken paragraph of inert
          text, at the narrowest width the panel ever gets. */}
      <section className="grid min-w-0 gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Message bubble — links and line breaks
        </h2>
        <div className="w-[320px] max-w-full rounded-xl border border-border p-3">
          <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-es-md border border-border bg-card px-3.5 py-2 text-sm">
            <MessageText
              text={SAMPLE_REPLY}
            />
          </div>
        </div>
      </section>

      {/* Mirrors the real shell: the bar shares one block with tall content,
          which is what gives `sticky` room to travel. */}
      <section className="relative grid min-w-0 gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Publish bar</h2>
        <div className="relative min-w-0">
        <div className="h-[900px] rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Tall stand-in for a long editor. The bar should stay pinned to the
          bottom of the viewport while scrolling through this.
        </div>
        <button
          type="button"
          className="w-fit rounded-lg border border-border px-3 py-1.5 text-sm"
          onClick={() => setHasDraft((v) => !v)}
        >
          Toggle unpublished changes (now: {String(hasDraft)})
        </button>
        <PublishBar
          locale="en"
          siteId="site-1"
          hasDraft={hasDraft}
          actions={{
            publishConfig: async () => {
              await new Promise((r) => setTimeout(r, 600));
              setHasDraft(false);
              return { ok: true as const, message: 'Published — live on your store within a minute.' };
            },
          }}
        />
        </div>
      </section>
    </main>
  );
}
