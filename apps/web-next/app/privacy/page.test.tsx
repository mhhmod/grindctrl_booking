import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getRequestLocale } from '@/lib/auth/locale';
import PrivacyPage from './page';

vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: vi.fn() }));
vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

describe('Privacy page', () => {
  it.each([
    ['en', 'ltr', 'Privacy policy', 'Terms of service', 'Last updated'],
    ['ar', 'rtl', 'سياسة الخصوصية', 'شروط الخدمة', 'آخر تحديث'],
  ] as const)('renders the published page and shared footer in %s', async (locale, dir, title, related, updated) => {
    vi.mocked(getRequestLocale).mockResolvedValue(locale);
    const { container } = render(await PrivacyPage());

    const root = container.querySelector('.gc-landing-root');
    expect(root).toHaveAttribute('dir', dir);
    expect(root).toHaveAttribute('lang', locale);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent(locale === 'en' ? '12 months' : '12 شهراً');
    expect(main.getByRole('link', { name: 'grindctrlnow@gmail.com' })).toHaveAttribute('href', 'mailto:grindctrlnow@gmail.com');
    expect(main.getByRole('link', { name: related })).toHaveAttribute('href', '/terms');
    const time = container.querySelector('time');
    expect(time).toHaveAttribute('dateTime', '2026-11-01');
    expect(time?.parentElement).toHaveTextContent(`${updated}: 2026-11-01`);
    expect(screen.getByRole('main').textContent).not.toMatch(/DRAFT|Open Questions|\u2014/);
    const footer = within(screen.getByRole('contentinfo'));
    expect(footer.getByRole('link', { name: title })).toHaveAttribute('href', '/privacy');
    expect(footer.getByRole('link', { name: related })).toHaveAttribute('href', '/terms');
  });

  it('switches the legal content and reading direction through the shared language control', async () => {
    vi.mocked(getRequestLocale).mockResolvedValue('en');
    const { container } = render(await PrivacyPage());
    const footer = within(screen.getByRole('contentinfo'));
    fireEvent.click(footer.getByRole('button', { name: 'التبديل إلى العربية' }));

    expect(container.querySelector('.gc-landing-root')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('heading', { level: 1, name: 'سياسة الخصوصية' })).toBeInTheDocument();
    expect(footer.getByRole('link', { name: 'شروط الخدمة' })).toHaveAttribute('href', '/terms');
  });
});
