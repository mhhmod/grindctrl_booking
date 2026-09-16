'use client';

import React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlatformPillars } from '@/components/landing/platform-pillars';
import { useLandingLocale } from '@/components/landing/landing-locale';
import {
  CtaRow,
  MarketingPage,
  NotLiveList,
  ProductHero,
  ProductSection,
} from '@/components/marketing/page-primitives';
import { getOperationsCopy } from './operations-copy';

export function OperationsPageContent() {
  const { locale, t: landingT } = useLandingLocale();
  const t = getOperationsCopy(locale);

  return (
    <MarketingPage>
      <ProductHero
        eyebrow={t.heroEyebrow}
        title={t.heroTitle}
        lead={t.heroLead}
        cta={{
          bookCallLabel: t.bookCall,
          section: 'operations_hero',
          secondary: [
            { href: '/conversations', label: t.seeConversations, cta: 'conversations' },
            { href: '/integrations', label: t.seeIntegrations, cta: 'integrations' },
          ],
        }}
      />

      <ProductSection id="order-support" eyebrow={t.orderEyebrow} title={t.orderTitle} body={t.orderBody}>
        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {t.orderPoints.map((point) => (
              <li key={point} className="flex min-w-0 items-start gap-3 p-5 sm:p-6">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-sm leading-6 text-foreground/90">{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <Link
          href="/conversations"
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t.orderLink}
        </Link>
      </ProductSection>

      <ProductSection id="team-workflow" eyebrow={t.teamEyebrow} title={t.teamTitle} body={t.teamBody}>
        <PlatformPillars
          items={t.teamItems.map((item) => ({
            title: item.title,
            body: item.body,
            status: landingT.integrationStateImplemented,
          }))}
        />
      </ProductSection>

      <ProductSection
        id="visibility"
        eyebrow={t.visibilityEyebrow}
        title={t.visibilityTitle}
        body={t.visibilityBody}
      >
        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          <Card className="min-w-0 border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t.visibilityConversationTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{t.visibilityConversationBody}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t.visibilityTryOnTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{t.visibilityTryOnBody}</p>
            </CardContent>
          </Card>
        </div>
      </ProductSection>

      <ProductSection
        id="managed-implementation"
        eyebrow={t.implementationEyebrow}
        title={t.implementationTitle}
        body={t.implementationBody}
      >
        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          <Card className="min-w-0 border-border">
            <CardHeader>
              <CardTitle className="text-base">{t.merchantProvidesTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {t.merchantProvidesItems.map((item) => (
                  <li key={item} className="flex min-w-0 items-start gap-2.5 text-sm text-foreground/90">
                    <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border">
            <CardHeader>
              <CardTitle className="text-base">{t.grindctrlHandlesTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {t.grindctrlHandlesItems.map((item) => (
                  <li key={item} className="flex min-w-0 items-start gap-2.5 text-sm text-foreground/90">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <p role="note" className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t.intakeNote}
        </p>
      </ProductSection>

      <ProductSection id="not-live" eyebrow={t.notLiveEyebrow} title={t.notLiveTitle}>
        <NotLiveList
          items={[
            t.notLiveCrm,
            t.notLiveWorkflow,
            t.notLiveAttribution,
            t.notLiveChannels,
          ]}
        />
      </ProductSection>

      <section className="border-b border-border bg-muted/10">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="min-w-0 max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.closingTitle}</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">{t.closingBody}</p>
          </div>
          <CtaRow
            bookCallLabel={t.bookCall}
            section="operations_closing"
            secondary={[
              { href: '/integrations', label: t.seeIntegrations, cta: 'integrations' },
              { href: '/pricing', label: t.viewPricing, cta: 'pricing' },
            ]}
            className="mt-8"
          />
        </div>
      </section>
    </MarketingPage>
  );
}
