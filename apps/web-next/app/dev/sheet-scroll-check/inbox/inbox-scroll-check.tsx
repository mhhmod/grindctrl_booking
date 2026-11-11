'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@mantine/core';
import { MantineUiProvider } from '@/components/mantine/provider';
import { V16Inbox, type InboxActions } from '@/components/dashboard/v16/inbox/v16-inbox';
import type { ConversationListItem } from '@/components/dashboard/messenger/conversations-panel';
import { useV16VisibleViewportHeight } from '@/components/dashboard/v16/v16-shell';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import shell from '@/components/dashboard/v16/v16-shell.module.css';

/* The real Inbox inside the shell's own layout classes and its fill frame
   (the markup V16ShellView renders on /dashboard/inbox: sidebar, sticky top
   bar, page header, fixed bottom tab bar). V16Shell itself needs Clerk, which
   a fixture has no session for, so only its chrome is drawn here. */

const NAV = ['Today', 'Inbox', 'Try-On', 'Store Chat', 'Store setup', 'Plan', 'Settings'];

const STARTED = Date.parse('2026-11-11T09:00:00.000Z');

const CONVERSATIONS: ConversationListItem[] = [
  {
    id: 'c1',
    status: 'handoff_requested',
    startedAt: new Date(STARTED).toISOString(),
    lastMessageAt: new Date(STARTED + 29 * 60_000).toISOString(),
    visitorEmail: 'salma@example.com',
    visitorName: 'Salma',
    handoffReason: 'assistant_escalated',
    unreadCount: 2,
    preview: 'Can someone confirm the delivery date?',
  },
  {
    id: 'c2',
    status: 'open',
    startedAt: new Date(STARTED - 3_600_000).toISOString(),
    lastMessageAt: new Date(STARTED - 1_800_000).toISOString(),
    visitorEmail: null,
    visitorName: null,
    handoffReason: null,
    unreadCount: 0,
    preview: 'Do you ship to Alexandria?',
  },
];

function thread(locale: SiteLocale) {
  const asks =
    locale === 'ar'
      ? ['هل القميص الكتان الأخضر مقاسه مضبوط؟', 'هل المقاس M متوفر؟', 'متى يصل الطلب إلى القاهرة؟']
      : ['Does the sage linen shirt run true to size?', 'Is M in stock?', 'Can someone confirm the delivery date to Cairo?'];
  const answers =
    locale === 'ar'
      ? ['قصّته واسعة، فالمقاس M مريح بالفعل. إذا كنت بين مقاسين فاختر الأصغر.', 'نعم، متوفر الآن وتبقّت ثلاث قطع.', 'يصل خلال يومين إلى ثلاثة أيام عمل، وسيؤكد الفريق الموعد.']
      : [
          "It's cut oversized, so M already sits relaxed. If you're between sizes, size down for a cleaner line.",
          'Yes, M is in stock right now, with three left.',
          'Delivery inside Cairo takes two to three working days. I have asked the team to confirm the exact date for you.',
        ];
  return Array.from({ length: 30 }, (_, index) => {
    const mine = index % 2 === 0;
    const turn = Math.floor(index / 2) % 3;
    return {
      id: `m${index}`,
      role: mine ? 'user' : 'assistant',
      content: mine ? asks[turn] : answers[turn],
      createdAt: new Date(STARTED + index * 60_000).toISOString(),
      author: mine ? undefined : 'ai',
    };
  });
}

const ok = async () => ({ ok: true as const });

export function InboxScrollCheck({ locale }: { locale: SiteLocale }) {
  const frame = useRef<HTMLDivElement>(null);
  useV16VisibleViewportHeight(frame, true);
  useEffect(() => {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);
  const actions: InboxActions = {
    fetchConversationMessages: async () => ({ ok: true, status: 'handoff_requested', attachments: {}, messages: thread(locale) }),
    staffReply: ok,
    pingStaffTyping: ok,
    addInternalNote: ok,
    takeoverConversation: ok,
    assignConversationAction: ok,
    releaseConversation: ok,
    closeConversationAction: ok,
    markConversationRead: ok,
  };
  return (
    <MantineUiProvider dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div ref={frame} className={shell.shell} dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale} data-fill data-inbox-fixture>
        <aside className={shell.sidebar}>
          <span className={shell.wordmark}>GrindCTRL</span>
          <span className={shell.storeButton}>
            <span className={shell.storeAvatar} aria-hidden="true">MN</span>
            <span className={shell.storeText}>
              <span className={shell.storeName}>Maison Noor</span>
            </span>
          </span>
          <nav className={shell.nav} aria-label="GrindCTRL">
            {NAV.map((label) => (
              <span key={label} className={shell.navLink} aria-current={label === 'Inbox' ? 'page' : undefined}>
                {label}
              </span>
            ))}
          </nav>
          <div className={shell.spacer} />
          <span className={shell.person}>
            <span className={shell.personAvatar} aria-hidden="true">HA</span>
            <span className={shell.personName}>Hana Adel</span>
          </span>
        </aside>
        <div className={shell.column}>
          <header className={shell.topbar}>
            <span className={shell.topbarStore}>Maison Noor</span>
          </header>
          <main className={shell.main}>
            <div className={shell.content}>
              <div className={shell.header}>
                <div className={shell.headerText}>
                  <h1 className={shell.title}>{locale === 'ar' ? 'صندوق الوارد' : 'Inbox'}</h1>
                </div>
                <div className={shell.headerActions}>
                  <Button variant="default" radius="pill" h={40} lang={locale === 'ar' ? 'en' : 'ar'}>
                    {locale === 'ar' ? 'English' : 'العربية'}
                  </Button>
                </div>
              </div>
              <div className={shell.page}>
                <V16Inbox
                  locale={locale}
                  data={{ siteId: 'site-fixture', conversations: CONVERSATIONS, cannedReplies: [], currentProfileId: null, assignableMembers: [] }}
                  actions={actions}
                />
              </div>
            </div>
          </main>
        </div>
        <nav className={shell.tabbar} aria-label="Tabs">
          {['Today', 'Inbox', 'Try-On', 'Chat'].map((label) => (
            <span key={label} className={shell.tab}>{label}</span>
          ))}
        </nav>
      </div>
    </MantineUiProvider>
  );
}
