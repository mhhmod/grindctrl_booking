import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { AssistantLocaleProvider, useAssistantLocale } from './locale-provider';
import { persistSiteLocale } from '@/lib/landing/site-locale-store';

function Consumer() {
  const { locale, t } = useAssistantLocale();
  return <button data-testid="consumer">{locale}: {t.launcherOpen}</button>;
}

afterEach(() => { document.cookie = 'gc-locale=;path=/;max-age=0'; });

describe('AssistantLocaleProvider shared locale', () => {
  it('preserves the server initial locale even when the browser cookie differs', () => {
    document.cookie = 'gc-locale=en;path=/';
    const html = renderToString(<AssistantLocaleProvider initialLocale="ar"><Consumer /></AssistantLocaleProvider>);
    expect(html).toContain('lang="ar"');
    expect(html).toContain('dir="rtl"');
    expect(html).not.toContain('Open assistant');
  });

  it('updates mounted consumers from the shared cookie change notification', () => {
    document.cookie = 'gc-locale=en;path=/';
    render(<AssistantLocaleProvider initialLocale="en"><Consumer /></AssistantLocaleProvider>);
    expect(screen.getByTestId('consumer')).toHaveTextContent('en: Open assistant');
    act(() => persistSiteLocale('ar'));
    expect(screen.getByTestId('consumer')).toHaveTextContent(/^ar:/);
    expect(screen.getByTestId('consumer').closest('[dir]')).toHaveAttribute('dir', 'rtl');
    act(() => persistSiteLocale('en'));
    expect(screen.getByTestId('consumer')).toHaveTextContent('en: Open assistant');
  });
});
