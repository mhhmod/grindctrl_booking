'use client';

import { CheckmarkCircle02Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { Icon } from '@/components/icons';
import { AmbientBackground } from '@/components/landing/ambient-background';
import { LandingLocaleToggle, useLandingLocale } from '@/components/landing/landing-locale';
import { CurrencyToggle } from '@/components/pricing/currency-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BOOKING_URL } from '@/lib/booking';
import type { Currency } from '@/lib/pricing/currency';
import type {
  PublicCreditPackCatalogItem,
  PublicEntitlementCatalog,
  PublicPlanCatalogItem,
} from '@/lib/try-on/public-catalog';
import { cn } from '@/lib/utils';
import { getPricingCopy, type PricingCopy } from './pricing-copy';

function formatNumber(value: number, locale: 'en' | 'ar'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US').format(value);
}

function formatCurrency(
  value: number,
  currency: string,
  locale: 'en' | 'ar',
  fractionDigits: number,
): string {
  try {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(fractionDigits)}`;
  }
}

function getPlanCopyKey(planKey: string): string {
  if (planKey.startsWith('free-')) return 'free-v1';
  if (planKey.startsWith('launch-')) return 'launch-v1';
  if (planKey.startsWith('dfy-')) return 'dfy-v1';
  return planKey;
}

function getPackCopyKey(packKey: string): string {
  if (packKey.startsWith('pack-lite-')) return 'pack-lite-v1';
  if (packKey.startsWith('pack-flash-')) return 'pack-flash-v1';
  return packKey;
}

function isPremiumPlan(plan: PublicPlanCatalogItem): boolean {
  return getPlanCopyKey(plan.planKey) === 'dfy-v1';
}

function isPremiumPack(pack: PublicCreditPackCatalogItem): boolean {
  return getPackCopyKey(pack.packKey) === 'pack-flash-v1';
}

function PlanCard({
  plan,
  t,
  locale,
  index,
}: {
  plan: PublicPlanCatalogItem;
  t: PricingCopy;
  locale: 'en' | 'ar';
  index: number;
}) {
  const copy = t.plans[getPlanCopyKey(plan.planKey)];
  const name = locale === 'ar' && copy ? copy.name : plan.name;
  const description = locale === 'ar'
    ? copy?.description ?? plan.description
    : plan.description ?? copy?.description;
  const recommended = getPlanCopyKey(plan.planKey) === 'launch-v1';
  const price = formatCurrency(plan.priceMinor / 100, plan.currency, locale, 0);
  const benefits = [
    t.tryOnsPerMonth(formatNumber(plan.rendersIncluded, locale)),
    isPremiumPlan(plan) ? t.premiumQuality : t.standardQuality,
    ...(copy?.benefits ?? []),
  ];

  return (
    <Card
      className={cn(
        'gc-fade-in-up gc-card-hover flex min-w-0 flex-col rounded-2xl',
        recommended
          ? 'gc-landing-card border-2 border-foreground'
          : 'gc-landing-panel border-border',
      )}
      style={{ animationDelay: `${0.05 + index * 0.06}s` }}
    >
      <CardHeader className="p-5 sm:p-6">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <CardTitle className="min-w-0 text-xl leading-tight">
              <h3 className="break-words">{name}</h3>
            </CardTitle>
            {recommended ? (
              <Badge className="h-6 shrink-0 rounded-full px-2.5">{t.recommended}</Badge>
            ) : null}
          </div>
          <p className="min-h-12 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          <div className="min-w-0">
            <p className="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
              <span className="break-words text-[clamp(2.2rem,11vw,3.25rem)] font-bold leading-none tracking-tight">
                {price}
              </span>
              <span className="pb-1 text-sm text-muted-foreground">/ {t.month}</span>
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-5 pb-6 pt-0 sm:px-6">
        <ul className="flex flex-col gap-3">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex min-w-0 items-start gap-2.5 text-sm leading-6">
              <span className="mt-1 shrink-0 text-muted-foreground" aria-hidden="true">
                <Icon icon={CheckmarkCircle02Icon} size={16} />
              </span>
              <span className="min-w-0 break-words">{benefit}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
        <Button
          asChild
          variant={recommended ? 'default' : 'outline'}
          size="lg"
          className="w-full rounded-full"
        >
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
            {t.choosePlan(name)}
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function PricingPageContent({
  catalog,
  currency,
}: {
  catalog: PublicEntitlementCatalog;
  currency: Currency;
}) {
  const { locale } = useLandingLocale();
  const t = getPricingCopy(locale);
  const sortedPlans = [...catalog.plans].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedPacks = [...catalog.packs].sort((a, b) => a.sortOrder - b.sortOrder);
  const launchPlan = sortedPlans.find(
    (plan) => getPlanCopyKey(plan.planKey) === 'launch-v1',
  );
  const launchRenders = launchPlan ? launchPlan.rendersIncluded.toLocaleString(
    locale === 'ar' ? 'ar-EG' : 'en-US',
  ) : null;

  return (
    <>
      <AmbientBackground />

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" aria-label={t.brandHome} className="min-w-0 rounded-lg">
            <BrandLogo size="sm" textClassName="text-[11px]" />
          </Link>

          <nav className="flex shrink-0 items-center gap-1 sm:gap-2" aria-label={t.pricing}>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden rounded-full px-3 text-muted-foreground sm:inline-flex"
            >
              <Link href="/">{t.home}</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden rounded-full px-3 text-muted-foreground min-[430px]:inline-flex"
            >
              <Link href="/try-on">{t.liveDemo}</Link>
            </Button>
            <LandingLocaleToggle className="bg-background backdrop-blur-none" />
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div
            className="gc-hero-grid-warm pointer-events-none absolute inset-0 -z-10"
            aria-hidden="true"
          />
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(18rem,0.88fr)] lg:items-end lg:gap-16 lg:px-8 lg:py-24">
            <div className="min-w-0">
              <Badge
                variant="secondary"
                className="gc-fade-in-up h-7 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.18em]"
              >
                {t.eyebrow}
              </Badge>
              <h1
                className="gc-fade-in-up mt-6 max-w-4xl text-[clamp(2.35rem,7vw,4.8rem)] font-bold leading-[1.02] tracking-tight"
                style={{ animationDelay: '0.05s' }}
              >
                {t.title}
              </h1>
              <p
                className="gc-fade-in-up mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8"
                style={{ animationDelay: '0.11s' }}
              >
                {t.intro}
              </p>
              <div
                className="gc-fade-in-up mt-8 flex flex-col gap-3 sm:flex-row"
                style={{ animationDelay: '0.17s' }}
              >
                <Button asChild size="lg" className="h-12 rounded-full px-6 font-semibold">
                  <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                    {t.bookCall}
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-full border-border px-6 font-semibold"
                >
                  <Link href="/try-on">{t.tryDemo}</Link>
                </Button>
              </div>
            </div>

            <aside
              className="gc-fade-in-up min-w-0 border-y border-border py-7"
              style={{ animationDelay: '0.13s' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t.marketLabel}
              </p>
              <p className="mt-4 max-w-xl text-lg font-semibold leading-8 sm:text-xl">
                {t.marketLead}
                {launchRenders ? (
                  <>
                    {' '}
                    <span className="text-muted-foreground">{t.marketTail(launchRenders)}</span>
                  </>
                ) : null}
              </p>
            </aside>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="mb-10 max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {t.plansEyebrow}
              </p>
              <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-tight sm:text-4xl lg:text-[44px]">
                {t.plansTitle}
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
                {t.plansBody}
              </p>
            </div>

            {/* Sits with the prices rather than in a page header, so somebody
                who scrolled straight to the plans can still correct it. */}
            <div className="mb-6 flex justify-start">
              <CurrencyToggle currency={currency} />
            </div>

            <div className="grid min-w-0 gap-5 lg:grid-cols-3 lg:items-stretch">
              {sortedPlans.map((plan, index) => (
                <PlanCard
                  key={plan.planKey}
                  plan={plan}
                  t={t}
                  locale={locale}
                  index={index}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-muted/20">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-16 lg:px-8 lg:py-24">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {t.packsEyebrow}
              </p>
              <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">
                {t.packsTitle}
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                {t.packsBody}
              </p>
            </div>

            <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
              {sortedPacks.map((pack, index) => {
                const packCopy = t.packs[getPackCopyKey(pack.packKey)];
                const name = locale === 'ar' && packCopy ? packCopy.name : pack.name;
                return (
                  <article
                    key={pack.packKey}
                    className={cn(
                      'grid min-w-0 gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6',
                      index > 0 && 'border-t border-border',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="min-w-0 break-words text-lg font-semibold">{name}</h3>
                        {isPremiumPack(pack) ? (
                          <Badge variant="outline" className="rounded-full">
                            {t.premium}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>{t.renders(formatNumber(pack.renders, locale))}</span>
                        <span>{t.validFor(formatNumber(pack.validityDays, locale))}</span>
                      </p>
                    </div>
                    <p className="min-w-0 sm:text-end">
                      <span className="block break-words text-2xl font-bold tracking-tight">
                        {formatCurrency(pack.priceMinor / 100, pack.currency, locale, 0)}
                      </span>
                      <span className="text-xs text-muted-foreground">{t.oneTime}</span>
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-16 lg:px-8 lg:py-24">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {t.faqEyebrow}
              </p>
              <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">
                {t.faqTitle}
              </h2>
            </div>

            <div className="min-w-0 border-t border-border">
              {t.faq.map((item) => (
                <details key={item.question} className="group min-w-0 border-b border-border">
                  <summary className="flex min-w-0 cursor-pointer list-none items-center justify-between gap-4 py-5 text-start font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 break-words">{item.question}</span>
                    <span
                      className="shrink-0 transition-transform duration-200 ease-out group-open:rotate-45 motion-reduce:transition-none"
                      aria-hidden="true"
                    >
                      <Icon icon={PlusSignIcon} size={18} />
                    </span>
                  </summary>
                  <p className="max-w-2xl pb-5 pe-8 text-sm leading-7 text-muted-foreground sm:text-base">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="gc-landing-card flex min-w-0 flex-col items-start gap-6 rounded-3xl border p-7 sm:p-12 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 max-w-2xl">
                <h2 className="text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">
                  {t.ctaTitle}
                </h2>
                <p className="mt-3 text-base leading-7 text-muted-foreground sm:text-lg">
                  {t.ctaBody}
                </p>
              </div>
              <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full px-6 font-semibold">
                  <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                    {t.bookCall}
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-full border-border px-6 font-semibold"
                >
                  <Link href="/try-on">{t.tryDemo}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-4 py-10 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo size="sm" textClassName="text-xs" />
          <p className="text-xs">{t.footerTagline}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <Link href="/">{t.home}</Link>
            <Link href="/try-on">{t.liveDemo}</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
