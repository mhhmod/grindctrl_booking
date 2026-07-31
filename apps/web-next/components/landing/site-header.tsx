'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import { LandingLocaleToggle } from '@/components/landing/landing-locale';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { BOOKING_URL } from '@/lib/booking';
import type { LandingTranslator, SiteLocale } from '@/lib/landing/landing-i18n';

const navLinks = [
  { href: '#how', key: 'navHow' },
  { href: '#demo', key: 'navDemo' },
  { href: '#benefits', key: 'navBenefits' },
  { href: '#pricing', key: 'navPricing' },
] as const;

export function SiteHeader({ locale, t }: { locale: SiteLocale; t: LandingTranslator }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" aria-label={t.brandHome} className="min-w-0 rounded-lg">
          <BrandLogo />
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {t[link.key]}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Shown from `lg` up, exactly where the menu button hides. Sign-in
              otherwise lives only in the sheet, which would leave desktop with
              no route to it at all. */}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden min-h-11 rounded-full px-3 text-sm font-semibold text-muted-foreground hover:text-foreground lg:inline-flex"
          >
            <Link href="/sign-in">{t.signIn}</Link>
          </Button>

          <Button
            asChild
            size="sm"
            className="min-h-11 rounded-full px-4 font-semibold transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
          >
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">{t.bookCall}</a>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t.menu}
                className="min-h-11 rounded-full px-3 lg:hidden"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            {/* The sheet side is physical, so it has to follow the locale:
                `right` in Arabic would open on the start edge. */}
            <SheetContent
              side={locale === 'ar' ? 'left' : 'right'}
              aria-describedby={undefined}
              className="gap-0 p-6"
            >
              <SheetTitle className="mb-4">{t.menu}</SheetTitle>

              <nav className="flex flex-col">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center text-base text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t[link.key]}
                  </a>
                ))}
                <Link
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center text-base font-semibold transition-colors hover:text-foreground"
                >
                  {t.signIn}
                </Link>
              </nav>

              <Separator className="my-4" />

              {/* Both toggles are h-9 (36px) by default, which is under the
                  44px touch floor. They were incidental controls in a desktop
                  bar before; here they are primary menu items. */}
              <div className="flex items-center gap-2">
                <LandingLocaleToggle className="min-h-11" />
                <ThemeToggle className="min-h-11" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
