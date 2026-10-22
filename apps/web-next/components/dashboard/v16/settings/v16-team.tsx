'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import { getTeamCopy } from '@/lib/dashboard/team-copy';
import type { TeamView } from '@/lib/dashboard/team-model';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { V16PageFrame } from '../page-frame';
import classes from './v16-team.module.css';

/* The v16 Settings page (04-dashboard.md), Team, the Team board's first
   tab. The model in lib/dashboard/team-model.ts decides what has a source;
   this file lays it out. Store details and Notifications have no board yet,
   so Team is the one tab. */

const STORE_CHAT_ALERTS = '/dashboard/store-chat/setup?tab=behaviour';

function V16SettingsFrame({ locale, children }: { locale: SiteLocale; children: React.ReactNode }) {
  const copy = getTeamCopy(locale);
  return (
    <V16PageFrame
      badge={null}
      subtitle={copy.subtitle}
      tabsLabel={copy.tabsLabel}
      tabs={[{ label: copy.team, href: '/dashboard/settings', current: true }]}
    >
      {children}
    </V16PageFrame>
  );
}

function ChangeLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button component={Link} href={href} radius="pill" variant="default" className={classes.change}>
      {children}
    </Button>
  );
}

export function V16Team({ view, locale }: { view: TeamView; locale: SiteLocale }) {
  const copy = getTeamCopy(locale);
  return (
    <V16SettingsFrame locale={locale}>
      <div className={classes.page}>
        <section aria-labelledby="team-people" className={classes.card}>
          <div className={classes.head}>
            <h2 id="team-people" className={classes.h2}>
              {copy.people}
            </h2>
            <p className={classes.muted}>{copy.rule}</p>
          </div>
          <ul className={classes.people}>
            {view.people.map((person) => (
              <li key={person.key} className={classes.person}>
                <span className={classes.avatar} aria-hidden="true">
                  {person.initials}
                </span>
                <span className={classes.who}>
                  <bdi className={classes.name}>{person.name}</bdi>
                  {person.email && <bdi className={classes.email}>{person.email}</bdi>}
                </span>
                <span className={classes.role} data-owner={person.owner}>
                  {person.role}
                </span>
              </li>
            ))}
          </ul>
          <div className={classes.row}>
            <span className={classes.rowIcon} aria-hidden="true">
              <GcIcon name="mail" size={16} />
            </span>
            <p className={classes.rowText}>{view.alerts ?? copy.noStoreChat}</p>
            <ChangeLink href={view.alerts ? STORE_CHAT_ALERTS : '/dashboard/store-chat'}>
              {view.alerts ? copy.changeInStoreChat : copy.openStoreChat}
            </ChangeLink>
          </div>
        </section>

        {view.hours && (
          <section aria-labelledby="team-hours" className={classes.card}>
            <div className={classes.row}>
              <span className={classes.rowIcon} aria-hidden="true">
                <GcIcon name="clock" size={16} />
              </span>
              <div className={classes.rowText}>
                <h2 id="team-hours" className={classes.h3}>
                  {copy.openingHours}
                </h2>
                <p className={classes.muted}>{view.hours}</p>
                {view.outsideHours && <p className={classes.muted}>{copy.outsideHours}</p>}
              </div>
              <ChangeLink href={STORE_CHAT_ALERTS}>{copy.change}</ChangeLink>
            </div>
          </section>
        )}
      </div>
    </V16SettingsFrame>
  );
}

export function V16TeamError({ locale }: { locale: SiteLocale }) {
  return (
    <V16SettingsFrame locale={locale}>
      <p className={`${classes.card} ${classes.error}`} role="status">
        {getTeamCopy(locale).couldNotLoad}
      </p>
    </V16SettingsFrame>
  );
}
