'use client';

/* The floating header shared by every v15 marketing page.

   Desktop (lg and up): a fixed pill 18px from the top, centred, with the
   brand at the start, the page's own navigation in the middle, and the
   language switch, Sign in and Book a call at the end. A translucent pill
   glides under the hovered item and a small dot marks the current one.

   Phones: a 58px pill with the brand, Book a call and a menu button. The
   menu is a real modal dialog (Radix Dialog, the primitive under
   components/ui/sheet.tsx; the Sheet wrapper itself only slides panels in
   from an edge, which is not this design): focus moves to its first row and
   stays inside, Escape and the backdrop close it, focus returns to the
   button, the page behind does not scroll, and its rows are only in the DOM
   while it is open. Sign in is always its first row. */

import * as React from 'react';
import Link from 'next/link';
import { Dialog } from 'radix-ui';
import { trackClick } from '@/lib/analytics';
import { BOOKING_URL } from '@/lib/booking';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { cn } from '@/lib/utils';
import { CalendarIcon, ChevronIcon, ExtIcon, PersonIcon } from './icons';
import { LanguageSwitch } from './language-switch';
import { GrindctrlMark } from './marks';

export type SiteNavItem = {
  id: string;
  label: string;
  href: string;
  /** Shown in the phone menu's icon tile, and before the label on desktop when `navIcons` is set. */
  icon?: React.ReactNode;
  /** Opens in a new tab and shows an outward arrow. */
  external?: boolean;
  /** Leaves the desktop bar below 1180px wide, as the design does for the last two landing items. */
  wideOnly?: boolean;
  onSelect?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

export type SiteHeaderTag = {
  icon: React.ReactNode;
  label: string;
  /** Also shown in the phone header (the try-on page); pricing keeps it desktop only. */
  onPhone?: boolean;
};

export type SiteHeaderCopy = {
  brandHome: string;
  mainNav: string;
  signIn: string;
  bookCall: string;
  menu: string;
  openMenu: string;
  closeMenu: string;
};

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

function isRoute(href: string) {
  return href.startsWith('/') && !href.startsWith('//');
}

function NavLink({
  item,
  className,
  children,
  onClick,
  onPointerEnter,
  onFocus,
  itemRef,
  ariaCurrent,
}: {
  item: SiteNavItem;
  className?: string;
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  onPointerEnter?: () => void;
  onFocus?: () => void;
  itemRef?: (node: HTMLAnchorElement | null) => void;
  ariaCurrent?: 'location' | undefined;
}) {
  const handle = (event: React.MouseEvent<HTMLAnchorElement>) => {
    item.onSelect?.(event);
    onClick?.(event);
  };
  const shared = {
    ref: itemRef,
    className,
    onClick: handle,
    onPointerEnter,
    onFocus,
    'aria-current': ariaCurrent,
  };
  if (item.external) {
    return (
      <a {...shared} href={item.href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  if (isRoute(item.href) && !item.href.includes('#')) {
    return (
      <Link {...shared} href={item.href}>
        {children}
      </Link>
    );
  }
  return (
    <a {...shared} href={item.href}>
      {children}
    </a>
  );
}

function BookCallLink({
  label,
  section,
  withIcon,
  className,
}: {
  label: string;
  section: string;
  withIcon?: boolean;
  className?: string;
}) {
  return (
    <a
      href={BOOKING_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackClick('cta_clicked', { cta: 'book_call', section })}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-foreground font-bold text-background hover:shadow-[0_12px_24px_-12px_rgb(32_29_27/0.6)]',
        className,
      )}
    >
      {withIcon ? <CalendarIcon size={16} /> : null}
      {label}
    </a>
  );
}

function Brand({
  copy,
  onBrandClick,
  compact,
  tag,
}: {
  copy: SiteHeaderCopy;
  onBrandClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  compact?: boolean;
  tag?: SiteHeaderTag;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Link
        href="/"
        onClick={onBrandClick}
        aria-label={copy.brandHome}
        className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-full text-foreground"
      >
        <GrindctrlMark className={compact ? 'h-[22px] w-[34px]' : 'h-6 w-9'} />
        <span
          lang="en"
          className={cn(
            'font-extrabold tracking-[0.1em]',
            compact ? 'text-[13.5px] max-[359px]:hidden' : 'text-[15px]',
            /* The try-on page's Arabic label is long; below 420px the mark
               alone carries the brand so the label stays on one line. */
            compact && tag?.onPhone && 'max-[419px]:rtl:hidden',
          )}
        >
          GRINDCTRL
        </span>
      </Link>
      {tag && (!compact || tag.onPhone) ? (
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-gc-text-2">
          <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border max-[359px]:hidden" />
          {tag.icon}
          <span className={cn('truncate', compact && 'max-[359px]:sr-only')}>{tag.label}</span>
        </span>
      ) : null}
    </div>
  );
}

/** Desktop navigation with the gliding hover pill and the current-item dot. */
function DesktopNav({
  items,
  label,
  activeId,
  navIcons,
  locale,
}: {
  items: SiteNavItem[];
  label: string;
  activeId?: string | null;
  navIcons?: boolean;
  locale: SiteLocale;
}) {
  const navRef = React.useRef<HTMLElement>(null);
  const pillRef = React.useRef<HTMLSpanElement>(null);
  const dotRef = React.useRef<HTMLSpanElement>(null);
  const itemRefs = React.useRef(new Map<string, HTMLAnchorElement>());

  const place = React.useCallback((el: HTMLElement | undefined, target: HTMLSpanElement | null, kind: 'pill' | 'dot') => {
    if (!target) return;
    if (!el || el.offsetParent === null) {
      target.style.opacity = '0';
      return;
    }
    if (kind === 'pill') {
      target.style.width = `${el.offsetWidth}px`;
      target.style.transform = `translateX(${el.offsetLeft}px)`;
    } else {
      target.style.transform = `translateX(${el.offsetLeft + el.offsetWidth / 2 - 2}px)`;
    }
    target.style.opacity = '1';
  }, []);

  React.useLayoutEffect(() => {
    const update = () => place(activeId ? itemRefs.current.get(activeId) : undefined, dotRef.current, 'dot');
    update();
    window.addEventListener('resize', update);
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    fonts?.ready.then(update).catch(() => {});
    return () => window.removeEventListener('resize', update);
  }, [activeId, place, locale, items]);

  return (
    <nav
      ref={navRef}
      aria-label={label}
      onPointerLeave={() => {
        if (pillRef.current) pillRef.current.style.opacity = '0';
      }}
      className="relative hidden min-w-0 items-center text-sm font-medium lg:flex"
    >
      <span
        ref={pillRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 -mt-[19px] h-[38px] w-[60px] rounded-full bg-foreground/[0.07] opacity-0"
        style={{
          left: 0,
          transition: `transform 0.38s ${EASE}, width 0.38s ${EASE}, opacity 0.25s ease`,
        }}
      />
      <span
        ref={dotRef}
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[3px] size-1 rounded-full bg-foreground opacity-0"
        style={{ left: 0, transition: `transform 0.45s ${EASE}, opacity 0.3s ease` }}
      />
      {items.map((item) => (
        <NavLink
          key={item.id}
          item={item}
          itemRef={(node) => {
            if (node) itemRefs.current.set(item.id, node);
            else itemRefs.current.delete(item.id);
          }}
          ariaCurrent={activeId === item.id ? 'location' : undefined}
          onPointerEnter={() => place(itemRefs.current.get(item.id), pillRef.current, 'pill')}
          onFocus={() => place(itemRefs.current.get(item.id), pillRef.current, 'pill')}
          className={cn(
            'relative z-[1] inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-[9px] text-gc-text-2 hover:text-foreground',
            item.wideOnly && 'hidden min-[1180px]:inline-flex',
          )}
        >
          {navIcons && item.icon ? item.icon : null}
          {item.label}
          {item.external ? <ExtIcon size={13} /> : null}
        </NavLink>
      ))}
    </nav>
  );
}

function MenuButtonBars({ open }: { open: boolean }) {
  const bar = 'absolute inset-x-[13px] h-0.5 rounded-sm bg-foreground';
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(bar, 'top-[17px]')}
        style={{
          transition: `transform 0.3s ${EASE}`,
          transform: open ? 'translateY(4px) rotate(45deg)' : 'none',
        }}
      />
      <span
        aria-hidden="true"
        className={cn(bar, 'top-[25px]')}
        style={{
          transition: `transform 0.3s ${EASE}`,
          transform: open ? 'translateY(-4px) rotate(-45deg)' : 'none',
        }}
      />
    </>
  );
}

export function SiteHeader({
  locale,
  copy,
  nav,
  menuItems,
  navIcons = false,
  tag,
  activeId,
  onBrandClick,
  onSwitchLocale,
  bookSection = 'header',
  bookIcon = false,
  showSignIn = true,
  middle,
  desktopEnd,
  phoneEnd,
  phoneExtra,
  onMenuOpenChange,
  menuFooter,
}: {
  locale: SiteLocale;
  copy: SiteHeaderCopy;
  /** Desktop middle navigation. */
  nav: SiteNavItem[];
  /** Phone menu rows, after Sign in. */
  menuItems: SiteNavItem[];
  navIcons?: boolean;
  tag?: SiteHeaderTag;
  activeId?: string | null;
  onBrandClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  onSwitchLocale: () => void;
  bookSection?: string;
  bookIcon?: boolean;
  /** The try-on header has no Sign in; the sign-in guard is about the landing header. */
  showSignIn?: boolean;
  /** Replaces the desktop navigation (the try-on page's journey). */
  middle?: React.ReactNode;
  /** Replaces Sign in and Book a call at the desktop end (the try-on page's store link). */
  desktopEnd?: React.ReactNode;
  /** Replaces Book a call and the menu button on phones (the try-on page). */
  phoneEnd?: React.ReactNode;
  /** Rendered under the phone header, such as the landing story progress bar. */
  phoneExtra?: React.ReactNode;
  onMenuOpenChange?: (open: boolean) => void;
  /** Extra rows at the bottom of the phone menu, above the language switch. */
  menuFooter?: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const firstRowRef = React.useRef<HTMLAnchorElement>(null);

  const setOpen = React.useCallback(
    (next: boolean) => {
      setMenuOpen(next);
      onMenuOpenChange?.(next);
      if (typeof document !== 'undefined') {
        if (next) document.documentElement.dataset.menuOpen = 'true';
        else delete document.documentElement.dataset.menuOpen;
      }
    },
    [onMenuOpenChange],
  );

  React.useEffect(
    () => () => {
      if (typeof document !== 'undefined') delete document.documentElement.dataset.menuOpen;
    },
    [],
  );

  const signInItem: SiteNavItem = { id: 'sign-in', label: copy.signIn, href: '/sign-in', icon: <PersonIcon size={16} /> };
  const rows = showSignIn ? [signInItem, ...menuItems] : menuItems;

  return (
    /* One banner landmark holding both pills. The pills are fixed, so this
       element takes no space of its own. */
    <header data-site-header="">
      {/* Desktop */}
      <div
        className="fixed left-1/2 z-50 hidden h-[62px] w-[min(1240px,calc(100%-40px))] -translate-x-1/2 items-center justify-between gap-3 rounded-full border border-border bg-card/[0.86] pe-[9px] ps-5 text-foreground shadow-[var(--gc-shadow-header)] backdrop-blur-[12px] lg:flex"
        style={{ top: 'calc(18px + env(safe-area-inset-top, 0px))' }}
      >
        <Brand copy={copy} onBrandClick={onBrandClick} tag={tag} />
        {middle ?? (
          <DesktopNav items={nav} label={copy.mainNav} activeId={activeId} navIcons={navIcons} locale={locale} />
        )}
        <div className="flex shrink-0 items-center gap-2.5 text-sm font-medium">
          <LanguageSwitch locale={locale} onSwitch={onSwitchLocale} />
          {desktopEnd ?? (
            <>
              {showSignIn ? (
                <Link
                  href="/sign-in"
                  className="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-gc-text-2 hover:bg-foreground/[0.07] hover:text-foreground"
                >
                  {copy.signIn}
                </Link>
              ) : null}
              <BookCallLink label={copy.bookCall} section={bookSection} withIcon={bookIcon} className="h-11 px-5 text-sm" />
            </>
          )}
        </div>
      </div>

      {/* Phones */}
      <Dialog.Root open={menuOpen} onOpenChange={setOpen}>
        <div
          className="fixed inset-x-3 z-50 flex h-[58px] items-center justify-between gap-2 rounded-full border border-border bg-card/90 pe-1.5 ps-4 text-foreground shadow-[var(--gc-shadow-header-phone)] backdrop-blur-[12px] lg:hidden"
          style={{ top: 'calc(12px + env(safe-area-inset-top, 0px))' }}
        >
          <Brand copy={copy} onBrandClick={onBrandClick} compact tag={tag} />
          <div className="flex shrink-0 items-center gap-1.5">
            {phoneEnd ?? (
              <>
                <BookCallLink label={copy.bookCall} section={bookSection} className="h-11 px-4 text-[13.5px]" />
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    aria-label={menuOpen ? copy.closeMenu : copy.openMenu}
                    className="relative size-11 shrink-0 rounded-full border border-border bg-card"
                  >
                    <MenuButtonBars open={menuOpen} />
                  </button>
                </Dialog.Trigger>
              </>
            )}
          </div>
        </div>
        {phoneExtra}
        <Dialog.Portal>
          <Dialog.Overlay
            data-slot="site-menu-overlay"
            className="gc-anim-fade fixed inset-0 z-[48] bg-foreground/[0.22] lg:hidden"
          />
          <Dialog.Content
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              firstRowRef.current?.focus();
            }}
            className="gc-anim-menu fixed inset-x-3 z-[49] max-h-[calc(100svh-96px)] origin-[90%_0] overflow-y-auto rounded-3xl border border-border bg-card p-2 text-foreground shadow-[0_30px_60px_-30px_rgb(32_29_27/0.55)] lg:hidden"
            style={{ top: 'calc(80px + env(safe-area-inset-top, 0px))' }}
          >
            <Dialog.Title className="sr-only">{copy.menu}</Dialog.Title>
            <nav aria-label={copy.menu}>
              <ul className="flex flex-col">
                {rows.map((item, index) => (
                  <li key={item.id}>
                    <NavLink
                      item={item}
                      itemRef={index === 0 ? (node) => { firstRowRef.current = node; } : undefined}
                      onClick={() => setOpen(false)}
                      className="flex h-[50px] items-center gap-3 rounded-[14px] px-2.5 text-base font-semibold text-foreground hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.06]"
                    >
                      <span
                        aria-hidden="true"
                        className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-secondary"
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.external ? (
                        <ExtIcon size={15} strokeWidth={1.9} />
                      ) : (
                        <ChevronIcon size={16} strokeWidth={1.9} data-icon="inline-end" className="rtl:-scale-x-100" />
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            {menuFooter}
            <div className="mx-4 my-1.5 h-px bg-secondary" />
            <div className="flex items-center justify-between gap-2.5 px-2 pb-1 pt-1.5">
              <LanguageSwitch
                locale={locale}
                onSwitch={() => {
                  onSwitchLocale();
                }}
                className="h-[46px] border border-border px-3.5 text-[15px] text-foreground"
              />
              <BookCallLink label={copy.bookCall} section={bookSection} className="h-[46px] px-[22px] text-[14.5px]" />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}

