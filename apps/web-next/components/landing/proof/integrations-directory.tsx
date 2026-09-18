import React from 'react';
import { MessagesSquare } from 'lucide-react';
import { BRAND_MARKS } from '@/components/brand-marks';
import {
  findPublicIntegration,
  type PublicIntegration,
} from '@/lib/product-truth/public-integrations';
import { cn } from '@/lib/utils';

export type IntegrationDepth = 'native' | 'builtIn' | 'automation' | 'custom' | 'internal' | 'planned' | 'notYet';

export type IntegrationsDirectoryCopy = {
  groups: Record<'commerce' | 'channels' | 'automation' | 'data' | 'ai', string>;
  depth: Record<IntegrationDepth, string>;
  webChat: string;
  aiNote: string;
  disclaimer: string;
};

/* Depth is derived from the product-truth register so this directory can
   never claim more than the register does. Two setup-required tools differ in
   how they connect, so their depth is named per id. */
function depthFor(integration: PublicIntegration): IntegrationDepth {
  switch (integration.state) {
    case 'implemented':
      return 'native';
    case 'infrastructure':
      return 'internal';
    case 'setup-required':
      return integration.id === 'n8n' ? 'automation' : 'custom';
    case 'evidence-required':
      return 'notYet';
    default:
      return 'planned';
  }
}

const GROUPS: { key: keyof IntegrationsDirectoryCopy['groups']; ids: string[]; webChat?: boolean }[] = [
  { key: 'commerce', ids: ['shopify'] },
  { key: 'channels', ids: ['whatsapp', 'instagram', 'telegram'], webChat: true },
  { key: 'automation', ids: ['n8n', 'make', 'zapier'] },
  { key: 'data', ids: ['hubspot', 'notion', 'supabase'] },
  { key: 'ai', ids: ['openrouter'] },
];

const LIVE_DEPTHS: ReadonlySet<IntegrationDepth> = new Set(['native', 'builtIn', 'automation', 'custom', 'internal']);

function Row({ mark, name, depth, label }: { mark: React.ReactNode; name: string; depth: IntegrationDepth; label: string }) {
  const live = LIVE_DEPTHS.has(depth);
  return (
    <li className="flex min-w-0 items-center gap-3 py-2.5">
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background',
          live ? '' : 'opacity-60 grayscale',
        )}
        aria-hidden="true"
      >
        {mark}
      </span>
      <span className="min-w-0 flex-1">
        <span dir="ltr" className="block truncate text-sm font-semibold text-foreground">
          {name}
        </span>
        <span className={cn('block text-xs', live ? 'text-foreground/70' : 'text-muted-foreground')}>{label}</span>
      </span>
    </li>
  );
}

export function IntegrationsDirectory({ copy, className }: { copy: IntegrationsDirectoryCopy; className?: string }) {
  return (
    <div className={cn('grid min-w-0 gap-6', className)}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {GROUPS.map((group) => (
          <section
            key={group.key}
            aria-labelledby={`integrations-${group.key}`}
            className="min-w-0 rounded-2xl border border-border bg-card px-4 pb-2 pt-4"
          >
            <h3 id={`integrations-${group.key}`} className="text-xs font-semibold text-muted-foreground">
              {copy.groups[group.key]}
            </h3>
            <ul className="mt-1 divide-y divide-border">
              {group.webChat ? (
                <Row
                  name={copy.webChat}
                  depth="builtIn"
                  label={copy.depth.builtIn}
                  mark={<MessagesSquare className="size-[18px] text-foreground" />}
                />
              ) : null}
              {group.ids.map((id) => {
                const integration = findPublicIntegration(id);
                if (!integration) return null;
                const Mark = BRAND_MARKS[integration.name];
                if (!Mark) return null;
                const depth = depthFor(integration);
                return (
                  <Row
                    key={id}
                    name={integration.name}
                    depth={depth}
                    label={copy.depth[depth]}
                    mark={<Mark className="size-[18px]" />}
                  />
                );
              })}
            </ul>
            {group.key === 'ai' ? <p className="pb-2 pt-1 text-xs leading-5 text-muted-foreground">{copy.aiNote}</p> : null}
          </section>
        ))}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{copy.disclaimer}</p>
    </div>
  );
}
