'use client';

import React from 'react';
import { notFound } from 'next/navigation';
import { MantineUiProvider } from '@/components/mantine/provider';
import { StorefrontDomains } from '@/components/dashboard/v16/store-chat/storefront-domains';
import { getChatStudioCopy } from '@/lib/dashboard/chat-studio-copy';
import type { DomainActions } from '@/lib/messenger/dashboard-actions-contract';
import type { DomainView } from '@/lib/messenger/domains';

/* Dev-only mirror of the storefront domain panel with mock actions, so its
   states can be checked in a browser without the Clerk wall, like
   app/dev/store-chat-check. Hidden outright in production. */

const PENDING: DomainView = {
  id: 'd1',
  domain: 'shop.dar-layla-boutique-example.com',
  status: 'failed',
  txtName: '_grindctrl-verification.shop.dar-layla-boutique-example.com',
  txtValue: 'grindctrl-verification=Qm3vX9pL2sKd8TfR1wYb4nZc',
  verifiedAt: null,
  lastCheckedAt: '2026-10-30T15:00:00.000Z',
};
const VERIFIED: DomainView = { ...PENDING, id: 'd2', domain: 'dar-layla.com', status: 'verified', verifiedAt: '2026-10-30T15:00:00.000Z' };

function mock(domains: DomainView[]): DomainActions {
  return {
    listDomainsAction: async () => ({ ok: true, domains }),
    addDomainAction: async (_siteId, domain) =>
      domain.includes('taken') ? { ok: false, error: 'taken' } : { ok: true, domain: { ...PENDING, id: domain, domain, status: 'pending' } },
    checkDomainAction: async (_siteId, id) => ({ ok: true, domain: { ...PENDING, id, status: 'verified' } }),
    removeDomainAction: async () => ({ ok: true }),
  };
}

export default function StoreDomainsCheckPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const [locale, setLocale] = React.useState<'en' | 'ar'>('en');
  const copy = getChatStudioCopy(locale).domains;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <MantineUiProvider dir={dir}>
      <main dir={dir} lang={locale} style={{ maxWidth: 720, margin: '0 auto', padding: 16, display: 'grid', gap: 24 }}>
        <button type="button" onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}>
          {locale === 'en' ? 'العربية' : 'English'}
        </button>
        <section style={{ border: '1px solid var(--border)', borderRadius: 16, padding: '0 22px' }}>
          <StorefrontDomains key={`a-${locale}`} siteId="s" copy={copy} actions={mock([])} />
        </section>
        <section style={{ border: '1px solid var(--border)', borderRadius: 16, padding: '0 22px' }}>
          <StorefrontDomains key={`b-${locale}`} siteId="s" copy={copy} actions={mock([VERIFIED, PENDING])} />
        </section>
      </main>
    </MantineUiProvider>
  );
}
