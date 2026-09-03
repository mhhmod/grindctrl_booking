'use client';

import React, { useState } from 'react';
import { notFound } from 'next/navigation';
import { MessengerOverview } from '@/components/dashboard/messenger/overview';
import { PublishBar } from '@/components/dashboard/messenger/publish-bar';

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
