'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
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
  feedbackUp30d: number;
  feedbackDown30d: number;
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
    revertAction: 'Revert to previous version',
    reverting: 'Reverting…',
    revertConfirm: 'Restore the previous published version? This cannot be undone.',
    reverted: 'Reverted — your store is serving the previous version again.',
    revertFailed: 'Could not revert. Please try again.',
    disconnectAction: 'Disconnect this store',
    disconnectNote: 'Remove this store from your dashboard. Store Chat in Shopify and all store data stay in place.',
    disconnecting: 'Disconnecting…',
    disconnectConfirm: 'Disconnect this store from your grindctrl.cloud dashboard? This removes your dashboard access to this store. Store Chat keeps running in your Shopify admin exactly as before. Nothing is deleted: all conversations, knowledge, saved replies and settings stay with the store. You, or anyone with access to that Shopify admin, can reconnect it later through the normal claim flow and regain access to everything. If this was your only store, your dashboard may show a new, blank “My store” draft.',
    disconnected: 'Store disconnected — your dashboard access has been removed. Nothing was deleted.',
    disconnectFailed: 'Could not disconnect. Please try again.',
    conversations: 'Conversations · 7 days',
    aiResolved: 'Closed by AI',
    handedOff: 'Needed your team',
    openNow: 'Open right now',
    firstResponse: 'Median first reply (7d)',
    satisfaction: 'Satisfaction · 30 days',
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
    revertAction: 'استعادة الإصدار السابق',
    reverting: 'جارٍ الاستعادة…',
    revertConfirm: 'هل تريد استعادة الإصدار المنشور السابق؟ لا يمكن التراجع عن هذه العملية.',
    reverted: 'تمت الاستعادة — متجرك يعرض الإصدار السابق مجدداً.',
    revertFailed: 'تعذرت الاستعادة. حاول مرة أخرى.',
    disconnectAction: 'فصل هذا المتجر',
    disconnectNote: 'أزل هذا المتجر من لوحة تحكمك. ستبقى دردشة المتجر في Shopify وجميع بيانات المتجر كما هي.',
    disconnecting: 'جارٍ الفصل…',
    disconnectConfirm: 'هل تريد فصل هذا المتجر عن لوحة تحكمك في grindctrl.cloud؟ سيُزال وصولك إلى هذا المتجر من لوحة التحكم. ستستمر دردشة المتجر في العمل داخل لوحة إدارة Shopify كما كانت تماماً. لن يُحذف أي شيء: ستبقى جميع المحادثات والمعرفة والردود المحفوظة والإعدادات مرتبطة بالمتجر. يمكنك أنت، أو أي شخص لديه وصول إلى لوحة إدارة Shopify لهذا المتجر، إعادة ربطه لاحقاً عبر خطوات المطالبة المعتادة واستعادة الوصول إلى كل شيء. إذا كان هذا متجرك الوحيد، فقد تعرض لوحة تحكمك مسودة جديدة وفارغة باسم «متجري».',
    disconnected: 'تم فصل المتجر — أُزيل وصولك إليه من لوحة التحكم. لم يُحذف أي شيء.',
    disconnectFailed: 'تعذر فصل المتجر. حاول مرة أخرى.',
    conversations: 'المحادثات · ٧ أيام',
    aiResolved: 'أُغلقت بالذكاء الاصطناعي',
    handedOff: 'احتاجت فريقك',
    openNow: 'مفتوحة الآن',
    firstResponse: 'وسيط أول رد (٧ أيام)',
    satisfaction: 'الرضا · ٣٠ يومًا',
    seconds: ' ث',
    noData: 'لا محادثات بعد. بعد تفعيل دردشة المتجر ستظهر أسئلة العملاء هنا.',
  },
};

export function MessengerOverview({
  locale,
  siteName,
  siteId,
  canRevert = false,
  canDisconnect = false,
  actions,
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
  siteId?: string;
  canRevert?: boolean;
  canDisconnect?: boolean;
  actions?: Pick<MessengerHostActions, 'revertConfigAction' | 'disconnectSiteAction'>;
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
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const previousState = useRef({ siteId, version, canRevert });
  useEffect(() => {
    const before = previousState.current;
    // Preserve success as revalidation consumes the snapshot; reset for a
    // new publish (including one before props caught up) or another store.
    if (siteId !== before.siteId || (canRevert && (!before.canRevert || version !== before.version))) {
      setResult(null);
    }
    previousState.current = { siteId, version, canRevert };
  }, [siteId, version, canRevert]);

  function revert() {
    const action = actions?.revertConfigAction;
    if (!action || !siteId || pending || !window.confirm(t.revertConfirm)) return;
    setResult(null);
    startTransition(async () => {
      try {
        const outcome = await action(siteId);
        setResult(outcome.ok
          ? { ok: true, text: t.reverted }
          : { ok: false, text: outcome.error || t.revertFailed });
      } catch {
        setResult({ ok: false, text: t.revertFailed });
      }
    });
  }

  const [disconnectPending, startDisconnectTransition] = useTransition();
  const [disconnectResult, setDisconnectResult] = useState<{ ok: boolean; text: string } | null>(null);
  const previousDisconnectState = useRef({ siteId, domain, canDisconnect });
  useEffect(() => {
    const before = previousDisconnectState.current;
    // Keep the received success while props catch up; reset for another
    // store or when this store becomes eligible again after reconnecting.
    if (siteId !== before.siteId || domain !== before.domain || (canDisconnect && !before.canDisconnect)) {
      setDisconnectResult(null);
    }
    previousDisconnectState.current = { siteId, domain, canDisconnect };
  }, [siteId, domain, canDisconnect]);

  function disconnect() {
    const action = actions?.disconnectSiteAction;
    if (!action || !siteId || !domain || !canDisconnect || disconnectPending || !window.confirm(t.disconnectConfirm)) return;
    setDisconnectResult(null);
    startDisconnectTransition(async () => {
      try {
        const outcome = await action(siteId);
        setDisconnectResult(outcome.ok
          ? { ok: true, text: t.disconnected }
          : { ok: false, text: outcome.error || t.disconnectFailed });
      } catch {
        setDisconnectResult({ ok: false, text: t.disconnectFailed });
      }
    });
  }

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
        <Fact label={t.version} value={`v${version}`} tone="plain" note={t.versionNote}>
          {/* The received outcome is newer than canRevert until revalidation. */}
          {canRevert && siteId && actions?.revertConfigAction && !result?.ok && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 h-auto min-h-11 max-w-full self-start whitespace-normal break-words py-2"
              disabled={pending}
              onClick={revert}
            >
              {pending ? t.reverting : t.revertAction}
            </Button>
          )}
          {result && (
            <p
              role={result.ok ? 'status' : 'alert'}
              className={`mt-2 text-xs [overflow-wrap:anywhere] ${result.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
            >
              {result.text}
            </p>
          )}
        </Fact>
      </div>

      {canDisconnect && domain && siteId && actions?.disconnectSiteAction && (
        <section className="min-w-0 rounded-xl border border-destructive/30 bg-card p-4 sm:p-5">
          <h2 className="break-words text-sm font-semibold">{t.disconnectAction}</h2>
          <p className="mt-1 max-w-prose break-words text-sm leading-relaxed text-muted-foreground">
            {t.disconnectNote}
          </p>
          {/* Success is newer than eligibility until the dashboard refreshes. */}
          {!disconnectResult?.ok && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="mt-3 h-auto min-h-11 max-w-full whitespace-normal break-words py-2"
              disabled={disconnectPending}
              onClick={disconnect}
            >
              {disconnectPending ? t.disconnecting : t.disconnectAction}
            </Button>
          )}
          {disconnectResult && (
            <p
              role={disconnectResult.ok ? 'status' : 'alert'}
              className={`mt-2 text-xs [overflow-wrap:anywhere] ${disconnectResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
            >
              {disconnectResult.text}
            </p>
          )}
        </section>
      )}

      {stats && stats.conversations7d > 0 ? (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6">
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
          <Metric
            label={t.satisfaction}
            value={
              stats.feedbackUp30d + stats.feedbackDown30d > 0
                ? `${Math.round((stats.feedbackUp30d / (stats.feedbackUp30d + stats.feedbackDown30d)) * 100)}%`
                : '—'
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
  children,
}: {
  label: string;
  value: string;
  note?: string;
  tone: 'good' | 'off' | 'plain';
  action?: { label: string; onClick: () => void } | null;
  children?: React.ReactNode;
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
      {children}
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
