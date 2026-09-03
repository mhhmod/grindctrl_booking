import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { MessengerTabId } from './messenger-tabs';

/* Overview answers one question — "is this working, and if not what do I do?"
   — and answers it once.

   It used to answer it four times in parallel: a Store Chat card and a
   Storefront card that both reported detection in different words, an AI card,
   and a Config version card that happened to be where the Publish button
   lived. Four equal-weight cards, no next step, and "Storefront" is not a word
   a merchant should have to decode. Now there is one status line that names
   the actual store domain, and the single action that changes it. */

type Stats = {
  conversations7d: number;
  aiResolved7d: number;
  handedOff7d: number;
  openNow: number;
  medianFirstResponseSeconds7d: number | null;
} | null;

const COPY = {
  en: {
    liveTitle: 'Store Chat is live',
    liveBody: 'Shoppers on {store} can open the chat and reach you.',
    lastSeen: 'Last seen on your store',
    setUpTitle: 'One step left',
    setUpBody:
      'Store Chat is ready, but it has not loaded on {store} yet. Turn on the Store Chat block in your Shopify theme and it goes live straight away.',
    setUpAction: 'Show me how',
    offTitle: 'Store Chat is turned off',
    offBody: 'Nobody on {store} can see it right now.',
    offAction: 'Go to Installation',
    yourStore: 'your store',
    ai: 'AI replies',
    aiOn: 'On — the assistant answers shoppers first',
    aiOff: 'Off — every question waits for your team',
    aiAction: 'Turn on AI replies',
    version: 'Published version',
    versionNote: 'The settings your store is serving right now',
    conversations: 'Conversations · 7 days',
    aiResolved: 'Closed by AI',
    handedOff: 'Needed your team',
    openNow: 'Open right now',
    firstResponse: 'Median first reply (7d)',
    seconds: 's',
    noData: 'No conversations yet. Once Store Chat is live, shopper questions land here.',
  },
  ar: {
    liveTitle: 'دردشة المتجر تعمل',
    liveBody: 'يمكن للعملاء على {store} فتح الدردشة والتواصل معك.',
    lastSeen: 'آخر ظهور على متجرك',
    setUpTitle: 'خطوة واحدة متبقية',
    setUpBody:
      'دردشة المتجر جاهزة، لكنها لم تُحمَّل على {store} بعد. فعّل كتلة دردشة المتجر في قالب Shopify وستعمل فوراً.',
    setUpAction: 'أرِني الطريقة',
    offTitle: 'دردشة المتجر متوقفة',
    offBody: 'لا أحد على {store} يمكنه رؤيتها الآن.',
    offAction: 'انتقل إلى التثبيت',
    yourStore: 'متجرك',
    ai: 'ردود الذكاء الاصطناعي',
    aiOn: 'مفعّلة — المساعد يرد على العملاء أولاً',
    aiOff: 'متوقفة — كل سؤال ينتظر فريقك',
    aiAction: 'فعّل ردود الذكاء الاصطناعي',
    version: 'الإصدار المنشور',
    versionNote: 'الإعدادات التي يعرضها متجرك الآن',
    conversations: 'المحادثات · ٧ أيام',
    aiResolved: 'أُغلقت بالذكاء الاصطناعي',
    handedOff: 'احتاجت فريقك',
    openNow: 'مفتوحة الآن',
    firstResponse: 'وسيط أول رد (٧ أيام)',
    seconds: ' ث',
    noData: 'لا محادثات بعد. بعد تفعيل دردشة المتجر ستظهر أسئلة العملاء هنا.',
  },
};

export function MessengerOverview({
  locale,
  siteName,
  domain,
  active,
  aiEnabled,
  detectedAt,
  version,
  stats,
  onOpenTab,
}: {
  locale: string;
  siteName: string;
  domain: string | null;
  active: boolean;
  aiEnabled: boolean;
  detectedAt: string | null;
  version: number;
  stats: Stats;
  /** Every dead end on this screen gets a way out. Switching tabs in the
   *  client is instant, so the shortcut costs nothing and saves the merchant
   *  from having to work out which tab holds the fix. */
  onOpenTab?: (tab: MessengerTabId) => void;
}) {
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const detected = Boolean(detectedAt);
  const store = domain || siteName || t.yourStore;

  const status = !active
    ? { tone: 'off' as const, title: t.offTitle, body: t.offBody, action: t.offAction }
    : detected
      ? { tone: 'good' as const, title: t.liveTitle, body: t.liveBody, action: null }
      : { tone: 'warn' as const, title: t.setUpTitle, body: t.setUpBody, action: t.setUpAction };

  return (
    <section className="grid min-w-0 gap-4">
      <StatusPanel
        tone={status.tone}
        title={status.title}
        body={status.body.replace('{store}', store)}
        action={
          status.action && onOpenTab
            ? { label: status.action, onClick: () => onOpenTab('installation') }
            : null
        }
        footnote={
          detected && detectedAt
            ? `${t.lastSeen}: ${new Date(detectedAt).toLocaleString()}`
            : null
        }
      />

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Fact
          label={t.ai}
          value={aiEnabled ? t.aiOn : t.aiOff}
          tone={aiEnabled ? 'good' : 'off'}
          action={
            !aiEnabled && onOpenTab ? { label: t.aiAction, onClick: () => onOpenTab('ai') } : null
          }
        />
        <Fact label={t.version} value={`v${version}`} tone="plain" note={t.versionNote} />
      </div>

      {stats && stats.conversations7d > 0 ? (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label={t.conversations} value={stats.conversations7d} />
          <Metric label={t.aiResolved} value={stats.aiResolved7d} />
          <Metric label={t.handedOff} value={stats.handedOff7d} />
          <Metric label={t.openNow} value={stats.openNow} />
          <Metric
            label={t.firstResponse}
            value={
              stats.medianFirstResponseSeconds7d === null
                ? '—'
                : `${stats.medianFirstResponseSeconds7d}${t.seconds}`
            }
          />
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t.noData}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function StatusPanel({
  tone,
  title,
  body,
  action,
  footnote,
}: {
  tone: 'good' | 'warn' | 'off';
  title: string;
  body: string;
  action: { label: string; onClick: () => void } | null;
  footnote: string | null;
}) {
  const skin =
    tone === 'good'
      ? 'border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/30'
      : tone === 'warn'
        ? 'border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/30'
        : 'border-border bg-card';
  const dot =
    tone === 'good'
      ? 'bg-emerald-500'
      : tone === 'warn'
        ? 'bg-amber-500'
        : 'bg-muted-foreground';

  return (
    <div className={`min-w-0 rounded-xl border p-4 sm:p-5 ${skin}`}>
      <div className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden="true" className={`mt-[0.45em] size-2.5 shrink-0 rounded-full ${dot}`} />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
          {/* max-w keeps the sentence readable on a wide desktop instead of
              running the full width of the dashboard. */}
          <p className="mt-1 max-w-prose break-words text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>
          {footnote && <p className="mt-2 text-xs text-muted-foreground">{footnote}</p>}
          {action && (
            <Button type="button" className="mt-3" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  note,
  tone,
  action,
}: {
  label: string;
  value: string;
  note?: string;
  tone: 'good' | 'off' | 'plain';
  action?: { label: string; onClick: () => void } | null;
}) {
  const valueTone =
    tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground';
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words text-sm font-semibold ${valueTone}`}>{value}</p>
      {note && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{note}</p>}
      {action && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 self-start"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
