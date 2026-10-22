'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Drawer } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import type { TodayCopy } from '@/lib/dashboard/today-copy';
import { getTodayCopy } from '@/lib/dashboard/today-copy';
import type { TodayView } from '@/lib/dashboard/today-model';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import classes from './v16-today.module.css';

/* The v16 Today page (04-dashboard.md): the health strip, Needs you (or a
   calm card when nothing does) and the last 7 days. Only what has a source
   is drawn; the model in lib/dashboard/today-model.ts decides what that is,
   and this file only lays it out. */

function HealthStrip({ view, copy, onDetails }: { view: TodayView; copy: TodayCopy; onDetails: () => void }) {
  return (
    <section aria-label={copy.storeHealth} className={`${classes.card} ${classes.health}`}>
      <span className={classes.healthLead}>
        <span className={classes.dot} data-tone={view.health.tone} aria-hidden="true" />
        {view.health.lead}
      </span>
      {view.health.items.map((item) => (
        <span key={item.text} className={classes.healthItem}>
          <GcIcon name={item.icon} size={18} />
          {item.text}
        </span>
      ))}
      <Button
        variant="subtle"
        className={classes.healthDetails}
        onClick={onDetails}
        rightSection={<GcIcon name="chev" size={16} />}
      >
        {copy.healthDetails}
      </Button>
    </section>
  );
}

function NeedsYou({ needs, copy }: { needs: NonNullable<TodayView['needsYou']>; copy: TodayCopy }) {
  return (
    <section aria-labelledby="today-needs-you" className={`${classes.card} ${classes.needs}`}>
      <div className={classes.needsHead}>
        <h2 id="today-needs-you" className={classes.h2}>
          {copy.needsYou}
        </h2>
        <span className={classes.count}>{needs.count}</span>
      </div>
      <ul className={classes.rows}>
        {needs.rows.map((row, index) => (
          <li key={row.kind} className={classes.row}>
            <span className={classes.rowIcon} data-tone={row.tone} aria-hidden="true">
              <GcIcon name={row.icon} size={22} />
            </span>
            <div className={classes.rowText}>
              <p className={classes.rowTitle}>{row.title}</p>
              <p className={classes.rowLine}>{row.line}</p>
            </div>
            {row.action && (
              <Button
                component={Link}
                href={row.action.href}
                radius="pill"
                variant={index === 0 ? 'filled' : 'default'}
                className={classes.rowAction}
              >
                {row.action.label}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Calm({ calm, copy }: { calm: NonNullable<TodayView['calm']>; copy: TodayCopy }) {
  return (
    <section aria-labelledby="today-calm" className={`${classes.card} ${classes.calm}`}>
      <span className={classes.calmIcon} aria-hidden="true">
        <GcIcon name="check" size={26} />
      </span>
      <h2 id="today-calm" className={classes.h2}>
        {copy.nothingNeedsYou}
      </h2>
      {calm.body && <p className={classes.calmBody}>{calm.body}</p>}
      {calm.chips.length > 0 && (
        <div className={classes.chips}>
          {calm.chips.map((chip) => (
            <span key={chip} className={classes.chip}>
              {chip}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function LastWeek({ tiles, copy }: { tiles: TodayView['tiles']; copy: TodayCopy }) {
  if (tiles.length === 0) return null;
  return (
    <section aria-labelledby="today-last-week" className={classes.tilesSection}>
      <h2 id="today-last-week" className={classes.h2}>
        {copy.lastSevenDays}
      </h2>
      <div className={classes.tiles} data-count={tiles.length}>
        {tiles.map((tile) => (
          <div key={tile.key} className={`${classes.card} ${classes.tile}`}>
            <p className={classes.tileLabel}>{tile.label}</p>
            <p className={classes.tileValue}>{tile.value}</p>
            {tile.sub && (
              <p className={classes.tileSub} data-trend={tile.trend}>
                {tile.sub}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function V16Today({ view, locale }: { view: TodayView; locale: SiteLocale }) {
  const copy = getTodayCopy(locale);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  return (
    <div className={classes.page}>
      <HealthStrip view={view} copy={copy} onDetails={() => setDetailsOpen(true)} />
      {view.needsYou ? <NeedsYou needs={view.needsYou} copy={copy} /> : view.calm && <Calm calm={view.calm} copy={copy} />}
      <LastWeek tiles={view.tiles} copy={copy} />
      <Drawer
        opened={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        position={locale === 'ar' ? 'left' : 'right'}
        title={copy.healthDetails}
        closeButtonProps={{ 'aria-label': copy.closeDetails }}
      >
        <ul className={classes.detailRows}>
          {view.details.rows.map((row) => (
            <li key={row.key} className={classes.detailRow}>
              <span className={classes.dot} data-tone={row.tone} aria-hidden="true" />
              <p className={classes.detailTitle}>
                {row.title}{' '}
                <span className={classes.detailState}>
                  · {row.tone === 'ok' ? copy.details.ok : copy.details.attention}
                </span>
              </p>
              <p className={classes.detailResult}>{row.result}</p>
            </li>
          ))}
        </ul>
        <p className={classes.notChecked}>{view.details.notChecked}</p>
      </Drawer>
    </div>
  );
}
