import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  CollaborationsMarquee,
  type IntegrationStateLabels,
} from '@/components/landing/collaborations-marquee';
import type { PlatformEvidenceItem } from '@/lib/landing/landing-i18n';

export function PlatformEvidenceSequence({
  label,
  items,
  integrationLabels,
}: {
  label: string;
  items: PlatformEvidenceItem[];
  integrationLabels: IntegrationStateLabels;
}) {
  return (
    <ol aria-label={label} className="grid min-w-0 gap-4 lg:grid-cols-2">
      {items.map((item, index) => {
        const showsIntegrations = item.kind === 'integrations';

        return (
          <li
            key={item.id}
            className={`gc-landing-card gc-spotlight gc-card-hover min-w-0 overflow-hidden rounded-3xl border bg-background p-5 sm:p-7 ${
              showsIntegrations ? 'lg:col-span-2' : ''
            }`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                dir="ltr"
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-muted text-xs font-bold text-muted-foreground"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold tracking-tight sm:text-xl">{item.title}</h3>
                  <Badge variant="outline" className="h-auto whitespace-normal rounded-full px-2.5 py-1 text-start text-[11px]">
                    {item.status}
                  </Badge>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-[1.7] text-muted-foreground sm:text-[15px]">
                  {item.body}
                </p>
              </div>
            </div>

            {showsIntegrations ? (
              <div className="mt-6 min-w-0 overflow-hidden rounded-2xl border border-border bg-background py-4">
                <CollaborationsMarquee labels={integrationLabels} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
