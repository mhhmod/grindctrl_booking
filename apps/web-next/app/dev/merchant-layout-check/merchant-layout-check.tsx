'use client';

import { useEffect } from 'react';
import { Button } from '@mantine/core';
import { MantineUiProvider } from '@/components/mantine/provider';
import { getShellCopy } from '@/lib/dashboard/shell-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import shell from '@/components/dashboard/v16/v16-shell.module.css';
import { SurfaceBody, surfaceTitle } from './surfaces';
import type { Surface } from './surface-list';
import { StoreSwitcher } from '@/components/dashboard/v16/store-switcher';
import { buildShellStores } from '@/lib/dashboard/shell-model';

const STORES = buildShellStores([], [
  { id: 'paste', name: 'My store', domain: null, storeDomain: 'harmong-eg.myshopify.com' },
  { id: 'web', name: 'Maison Noor Modest Fashion and Abayas Boutique', domain: 'maison-noor-modest-fashion-and-abayas-boutique.example.com' },
], { shopDomain: null, siteId: 'paste' });

export function MerchantLayoutCheck({ locale, surface }: { locale: SiteLocale; surface: Surface }) {
  const copy = getShellCopy(locale);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
  }, [dir, locale]);
  const title = surfaceTitle(surface, copy.nav);
  // Claim and onboarding are pages of their own, outside the shell.
  if (!title) {
    return (
      <MantineUiProvider dir={dir}>
        <main dir={dir} lang={locale} data-merchant-layout-fixture={surface}>
          <SurfaceBody surface={surface} locale={locale} />
        </main>
      </MantineUiProvider>
    );
  }
  return (
    <MantineUiProvider dir={dir}>
      <div className={shell.shell} dir={dir} lang={locale} data-merchant-layout-fixture={surface}>
        <aside className={shell.sidebar}>
          <span className={shell.wordmark}>GrindCTRL</span>
          <StoreSwitcher stores={STORES} locale={locale} pathname="/dashboard/plan" />
          <nav className={shell.nav} aria-label={copy.navLabel}>
            {[copy.nav.today, copy.nav.inbox, copy.nav.tryOn, copy.nav.storeChat, copy.nav.yourStore, copy.nav.plan, copy.nav.settings].map((label) => (
              <span key={label} className={shell.navLink} aria-current={label === title ? 'page' : undefined}>{label}</span>
            ))}
          </nav>
        </aside>
        <div className={shell.column}>
          <header className={shell.topbar}><StoreSwitcher stores={STORES} locale={locale} pathname="/dashboard/plan" compact /></header>
          <main className={shell.main}>
            <div className={shell.content}>
              <div className={shell.header}>
                <h1 className={shell.title}>{title}</h1>
                <Button variant="default" radius="pill">{locale === 'ar' ? 'English' : 'العربية'}</Button>
              </div>
              <div className={shell.page}>
                <SurfaceBody surface={surface} locale={locale} />
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
