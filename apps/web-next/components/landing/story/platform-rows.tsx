/* The platform row of the "Works inside your stack" scene: Shopify's live
   chip and the other platforms with their status beside the name. Solid
   means live, dashed means not live yet, the same cue the n8n and HubSpot
   rows use. A mark never stands alone: the status is always written next to
   it, and never carried by colour (register rule integration.public-logo-strip).

   Status comes from the product-truth register, so this scene cannot show a
   platform as further along than lib/product-truth/public-integrations.ts
   says. Marks are monochrome like every other mark in the story; Zid has no
   official mark and is shown by name only. */

import * as React from 'react';
import { SallaMark, WooCommerceMark } from '@/components/brand-marks';
import { GlobeIcon } from '@/components/site/icons';
import { findPublicIntegration, type PublicIntegrationState } from '@/lib/product-truth/public-integrations';
import type { StoryT } from './story-types';

type StatusLabel = 'Live' | 'In testing' | 'Planned';

const STATUS_LABEL: Partial<Record<PublicIntegrationState, StatusLabel>> = {
  implemented: 'Live',
  'in-testing': 'In testing',
  planned: 'Planned',
};

const MARK_SIZE = { width: '16px', height: '16px', flexShrink: 0 } as const;

const PLATFORMS = [
  { id: 'woocommerce', label: 'WooCommerce', mark: <WooCommerceMark monochrome decorative style={MARK_SIZE} /> },
  { id: 'custom-website', label: 'Your website', mark: <GlobeIcon size={16} style={{ flexShrink: 0 }} /> },
  { id: 'salla', label: 'Salla', mark: <SallaMark monochrome decorative style={MARK_SIZE} /> },
  { id: 'zid', label: 'Zid', mark: null },
] as const;

/** A status pill in the story's own chip shape, on a light surface. */
export function StatusChip({ label, live, t }: { label: StatusLabel; live: boolean; t: StoryT }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '22px',
        padding: '0 9px',
        borderRadius: '11px',
        fontSize: '11px',
        fontWeight: '700',
        whiteSpace: 'nowrap',
        color: 'var(--foreground)',
        border: live
          ? '1px solid color-mix(in srgb, var(--foreground) 28%, transparent)'
          : '1px dashed color-mix(in srgb, var(--foreground) 25%, transparent)',
        background: `color-mix(in srgb, var(--card) ${live ? 55 : 50}%, transparent)`,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          boxSizing: 'border-box',
          borderRadius: '50%',
          ...(live
            ? { background: 'var(--foreground)', animation: 'gcs-live 2.4s ease-in-out infinite' }
            : { border: '1.5px solid var(--foreground)' }),
        }}
      />
      {t(label)}
    </span>
  );
}

export function PlatformRows({ t }: { t: StoryT }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {PLATFORMS.map(({ id, label, mark }) => {
        const status = STATUS_LABEL[findPublicIntegration(id)?.state ?? 'evidence-required'];
        if (!status) return null;
        const live = status === 'Live';
        return (
          <div
            key={id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              height: '34px',
              boxSizing: 'border-box',
              padding: '0 11px',
              borderRadius: '12px',
              border: live ? '1px solid var(--border)' : '1px dashed var(--gc-line-strong)',
              background: 'color-mix(in srgb, var(--card) 70%, transparent)',
              color: 'var(--foreground)',
            }}
          >
            <span aria-hidden="true" style={{ width: '16px', height: '16px', flexShrink: 0, display: 'inline-flex' }}>
              {mark}
            </span>
            <span style={{ flex: '1', minWidth: '0', fontSize: '13px', fontWeight: '700' }}>{t(label)}</span>
            <StatusChip label={status} live={live} t={t} />
          </div>
        );
      })}
    </div>
  );
}
