'use client';

import React from 'react';
import { useLandingLocale } from '@/components/landing/landing-locale';
import { MarketingPage, ProductHero, ProductSection, CtaRow } from '@/components/marketing/page-primitives';
import { getShoppingCopy, type ShoppingFact } from './shopping-copy';

/* Plain fact list for the privacy section — deliberately not NotLiveList:
   these are things that ARE true today, not a "not live yet" status badge. */
function FactList({ facts }: { facts: ShoppingFact[] }) {
  return (
    <ul className="min-w-0 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {facts.map((fact) => (
        <li key={fact.title} className="p-5 sm:p-6">
          <p className="text-sm font-semibold text-foreground">{fact.title}</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{fact.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function ShoppingPageContent() {
  const { locale } = useLandingLocale();
  const t = getShoppingCopy(locale);

  return (
    <MarketingPage>
      <ProductHero
        eyebrow={t.eyebrow}
        title={t.title}
        lead={t.lead}
        cta={{
          bookCallLabel: t.ctaBookCall,
          section: 'shopping_hero',
          secondary: [{ href: '/try-on', label: t.ctaTryDemo, cta: 'try_on' }],
        }}
      />

      <ProductSection id="privacy" eyebrow={t.privacyEyebrow} title={t.privacyTitle} body={t.privacyBody}>
        <FactList facts={t.privacyFacts} />
      </ProductSection>

      <ProductSection id="reliability" eyebrow={t.reliabilityEyebrow} title={t.reliabilityTitle} body={t.reliabilityBody} />

      <ProductSection id="catalog" eyebrow={t.catalogEyebrow} title={t.catalogTitle} body={t.catalogBody} />

      <ProductSection id="bilingual" eyebrow={t.bilingualEyebrow} title={t.bilingualTitle} body={t.bilingualBody} />

      <ProductSection id="cart" eyebrow={t.cartEyebrow} title={t.cartTitle} body={t.cartBody} />

      <ProductSection id="plans" eyebrow={t.plansEyebrow} title={t.plansTitle} body={t.plansBody}>
        <CtaRow
          bookCallLabel={t.ctaBookCall}
          section="shopping_plans"
          secondary={[{ href: '/pricing', label: t.ctaViewPricing, cta: 'pricing' }]}
        />
      </ProductSection>

      <ProductSection id="closing" eyebrow={t.closingEyebrow} title={t.closingTitle} body={t.closingBody} className="border-b-0">
        <CtaRow
          bookCallLabel={t.ctaBookCall}
          section="shopping_closing"
          secondary={[
            { href: '/try-on', label: t.ctaTryDemo, cta: 'try_on' },
            { href: '/pricing', label: t.ctaViewPricing, cta: 'pricing' },
          ]}
        />
      </ProductSection>
    </MarketingPage>
  );
}
