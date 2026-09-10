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

import DashboardAgentsPage from '@/app/dashboard/agents/page';

describe('DashboardAgentsPage', () => {
  it('renders AI agents catalog and selected detail', async () => {
    const result = await DashboardAgentsPage({ searchParams: Promise.resolve({ agent: 'voice-lead-agent' }) });
    render(result);

    expect(screen.getByText(/ai agents hub/i)).toBeInTheDocument();
    expect(screen.getByText('Website Support Agent')).toBeInTheDocument();
    expect(screen.getAllByText('Voice Lead Agent').length).toBeGreaterThan(0);
    expect(screen.getByText(/selected agent preview/i)).toBeInTheDocument();
    expect(screen.getByText(/prospect leaves 30-second voice note requesting a proposal\./i)).toBeInTheDocument();
  });
});
