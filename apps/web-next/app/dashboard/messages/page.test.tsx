import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/* The page resolves the operator's language from the locale cookie, and
   cookies() has no request scope when the component is rendered directly. */
const cookieLocale: string | undefined = 'en';
/* getRequestLocale falls back to Accept-Language when no cookie is set, so the
   mock has to supply headers as well as cookies. */
const acceptLanguage: string | undefined = 'en';
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'gc-locale' && cookieLocale ? { name, value: cookieLocale } : undefined,
  }),
  headers: async () => ({
    get: (name: string) =>
      name.toLowerCase() === 'accept-language' ? (acceptLanguage ?? null) : null,
  }),
}));

import DashboardMessagesPage from '@/app/dashboard/messages/page';

describe('DashboardMessagesPage', () => {
  it('renders messages preview route with selected conversation', async () => {
    const result = await DashboardMessagesPage({ searchParams: Promise.resolve({ conversation: 'conv_web_001' }) });
    render(result);

    expect(screen.getByText(/^messages$/i)).toBeInTheDocument();
    expect(screen.getByText(/selected conversation preview/i)).toBeInTheDocument();
    expect(screen.getAllByText(/can you setup support automation/i).length).toBeGreaterThan(0);
  });
});
