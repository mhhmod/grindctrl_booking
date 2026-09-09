import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getAuthCopy } from '@/lib/auth/auth-i18n';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { AuthShell } from './auth-shell';

function renderShell(locale: SiteLocale, mode: 'signIn' | 'signUp' = 'signIn') {
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
    >
      <form aria-label="Account form"><button type="submit">Continue</button></form>
    </AuthShell>,
  );
}

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
    expect(formWrapper).toHaveClass('min-h-[420px]', 'min-w-0', 'max-w-full');
    expect(formWrapper).toHaveClass('[&_.cl-rootBox]:max-w-full', '[&_.cl-cardBox]:max-w-full', '[&_.cl-card]:max-w-full');
    expect(formWrapper?.parentElement).toHaveClass('w-full', 'min-w-0', 'max-w-md');
  });
});
