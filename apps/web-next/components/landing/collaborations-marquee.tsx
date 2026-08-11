'use client';

import React from 'react';
import { BRAND_MARKS } from '@/components/brand-marks';
import { InfiniteSlider } from '@/components/ui/infinite-slider';

/* The collaborations strip, same twelve brand marks as before, now animated
   by the motion-primitives InfiniteSlider (framer-motion) instead of a
   hand-rolled CSS keyframe track. Two rows travelling opposite ways read as
   motion without anything moving fast enough to be hard to look at. */

const ROW_ONE = ['Shopify', 'WhatsApp', 'Instagram', 'Telegram', 'Zapier', 'Make'] as const;
const ROW_TWO = ['n8n', 'Gemini', 'Claude', 'Notion', 'HubSpot', 'Supabase'] as const;

function Chip({ name }: { name: string }) {
  const Mark = BRAND_MARKS[name];

  return (
    <span className="inline-flex shrink-0 items-center gap-2.5 rounded-full border border-border bg-card/70 px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm backdrop-blur">
      {Mark ? <Mark className="size-[18px] shrink-0" /> : null}
      {/* Brand names are proper nouns: never translated, never letter-spaced,
          and kept LTR so Latin marks read correctly inside an RTL page. */}
      <span dir="ltr">{name}</span>
    </span>
  );
}

function Row({ names, reverse }: { names: readonly string[]; reverse?: boolean }) {
  return (
    /* dir="ltr" is load-bearing, not cosmetic. InfiniteSlider's track is a
       flex row with flexDirection set inline, which still follows the
       ambient text direction — under RTL that lays the track out from the
       right and the translateX() math runs the duplicated half off the left
       edge (the overflow sweep caught this on the old CSS marquee too).
       Pinning the conveyor to LTR makes the geometry identical in both
       languages. The names inside are Latin brands either way. */
    <div dir="ltr">
      <InfiniteSlider gap={10} duration={38} durationOnHover={120} reverse={reverse}>
        {names.map((name) => (
          <Chip key={name} name={name} />
        ))}
      </InfiniteSlider>
    </div>
  );
}

export function CollaborationsMarquee() {
  return (
    <div className="relative flex flex-col gap-3">
      <Row names={ROW_ONE} />
      <Row names={ROW_TWO} reverse />

      {/* Edges fade into the section background so chips enter and leave
          instead of being cut off. pointer-events-none keeps them inert. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-0 w-12 bg-gradient-to-r from-background to-transparent sm:w-20"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 end-0 w-12 bg-gradient-to-l from-background to-transparent sm:w-20"
      />
    </div>
  );
}
