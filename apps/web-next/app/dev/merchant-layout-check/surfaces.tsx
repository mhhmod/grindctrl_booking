'use client';

import { Stack } from '@mantine/core';
import { V16Today } from '@/components/dashboard/v16/today/v16-today';
import { V16TodaySetup } from '@/components/dashboard/v16/today/v16-today-setup';
import { V16TryOnFrame, V16TryOnResults, V16TryOnResultsError } from '@/components/dashboard/v16/try-on/v16-tryon';
import { V16TryOnStudio } from '@/components/dashboard/v16/try-on/v16-tryon-studio';
import { V16TryOnApp } from '@/components/dashboard/v16/try-on/v16-tryon-app';
import { V16YourStore, V16YourStoreTodayCard } from '@/components/dashboard/v16/your-store/v16-your-store';
import { V16FinishConfirming, V16NeedsStore, V16NoStore } from '@/components/dashboard/v16/states';
import { V16Plan } from '@/components/dashboard/v16/plan/v16-plan';
import { V16Team, type TeamActions } from '@/components/dashboard/v16/settings/v16-team';
import { StoreFlagsCard } from '@/components/dashboard/store-flags-card';
import { LaunchCard } from '@/components/dashboard/launch-card';
import { ConnectShopPanel } from '@/components/dashboard/connect-shop-panel';
import { ClaimMessage } from '@/components/claim/claim-message';
import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import type { TryOnWidgetSettings } from '@/components/try-on/settings-controls';
import type { PlacementActions } from '@/components/dashboard/v16/try-on/button-placement';
import { buildTodayView, type TodayFacts } from '@/lib/dashboard/today-model';
import { getTodayCopy } from '@/lib/dashboard/today-copy';
import { buildTodaySetupView, type TodaySetupFacts } from '@/lib/dashboard/today-setup-model';
import { getTodaySetupCopy } from '@/lib/dashboard/today-setup-copy';
import { buildTryOnResultsView, type TryOnResultsFacts } from '@/lib/dashboard/tryon-insights-model';
import { getTryOnResultsCopy } from '@/lib/dashboard/tryon-insights-copy';
import { buildTodayStoreCard, buildYourStoreView, type YourStoreFacts } from '@/lib/dashboard/your-store-model';
import { getYourStoreCopy } from '@/lib/dashboard/your-store-copy';
import { buildPlanView, type PlanFacts } from '@/lib/dashboard/plan-model';
import { getPlanCopy } from '@/lib/dashboard/plan-copy';
import { buildTeamView, type TeamFacts } from '@/lib/dashboard/team-model';
import { getTeamCopy } from '@/lib/dashboard/team-copy';
import { getShellCopy } from '@/lib/dashboard/shell-copy';
import { getAuthCopy } from '@/lib/auth/auth-i18n';
import { getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';
import { V16Notice } from '@/components/dashboard/v16/notice';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { STATES as STORE_STATES, connectFor } from '../your-store-check/your-store-check';

/* Sample data for every merchant screen the layout spec walks, with the
   awkward cases on purpose: long names and addresses, Arabic titles, big
   numbers, nothing yet, failures, a pending connection, outdated code and
   no looks left. None of it is real store data. */

export const NOW = Date.parse('2026-11-12T12:00:00Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
export const EMAIL = 'mostafasabrymohamed121@gmail.com';
const LONG_STORE = 'maison-noor-modest-fashion-and-abayas-boutique.myshopify.com';
const ok = async () => ({ ok: true as const });

import type { Surface } from './surface-list';

export function surfaceTitle(surface: Surface, nav: ReturnType<typeof getShellCopy>['nav']) {
  // A new account's connect states stand in for Today inside the shell.
  if (surface.startsWith('today') || surface.startsWith('connect')) return nav.today;
  if (surface.startsWith('tryon')) return nav.tryOn;
  if (surface.startsWith('store')) return nav.yourStore;
  if (surface.startsWith('plan')) return nav.plan;
  if (surface === 'settings' || surface === 'team') return nav.settings;
  return null;
}

/* Today */
const todayFacts = (calm: boolean): TodayFacts => ({
  now: NOW, timeZone: 'Africa/Cairo', canBilling: true,
  tryOn: { looksLeft: calm ? 1240 : 0, looksIncluded: 1500, available: calm, planName: 'Growth', planActive: true,
    resetAt: '2026-12-01T00:00:00Z', looksLast7: calm ? 0 : 128_430, looksPrev7: calm ? 0 : 97_002, looksToday: 12 },
  chat: { lastSeenAt: ago(calm ? 3 : 60 * 30),
    waiting: calm ? [] : [
      { since: ago(184), alertSent: true, cart: { totalMinor: 1_249_900, currency: 'EGP' } },
      { since: ago(41), alertSent: false, cart: { totalMinor: 89_900, currency: 'EGP' } },
    ],
    chatsToday: calm ? 0 : 1_204, handedOffToday: calm ? 0 : 37, solved7: calm ? 0 : 18_402, handedOff7: calm ? 0 : 912,
    handoffs7: calm ? 0 : 912, alertProblems7: calm ? 0 : 3, teamReplyMinutes: calm ? null : 1_440, emailsTeam: !calm },
});

const SETUP: TodaySetupFacts = {
  store: 'Maison Noor Modest Fashion & Abayas Boutique', shop: LONG_STORE,
  chatSeenAt: ago(12), storeLook: false, testLook: false, tryOnMounted: false, holdoutAvailable: true,
};

/* Try-On */
const TITLES = [
  'Muscat everyday crepe abaya with long embroidered sleeves and a matching belt',
  'عباية كريب يومية مطرزة بأكمام طويلة وحزام مطابق',
  'Linen kaftan',
  'فستان سهرة',
];
const tryOnFacts = (empty: boolean): TryOnResultsFacts => ({
  now: NOW, period: 30, live: !empty,
  products: Object.fromEntries(TITLES.map((title, i) => [`p${i}`, { title, imageUrl: null }])),
  jobs: empty ? [] : Array.from({ length: 48 }, (_, i) => ({
    product_id: `p${i % TITLES.length}`, product_title: TITLES[i % TITLES.length],
    status: i % 7 === 3 ? 'failed' : i === 0 ? 'processing' : 'completed', duration_ms: 18_000,
    message: i % 7 === 3 ? (i % 2 ? 'photo_rejected: no person' : 'provider busy') : null,
    created_at: ago(i * 37 + 4),
  })),
});
const SETTINGS: TryOnWidgetSettings = {
  buttonLabel: 'Try it on with your own photo', buttonLabelAr: 'جرّبيها على صورتك', accentBg: '#111111', accentFg: '#ffffff',
  radiusPx: 12, widgetTheme: 'light', iconBgFrom: '#ff9a3d', iconBgTo: '#ffd76e', loadingStyle: 'steps',
  catalogLabel: 'Try on', catalogLabelAr: 'جرّبي', catalogIconPx: 14, catalogFontPx: 12, catalogPadPx: 6, buttonIconPx: 28,
  showDownload: true, showWhatsapp: true, showAddToCart: true, showTryAgain: true,
  disclaimerText: null, disclaimerTextAr: null, loadingSteps: null,
};
const PLACEMENT = {
  read: async () => ({ ok: true as const, placement: { placement: 'spot' as const,
    spot: { selector: 'form[action*="cart"] .product-form__buttons', position: 'after' as const, label: 'أضف إلى السلة', pathHint: '/products/muscat-everyday-crepe-abaya-with-long-embroidered-sleeves' } } }),
  set: async () => ({ ok: true as const, placement: { placement: 'auto' as const } }),
  open: async () => ({ ok: false as const, error: 'demo' }),
} as unknown as PlacementActions;

/* Your store: a long address, three domains (one held elsewhere), outdated code. */
const LONG_SITE = 'maison-noor-modest-fashion-and-abayas.myeasyorders.com';
const storeFacts = (state: 'store' | 'store-outdated'): YourStoreFacts => {
  const base = state === 'store' ? STORE_STATES.running : STORE_STATES['health-broken'];
  return { ...base, address: LONG_SITE, storeUrl: `https://${LONG_SITE}` };
};

/* Plan */
const CATALOGUE = [
  { planKey: 'free-v2', name: 'Free', priceMinor: 0, rendersIncluded: 15 },
  { planKey: 'launch-v1', name: 'Launch', priceMinor: 1500, rendersIncluded: 150 },
  { planKey: 'growth-v1', name: 'Growth', priceMinor: 2900, rendersIncluded: 350 },
  { planKey: 'pro-v1', name: 'Pro', priceMinor: 5900, rendersIncluded: 750 },
].map((plan, i) => ({ ...plan, id: plan.planKey, currency: 'USD', description: null, modelKey: 'lite',
  periodUnit: 'month' as const, periodCount: 1, graceDays: i ? 3 : 0, isFree: i === 0, active: true, sortOrder: i }));
const planFacts = (zero: boolean): PlanFacts => ({
  now: NOW, timeZone: 'Africa/Cairo', currency: 'USD', plans: CATALOGUE,
  looks: zero ? Array.from({ length: 750 }, (_, i) => Date.parse('2026-11-01T08:00:00Z') + i * 13 * 60_000) : [],
  plan: zero
    ? { planKey: 'pro-v1', planName: 'Pro', status: 'active', isFree: false, rendersIncluded: 750, topUpCreditsRemaining: 0,
        totalCreditsRemaining: 0, currentPeriodStart: '2026-11-01T00:00:00Z', currentPeriodEnd: '2026-12-01T00:00:00Z', available: false }
    : { planKey: 'free-v2', planName: 'Free', status: 'active', isFree: true, rendersIncluded: 15, topUpCreditsRemaining: 0,
        totalCreditsRemaining: 15, currentPeriodStart: '2026-11-01T00:00:00Z', currentPeriodEnd: '2026-12-01T00:00:00Z', available: true },
});

/* Team */
const TEAM: TeamFacts = {
  now: NOW, afterHours: true,
  people: [
    { profileId: 'owner', name: 'Mostafa Sabry', email: EMAIL, role: 'owner', you: true },
    { profileId: 'member', name: null, email: `another.long.teammate.${EMAIL}`, role: 'member' },
  ],
  invites: [{ id: 'invite', email: `invited.${EMAIL}`, role: 'admin', invitedAt: '2026-11-11T09:00:00Z', expiresAt: '2026-11-18T09:00:00Z' }],
  site: { emailOnHandoff: true, recipients: [EMAIL, `support.team.${EMAIL}`], availabilityMode: 'always', availabilityTimezone: 'Africa/Cairo', availabilityHours: [] },
};
const teamActions: TeamActions = { invite: ok, resend: ok, revoke: ok, changeRole: ok, remove: ok };
const FLAGS = [
  ['v16_dashboard', 'N1', 'The v16 dashboard'], ['n5_preview_mode', 'N5', 'Preview before going live'],
  ['n6_holdout', 'N6', 'Half of shoppers test (50/50)'], ['n24_theme_check', 'N24', 'Read the theme for Try-On and Store Chat blocks'],
].map(([flag, code, title], i) => ({ flag, code, title, enabled: i % 2 === 0 }));

export function SurfaceBody({ surface, locale }: { surface: Surface; locale: SiteLocale }) {
  const yourStore = getYourStoreCopy(locale);
  const storeCard = <V16YourStoreTodayCard card={buildTodayStoreCard(storeFacts('store-outdated'), yourStore, locale)} locale={locale} />;
  switch (surface) {
    case 'today':
    case 'today-calm':
      return (
        <V16Today
          view={buildTodayView(todayFacts(surface === 'today-calm'), getTodayCopy(locale), locale)}
          locale={locale}
          storeCard={surface === 'today' ? <><V16FinishConfirming locale={locale} shop={LONG_STORE} />{storeCard}</> : null}
        />
      );
    case 'today-setup':
      return <V16TodaySetup view={buildTodaySetupView(SETUP, getTodaySetupCopy(locale))} locale={locale} shop={LONG_STORE}
        actions={{ setLaunchState: async () => ({ ok: true }) as never, createPreviewLink: async () => ({ ok: false }) as never }} storeCard={storeCard} />;
    case 'tryon':
    case 'tryon-empty':
      return <V16TryOnResults locale={locale} view={buildTryOnResultsView(tryOnFacts(surface === 'tryon-empty'), getTryOnResultsCopy(locale), getTodayCopy(locale), locale)} />;
    case 'tryon-error':
      return <V16TryOnResultsError locale={locale} />;
    case 'tryon-setup': {
      const copy = getTryOnResultsCopy(locale);
      return (
        <V16TryOnFrame locale={locale} tab="setup" status={{ live: false, label: copy.hiddenOnStore }}>
          <V16TryOnStudio locale={locale} shop="site:11111111-1111-4111-8111-111111111111" settings={SETTINGS} saveSettings={ok}
            buttonStatus={{ showButton: true, tryOnState: 'not_ready', reason: 'out_of_looks', codeOutdated: true }} setButton={ok}
            cardPill={null} setCardPill={ok} placementActions={PLACEMENT} />
          <LaunchCard locale={locale === 'ar' ? 'ar' : 'en'} shop={LONG_STORE} launch={{ state: 'holdout', holdoutDay: 4, holdoutDays: 14 }} holdoutAvailable />
          <V16TryOnApp locale={locale} shop={LONG_STORE} />
        </V16TryOnFrame>
      );
    }
    case 'store':
    case 'store-outdated':
      return (
        <V16YourStore view={buildYourStoreView(storeFacts(surface), yourStore, locale)} canChange locale={locale}
          alerts={{ siteId: 'preview-site', enabled: true, save: ok }}
          connect={connectFor(surface === 'store' ? 'running' : 'new', false, locale === 'ar' ? 'ar' : 'en')}
          actions={{ setTryOnButton: ok, setStoreChat: ok, checkDomain: ok }} />
      );
    case 'store-new':
      return connectFor('new', false, locale === 'ar' ? 'ar' : 'en');
    case 'settings':
      return (
        <Stack gap="lg">
          <V16Team locale={locale} view={buildTeamView(TEAM, getTeamCopy(locale), locale)}
            roles={{ admin: getShellCopy(locale).roles.admin, member: getShellCopy(locale).roles.member }} actions={teamActions} />
          <StoreFlagsCard kind="shop" storeKey={LONG_STORE} launchKey={LONG_STORE} storeLabel={LONG_STORE} rows={FLAGS} locale={locale}
            launchState="preview" dailyLimits={[{ key: 'tryOnDailyLooks', override: null, defaultLimit: 2_000, limit: 2_000, used: 1_987 },
              { key: 'storeChatDailyTurns', override: 25_000, defaultLimit: 5_000, limit: 25_000, used: null }]} />
        </Stack>
      );
    case 'team':
      return <V16Team locale={locale} view={buildTeamView(TEAM, getTeamCopy(locale), locale)}
        roles={{ admin: getShellCopy(locale).roles.admin, member: getShellCopy(locale).roles.member }} actions={teamActions} />;
    case 'plan':
    case 'plan-zero':
      return <V16Plan locale={locale} view={buildPlanView(planFacts(surface === 'plan-zero'), getPlanCopy(locale), locale)} />;
    case 'claim':
      return <ClaimMessage locale={locale === 'ar' ? 'ar' : 'en'}
        title={locale === 'ar' ? 'لم نتمكن من التحقق من أنك مالك المتجر' : "We couldn't verify you're the store owner"}
        body={locale === 'ar'
          ? 'البريد الإلكتروني للتواصل في Shopify لهذا المتجر لا يطابق حسابك في GRINDCTRL. تواصل مع الدعم إذا كنت تعتقد أن هذا متجرك، أو اربطه بنفسك برمز لمرة واحدة.'
          : "This store's Shopify contact email doesn't match your GRINDCTRL account. Contact support if you believe this is your store, or connect it yourself with a one-time code."}
        actions={[{ label: locale === 'ar' ? 'أعد المحاولة' : 'Try again', href: '/claim?token=x' },
          { label: locale === 'ar' ? 'الربط برمز بدلاً من ذلك' : 'Connect with a code instead', href: '/dashboard/try-on' }]} />;
    case 'onboarding': {
      const copy = getAuthCopy(locale);
      return (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <div className="flex flex-col gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy.onboardingTitle}</h1>
            <p className="text-sm text-muted-foreground sm:text-base">{copy.onboardingLead}</p>
          </div>
          <OnboardingForm copy={copy} profile={null} />
        </div>
      );
    }
    case 'connect':
      return (
        <Stack gap="lg">
          <V16NoStore locale={locale} />
          <V16NeedsStore locale={locale} feature="tryOn" shops={[{ domain: LONG_STORE, label: SETUP.store }] as never} />
        </Stack>
      );
    case 'connect-code':
      // A code already issued and expired, so the fixture never polls.
      return (
        <V16Notice title={getTryOnDashboardCopy(locale).connectAnotherStore} body={getTryOnDashboardCopy(locale).shopifyAppBody}>
          <ConnectShopPanel locale={locale} hasShops initialCode={{ code: 'K7Q2M9XP', expiresAt: new Date(NOW).toISOString() }} />
        </V16Notice>
      );
  }
}
