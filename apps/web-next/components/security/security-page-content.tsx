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
} from '@/components/marketing/page-primitives';
import { getSecurityCopy, SECURITY_CONTACT_EMAIL } from './security-copy';

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="min-w-0 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {items.map((item) => (
        <li key={item} className="flex min-w-0 items-start gap-3 p-5 sm:p-6">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="text-sm leading-6 text-foreground/90">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function SecurityPageContent() {
  const { locale } = useLandingLocale();
  const t = getSecurityCopy(locale);

  return (
    <MarketingPage>
      <ProductHero
        eyebrow={t.heroEyebrow}
        title={t.heroTitle}
        lead={t.heroLead}
        cta={{ bookCallLabel: t.bookCall, section: 'security_hero' }}
      />

      <ProductSection id="access" eyebrow={t.accessEyebrow} title={t.accessTitle} body={t.accessBody}>
        <CheckList items={t.accessItems} />
      </ProductSection>

      <ProductSection id="photos" eyebrow={t.photosEyebrow} title={t.photosTitle} body={t.photosBody}>
        <CheckList items={t.photosItems} />
      </ProductSection>

      <ProductSection id="privacy-requests" eyebrow={t.privacyEyebrow} title={t.privacyTitle} body={t.privacyBody}>
        <CheckList items={t.privacyItems} />
        <p role="note" className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t.privacyNote}
        </p>
      </ProductSection>

      <ProductSection id="analytics" eyebrow={t.analyticsEyebrow} title={t.analyticsTitle}>
        <CheckList items={t.analyticsItems} />
      </ProductSection>

      <ProductSection id="safeguards" eyebrow={t.safeguardsEyebrow} title={t.safeguardsTitle}>
        <CheckList items={t.safeguardsItems} />
      </ProductSection>

      <ProductSection
        id="processors"
        eyebrow={t.processorsEyebrow}
        title={t.processorsTitle}
        body={t.processorsBody}
      >
        <NotLiveList items={t.processorsItems} />
      </ProductSection>

      <ProductSection id="not-live" eyebrow={t.notLiveEyebrow} title={t.notLiveTitle}>
        <NotLiveList items={t.notLiveItems} />
      </ProductSection>

      <ProductSection
        id="reporting"
        eyebrow={t.reportingEyebrow}
        title={t.reportingTitle}
        body={t.reportingBody}
        className="border-b-0"
      >
        <a
          href={`mailto:${SECURITY_CONTACT_EMAIL}`}
          className="mb-4 inline-flex min-h-11 flex-wrap items-center gap-x-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t.reportingEmailLabel} <bdi dir="ltr">{SECURITY_CONTACT_EMAIL}</bdi>
        </a>
        <CtaRow bookCallLabel={t.bookCall} section="security_reporting" />
      </ProductSection>
    </MarketingPage>
  );
}
