import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getRequestLocale } from '@/lib/auth/locale';
import TermsPage from './page';

vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: vi.fn() }));
vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

describe('Terms page', () => {
  it.each([
    ['en', 'ltr', 'Terms of service', 'Privacy policy', 'Last updated', 'laws of Egypt'],
    ['ar', 'rtl', 'شروط الخدمة', 'سياسة الخصوصية', 'آخر تحديث', 'لقوانين مصر'],
  ] as const)('renders the published page and shared footer in %s', async (locale, dir, title, related, updated, law) => {
    vi.mocked(getRequestLocale).mockResolvedValue(locale);
    const { container } = render(await TermsPage());

    expect(container.querySelector('.gc-landing-root')).toHaveAttribute('dir', dir);
    expect(container.querySelector('.gc-landing-root')).toHaveAttribute('lang', locale);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent(law);
    expect(main.getByRole('link', { name: 'grindctrlnow@gmail.com' })).toHaveAttribute('href', 'mailto:grindctrlnow@gmail.com');
    expect(main.getByRole('link', { name: related })).toHaveAttribute('href', '/privacy');
    const time = container.querySelector('time');
    expect(time).toHaveAttribute('dateTime', '2026-11-01');
    expect(time?.parentElement).toHaveTextContent(`${updated}: 2026-11-01`);
    expect(screen.getByRole('main').textContent).not.toMatch(/DRAFT|Open Questions|\u2014/);
    const footer = within(screen.getByRole('contentinfo'));
    expect(footer.getByRole('link', { name: title })).toHaveAttribute('href', '/terms');
    expect(footer.getByRole('link', { name: related })).toHaveAttribute('href', '/privacy');
  });
});
