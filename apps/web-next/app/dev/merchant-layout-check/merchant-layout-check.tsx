'use client';

import { useEffect } from 'react';
import { Button } from '@mantine/core';
import { MantineUiProvider } from '@/components/mantine/provider';
import { V16Plan } from '@/components/dashboard/v16/plan/v16-plan';
import { V16Team, type TeamActions } from '@/components/dashboard/v16/settings/v16-team';
import { buildPlanView, type PlanFacts } from '@/lib/dashboard/plan-model';
import { getPlanCopy } from '@/lib/dashboard/plan-copy';
import { buildTeamView, type TeamFacts } from '@/lib/dashboard/team-model';
import { getTeamCopy } from '@/lib/dashboard/team-copy';
import { getShellCopy } from '@/lib/dashboard/shell-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import shell from '@/components/dashboard/v16/v16-shell.module.css';

const NOW = Date.parse('2026-11-12T12:00:00Z');
const EMAIL = 'mostafasabrymohamed121@gmail.com';
// Sample catalogue, not a replacement for the store's database catalogue.
const PLAN: PlanFacts = {
  now: NOW, timeZone: 'Africa/Cairo', currency: 'USD', looks: [],
  plan: { planKey: 'free-v2', planName: 'Free', status: 'active', isFree: true, rendersIncluded: 15,
    topUpCreditsRemaining: 0, totalCreditsRemaining: 15, currentPeriodStart: '2026-11-01T00:00:00Z',
    currentPeriodEnd: '2026-12-01T00:00:00Z', available: true },
  plans: [
    { planKey: 'free-v2', name: 'Free', priceMinor: 0, rendersIncluded: 15 },
    { planKey: 'launch-v1', name: 'Launch', priceMinor: 1500, rendersIncluded: 150 },
    { planKey: 'growth-v1', name: 'Growth', priceMinor: 2900, rendersIncluded: 350 },
    { planKey: 'pro-v1', name: 'Pro', priceMinor: 5900, rendersIncluded: 750 },
  ].map((plan, i) => ({ ...plan, id: plan.planKey, currency: 'USD', description: null, modelKey: 'lite',
    periodUnit: 'month', periodCount: 1, graceDays: i ? 3 : 0, isFree: i === 0, active: true, sortOrder: i })),
};
const TEAM: TeamFacts = {
  now: NOW, afterHours: true,
  people: [
    { profileId: 'owner', name: 'Mostafa Sabry', email: EMAIL, role: 'owner', you: true },
    { profileId: 'member', name: null, email: `another.long.teammate.${EMAIL}`, role: 'member' },
  ],
  invites: [{ id: 'invite', email: `invited.${EMAIL}`, role: 'admin', invitedAt: '2026-11-11T09:00:00Z', expiresAt: '2026-11-18T09:00:00Z' }],
  site: { emailOnHandoff: true, recipients: [EMAIL], availabilityMode: 'always', availabilityTimezone: 'Africa/Cairo', availabilityHours: [] },
};
const ok = async () => ({ ok: true as const });
const actions: TeamActions = { invite: ok, resend: ok, revoke: ok, changeRole: ok, remove: ok };

export function MerchantLayoutCheck({ locale, surface }: { locale: SiteLocale; surface: 'plan' | 'team' }) {
  const copy = getShellCopy(locale);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
  }, [dir, locale]);
  const title = surface === 'plan' ? copy.nav.plan : copy.nav.settings;
  return (
    <MantineUiProvider dir={dir}>
      <div className={shell.shell} dir={dir} lang={locale} data-merchant-layout-fixture>
        <aside className={shell.sidebar}>
          <span className={shell.wordmark}>GrindCTRL</span>
          <span className={shell.storeButton}>My store</span>
          <nav className={shell.nav} aria-label={copy.navLabel}>
            {[copy.nav.today, copy.nav.inbox, copy.nav.tryOn, copy.nav.storeChat, copy.nav.yourStore, copy.nav.plan, copy.nav.settings].map((label) => (
              <span key={label} className={shell.navLink} aria-current={label === title ? 'page' : undefined}>{label}</span>
            ))}
          </nav>
        </aside>
        <div className={shell.column}>
          <header className={shell.topbar}><span className={shell.topbarStore}>{locale === 'ar' ? 'متجري' : 'My store'}</span></header>
          <main className={shell.main}>
            <div className={shell.content}>
              <div className={shell.header}>
                <h1 className={shell.title}>{title}</h1>
                <Button variant="default" radius="pill">{locale === 'ar' ? 'English' : 'العربية'}</Button>
              </div>
              <div className={shell.page}>
                {surface === 'plan'
                  ? <V16Plan locale={locale} view={buildPlanView(PLAN, getPlanCopy(locale), locale)} />
                  : <V16Team locale={locale} view={buildTeamView(TEAM, getTeamCopy(locale), locale)} roles={{ admin: copy.roles.admin, member: copy.roles.member }} actions={actions} />}
              </div>
            </div>
          </main>
        </div>
        <nav className={shell.tabbar} aria-label={copy.phoneNavLabel}>
          {[copy.nav.today, copy.nav.inbox, copy.nav.tryOn, copy.nav.storeChatShort].map((label) => <span key={label} className={shell.tab}>{label}</span>)}
        </nav>
      </div>
    </MantineUiProvider>
  );
}
