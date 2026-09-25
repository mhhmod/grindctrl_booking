'use client';

/* The v15 pricing page. Plans, prices and packs come from the live catalog
   (app/pricing/page.tsx resolves the currency and loads it); copy comes from
   pricing-copy.ts; which answers show comes from lib/product-truth, exactly
   as before. The design draws what a credit is instead of explaining it:
   one photo plus one piece make one delivered look, and a failed generation
   gives its credit back. */

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLandingLocale } from '@/components/landing/landing-locale';
import { CurrencyToggle } from '@/components/pricing/currency-toggle';
import { SiteChip, SiteBadge } from '@/components/site/chip';
import {
  BlocksIcon,
  BoltIcon,
  CalendarIcon,
  CameraIcon,
  ChartIcon,
  ChatIcon,
  EqualsIcon,
  HangerIcon,
  InfoIcon,
  MinusIcon,
  PhotoIcon,
  PlusIcon,
  RefundIcon,
  ShirtIcon,
  SITE_ICONS,
  SparkleIcon,
  StackIcon,
  TagIcon,
  TickIcon,
} from '@/components/site/icons';
import { MarketingChrome } from '@/components/site/marketing-chrome';
import { GrindctrlMark } from '@/components/site/marks';
import type { SiteNavItem } from '@/components/site/site-header';
import { trackClick } from '@/lib/analytics';
import { BOOKING_URL } from '@/lib/booking';
import { displayCurrencyFor, type Currency } from '@/lib/pricing/currency';
import {
  findPublicTruthRecord,
  isPublishableWithoutOwnerReview,
} from '@/lib/product-truth/public-register';
import type {
  PublicCreditPackCatalogItem,
  PublicEntitlementCatalog,
  PublicPlanCatalogItem,
} from '@/lib/try-on/public-catalog';
import { cn } from '@/lib/utils';
import { getPricingCopy, type PlanFeature, type PricingCopy } from './pricing-copy';

export function formatNumber(value: number, locale: 'en' | 'ar'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    numberingSystem: 'latn',
  }).format(value);
}

export function formatCurrency(
  value: number,
  currency: string,
  locale: 'en' | 'ar',
  fractionDigits: number,
): string {
  try {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      numberingSystem: 'latn',
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(fractionDigits)}`;
  }
}

export function isPricingRecordVisible(id: string): boolean {
  const record = findPublicTruthRecord(id);
  return record ? isPublishableWithoutOwnerReview(record) : false;
}

const PLAN_PREFIXES = ['free', 'launch', 'growth', 'pro', 'dfy'] as const;
type PlanFamily = (typeof PLAN_PREFIXES)[number];

export function planFamily(planKey: string): PlanFamily | null {
  return PLAN_PREFIXES.find((prefix) => planKey.startsWith(`${prefix}-`)) ?? null;
}

export function getPlanCopyKey(planKey: string): string {
  const family = planFamily(planKey);
  return family ? `${family}-v1` : planKey;
}

function getPackCopyKey(packKey: string): string {
  if (packKey.startsWith('pack-lite-')) return 'pack-lite-v1';
  if (packKey.startsWith('pack-flash-')) return 'pack-flash-v1';
  return packKey;
}

export function isRecommendedPlan(plan: Pick<PublicPlanCatalogItem, 'planKey'>): boolean {
  return plan.planKey.startsWith('launch-');
}

/** The try-ons meter: this plan against the largest plan on the page, never under 3%. */
export function meterPercent(renders: number, largest: number): number {
  if (largest <= 0) return 3;
  return Math.max(3, Math.min(100, Math.round((renders / largest) * 100)));
}

const PLAN_ICON: Record<PlanFamily, React.ComponentType<{ size?: number }>> = {
  free: SparkleIcon,
  launch: BoltIcon,
  growth: ChartIcon,
  pro: BlocksIcon,
  dfy: BlocksIcon,
};

function isFeatureVisible(feature: PlanFeature): boolean {
  return !feature.truthRecordId || isPricingRecordVisible(feature.truthRecordId);
}

const SECTIONS = ['plans', 'topups', 'faq'] as const;
type SectionId = (typeof SECTIONS)[number];

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function scrollToSection(id: SectionId) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  window.history.replaceState(null, '', `#${id}`);
}

/* ─── Hero figure: one try-on, drawn ─── */

function UnitTile({
  src,
  label,
  icon,
  contain = false,
}: {
  src: string;
  label: string;
  icon: React.ReactNode;
  contain?: boolean;
}) {
  return (
    <div className="w-[var(--tile)] text-center">
      <div className="relative h-[calc(var(--tile)*1.3)] overflow-hidden rounded-2xl bg-gc-studio">
        <Image
          src={src}
          alt=""
          fill
          /* Eager, not priority: the tiles are on the first screen, but a
             high-priority preload of all three competes with the
             stylesheet on a slow connection and delays the first paint. */
          loading="eager"
          sizes="(min-width: 1024px) 118px, 92px"
          className={cn(contain ? 'object-contain p-2' : 'object-cover object-[50%_16%]')}
        />
      </div>
      <span className="mt-2 inline-flex items-center gap-[5px] text-xs font-bold text-gc-text-2">
        {icon}
        {label}
      </span>
    </div>
  );
}

function Operator({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="mt-[calc(var(--tile)*0.65-15px)] inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-foreground text-background"
    >
      {children}
    </span>
  );
}

function UnitCard({ t }: { t: PricingCopy }) {
  return (
    <figure
      role="img"
      aria-label={t.unitAria}
      /* Tiles are 92px on phones and 118px on desktop, and shrink with the
         viewport below about 425px so the figure never overflows at 320.
         The figure's size is set from the tile size (three tiles, two 30px
         operators, the gaps, padding and border) rather than from its
         content, so a slow connection that paints the figure before all of
         it has arrived doesn't move it, or the heading beside it, as the
         rest streams in. */
      className="m-0 w-[calc(var(--tile)*3+118px)] rounded-[28px] border border-border bg-card p-4 shadow-[var(--gc-shadow-float)] [--tile:min(92px,calc((100vw-148px)/3))] lg:min-h-[calc(var(--tile)*1.3+125px)] lg:w-[calc(var(--tile)*3+146px)] lg:p-[22px] lg:[--tile:118px]"
    >
      <div className="flex items-start justify-start gap-1.5 lg:gap-2.5">
        <UnitTile src="/landing/v15/shopper-woman.webp" label={t.unitPhoto} icon={<CameraIcon size={13} strokeWidth={1.9} />} />
        <Operator>
          <PlusIcon size={14} strokeWidth={2.2} />
        </Operator>
        <UnitTile
          src="/landing/v15/garment-abaya.webp"
          label={t.unitPiece}
          icon={<HangerIcon size={13} strokeWidth={1.9} />}
          contain
        />
        <Operator>
          <EqualsIcon size={14} strokeWidth={2.2} />
        </Operator>
        <UnitTile src="/landing/v15/woman-abaya.webp" label={t.unitLook} icon={<SparkleIcon size={13} strokeWidth={1.9} />} />
      </div>
      <div className="mt-3.5 flex items-center justify-center gap-2.5 text-sm font-bold lg:mt-[18px]">
        <span className="inline-flex h-8 items-center gap-[7px] rounded-full bg-foreground px-3 text-background">
          <StackIcon size={15} strokeWidth={1.9} />
          {t.unitTryOn}
        </span>
        <span aria-hidden="true" className="text-muted-foreground">
          =
        </span>
        {t.unitDelivered}
      </div>
    </figure>
  );
}

/* ─── Plans ─── */

function PlanCard({
  plan,
  t,
  locale,
  currency,
  largest,
}: {
  plan: PublicPlanCatalogItem;
  t: PricingCopy;
  locale: 'en' | 'ar';
  currency: Currency;
  largest: number;
}) {
  const family = planFamily(plan.planKey);
  const copy = t.plans[getPlanCopyKey(plan.planKey)];
  const name = locale === 'ar' && copy ? copy.name : plan.name;
  /* Unchanged rule: English leads with the database description, Arabic with
     the approved copy entry. */
  const description = locale === 'ar'
    ? copy?.description ?? plan.description
    : plan.description ?? copy?.description;
  const recommended = isRecommendedPlan(plan);
  const Icon = family ? PLAN_ICON[family] : SparkleIcon;
  const price = formatCurrency(plan.priceMinor / 100, displayCurrencyFor(plan, currency), locale, 0);
  const headingId = `plan-${plan.planKey}`;
  const features: PlanFeature[] = [
    { icon: 'photo', text: family === 'dfy' ? t.premiumQuality : t.standardQuality },
    ...(copy?.features ?? []).filter(isFeatureVisible),
  ];
  const free = plan.isFree || family === 'free';
  const buttonClass = cn(
    'mt-5 inline-flex h-[46px] w-full items-center justify-center gap-[9px] whitespace-nowrap rounded-full px-5 text-[15px] font-bold hover:brightness-110',
    recommended ? 'bg-foreground text-background' : 'border border-border bg-card text-foreground',
  );
  const track = () => trackClick('plan_cta_clicked', { plan: plan.planKey, section: 'pricing_plan' });

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        'relative flex min-w-0 flex-col rounded-[26px] bg-card p-5',
        recommended
          ? 'border-[1.5px] border-foreground shadow-[var(--gc-shadow-card-strong)]'
          : 'border border-border shadow-[var(--gc-shadow-card)]',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex size-[38px] shrink-0 items-center justify-center rounded-xl',
            recommended ? 'bg-foreground text-background' : 'bg-gc-studio text-foreground',
          )}
        >
          <Icon size={19} />
        </span>
        <h3 id={headingId} className="min-w-0 flex-1 break-words text-[19px] font-bold">
          {name}
        </h3>
        {recommended ? (
          <SiteBadge tone="ink" icon={<TickIcon size={12} strokeWidth={2.4} />}>
            {t.recommended}
          </SiteBadge>
        ) : null}
      </div>
      {description ? (
        <p className="mt-3 text-[13.5px] leading-normal text-muted-foreground lg:min-h-10">{description}</p>
      ) : null}
      <p className="mt-4 flex min-w-0 flex-wrap items-baseline gap-x-1.5">
        <span className="break-words text-[44px] font-bold leading-none tracking-[-0.03em]">{price}</span>
        <span className="text-sm text-muted-foreground">/ {t.month}</span>
      </p>
      <div className="mt-[18px]">
        <div className="flex items-center justify-between gap-3 text-[13.5px] font-bold">
          <span className="inline-flex items-center gap-[7px]">
            <ShirtIcon size={15} />
            {t.tryOns(formatNumber(plan.rendersIncluded, locale))}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">{t.perMonth}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-[3px] bg-secondary" aria-hidden="true">
          <div
            data-meter=""
            className="h-full rounded-[3px] bg-foreground"
            style={{ width: `${meterPercent(plan.rendersIncluded, largest)}%` }}
          />
        </div>
      </div>
      <ul className="mt-[18px] flex flex-1 flex-col gap-[9px]">
        {features.map((feature) => {
          const FeatureIcon = SITE_ICONS[feature.icon];
          return (
            <li key={feature.text} className="flex items-center gap-[9px] text-[13.5px] leading-snug">
              <span
                aria-hidden="true"
                className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-gc-studio"
              >
                <FeatureIcon size={14} />
              </span>
              <span className="min-w-0">{feature.text}</span>
            </li>
          );
        })}
      </ul>
      {free ? (
        <Link href="/sign-up" onClick={track} className={buttonClass}>
          <SparkleIcon size={17} />
          {t.choosePlan(name)}
        </Link>
      ) : (
        <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" onClick={track} className={buttonClass}>
          <CalendarIcon size={17} />
          {copy?.button ?? t.bookCallForPlan(name)}
        </a>
      )}
    </article>
  );
}

function FlowNode({
  icon,
  title,
  detail,
  dark = false,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-2xl py-2.5 pe-3.5 ps-2.5',
        dark ? 'bg-foreground text-background' : 'border border-border bg-card',
      )}
    >
      <span
        className={cn(
          'inline-flex size-[34px] shrink-0 items-center justify-center rounded-[11px]',
          dark ? 'bg-background/[0.12]' : 'bg-gc-studio',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-bold">{title}</span>
        <span className="block text-xs opacity-75">{detail}</span>
      </span>
    </div>
  );
}

function CreditFlow({ t }: { t: PricingCopy }) {
  return (
    <div
      role="img"
      aria-label={t.creditsAria}
      className="mt-[22px] flex flex-col gap-3.5 rounded-3xl bg-card/70 p-4 lg:mt-[26px] lg:grid lg:grid-cols-[minmax(0,250px)_auto_minmax(0,260px)] lg:items-center lg:justify-between lg:gap-7 lg:px-6 lg:py-5"
    >
      <div>
        <p className="text-[15px] font-bold">{t.creditsTitle}</p>
        <p className="mt-[3px] text-[13px] leading-[1.45] text-muted-foreground">{t.creditsLine}</p>
      </div>
      <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-3">
        <FlowNode dark icon={<StackIcon size={17} />} title={t.creditReserved} detail={t.creditReservedWhen} />
        {/* Phones: one arrow down to both outcomes. */}
        <svg
          width="22"
          height="14"
          viewBox="0 0 34 14"
          fill="none"
          stroke="var(--gc-inactive)"
          strokeWidth={1.5}
          strokeLinecap="round"
          aria-hidden="true"
          className="mx-auto rotate-90 lg:hidden"
        >
          <path d="M1 7h30M26 2l5 5-5 5" />
        </svg>
        {/* Desktop: the reserved credit forks into its two outcomes. */}
        <svg
          width="46"
          height="120"
          viewBox="0 0 46 120"
          fill="none"
          stroke="var(--gc-inactive)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="hidden shrink-0 lg:block rtl:-scale-x-100"
        >
          <path d="M1 60h15" />
          <path d="M16 60V36q0-8 8-8h18M37 23l5 5-5 5" />
          <path d="M16 60v24q0 8 8 8h18M37 87l5 5-5 5" />
        </svg>
        <div className="flex flex-col gap-2">
          <FlowNode icon={<TickIcon size={17} />} title={t.creditDelivered} detail={t.creditDeliveredResult} />
          <FlowNode icon={<RefundIcon size={17} />} title={t.creditFailed} detail={t.creditFailedResult} />
        </div>
      </div>
      <p className="flex items-start gap-2 text-[12.5px] leading-normal text-muted-foreground lg:border-s lg:border-secondary lg:ps-6">
        <InfoIcon size={15} className="mt-px shrink-0" />
        <span>{t.creditNote}</span>
      </p>
    </div>
  );
}

/* ─── Packs ─── */

function PackRow({
  pack,
  t,
  locale,
  showValidity,
}: {
  pack: PublicCreditPackCatalogItem;
  t: PricingCopy;
  locale: 'en' | 'ar';
  showValidity: boolean;
}) {
  const key = getPackCopyKey(pack.packKey);
  const packCopy = t.packs[key];
  const name = packCopy?.name ?? pack.name;
  const premium = key === 'pack-flash-v1';
  return (
    <article className="flex items-center gap-3 rounded-[22px] border border-border bg-card px-4 py-4 sm:gap-4 sm:px-[18px]">
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex size-[52px] shrink-0 items-center justify-center rounded-2xl',
          premium ? 'bg-foreground text-background' : 'bg-gc-studio text-foreground',
        )}
      >
        <StackIcon size={24} strokeWidth={1.7} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 lang="en" className="text-[17px] font-bold">
            {name}
          </h3>
          {premium ? <SiteBadge icon={<SparkleIcon size={13} strokeWidth={1.9} />}>{t.premium}</SiteBadge> : null}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <PhotoIcon size={14} />
            {t.renders(formatNumber(pack.renders, locale))}
          </span>
          {showValidity ? <span>{t.validFor(formatNumber(pack.validityDays, locale))}</span> : null}
        </p>
      </div>
      <p className="shrink-0 text-end">
        <span className="block text-[22px] font-bold tracking-[-0.02em] sm:text-[26px]">
          {formatCurrency(pack.priceMinor / 100, pack.currency, locale, 0)}
        </span>
        <span className="block text-xs text-muted-foreground">{t.oneTime}</span>
      </p>
      <a
        href={BOOKING_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t.askAboutPack(name)}
        onClick={() => trackClick('pack_cta_clicked', { pack: pack.packKey, section: 'pricing_pack' })}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:bg-foreground/[0.06]"
      >
        <CalendarIcon size={17} />
      </a>
    </article>
  );
}

/* ─── Questions ─── */

function FaqList({ items }: { items: PricingCopy['faq'] }) {
  const [open, setOpen] = React.useState(0);
  return (
    <div className="min-w-0 border-t border-secondary">
      {items.map((item, index) => {
        const expanded = open === index;
        const Icon = SITE_ICONS[item.icon];
        return (
          <div key={item.question} className="border-b border-secondary">
            <h3>
              <button
                type="button"
                id={`faq-q${index}`}
                aria-expanded={expanded}
                aria-controls={`faq-a${index}`}
                onClick={() => setOpen(expanded ? -1 : index)}
                className="flex min-h-[60px] w-full items-center gap-3 px-1 py-2 text-start text-[15.5px] font-bold text-foreground hover:bg-foreground/[0.03]"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-gc-studio"
                >
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">{item.question}</span>
                {expanded ? <MinusIcon size={18} strokeWidth={2} /> : <PlusIcon size={18} strokeWidth={2} />}
              </button>
            </h3>
            <div
              id={`faq-a${index}`}
              role="region"
              aria-labelledby={`faq-q${index}`}
              hidden={!expanded}
              className="gc-anim-in pb-[18px] pe-1 ps-[50px] text-[14.5px] leading-relaxed text-gc-text-2"
            >
              <p>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Page ─── */

function useActiveSection(): SectionId | null {
  const [active, setActive] = React.useState<SectionId | null>(null);
  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => visible.set(entry.target.id, entry.isIntersecting));
        const first = SECTIONS.find((id) => visible.get(id));
        setActive(first ?? null);
      },
      { rootMargin: '-30% 0px -55% 0px' },
    );
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);
  return active;
}

const headingClass = 'text-[28px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-4xl lg:text-[44px]';

export function PricingPageContent({
  catalog,
  currency,
}: {
  catalog: PublicEntitlementCatalog;
  currency: Currency;
}) {
  const { locale, t: landingT } = useLandingLocale();
  const t = getPricingCopy(locale);
  const activeSection = useActiveSection();
  const sortedPlans = [...catalog.plans].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedPacks = [...catalog.packs].sort((a, b) => a.sortOrder - b.sortOrder);
  const largest = Math.max(0, ...sortedPlans.map((plan) => plan.rendersIncluded));
  const showMarketComparison = isPricingRecordVisible('pricing.competitor-entry-volume');
  const showPackValidity = isPricingRecordVisible('pricing.topups-valid-365-days');
  const visibleFaq = t.faq.filter(
    (item) => !item.truthRecordId || isPricingRecordVisible(item.truthRecordId),
  );

  const tab = (id: SectionId, label: string, icon: React.ReactNode): SiteNavItem => ({
    id,
    label,
    href: `#${id}`,
    icon,
    onSelect: (event) => {
      event.preventDefault();
      scrollToSection(id);
    },
  });
  const tabs = [
    tab('plans', t.tabPlans, <CalendarIcon size={15} />),
    tab('topups', t.tabTopups, <StackIcon size={15} />),
    tab('faq', t.tabQuestions, <ChatIcon size={15} />),
  ];
  const menu: SiteNavItem[] = [
    ...tabs,
    { id: 'home', label: landingT.footerHome, href: '/', icon: <GrindctrlMark className="h-3.5 w-5" /> },
    { id: 'try-on', label: landingT.footerDemo, href: '/try-on', icon: <ShirtIcon size={16} /> },
  ];

  const primaryCta = 'inline-flex h-[50px] items-center justify-center gap-[9px] whitespace-nowrap rounded-full px-[22px] text-[15px] font-bold hover:brightness-110';

  return (
    <MarketingChrome
      wiring
      trace={t.trace}
      header={{
        nav: tabs,
        menuItems: menu,
        navIcons: true,
        tag: { icon: <TagIcon size={15} />, label: t.pricing },
        activeId: activeSection,
        bookIcon: true,
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[560px] lg:max-w-none">
          {/* Hero */}
          <section
            aria-labelledby="pricing-title"
            className="flex flex-col gap-[26px] pt-4 text-center lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:pt-9 lg:text-start"
          >
            <div className="min-w-0 lg:max-w-[600px]">
              <SiteChip icon={<TagIcon size={15} />}>{t.eyebrow}</SiteChip>
              <h1
                id="pricing-title"
                className="mt-4 text-[32px] font-bold leading-[1.06] tracking-[-0.035em] lg:text-[50px]"
              >
                {t.title}
              </h1>
              <p className="mt-3.5 text-[15px] leading-normal text-muted-foreground lg:text-[17px]">{t.intro}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2.5 lg:justify-start">
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackClick('cta_clicked', { cta: 'book_call', section: 'pricing_hero' })}
                  className={cn(primaryCta, 'bg-foreground text-background')}
                >
                  <CalendarIcon size={17} />
                  {t.bookCall}
                </a>
                <Link
                  href="/try-on"
                  onClick={() => trackClick('cta_clicked', { cta: 'try_on', section: 'pricing_hero' })}
                  className={cn(primaryCta, 'border border-border bg-card text-foreground')}
                >
                  <ShirtIcon size={17} />
                  {t.tryDemo}
                </Link>
              </div>
            </div>
            <div className="flex justify-center lg:shrink-0">
              <UnitCard t={t} />
            </div>
          </section>

          {/* Plans */}
          <section id="plans" aria-labelledby="plans-title" className="mt-[60px] scroll-mt-24 lg:mt-24">
            <div className="flex flex-col items-center gap-4 text-center lg:flex-row lg:items-end lg:justify-between lg:text-start">
              <div className="min-w-0">
                <SiteChip icon={<CalendarIcon size={15} />}>{t.plansEyebrow}</SiteChip>
                <h2 id="plans-title" className={cn('mt-3.5', headingClass)}>
                  {t.plansTitle}
                </h2>
              </div>
              <CurrencyToggle currency={currency} />
            </div>
            <div className="mt-[22px] grid min-w-0 gap-3 lg:mt-[30px] lg:grid-cols-2 lg:gap-4 xl:grid-cols-4">
              {sortedPlans.map((plan) => (
                <PlanCard
                  key={plan.planKey}
                  plan={plan}
                  t={t}
                  locale={locale}
                  currency={currency}
                  largest={largest}
                />
              ))}
            </div>
            <CreditFlow t={t} />
            {showMarketComparison ? (
              <aside className="mt-8 border-t border-border pt-6 text-center lg:text-start">
                <SiteChip>{t.marketLabel}</SiteChip>
                <p className="mt-3 max-w-xl text-lg font-semibold leading-8 lg:max-w-2xl">{t.marketLead}</p>
              </aside>
            ) : null}
          </section>

          {/* Top-ups */}
          <section
            id="topups"
            aria-labelledby="packs-title"
            className="mt-[60px] flex scroll-mt-24 flex-col gap-5 lg:mt-[100px] lg:flex-row lg:items-center lg:justify-between lg:gap-[60px]"
          >
            <div className="min-w-0 text-center lg:max-w-[420px] lg:text-start">
              <SiteChip icon={<StackIcon size={15} />}>{t.packsEyebrow}</SiteChip>
              <h2 id="packs-title" className={cn('mt-3.5', headingClass)}>
                {t.packsTitle}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{t.packsBody}</p>
            </div>
            <div className="flex min-w-0 flex-col gap-2.5 lg:w-[600px] lg:max-w-[58%]">
              {sortedPacks.map((pack) => (
                <PackRow key={pack.packKey} pack={pack} t={t} locale={locale} showValidity={showPackValidity} />
              ))}
            </div>
          </section>

          {/* Questions */}
          <section
            id="faq"
            aria-labelledby="faq-title"
            className="mt-[60px] flex scroll-mt-24 flex-col gap-[18px] lg:mt-[100px] lg:flex-row lg:items-start lg:justify-between lg:gap-[60px]"
          >
            <div className="min-w-0 text-center lg:max-w-[400px] lg:text-start">
              <SiteChip icon={<ChatIcon size={15} />}>{t.faqEyebrow}</SiteChip>
              <h2 id="faq-title" className={cn('mt-3.5', headingClass)}>
                {t.faqTitle}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{t.termsReviewNote}</p>
            </div>
            <div className="min-w-0 lg:w-[600px] lg:max-w-[58%]">
              <FaqList items={visibleFaq} />
            </div>
          </section>

          {/* Closing band */}
          <section
            aria-labelledby="close-title"
            className="mb-4 mt-[60px] flex flex-col gap-5 rounded-[30px] bg-foreground p-[26px] text-center text-background lg:mt-[100px] lg:flex-row lg:items-center lg:justify-between lg:gap-[30px] lg:p-10 lg:text-start"
          >
            <div className="min-w-0">
              <h2 id="close-title" className="text-[26px] font-bold leading-[1.12] tracking-[-0.03em] lg:text-[34px]">
                {t.ctaTitle}
              </h2>
              <p className="mt-2.5 text-[15px] leading-normal text-background/75">{t.ctaBody}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2.5 lg:shrink-0">
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick('cta_clicked', { cta: 'book_call', section: 'pricing_closing' })}
                className={cn(primaryCta, 'bg-background text-foreground')}
              >
                <CalendarIcon size={17} />
                {t.bookCall}
              </a>
              <Link
                href="/try-on"
                onClick={() => trackClick('cta_clicked', { cta: 'try_on', section: 'pricing_closing' })}
                className={cn(primaryCta, 'border border-background/30 text-background')}
              >
                <ShirtIcon size={17} />
                {t.tryDemo}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </MarketingChrome>
  );
}
