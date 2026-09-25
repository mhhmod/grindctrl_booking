'use client';

/* The v15 header and footer as every page under LandingLocaleProvider uses
   them. Outside the landing, the story items link to the landing with a
   hash (/#try, /#store, ...), which the landing's director reads on load. */

import * as React from 'react';
import { ShopifyMark } from '@/components/brand-marks';
import { useLandingLocale } from '@/components/landing/landing-locale';
import type { LandingTranslator } from '@/lib/landing/landing-i18n';
import { BackgroundWiring } from './background-wiring';
import { BlocksIcon, ChatIcon, PhotoIcon, ShirtIcon, TagIcon } from './icons';
import { AgentMark } from './marks';
import { SiteFooter, type SiteFooterLink } from './site-footer';
import { SiteHeader, type SiteHeaderCopy, type SiteNavItem } from './site-header';
import { SkipLink } from './skip-link';

export type StorySceneId = 'try' | 'store' | 'ops' | 'product' | 'results';

export function siteHeaderCopy(t: LandingTranslator): SiteHeaderCopy {
  return {
    brandHome: t.brandHome,
    mainNav: t.siteMainNav,
    signIn: t.signIn,
    bookCall: t.bookCall,
    menu: t.menu,
    openMenu: t.siteOpenMenu,
    closeMenu: t.closeMenu,
  };
}

/** Desktop nav and phone menu for the landing story, as links. The landing
 *  itself passes `onScene` to turn them into in-page moves. */
export function storyNavigation(
  t: LandingTranslator,
  {
    base = '/',
    onScene,
    onJourney,
    onChat,
  }: {
    base?: string;
    onScene?: (scene: StorySceneId, event: React.MouseEvent<HTMLAnchorElement>) => void;
    onJourney?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
    onChat?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  } = {},
): { nav: SiteNavItem[]; menu: SiteNavItem[] } {
  const scene = (id: StorySceneId, label: string, icon: React.ReactNode): SiteNavItem => ({
    id,
    label,
    href: `${base}#${id}`,
    icon,
    onSelect: onScene ? (event) => onScene(id, event) : undefined,
  });
  const icons = {
    try: <ShirtIcon size={16} />,
    store: <ShopifyMark monochrome decorative className="size-4" />,
    ops: <AgentMark size={22} />,
    product: <BlocksIcon size={16} />,
    results: <PhotoIcon size={16} />,
  };
  const journey: SiteNavItem = {
    id: 'journey',
    label: t.navHowItWorks,
    href: `${base}#journey`,
    wideOnly: true,
    onSelect: onJourney,
  };
  const pricing: SiteNavItem = { id: 'pricing', label: t.navPricing, href: '/pricing', icon: <TagIcon size={16} /> };
  return {
    nav: [
      scene('try', t.navTryOn, icons.try),
      scene('store', t.navLiveStore, icons.store),
      scene('ops', t.navAiOps, icons.ops),
      scene('product', t.navProduct, icons.product),
      scene('results', t.navResults, icons.results),
      journey,
      { ...pricing, wideOnly: true },
    ],
    menu: [
      scene('try', t.navTryOn, icons.try),
      scene('store', t.navLiveStore, icons.store),
      scene('ops', t.navAiOps, icons.ops),
      scene('product', t.menuTheProduct, icons.product),
      scene('results', t.navResults, icons.results),
      {
        id: 'chat',
        label: t.menuAskStore,
        href: `${base}#chat`,
        icon: <ChatIcon size={16} />,
        onSelect: onChat,
      },
      pricing,
    ],
  };
}

export function siteFooterCopy(t: LandingTranslator) {
  return {
    brandHome: t.brandHome,
    footerNav: t.footerNav,
    copyright: t.footerCopyright,
    copyrightShort: t.footerCopyrightShort,
  };
}

/** The footer link set for marketing pages other than the landing. */
export function marketingFooterLinks(t: LandingTranslator): SiteFooterLink[] {
  return [
    { id: 'home', label: t.footerHome, href: '/' },
    { id: 'try-on', label: t.footerDemo, href: '/try-on' },
    { id: 'pricing', label: t.footerPricing, href: '/pricing' },
    { id: 'roi', label: t.footerRoi, href: '/roi' },
    { id: 'security', label: t.footerSecurity, href: '/security' },
  ];
}

/** Header, background wiring, main landmark and footer for a marketing page. */
export function MarketingChrome({
  children,
  wiring = false,
  trace,
  header,
  background,
  mainLabel,
}: {
  children: React.ReactNode;
  /** The v15 background wiring (landing, pricing, try-on). Other pages keep their own background. */
  wiring?: boolean;
  /** Four short background trace lines, when the page has them. */
  trace?: string[];
  /** Overrides for pages with their own navigation (pricing). */
  header?: Partial<React.ComponentProps<typeof SiteHeader>>;
  /** A page-level background layer, such as the ambient background on the product pages. */
  background?: React.ReactNode;
  mainLabel?: string;
}) {
  const { locale, t, toggleLocale } = useLandingLocale();
  const { nav, menu } = storyNavigation(t);
  return (
    <>
      <SkipLink />
      <SiteHeader
        locale={locale}
        copy={siteHeaderCopy(t)}
        nav={nav}
        menuItems={menu}
        onSwitchLocale={toggleLocale}
        {...header}
      />
      {background}
      <div className="relative">
        {wiring ? <BackgroundWiring trace={trace} lane={false} /> : null}
        {/* The header floats over the page, so content starts below it. */}
        <main id="main" tabIndex={-1} aria-label={mainLabel} className="relative z-[1] pt-[82px] outline-none lg:pt-24">
          {children}
        </main>
      </div>
      <SiteFooter
        locale={locale}
        links={marketingFooterLinks(t)}
        onSwitchLocale={toggleLocale}
        copy={siteFooterCopy(t)}
      />
    </>
  );
}
