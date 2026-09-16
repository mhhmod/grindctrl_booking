'use client';

/* /conversations: Store Chat product page. Content and honesty boundaries
   come from phase4-evidence-conversations.json: exactly one live channel
   (storefront web chat), no structured intent classifier, no AI-drafts/
   human-approves reply mode. No demo link exists for this page; CTAs are
   Book a call, /pricing, and /integrations only. */

import React from 'react';
import { PlatformPillars } from '@/components/landing/platform-pillars';
import { useLandingLocale } from '@/components/landing/landing-locale';
import {
  CtaRow,
  MarketingPage,
  NotLiveList,
  ProductHero,
  ProductSection,
} from '@/components/marketing/page-primitives';
import type { NotLiveItem } from '@/components/marketing/page-primitives';
import { getConversationsCopy, type NotLiveStatusKind } from './conversations-copy';

function statusLabel(
  kind: NotLiveStatusKind,
  t: ReturnType<typeof getConversationsCopy>,
  landingT: ReturnType<typeof useLandingLocale>['t'],
): string {
  switch (kind) {
    case 'evidenceRequired':
      return landingT.integrationStateEvidenceRequired;
    case 'planned':
      return landingT.integrationStatePlanned;
    default:
      return t.notBuiltStatus;
  }
}

export function ConversationsPageContent() {
  const { locale, t: landingT } = useLandingLocale();
  const t = getConversationsCopy(locale);

  const notLiveItems: NotLiveItem[] = t.notLiveItems.map((item) => ({
    label: item.label,
    note: item.note,
    status: statusLabel(item.statusKind, t, landingT),
  }));

  const secondaryCta = [
    { href: '/pricing', label: t.ctaPricing, cta: 'pricing' },
    { href: '/integrations', label: t.ctaIntegrations, cta: 'integrations' },
  ];

  return (
    <MarketingPage>
      <ProductHero
        eyebrow={t.heroEyebrow}
        title={t.heroTitle}
        lead={t.heroLead}
        cta={{ bookCallLabel: t.bookCall, section: 'conversations_hero', secondary: secondaryCta }}
      />

      <ProductSection
        id="how-it-works"
        eyebrow={t.pillarsEyebrow}
        title={t.pillarsTitle}
        body={t.pillarsBody}
      >
        <PlatformPillars
          items={t.pillars.map((pillar) => ({ ...pillar, status: t.pillarStatus }))}
        />
      </ProductSection>

      <ProductSection
        id="not-live"
        eyebrow={t.notLiveEyebrow}
        title={t.notLiveTitle}
        body={t.notLiveBody}
      >
        <NotLiveList items={notLiveItems} />
      </ProductSection>

      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="gc-landing-card flex min-w-0 flex-col items-start gap-6 rounded-3xl border p-7 sm:p-12 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <h2 className="text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">
                {t.closingTitle}
              </h2>
              <p className="mt-3 text-base leading-7 text-muted-foreground sm:text-lg">
                {t.closingBody}
              </p>
            </div>
            <CtaRow
              bookCallLabel={t.bookCall}
              section="conversations_closing"
              secondary={secondaryCta}
              className="w-full shrink-0 sm:w-auto"
            />
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
