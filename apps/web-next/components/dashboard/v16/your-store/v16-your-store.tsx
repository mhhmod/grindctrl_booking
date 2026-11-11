'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Skeleton, Switch } from '@mantine/core';
import { GcIcon, type GcIconName } from '@/components/icons';
import { V16Notice } from '@/components/dashboard/v16/notice';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { getYourStoreCopy, type PillKind, type YourStoreCopy } from '@/lib/dashboard/your-store-copy';
import {
  INSTALL_HREF,
  productsHeading,
  type DomainLine,
  type FixRow,
  type ProductCardView,
  type ProductKey,
  type StoreCheckView,
  type TodayStoreCardView,
  type WellLine,
  type YourStoreView,
} from '@/lib/dashboard/your-store-model';
import classes from './v16-your-store.module.css';
import { checkRowProblemKey } from '@/lib/store-health/problems';
import { StoreHealthAlerts, type StoreHealthAlertsProps } from './store-health-alerts';

/* Your store (Pack A handoff, A5 and A6): one card per product with its
   switch, status and sentence, then the Store check. The model in
   lib/dashboard/your-store-model.ts decides every status and row; this file
   lays them out and runs the two switches and Run check now. */

type SaveResult = { ok: true } | { ok: false };
export type YourStoreActions = {
  setTryOnButton: (input: { shop: string; showButton: boolean }) => Promise<SaveResult>;
  setStoreChat: (siteId: string, enabled: boolean) => Promise<SaveResult>;
  /** Looks for the code again on one pasted website address. */
  checkDomain: (siteId: string, domainId: string) => Promise<unknown>;
};

const PILL: Record<PillKind, { icon: GcIconName; color?: string }> = {
  well: { icon: 'check', color: 'success' },
  attention: { icon: 'warn', color: 'attention' },
  bad: { icon: 'close', color: 'danger' },
  waiting: { icon: 'clock' },
  preview: { icon: 'eye' },
};

/** Status is always an icon and a word. */
export function StatusPill({ kind, copy, compact }: { kind: PillKind; copy: YourStoreCopy; compact?: boolean }) {
  const pill = PILL[kind];
  return (
    <Badge
      variant="light"
      color={pill.color ?? 'gray'}
      radius="pill"
      className={classes.pill}
      data-kind={kind}
      data-compact={compact || undefined}
      leftSection={<GcIcon name={pill.icon} size={16} strokeWidth={2} />}
    >
      {copy.pill[kind]}
    </Badge>
  );
}

const PRODUCT_ICON: Record<ProductKey, GcIconName> = { tryOn: 'shirt', storeChat: 'chat' };

function ProductCard({
  product,
  shownOn,
  saving,
  error,
  canChange,
  copy,
  onChange,
}: {
  product: ProductCardView;
  shownOn: boolean;
  saving: boolean;
  error: string | null;
  canChange: boolean;
  copy: YourStoreCopy;
  onChange: (next: boolean) => void;
}) {
  const headingId = React.useId();
  /* The server's status holds while the switch matches it. Turned on and not
     saved through yet, the product waits for data; turned off, it is off. */
  const settled = shownOn === product.on;
  const pill = !shownOn ? null : settled ? product.pill : 'waiting';
  const sentence = settled ? product.sentence : copy.products[product.key].sentence;
  const quiet = settled ? product.sentenceQuiet : true;
  return (
    <section aria-labelledby={headingId} className={`${classes.card} ${classes.product}`}>
      <span className={classes.tile} data-product={product.key} aria-hidden="true">
        <GcIcon name={PRODUCT_ICON[product.key]} size={24} />
      </span>
      <div className={classes.productTitle}>
        <h3 id={headingId} className={classes.productName}>
          {product.name}
        </h3>
        {pill && <StatusPill kind={pill} copy={copy} compact />}
      </div>
      <Switch
        className={classes.switch}
        classNames={{ track: classes.switchTrack }}
        labelPosition="left"
        label={shownOn ? copy.on : copy.off}
        aria-label={product.name}
        checked={shownOn}
        disabled={!canChange || saving}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <div className={classes.productBody}>
        <p className={classes.sentence} data-quiet={quiet || undefined}>
          {sentence}
        </p>
        {shownOn && product.looks && <p className={classes.looks}>{product.looks}</p>}
        {settled && product.updatedCode && (
          <div className={classes.note}>
            <span className={classes.noteText}>
              <GcIcon name="warn" size={20} className={classes.noteIcon} />
              {product.updatedCode.note}
            </span>
            {product.updatedCode.action && (
              <Button component={Link} href={product.updatedCode.action.href} variant="default" radius="pill" h={44} className={classes.noteAction}>
                {product.updatedCode.action.label}
              </Button>
            )}
          </div>
        )}
        {settled && product.seeIt && (
          <a href={product.seeIt.href} target="_blank" rel="noopener noreferrer" className={classes.textLink}>
            {product.seeIt.label}
            <GcIcon name="ext" size={16} />
            <span className={classes.visuallyHidden}>({copy.opensInNewTab})</span>
          </a>
        )}
        {error && (
          <p role="alert" className={classes.error}>
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

const DOMAIN_ICON: Record<DomainLine['state'], GcIconName> = { live: 'check', waiting: 'clock', needs_proof: 'warn' };

function FixRowItem({ row, copy }: { row: FixRow; copy: YourStoreCopy }) {
  const hostAt = row.host ? row.sentence.indexOf(row.host) : -1;
  return (
    <li id={`check-${checkRowProblemKey(row.key) ?? row.key}`} className={classes.fixRow}>
      <div className={classes.fixPill}>
        <StatusPill kind={row.kind} copy={copy} />
      </div>
      <div className={classes.fixText}>
        <p className={classes.rowTitle}>{row.title}</p>
        {row.domains.length > 0 ? (
          <ul className={classes.domains}>
            {row.domains.map((line) => (
              <li key={line.domain} className={classes.domain}>
                <bdi dir="ltr" className={classes.domainName}>
                  {line.domain}
                </bdi>
                <span className={classes.domainState} data-state={line.state}>
                  <GcIcon name={DOMAIN_ICON[line.state]} size={14} strokeWidth={2.25} />
                  {line.label}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={classes.rowSentence}>
            {hostAt < 0 ? row.sentence : <>{row.sentence.slice(0, hostAt)}<bdi dir="ltr">{row.host}</bdi>{row.sentence.slice(hostAt + row.host!.length)}</>}
          </p>
        )}
      </div>
      {row.action && (
        <Button
          component={Link}
          href={row.action.href}
          variant={row.action.primary ? 'filled' : 'default'}
          radius="pill"
          h={44}
          className={classes.fixAction}
        >
          {row.action.label}
        </Button>
      )}
    </li>
  );
}

function WellLineItem({ line, mode = 'well' }: { line: WellLine; mode?: 'well' | 'waiting' | 'more' }) {
  return (
    <li id={`check-${checkRowProblemKey(line.key) ?? line.key}`} className={`${classes.wellLine} ${mode === 'more' ? classes.optionalRow : ''}`}>
      {mode !== 'more' && <GcIcon name={mode === 'waiting' ? 'clock' : 'check'} size={16} strokeWidth={2.25} className={mode === 'well' ? classes.wellTick : undefined} />}
      <span className={classes.wellTitle}>{line.title}</span>
      <span className={classes.wellSentence}>{line.sentence}</span>
      {line.link && mode === 'more' ? (
        <Button component={Link} href={line.link.href} variant="default" radius="pill" h={44} className={classes.optionalAction}>{line.link.label}</Button>
      ) : line.link && (
        <Link href={line.link.href} className={classes.quietLink}>
          {line.link.label}
        </Link>
      )}
    </li>
  );
}

function CheckingRows({ copy }: { copy: YourStoreCopy }) {
  return (
    <section role="status" aria-label={copy.check.checkingLabel} className={`${classes.card} ${classes.group}`}>
      {[0, 1, 2].map((index) => (
        <div key={index} className={classes.skeletonRow} aria-hidden="true">
          <Skeleton h={28} w={130} radius="pill" className={classes.skeleton} />
          <Skeleton h={14} radius="pill" className={`${classes.skeleton} ${classes.skeletonLine}`} />
        </div>
      ))}
    </section>
  );
}

export const WAITING_REFRESH_MS = 30_000;
const WAITING_WATCH_MS = 30 * 60_000;

function StoreCheck({
  check,
  recheck,
  copy,
  checkDomain,
  alerts,
}: {
  check: StoreCheckView;
  recheck: YourStoreView['recheck'];
  copy: YourStoreCopy;
  checkDomain: YourStoreActions['checkDomain'];
  alerts?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const fixId = React.useId();
  const wellId = React.useId();

  /* While the code is not live yet, read the page again every 30 seconds
     (visible tab, 30 minutes at most), so the check appears by itself. */
  React.useEffect(() => {
    if (!check.waiting) return;
    const until = Date.now() + WAITING_WATCH_MS;
    const timer = window.setInterval(() => {
      if (Date.now() > until) { window.clearInterval(timer); return; }
      if (document.visibilityState === 'visible') router.refresh();
    }, WAITING_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [check.waiting, router]);

  function runCheck() {
    startTransition(async () => {
      // Waiting addresses are looked at again (rate limited server-side); then every fact is read again.
      if (recheck) {
        await Promise.allSettled(recheck.domainIds.map((id) => checkDomain(recheck.siteId, id)));
      }
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="your-store-check" className={classes.check}>
      <div className={classes.checkHead}>
        <div className={classes.checkTitle}>
          <h2 id="your-store-check" className={classes.h2}>
            {copy.check.title}
          </h2>
          {!check.waiting && <span className={classes.muted}>{check.checkedAt}</span>}
        </div>
        <Button
          variant="default"
          radius="pill"
          h={44}
          className={classes.runCheck}
          onClick={runCheck}
          disabled={pending}
          aria-busy={pending || undefined}
          leftSection={<GcIcon name="refresh" size={18} />}
        >
          {pending ? copy.check.checking : copy.check.runNow}
        </Button>
      </div>
      {pending ? (
        <CheckingRows copy={copy} />
      ) : check.waiting ? (
        <div className={`${classes.card} ${classes.waitingCard}`}>
          <StatusPill kind="waiting" copy={copy} />
          <p className={classes.waitingText}>{copy.check.waiting}</p>
          {/* The connect card is at the top of this page. */}
          <Button component="a" href="#connect" variant="default" radius="pill" h={44}>
            {copy.check.waitingAction}
          </Button>
        </div>
      ) : (
        <>
          {check.fix.length > 0 && (
            <section aria-labelledby={fixId} className={`${classes.card} ${classes.group}`}>
              <h3 id={fixId} className={classes.groupTitle}>
                {copy.check.whatToFix}
              </h3>
              <ul className={classes.list}>
                {check.fix.map((row) => (
                  <FixRowItem key={row.key} row={row} copy={copy} />
                ))}
              </ul>
            </section>
          )}
          {check.more.length > 0 && (
            <section aria-label={copy.check.moreYouCanAdd} className={`${classes.card} ${classes.group} ${classes.optionalGroup}`}>
              <h3 className={classes.groupTitle}>{copy.check.moreYouCanAdd}</h3>
              <ul className={classes.list}>{check.more.map((line) => <WellLineItem key={line.key} line={line} mode="more" />)}</ul>
            </section>
          )}
          {check.pending.length > 0 && (
            <section aria-label={copy.pill.waiting} className={`${classes.card} ${classes.group}`}>
              <ul className={classes.list}>{check.pending.map((line) => <WellLineItem key={line.key} line={line} mode="waiting" />)}</ul>
            </section>
          )}
          {check.well.length > 0 && (
            <section aria-labelledby={wellId} className={`${classes.card} ${classes.group}`}>
              <h3 id={wellId} className={`${classes.groupTitle} ${classes.wellHead}`}>
                <GcIcon name="check" size={20} />
                {copy.check.workingWell}
              </h3>
              <ul className={classes.list}>
                {check.well.map((line) => (
                  <WellLineItem key={line.key} line={line} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {alerts}
    </section>
  );
}

export function V16YourStore({
  view,
  canChange,
  locale,
  actions,
  connect,
  alerts,
}: {
  view: YourStoreView;
  /** Owners and admins; for anyone else the switches show, disabled (item 12). */
  canChange: boolean;
  locale: SiteLocale;
  actions: YourStoreActions;
  /** The Connect your store card; it carries the store's address and install steps. */
  connect?: React.ReactNode;
  alerts?: StoreHealthAlertsProps;
}) {
  const copy = getYourStoreCopy(locale);
  /* A switch shows its new position at once and goes back if the save
     fails. The position the server last sent is remembered, so a fresh
     view after the save replaces the optimistic one. */
  const [overrides, setOverrides] = React.useState<Partial<Record<ProductKey, boolean>>>({});
  const [saving, setSaving] = React.useState<Partial<Record<ProductKey, boolean>>>({});
  const [errors, setErrors] = React.useState<Partial<Record<ProductKey, string>>>({});
  const serverOn = view.products.map((product) => `${product.key}:${product.on}`).join(',');
  const [seenServerOn, setSeenServerOn] = React.useState(serverOn);
  if (seenServerOn !== serverOn) {
    setSeenServerOn(serverOn);
    setOverrides({});
  }
  const shownOn = (product: ProductCardView) => overrides[product.key] ?? product.on;

  async function change(product: ProductCardView, next: boolean) {
    setOverrides((current) => ({ ...current, [product.key]: next }));
    setSaving((current) => ({ ...current, [product.key]: true }));
    setErrors((current) => ({ ...current, [product.key]: undefined }));
    const result =
      product.key === 'tryOn'
        ? await actions.setTryOnButton({ shop: product.target, showButton: next }).catch(() => null)
        : await actions.setStoreChat(product.target, next).catch(() => null);
    setSaving((current) => ({ ...current, [product.key]: false }));
    if (!result?.ok) {
      setOverrides((current) => ({ ...current, [product.key]: !next }));
      setErrors((current) => ({ ...current, [product.key]: copy.saveFailed }));
    }
  }

  const anyOn = view.products.some((product) => shownOn(product));

  return (
    <div className={classes.page}>
      {connect ?? (view.header.address && (
        <p className={classes.headerLine}>
          <bdi dir="ltr" className={classes.address}>
            {view.header.address}
          </bdi>
          {view.header.installSteps && (
            <Link href={view.header.installSteps.href} className={classes.quietLink}>
              {view.header.installSteps.label}
            </Link>
          )}
        </p>
      ))}

      {view.banner && (
        <section aria-labelledby="your-store-banner" className={`${classes.card} ${classes.banner}`}>
          <span className={`${classes.tile} ${classes.tileSuccess}`} aria-hidden="true">
            <GcIcon name="check" size={24} />
          </span>
          <div className={classes.bannerText}>
            <h2 id="your-store-banner" className={classes.bannerTitle}>
              {view.banner.title}
            </h2>
            <p className={classes.muted}>{view.banner.body}</p>
            {view.banner.steps && (
              <Link href={view.banner.steps.href} className={classes.textLink}>
                {view.banner.steps.label}
                <GcIcon name="chev" size={16} />
              </Link>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="your-store-products" className={classes.products}>
        <h2 id="your-store-products" className={classes.h2}>
          {productsHeading(anyOn, copy)}
        </h2>
        <div className={classes.productList}>
          {view.products.map((product) => (
            <ProductCard
              key={product.key}
              product={product}
              shownOn={shownOn(product)}
              saving={Boolean(saving[product.key])}
              error={errors[product.key] ?? null}
              canChange={canChange}
              copy={copy}
              onChange={(next) => void change(product, next)}
            />
          ))}
        </div>
        <p className={classes.newFeatures}>{copy.newFeatures}</p>
      </section>

      {view.check ? (
        <StoreCheck check={view.check} recheck={view.recheck} copy={copy} checkDomain={actions.checkDomain}
          alerts={alerts && <StoreHealthAlerts key={`${alerts.siteId}:${alerts.enabled}`} {...alerts} locale={locale} canChange={canChange} />} />
      ) : alerts && <StoreHealthAlerts key={`${alerts.siteId}:${alerts.enabled}`} {...alerts} locale={locale} canChange={canChange} />}
    </div>
  );
}

/** No store is connected yet: say so and open the existing set-up page. */
export function V16YourStoreNotConnected({ locale, canChange }: { locale: SiteLocale; canChange: boolean }) {
  const copy = getYourStoreCopy(locale);
  return (
    <V16Notice title={copy.notConnected.title} body={copy.notConnected.body}>
      {canChange && (
        <Button component={Link} href={INSTALL_HREF} radius="pill" h={44}>
          {copy.notConnected.action}
        </Button>
      )}
    </V16Notice>
  );
}

/** The compact Your store card at the top of Today. */
export function V16YourStoreTodayCard({ card, locale }: { card: TodayStoreCardView; locale: SiteLocale }) {
  const copy = getYourStoreCopy(locale);
  return (
    <section aria-labelledby="today-your-store" className={`${classes.card} ${classes.todayCard}`}>
      <div className={classes.todayHead}>
        <h2 id="today-your-store" className={classes.todayTitle}>
          {copy.title}
        </h2>
        <span className={classes.muted}>{card.checkedAt}</span>
      </div>
      <ul className={classes.todayProducts}>
        {card.products.map((product) => (
          <li key={product.key} className={classes.todayProduct}>
            <span className={classes.todayName}>{product.name}</span>
            {product.pill ? <StatusPill kind={product.pill} copy={copy} /> : <span className={classes.muted}>{product.offLabel}</span>}
          </li>
        ))}
      </ul>
      {card.notice ? <p role="status" className={classes.muted}>{card.notice.sentence}{' '}<a href={card.notice.action.href}>{card.notice.action.label}</a></p> : null}
      <Link href={card.link.href} className={classes.todayLink}>
        {card.link.label}
        <GcIcon name="chev" size={16} />
      </Link>
    </section>
  );
}
