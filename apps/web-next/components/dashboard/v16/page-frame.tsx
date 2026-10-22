import * as React from 'react';
import Link from 'next/link';
import classes from './page-frame.module.css';

/* The head of a v16 page with tabs (04-dashboard.md): Try-On's Results and
   Set up, Store Chat's What it knows and Set up. The shell already titles
   the page; this adds the state badge, one line under it, an action on the
   far side, and the tabs, which are links so each tab has its own address. */

export type FrameBadge = { live: boolean; label: string };
export type FrameTab = { label: string; href: string; current: boolean };

export function V16PageFrame({
  badge,
  subtitle,
  action,
  tabsLabel,
  tabs,
  controls,
  children,
}: {
  badge: FrameBadge | null;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  tabsLabel: string;
  tabs: FrameTab[];
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={classes.page}>
      <div className={classes.head}>
        <div className={classes.intro}>
          {badge && (
            <span className={classes.badge} data-live={badge.live}>
              <span className={classes.badgeDot} aria-hidden="true" />
              {badge.label}
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
        {action}
      </div>
      <div className={classes.controls}>
        <nav aria-label={tabsLabel} className={classes.tabs}>
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className={classes.tab} aria-current={tab.current ? 'page' : undefined}>
              {tab.label}
            </Link>
          ))}
        </nav>
        {controls}
      </div>
      {children}
    </div>
  );
}
