'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useLandingLocale } from '@/components/landing/landing-locale';
import {
  CtaRow,
  MarketingPage,
  NotLiveList,
  ProductHero,
  ProductSection,
  type NotLiveItem,
} from '@/components/marketing/page-primitives';
import { findPublicIntegration, type PublicIntegrationState } from '@/lib/product-truth/public-integrations';
import type { LandingTranslator } from '@/lib/landing/landing-i18n';
import { getIntegrationsCopy, type IntegrationCopyRow } from './integrations-copy';

/* State badge text always comes from the register (single source of truth),
   never hardcoded per row here — see lib/product-truth/public-integrations.ts. */
function integrationRows(rows: IntegrationCopyRow[], landingT: LandingTranslator): NotLiveItem[] {
  const stateLabel: Record<PublicIntegrationState, string> = {
    implemented: landingT.integrationStateImplemented,
    'setup-required': landingT.integrationStateSetupRequired,
    'evidence-required': landingT.integrationStateEvidenceRequired,
    planned: landingT.integrationStatePlanned,
    infrastructure: landingT.integrationStateInfrastructure,
  };
  return rows.map(({ id, description }) => {
    const integration = findPublicIntegration(id);
    if (!integration) throw new Error(`integrations-copy.ts references unknown register id: ${id}`);
    return { label: integration.name, note: description, status: stateLabel[integration.state] };
  });
}

export function IntegrationsPageContent() {
  const { locale, t: landingT } = useLandingLocale();
  const t = getIntegrationsCopy(locale);

  return (
    <MarketingPage>
      <ProductHero
        eyebrow={t.heroEyebrow}
        title={t.heroTitle}
        lead={t.heroLead}
        cta={{
          bookCallLabel: t.bookCall,
          section: 'integrations_hero',
          secondary: [
            { href: '/operations', label: t.seeOperations, cta: 'operations' },
            { href: '/pricing', label: t.viewPricing, cta: 'pricing' },
          ],
        }}
      />

      <ProductSection id="storefront" eyebrow={t.storefrontEyebrow} title={t.storefrontTitle} body={t.storefrontBody}>
        <NotLiveList items={integrationRows(t.storefrontItems, landingT)} />
      </ProductSection>

      <ProductSection id="channels" eyebrow={t.channelsEyebrow} title={t.channelsTitle} body={t.channelsBody}>
        <NotLiveList items={integrationRows(t.channelsItems, landingT)} />
      </ProductSection>

      <ProductSection id="crm" eyebrow={t.crmEyebrow} title={t.crmTitle} body={t.crmBody}>
        <NotLiveList items={integrationRows(t.crmItems, landingT)} />
      </ProductSection>

      <ProductSection id="automation" eyebrow={t.automationEyebrow} title={t.automationTitle} body={t.automationBody}>
        <NotLiveList items={integrationRows(t.automationItems, landingT)} />
      </ProductSection>

      <ProductSection id="ai-infrastructure" eyebrow={t.aiEyebrow} title={t.aiTitle} body={t.aiBody}>
        <NotLiveList items={integrationRows(t.aiItems, landingT)} />
      </ProductSection>

      <ProductSection id="not-claims" eyebrow={t.notClaimsEyebrow} title={t.notClaimsTitle} body={t.notClaimsBody}>
        <ul className="min-w-0 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {t.notClaimsPoints.map((point) => (
            <li key={point} className="flex min-w-0 items-start gap-3 p-5 sm:p-6">
              <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm leading-6 text-foreground/90">{point}</span>
            </li>
          ))}
        </ul>
      </ProductSection>

      <ProductSection id="closing" eyebrow={t.closingEyebrow} title={t.closingTitle} body={t.closingBody} className="border-b-0">
        <CtaRow
          bookCallLabel={t.bookCall}
          section="integrations_closing"
          secondary={[
            { href: '/operations', label: t.seeOperations, cta: 'operations' },
            { href: '/pricing', label: t.viewPricing, cta: 'pricing' },
          ]}
        />
      </ProductSection>
    </MarketingPage>
  );
}
