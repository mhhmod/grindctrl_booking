import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

/* Overview: only signals that answer "is this healthy and is it working".
   Deliberately Configured-vs-Detected honest — a database flag alone never
   claims the storefront is live. */

type Stats = {
  conversations7d: number;
  aiResolved7d: number;
  handedOff7d: number;
  openNow: number;
  medianFirstResponseSeconds7d: number | null;
} | null;

const COPY = {
  en: {
    status: 'Store Chat',
    liveOnStore: 'Live on your store',
    configuredOnly: 'Configured — not detected yet',
    off: 'Off',
    ai: 'AI assistant',
    aiOn: 'Answering shoppers',
    aiOff: 'Not enabled yet',
    detection: 'Storefront',
    detected: 'Installed & seen recently',
    notDetected: 'Enable it in your Shopify theme to go live',
    notDetectedShort: 'Not detected yet',
    configVersion: 'Config version',
    configVersionNote: 'Published settings your store is serving',
    conversations: 'Conversations · 7 days',
    aiResolved: 'Closed by AI',
    handedOff: 'Needed your team',
    openNow: 'Open right now',
    firstResponse: 'Median first reply (7d)',
    seconds: 's',
    noData: 'No conversations yet. Once Store Chat is live, shopper questions will appear here.',
    goToInstall: 'Go to Installation',
  },
  ar: {
    status: 'دردشة المتجر',
    liveOnStore: 'يعمل على متجرك',
    configuredOnly: 'تم الإعداد — لم يُكتشف بعد',
    off: 'متوقف',
    ai: 'مساعد الذكاء الاصطناعي',
    aiOn: 'يرد على العملاء',
    aiOff: 'غير مفعّل بعد',
    detection: 'المتجر',
    detected: 'مثبَّت ومرصد مؤخراً',
    notDetected: 'فعّله من قالب متجرك على Shopify للبدء',
    notDetectedShort: 'لم يُكتشف بعد',
    configVersion: 'إصدار الإعدادات',
    configVersionNote: 'الإعدادات المنشورة التي يعرضها متجرك',
    conversations: 'المحادثات · ٧ أيام',
    aiResolved: 'أُغلقت بالذكاء الاصطناعي',
    handedOff: 'احتاجت فريقك',
    openNow: 'مفتوحة الآن',
    firstResponse: 'وسيط أول رد (٧ أيام)',
    seconds: ' ث',
    noData: 'لا محادثات بعد. بعد تفعيل دردشة المتجر ستظهر أسئلة العملاء هنا.',
    goToInstall: 'انتقل إلى التثبيت',
  },
};

export function MessengerOverview({
  locale,
  siteName,
  active,
  aiEnabled,
  detectedAt,
  version,
  stats,
}: {
  locale: string;
  siteName: string;
  active: boolean;
  aiEnabled: boolean;
  detectedAt: string | null;
  version: number;
  stats: Stats;
}) {
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const detected = Boolean(detectedAt);

  return (
    <section className="grid min-w-0 gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Every card reads the same way: label, one short state word, then
            the detail. The status card used to put the store domain where
            the others put a glyph, so a long domain wrapped under the status
            dot and threw the whole row's alignment out. */}
        <Signal
          label={t.status}
          value={active ? (detected ? t.liveOnStore : t.configuredOnly) : t.off}
          state={active ? (detected ? 'good' : 'warn') : 'off'}
          note={siteName}
        />
        <Signal
          label={t.detection}
          value={detected ? t.detected : active ? t.notDetectedShort : t.off}
          state={detected ? 'good' : active ? 'warn' : 'off'}
          note={detected ? '' : active ? t.notDetected : ''}
        />
        <Signal
          label={t.ai}
          value={aiEnabled ? t.aiOn : t.aiOff}
          state={aiEnabled ? 'good' : 'off'}
          note={''}
        />
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t.configVersion}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">v{version}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t.configVersionNote}</p>
        </div>
      </div>

      {stats && stats.conversations7d > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label={t.conversations} value={stats.conversations7d} />
          <Metric label={t.aiResolved} value={stats.aiResolved7d} />
          <Metric label={t.handedOff} value={stats.handedOff7d} />
          <Metric label={t.openNow} value={stats.openNow} />
          <Metric
            label={t.firstResponse}
            value={stats.medianFirstResponseSeconds7d === null ? '—' : `${stats.medianFirstResponseSeconds7d}${t.seconds}`}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">{t.noData}</CardContent>
        </Card>
      )}
    </section>
  );
}

function Signal({
  label,
  value,
  note,
  state,
}: {
  label: string;
  value: string;
  note: string;
  state: 'good' | 'warn' | 'off';
}) {
  const tone =
    state === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : state === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground';
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      {/* items-start + shrink-0, so a value that wraps to a second line does
          not drag the dot down or indent under it. */}
      <p className={`mt-1 flex items-start gap-2 text-base font-semibold ${tone}`}>
        <span aria-hidden="true" className="mt-[0.45em] inline-block size-2 shrink-0 rounded-full bg-current" />
        <span className="min-w-0 break-words">{value}</span>
      </p>
      {note && (
        <p className="mt-1 truncate text-[11px] leading-snug text-muted-foreground" title={note}>
          {note}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
