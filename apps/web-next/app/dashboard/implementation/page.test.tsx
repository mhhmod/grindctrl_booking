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

import DashboardImplementationPage from '@/app/dashboard/implementation/page';

describe('DashboardImplementationPage', () => {
  it('renders implementation request form shell', async () => {
    render(await DashboardImplementationPage());

    expect(screen.getByText(/^implementation request$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prepare implementation request/i })).toBeInTheDocument();
  });
});
