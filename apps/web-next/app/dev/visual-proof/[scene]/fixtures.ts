import { resolveMessengerConfig } from '@/lib/messenger/config';
import { toPublicPayload, type PublicMessengerPayload } from '@/lib/messenger/public-api';
import type { ConversationListItem } from '@/components/dashboard/messenger/conversations-panel';
import type { FetchMessagesResult } from '@/lib/messenger/dashboard-actions-contract';
import type { WireMessage } from '@/components/messenger/MessengerPanel';
import { toShopperFailureMessage } from '@/lib/try-on/shopper-errors';
import type { TryOnOverview } from '@/lib/dashboard/overview-data';

/* One coherent demo scenario — GrindCTRL demo store, shopper Salma, teammate
   Omar — shared by every /dev/visual-proof scene so the homepage's "real
   product UI" screenshots read as one story rather than four unrelated
   mockups. Server-safe data only (the dev route's own page.tsx reads these
   and hands plain, serializable props to the client scene renderer — see
   scene-client.tsx for why that split exists). */

export type DemoLocale = 'en' | 'ar';

// Fixed "now" so every scene's relative timestamps agree with each other
// and repeat identically capture to capture.
const NOW = new Date('2026-09-17T09:00:00.000Z');

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

function daysAgo(days: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const DOMAIN = 'demo-store.myshopify.com';
const STORE_NAME = 'GrindCTRL demo store';

/* ─── chat scene ─── */

export function getChatPayload(): PublicMessengerPayload {
  // The real defaults, per lib/messenger/config.ts — only the store name
  // is overridden, matching every other scene's DOMAIN/STORE_NAME.
  const config = resolveMessengerConfig({});
  return toPublicPayload(
    { name: STORE_NAME, embed_key: 'demo-store', status: 'active', settings_version: 1, config },
    NOW,
  );
}

export function getChatMessages(locale: DemoLocale): WireMessage[] {
  const copy =
    locale === 'ar'
      ? ([
          "هل قميص الكتان الأخضر مقاسه مضبوط؟ أنا بين M و L.",
          'قصّته واسعة، فالمقاس M مريح بالفعل والمقاس L أطول وأوسع. هل تريدين أن يؤكد أحد أعضاء الفريق توفر اللون الأخضر؟',
          'نعم من فضلك، هل المقاس M متوفر باللون الأخضر؟',
        ] as const)
      : ([
          "Does the sage linen shirt run true to size? I'm between M and L.",
          "It's cut oversized, so M already sits relaxed and L gives a longer, looser fit. Want a teammate to confirm stock in sage?",
          'Yes please, is M in stock in sage?',
        ] as const);
  return [
    { id: 'demo-1', role: 'user', content: copy[0], createdAt: hoursAgo(1) },
    { id: 'demo-2', role: 'assistant', content: copy[1], author: 'ai', createdAt: hoursAgo(0.95) },
    { id: 'demo-3', role: 'user', content: copy[2], createdAt: hoursAgo(0.9) },
  ];
}

/* ─── inbox scene ─── */

export function getConversations(locale: DemoLocale): ConversationListItem[] {
  const ar = locale === 'ar';
  return [
    {
      id: 'conv-salma',
      status: 'handoff_requested',
      startedAt: hoursAgo(2),
      lastMessageAt: hoursAgo(0.9),
      visitorEmail: null,
      visitorName: ar ? 'سلمى' : 'Salma',
      handoffReason: 'assistant_escalated',
      assigneeId: 'omar',
      assigneeName: ar ? 'عمر' : 'Omar',
      unreadCount: 1,
      preview: ar ? 'نعم من فضلك، هل المقاس M متوفر باللون الأخضر؟' : 'Yes please, is M in stock in sage?',
    },
    {
      id: 'conv-alexandria',
      status: 'open',
      startedAt: hoursAgo(5),
      lastMessageAt: hoursAgo(4),
      visitorEmail: null,
      visitorName: null,
      handoffReason: null,
      unreadCount: 0,
      preview: ar
        ? 'هل تشحنون إلى الإسكندرية؟ وكم تستغرق المدة؟'
        : 'Do you ship to Alexandria, and how long does it take?',
    },
    {
      id: 'conv-karim',
      status: 'closed',
      startedAt: hoursAgo(30),
      lastMessageAt: hoursAgo(29),
      visitorEmail: null,
      visitorName: ar ? 'كريم' : 'Karim',
      handoffReason: null,
      unreadCount: 0,
      preview: ar ? 'شكرًا، دليل المقاسات ساعدني.' : 'Thanks, the size guide helped.',
    },
  ];
}

export function getConversationThreads(locale: DemoLocale): Record<string, FetchMessagesResult> {
  const ar = locale === 'ar';
  const [q1, a1, q2] = getChatMessages(locale).map((m) => m.content);
  return {
    'conv-salma': {
      ok: true,
      status: 'handoff_requested',
      attachments: {},
      messages: [
        { id: 'salma-1', role: 'user', content: q1, createdAt: hoursAgo(1) },
        { id: 'salma-2', role: 'assistant', content: a1, author: 'ai', createdAt: hoursAgo(0.95) },
        { id: 'salma-3', role: 'user', content: q2, createdAt: hoursAgo(0.9) },
        {
          id: 'salma-note',
          role: 'system',
          content: ar ? 'راجعت المخزون: المقاس M متوفر باللون الأخضر.' : 'Checked stock: M in sage is available.',
          internal: true,
          noteAuthorName: ar ? 'عمر' : 'Omar',
          createdAt: hoursAgo(0.5),
        },
      ],
    },
    'conv-alexandria': {
      ok: true,
      status: 'open',
      attachments: {},
      messages: [
        {
          id: 'alexandria-1',
          role: 'user',
          content: ar
            ? 'هل تشحنون إلى الإسكندرية؟ وكم تستغرق المدة؟'
            : 'Do you ship to Alexandria, and how long does it take?',
          createdAt: hoursAgo(4),
        },
      ],
    },
    'conv-karim': {
      ok: true,
      status: 'closed',
      attachments: {},
      messages: [
        {
          id: 'karim-1',
          role: 'assistant',
          content: ar ? 'يمكنك مراجعة دليل المقاسات هنا لمساعدتك على الاختيار.' : 'You can check our size guide here to help pick the right fit.',
          author: 'ai',
          createdAt: hoursAgo(29.5),
        },
        {
          id: 'karim-2',
          role: 'user',
          content: ar ? 'شكرًا، دليل المقاسات ساعدني.' : 'Thanks, the size guide helped.',
          createdAt: hoursAgo(29),
        },
      ],
    },
  };
}

/* ─── report scene ─── */

export interface ReportProps {
  siteName: string;
  domain: string;
  version: number;
  active: boolean;
  aiEnabled: boolean;
  detectedAt: string | null;
  stats: {
    conversations7d: number;
    aiResolved7d: number;
    handedOff7d: number;
    openNow: number;
    medianFirstResponseSeconds7d: number | null;
    feedbackUp30d: number;
    feedbackDown30d: number;
  } | null;
}

export function getReportProps(): ReportProps {
  return {
    siteName: STORE_NAME,
    domain: DOMAIN,
    version: 4,
    active: true,
    aiEnabled: true,
    detectedAt: hoursAgo(3),
    stats: {
      conversations7d: 42,
      aiResolved7d: 29,
      handedOff7d: 13,
      openNow: 3,
      medianFirstResponseSeconds7d: 38,
      feedbackUp30d: 31,
      feedbackDown30d: 3,
    },
  };
}

/* ─── try-on usage scene ─── */

// 7 days of demo generations, oldest first, summing to totals.jobsLast7d (64).
const DAILY_JOBS = [6, 9, 11, 8, 10, 12, 8];

export function getTryOnOverview(locale: DemoLocale): TryOnOverview {
  const dailySeries = DAILY_JOBS.map((jobs, i) => ({
    day: daysAgo(DAILY_JOBS.length - 1 - i),
    jobs,
    // Demo store has no real provider billing wired up — unknown cost, not zero.
    spendUsd: null,
    missingCostJobs: jobs,
  }));

  // The exact shopper-safe copy from lib/try-on/shopper-errors.ts, not
  // invented text — the three failure kinds a shopper can hit.
  const recentFailures = [
    { id: 'fail-1', trigger: 'face not detected in the uploaded photo', hoursAgoValue: 3 },
    { id: 'fail-2', trigger: 'provider request timed out', hoursAgoValue: 14 },
    { id: 'fail-3', trigger: 'insufficient credits, quota exceeded', hoursAgoValue: 26 },
  ].map(({ id, trigger, hoursAgoValue }) => ({
    id,
    productId: 'sage-linen-shirt',
    shop: DOMAIN,
    message: toShopperFailureMessage(new Error(trigger), locale),
    createdAt: hoursAgo(hoursAgoValue),
  }));

  return {
    totals: {
      installedShops: 1,
      jobsLast7d: 64,
      jobsPrev7d: 51,
      completedLast7d: 61,
      failedLast7d: 3,
      spendLast7dUsd: null,
      spendPrev7dUsd: null,
      missingCostJobsLast7d: 64,
      missingCostJobsPrev7d: 51,
      avgDurationMsLast7d: 11_400,
    },
    byShop: [
      {
        domain: DOMAIN,
        jobsLast7d: 64,
        spendLast7dUsd: null,
        missingCostJobsLast7d: 64,
        lastJobAt: hoursAgo(1),
        status: 'installed',
      },
    ],
    dailySeries,
    recentFailures,
  };
}
