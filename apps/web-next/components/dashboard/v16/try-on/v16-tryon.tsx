'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Menu } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import { getTryOnResultsCopy } from '@/lib/dashboard/tryon-insights-copy';
import { getTryOnStudioCopy } from '@/lib/dashboard/tryon-studio-copy';
import type { TryOnResultsView } from '@/lib/dashboard/tryon-insights-model';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { V16PageFrame } from '../page-frame';
import classes from './v16-tryon.module.css';

/* The v16 Try-On page (04-dashboard.md): Results (TryOnInsights) from the
   store's own looks, and Set up (TryOnStudio, v16-tryon-studio.tsx), for
   owners and admins. The model in lib/dashboard/tryon-insights-model.ts
   decides what has a source; this file only lays it out. */

export function V16TryOnFrame({
  locale,
  tab,
  status,
  children,
  controls,
  canSetUp = true,
}: {
  locale: SiteLocale;
  tab: 'results' | 'setup';
  status: TryOnResultsView['status'];
  children: React.ReactNode;
  controls?: React.ReactNode;
  /** Set up is for owners and admins (item 12); a member sees Results only. */
  canSetUp?: boolean;
}) {
  const copy = getTryOnResultsCopy(locale);
  return (
    <V16PageFrame
      badge={status}
      subtitle={tab === 'setup' ? getTryOnStudioCopy(locale).subtitle : copy.subtitle}
      tabsLabel={copy.tabsLabel}
      tabs={[
        { label: copy.results, href: '/dashboard/try-on', current: tab === 'results' },
        ...(canSetUp ? [{ label: copy.setUp, href: '/dashboard/try-on/setup', current: tab === 'setup' }] : []),
      ]}
      controls={controls}
    >
      {children}
    </V16PageFrame>
  );
}

function PeriodMenu({ view, locale }: { view: TryOnResultsView; locale: SiteLocale }) {
  const copy = getTryOnResultsCopy(locale);
  const current = view.periods.find((p) => p.current) ?? view.periods[0];
  return (
    <Menu position="bottom-end" withinPortal={false}>
      <Menu.Target>
        <Button variant="default" radius="pill" leftSection={<GcIcon name="clock" size={16} />} rightSection={<GcIcon name="down" size={14} />} aria-label={`${copy.periodLabel}: ${current.label}`}>
          {current.label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {view.periods.map((period) => (
          <Menu.Item key={period.days} component={Link} href={period.href} aria-current={period.current ? 'true' : undefined}>
            {period.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

function Thumb({ src }: { src: string | null }) {
  // The store's own product image, on Shopify's CDN; never a shopper's photo.
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className={classes.thumb} /> : <span className={classes.thumb} aria-hidden="true" />;
}

export function V16TryOnResults({ view, locale, canSetUp = true }: { view: TryOnResultsView; locale: SiteLocale; canSetUp?: boolean }) {
  const copy = getTryOnResultsCopy(locale);
  return (
    <V16TryOnFrame locale={locale} tab="results" status={view.status} canSetUp={canSetUp} controls={<PeriodMenu view={view} locale={locale} />}>
      <section aria-label={view.periods.find((p) => p.current)?.label} className={classes.tiles}>
        {view.tiles.map((tile) => (
          <div key={tile.key} className={`${classes.card} ${classes.tile}`}>
            <p className={classes.tileLabel}>{tile.label}</p>
            <p className={classes.tileValue}>{tile.value}</p>
            {tile.sub && (
              <p className={classes.tileSub} data-trend={tile.trend}>
                {tile.trend && <GcIcon name={tile.trend} size={14} />}
                {tile.sub}
              </p>
            )}
          </div>
        ))}
      </section>

      {view.why && (
        <section aria-labelledby="tryon-why" className={`${classes.card} ${classes.section}`}>
          <div>
            <h2 id="tryon-why" className={classes.h2}>
              {copy.whyTitle}
            </h2>
            <p className={classes.muted}>{view.why.summary}</p>
          </div>
          <ul className={classes.reasons}>
            {view.why.rows.map((row) => (
              <li key={row.kind} className={classes.reason}>
                <div>
                  <p className={classes.reasonTitle}>{row.title}</p>
                  <p className={classes.muted}>{row.line}</p>
                </div>
                <div className={classes.bar} aria-hidden="true">
                  <div className={classes.barFill} style={{ inlineSize: `${Math.max(4, Math.round(row.share * 100))}%` }} />
                </div>
                <span className={classes.count}>{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="tryon-by-product" className={`${classes.card} ${classes.section}`}>
        <h2 id="tryon-by-product" className={classes.h2}>
          {copy.byProduct}
        </h2>
        {view.byProduct ? (
          <>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th scope="col">{copy.product}</th>
                  <th scope="col">{copy.looks}</th>
                </tr>
              </thead>
              <tbody>
                {view.byProduct.rows.map((row) => (
                  <tr key={row.handle}>
                    <td>
                      <span className={classes.productCell}>
                        <Thumb src={row.imageUrl} />
                        <bdi>{row.title}</bdi>
                      </span>
                    </td>
                    <td>{row.looks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {view.byProduct.other && <p className={classes.muted}>{view.byProduct.other}</p>}
          </>
        ) : (
          <p className={classes.muted}>{copy.noLooksYet}</p>
        )}
      </section>

      <section aria-labelledby="tryon-recent" className={`${classes.card} ${classes.section}`}>
        <div>
          <h2 id="tryon-recent" className={classes.h2}>
            {copy.recentLooks}
          </h2>
          <p className={classes.muted}>{copy.privacyLine}</p>
        </div>
        {view.recent.length > 0 ? (
          <ul className={classes.recent}>
            {view.recent.map((row) => (
              <li key={row.key} className={classes.recentRow}>
                <Thumb src={row.imageUrl} />
                <div className={classes.recentText}>
                  <p className={classes.recentTitle}>
                    <bdi>{row.title}</bdi>
                  </p>
                  <span className={classes.muted}>{row.ago}</span>
                </div>
                <div className={classes.pills}>
                  <span className={classes.pill} data-outcome={row.outcome}>
                    {row.label}
                  </span>
                  {row.notCounted && (
                    <span className={classes.pill} data-outcome="none">
                      {copy.notCounted}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={classes.muted}>{copy.noRecentLooks}</p>
        )}
      </section>
    </V16TryOnFrame>
  );
}

export function V16TryOnResultsError({ locale, canSetUp = true }: { locale: SiteLocale; canSetUp?: boolean }) {
  const copy = getTryOnResultsCopy(locale);
  return (
    <V16TryOnFrame locale={locale} tab="results" status={null} canSetUp={canSetUp}>
      <p className={`${classes.card} ${classes.error}`} role="status">
        {copy.couldNotLoad}
      </p>
    </V16TryOnFrame>
  );
}
