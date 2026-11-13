import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAuthCopy } from '@/lib/auth/auth-i18n';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { AuthShell } from './auth-shell';

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

function renderShell(locale: SiteLocale, mode: 'signIn' | 'signUp' = 'signIn', notice?: string) {
  const copy = getAuthCopy(locale);
  return render(
    <AuthShell
      locale={locale}
      copy={copy}
      title={copy[`${mode}Title`]}
      subtitle={copy[`${mode}Subtitle`]}
      footerPrompt={copy[`${mode}FooterPrompt`]}
      footerCtaLabel={copy[`${mode}FooterCta`]}
      footerCtaHref={mode === 'signIn' ? '/sign-up' : '/sign-in'}
      notice={notice}
    >
      <form aria-label="Account form"><button type="submit">Continue</button></form>
    </AuthShell>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
  document.cookie = 'gc-locale=; max-age=0; path=/';
  document.documentElement.lang = '';
  document.documentElement.dir = '';
});

describe('AuthShell', () => {
  it.each(['en', 'ar'] as const)('keeps localized %s auth content and navigation intact', (locale) => {
    renderShell(locale);
    const copy = getAuthCopy(locale);
    expect(screen.getByRole('main')).toHaveAttribute('lang', locale);
    expect(screen.getByRole('main')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect(screen.getByRole('heading', { name: copy.signInTitle })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.signInFooterCta })).toHaveAttribute('href', '/sign-up');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('preserves the sign-up route back to sign-in', () => {
    renderShell('en', 'signUp');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
  });

  it('uses shrinkable grid tracks and form containers instead of clipping overflowing content', () => {
    const { container } = renderShell('en');
    const main = screen.getByRole('main');
    expect(main).toHaveClass('grid-cols-1', 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]');
    expect(main).not.toHaveClass('overflow-x-hidden');
    expect(container.querySelector('.gc-auth-form-pane')).toHaveClass('min-w-0');

    const formWrapper = screen.getByRole('form', { name: 'Account form' }).parentElement;
    // The same reserve the placeholder and the slow/failed states use.
    expect(formWrapper).toHaveClass('min-h-[31rem]', 'min-w-0', 'max-w-full');
    expect(formWrapper).toHaveClass('[&_.cl-rootBox]:max-w-full', '[&_.cl-cardBox]:max-w-full', '[&_.cl-card]:max-w-full');
    expect(formWrapper?.parentElement).toHaveClass('w-full', 'min-w-0', 'max-w-md');
  });

  it('shows a status line above the form when given one', () => {
    renderShell('en', 'signIn', 'You’re signed out.');
    expect(screen.getByRole('status')).toHaveTextContent('You’re signed out.');
  });

  it.each(['en', 'ar'] as const)('offers the language switch and the theme toggle on the %s form', (locale) => {
    renderShell(locale);
    expect(screen.getByRole('button', { name: locale === 'en' ? 'التبديل إلى العربية' : 'Switch to English' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: locale === 'en' ? /^Switch to (dark|light) mode$/ : /^التبديل إلى الوضع (الداكن|الفاتح)$/ }),
    ).toHaveAttribute('aria-pressed');
  });

  it('switches the language in the shared cookie and re-renders in place', () => {
    renderShell('en');
    fireEvent.click(screen.getByRole('button', { name: 'التبديل إلى العربية' }));
    expect(document.cookie).toContain('gc-locale=ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
