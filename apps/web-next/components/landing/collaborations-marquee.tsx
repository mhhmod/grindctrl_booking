'use client';

import React from 'react';
import { BRAND_MARKS } from '@/components/brand-marks';
import {
  PUBLIC_INTEGRATIONS,
  type PublicIntegration,
  type PublicIntegrationState,
} from '@/lib/product-truth/public-integrations';

export type IntegrationStateLabels = Record<PublicIntegrationState, string>;

function Chip({ integration, labels }: { integration: PublicIntegration; labels: IntegrationStateLabels }) {
  const Mark = BRAND_MARKS[integration.name];

  return (
    <li className="inline-flex min-h-12 min-w-0 items-center gap-2.5 rounded-full border border-border bg-card/70 px-4 py-2 text-foreground shadow-sm backdrop-blur">
      {Mark ? <Mark className="size-[18px] shrink-0" /> : null}
      {/* Brand names are proper nouns: never translated, never letter-spaced,
          and kept LTR so Latin marks read correctly inside an RTL page. */}
      <span className="flex flex-col leading-tight">
        <span dir="ltr" className="text-sm font-semibold">{integration.name}</span>
        <span dir="auto" className="mt-0.5 text-xs font-medium text-muted-foreground">
          {labels[integration.state]}
        </span>
      </span>
    </li>
  );
}

export function CollaborationsMarquee({ labels }: { labels: IntegrationStateLabels }) {
  return (
    <ul className="flex min-w-0 flex-wrap gap-2.5 px-3 sm:px-4">
      {PUBLIC_INTEGRATIONS.map((integration) => (
        <Chip key={integration.id} integration={integration} labels={labels} />
      ))}
    </ul>
  );
}
