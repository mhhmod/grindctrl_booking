'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { useTheme } from 'next-themes';
import { ActionIcon, Badge, Button, Drawer, Menu, Progress } from '@mantine/core';
import { BrandLogo } from '@/components/brand-logo';
import { GcIcon, type GcIconName } from '@/components/icons';
import { getShellCopy } from '@/lib/dashboard/shell-copy';
import type { ShellRole } from '@/lib/dashboard/shell-copy';
import type { LooksMeter, ShellStore } from '@/lib/dashboard/shell-model';
import { storeSwitchHref } from '@/lib/dashboard/shell-model';
import { getDashboardRouteMeta } from '@/lib/dashboard/route-meta';
import { persistSiteLocale } from '@/lib/landing/site-locale-store';
import type { DashboardPermissionKey, DashboardPermissionSet } from '@/lib/rbac/dashboard-policy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import classes from './v16-shell.module.css';

/* The v16 dashboard shell (04-dashboard.md), shown while the active store's
   v16_dashboard flag is on. The page bodies are still today's until each
   v16 page lands, and the nav lists only pages that exist: Inbox, Plan and
   Settings join as theirs do, and so do the search field and the bell. */

export type V16NavItem = {
  href: string;
  key: 'today' | 'inbox' | 'tryOn' | 'storeChat' | 'plan';
  icon: GcIconName;
  /** Who sees it (item 12): Plan joins for owners only, Settings for owners and admins. */
  permission: DashboardPermissionKey;
};

export const V16_NAV: readonly V16NavItem[] = [
  { href: '/dashboard', key: 'today', icon: 'home', permission: 'canViewToday' },
  // Everyone who sees Store Chat answers its shoppers (item 12).
  { href: '/dashboard/inbox', key: 'inbox', icon: 'inbox', permission: 'canViewStoreChat' },
  { href: '/dashboard/try-on', key: 'tryOn', icon: 'shirt', permission: 'canViewTryOn' },
  { href: '/dashboard/store-chat', key: 'storeChat', icon: 'chat', permission: 'canViewStoreChat' },
  { href: '/dashboard/plan', key: 'plan', icon: 'gauge', permission: 'canViewPlan' },
];

/** The nav items the person's role sees. */
export function v16NavFor(permissions: DashboardPermissionSet): V16NavItem[] {
  return V16_NAV.filter((item) => permissions[item.permission]);
}

/* The shoppers waiting for a person show on Inbox, where they are answered. */
const WAITING_HREF = '/dashboard/inbox';

/* Whether the page has hydrated, so the theme row can read next-themes
   without a mismatch (the same pattern as components/dashboard/theme-toggle.tsx). */
function subscribeMounted() {
  return () => {};
}
function getMountedSnapshot() {
  return true;
}
function getServerMountedSnapshot() {
  return false;
}

export function isV16NavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type V16ShellProps = {
  locale: SiteLocale;
  stores: ShellStore[];
  meter: LooksMeter | null;
  person: { name: string; role: ShellRole | null };
  today: { date: string; greeting: string };
  /** From the person's role on the active store (item 12). */
  permissions: DashboardPermissionSet;
  waitingCount: number;
  children: React.ReactNode;
};

function useWaitingCount(initial: number, pathname: string) {
  /* The layout renders once per full load and is reused across client
     navigation, so the count is refreshed on every route change, like the
     current shell's nav does. A failed refresh keeps the last count. */
  const [count, setCount] = React.useState(initial);
  const seq = React.useRef(0);
  React.useEffect(() => {
    const current = (seq.current += 1);
    fetch('/api/dashboard/store-chat-waiting')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count?: number } | null) => {
        if (current === seq.current && typeof data?.count === 'number') setCount(data.count);
      })
      .catch(() => {});
  }, [pathname]);
  return count;
}

function personInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?';
}

/* The live pathname, not one resolved by the server layout, which Next
   reuses across client navigation (see lib/dashboard/use-route-meta.ts). */
export function V16Shell(props: V16ShellProps) {
  return <V16ShellView pathname={usePathname() ?? '/dashboard'} {...props} />;
}

export function V16ShellView({
  pathname,
  locale,
  stores,
  meter,
  person,
  today,
  permissions,
  waitingCount,
  children,
}: V16ShellProps & { pathname: string }) {
  const copy = getShellCopy(locale);
  const router = useRouter();
  const clerk = useClerk();
  const { resolvedTheme, setTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [languagePending, startLanguage] = React.useTransition();
  const waiting = useWaitingCount(waitingCount, pathname);
  const { title } = getDashboardRouteMeta(pathname, locale);
  const mounted = React.useSyncExternalStore(subscribeMounted, getMountedSnapshot, getServerMountedSnapshot);

  const nav = v16NavFor(permissions);
  const current = stores.find((store) => store.current) ?? stores[0] ?? null;
  const isToday = pathname === '/dashboard';
  /* Before hydration, guess the provider's default (light), like the toggle. */
  const isDark = mounted ? resolvedTheme !== 'light' : false;

  function switchLanguage() {
    persistSiteLocale(locale === 'ar' ? 'en' : 'ar');
    startLanguage(() => router.refresh());
  }

  const navLabel = (item: V16NavItem) => copy.nav[item.key];
  const badge = (item: V16NavItem) =>
    item.href === WAITING_HREF && waiting > 0 ? (
      <Badge color="alert" radius="pill" size="sm" aria-label={copy.waiting(waiting)}>
        {waiting}
      </Badge>
    ) : null;

  const storeList = stores.map((store) => (
    <Menu.Item
      key={store.key}
      component="a"
      href={storeSwitchHref(pathname, store.choice)}
      leftSection={<span className={classes.storeAvatar} aria-hidden="true">{store.initials}</span>}
      rightSection={store.current ? <GcIcon name="check" size={16} /> : null}
      aria-current={store.current ? 'true' : undefined}
    >
      <span className={classes.storeText}>
        <span className={classes.storeName}>{store.label}</span>
        {store.domain && (
          <bdi dir="ltr" className={classes.storeDomain}>
            {store.domain}
          </bdi>
        )}
      </span>
    </Menu.Item>
  ));

  const storeSwitcher = current && (
    <Menu position="bottom-start" width="target" withinPortal>
      <Menu.Target>
        <button type="button" className={classes.storeButton} aria-label={copy.switchStore(current.label)}>
          <span className={classes.storeAvatar} aria-hidden="true">{current.initials}</span>
          <span className={classes.storeText}>
            <span className={classes.storeName}>{current.label}</span>
            {current.domain && (
              <bdi dir="ltr" className={classes.storeDomain}>
                {current.domain}
              </bdi>
            )}
          </span>
          <GcIcon name="sel" size={16} />
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{copy.yourStores}</Menu.Label>
        {storeList}
      </Menu.Dropdown>
    </Menu>
  );

  const personMenuItems = (
    <>
      <Menu.Item onClick={() => clerk.openUserProfile()}>{copy.account}</Menu.Item>
      <Menu.Item onClick={() => setTheme(isDark ? 'light' : 'dark')}>{isDark ? copy.toLight : copy.toDark}</Menu.Item>
      <Menu.Divider />
      <Menu.Item onClick={() => clerk.signOut({ redirectUrl: '/' })}>{copy.signOut}</Menu.Item>
    </>
  );

  const meterBody = meter && (
    <>
      <span className={classes.meterTitle}>{meter.title}</span>
      <span className={classes.meterValue}>{meter.value}</span>
      <Progress
        value={meter.percent}
        size={6}
        radius="pill"
        color={meter.low ? 'attention' : 'brand'}
        aria-label={`${meter.title}: ${meter.value}`}
      />
    </>
  );
  // The meter opens Plan for whoever may see it (the owner, item 12).
  const meterCard =
    meterBody &&
    (permissions.canViewPlan ? (
      <Link href="/dashboard/plan" className={classes.meter} data-testid="looks-meter">
        {meterBody}
      </Link>
    ) : (
      <div className={classes.meter} data-testid="looks-meter">
        {meterBody}
      </div>
    ));

  return (
    <div className={classes.shell} data-testid="v16-shell">
      <a href="#v16-main" className={classes.skip}>
        {copy.skipToContent}
      </a>

      <aside className={classes.sidebar}>
        <Link href="/dashboard" className={classes.wordmark} aria-label="GrindCTRL">
          <BrandLogo size="sm" />
        </Link>
        {storeSwitcher}
        <nav aria-label={copy.navLabel} className={classes.nav}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={classes.navLink}
              aria-current={isV16NavActive(pathname, item.href) ? 'page' : undefined}
            >
              <GcIcon name={item.icon} size={20} />
              <span className={classes.navLabel}>{navLabel(item)}</span>
              {badge(item)}
            </Link>
          ))}
        </nav>
        <div className={classes.spacer} />
        {meterCard}
        <Menu position="top-start" width="target" withinPortal>
          <Menu.Target>
            <button type="button" className={classes.person}>
              <span className={classes.personAvatar} aria-hidden="true">{personInitials(person.name)}</span>
              <span className={classes.storeText}>
                <span className={classes.personName}>{person.name}</span>
                {person.role && <span className={classes.personRole}>{copy.roles[person.role]}</span>}
              </span>
            </button>
          </Menu.Target>
          <Menu.Dropdown>{personMenuItems}</Menu.Dropdown>
        </Menu>
      </aside>

      <div className={classes.column}>
        <header className={classes.topbar}>
          <ActionIcon variant="subtle" color="gray" size={40} aria-label={copy.menu} onClick={() => setDrawerOpen(true)}>
            <GcIcon name="menu" size={20} />
          </ActionIcon>
          {current && (
            <Menu position="bottom-start" withinPortal>
              <Menu.Target>
                <button type="button" className={classes.topbarStore} aria-label={copy.switchStore(current.label)}>
                  <span className={classes.storeName}>{current.label}</span>
                  <GcIcon name="sel" size={16} />
                </button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{copy.yourStores}</Menu.Label>
                {storeList}
              </Menu.Dropdown>
            </Menu>
          )}
        </header>

        <main id="v16-main" tabIndex={-1} className={classes.main}>
          <div className={classes.content}>
          <div className={classes.header}>
            <div className={classes.headerText}>
              {isToday && <span className={classes.date}>{today.date}</span>}
              <h1 className={classes.title}>{isToday ? today.greeting : title}</h1>
            </div>
            <div className={classes.headerActions}>
              <Button
                variant="default"
                radius="pill"
                h={40}
                onClick={switchLanguage}
                disabled={languagePending}
                aria-label={copy.switchLanguage}
                lang={locale === 'ar' ? 'en' : 'ar'}
              >
                {copy.otherLanguage}
              </Button>
            </div>
          </div>
          <div className="min-w-0">{children}</div>
          </div>
        </main>
      </div>

      <nav aria-label={copy.phoneNavLabel} className={classes.tabbar}>
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={classes.tab}
            aria-current={isV16NavActive(pathname, item.href) ? 'page' : undefined}
          >
            <GcIcon name={item.icon} size={22} />
            <span>{item.key === 'storeChat' ? copy.nav.storeChatShort : navLabel(item)}</span>
            {item.href === WAITING_HREF && waiting > 0 && (
              <span className={classes.tabBadge}>
                <Badge color="alert" radius="pill" size="xs" aria-label={copy.waiting(waiting)}>
                  {waiting}
                </Badge>
              </span>
            )}
          </Link>
        ))}
      </nav>

      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        /* Mantine mirrors this under right to left, so it opens from the
           menu button's side in both languages. */
        position="left"
        size={300}
        title={copy.menu}
        closeButtonProps={{ 'aria-label': copy.closeMenu }}
      >
        <div className={classes.drawerSection}>
          {current && <span className={classes.drawerLabel}>{copy.yourStores}</span>}
          {stores.map((store) => (
            <a
              key={store.key}
              href={storeSwitchHref(pathname, store.choice)}
              className={classes.navLink}
              aria-current={store.current ? 'true' : undefined}
            >
              <span className={classes.storeAvatar} aria-hidden="true">{store.initials}</span>
              <span className={classes.navLabel}>{store.label}</span>
              {store.current && <GcIcon name="check" size={16} />}
            </a>
          ))}
          <span className={classes.drawerLabel}>{person.name}</span>
          <button type="button" className={classes.navLink} onClick={() => clerk.openUserProfile()}>
            {copy.account}
          </button>
          <button type="button" className={classes.navLink} onClick={() => setTheme(isDark ? 'light' : 'dark')}>
            {isDark ? copy.toLight : copy.toDark}
          </button>
          <button type="button" className={classes.navLink} onClick={switchLanguage} lang={locale === 'ar' ? 'en' : 'ar'}>
            {copy.otherLanguage}
          </button>
          <button type="button" className={classes.navLink} onClick={() => clerk.signOut({ redirectUrl: '/' })}>
            {copy.signOut}
          </button>
        </div>
      </Drawer>
    </div>
  );
}
