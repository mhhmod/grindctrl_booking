'use client';

import React from 'react';
import Link from 'next/link';
import { useLandingLocale } from '@/components/landing/landing-locale';
import { MarketingPage, ProductHero, ProductSection } from '@/components/marketing/page-primitives';
import { LEGAL_CONTACT_EMAIL, LEGAL_UPDATED, legalCopy, type LegalPage } from './legal-copy';

export function LegalPageContent({ page }: { page: LegalPage }) {
  const { locale } = useLandingLocale();
  const copy = legalCopy[page][locale];

  return (
    <MarketingPage>
      <ProductHero eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} cta={false} />
      {copy.sections.map((section, index) => (
        <ProductSection
          key={section.id}
          id={section.id}
          eyebrow={`${copy.sectionLabel} ${index + 1}`}
          title={section.title}
        >
          <div className="min-w-0 max-w-3xl space-y-5 text-base leading-8 text-foreground/90 [overflow-wrap:anywhere]">
            {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.items ? (
              <ul className="list-disc space-y-3 ps-6">
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}
            {section.id === 'contact' ? (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
                  <bdi dir="ltr">{LEGAL_CONTACT_EMAIL}</bdi>
                </a>
                <Link href={page === 'privacy' ? '/terms' : '/privacy'} className="inline-flex min-h-11 items-center underline underline-offset-4">
                  {copy.relatedLabel}
                </Link>
                <Link href="/security" className="inline-flex min-h-11 items-center underline underline-offset-4">
                  {copy.securityLabel}
                </Link>
              </div>
            ) : null}
          </div>
        </ProductSection>
      ))}
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">
          {copy.updatedLabel}: <time dateTime={LEGAL_UPDATED} dir="ltr">{LEGAL_UPDATED}</time>
        </p>
      </div>
    </MarketingPage>
  );
}
