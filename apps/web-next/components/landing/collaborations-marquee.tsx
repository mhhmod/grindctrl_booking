'use client';

import React from 'react';
import { BRAND_MARKS } from '@/components/brand-marks';

/* The collaborations strip.

   Built from the brand marks this repo already ships rather than the
   react-bits GridMotion the owner suggested. That component reads
   window.innerWidth at render scope with no 'use client', so it 500s a
   server-rendered page; it drives motion from mousemove only, so it is inert
   on touch; and it pulls 6.4MB of gsap to move a row of logos.

   This is CSS only. It runs on a phone, costs no dependency, and takes its
   colours from the theme instead of a hardcoded purple.

   Two rows travelling opposite ways read as motion without anything moving
   fast enough to be hard to look at. Each row's content is duplicated so the
   translation can loop seamlessly — the copy is aria-hidden so a screen reader
   hears each partner once. */

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
    /* dir="ltr" is load-bearing, not cosmetic. Under RTL the flex track lays
       out from the right, so the duplicated half runs off the LEFT edge — the
       overflow sweep caught chips at x=-45 through -398 on the Arabic landing
       page. Pinning the conveyor to LTR makes the geometry identical in both
       languages. The names inside are Latin brands either way. */
    <div className="gc-marquee-viewport" dir="ltr">
      <div className={`gc-marquee-track ${reverse ? 'gc-marquee-track--reverse' : ''}`}>
        {names.map((name) => (
          <Chip key={name} name={name} />
        ))}
        {/* Seamless loop needs a second copy; hidden from assistive tech so the
            list is not read twice. */}
        <span className="contents" aria-hidden="true">
          {names.map((name) => (
            <Chip key={`dup-${name}`} name={name} />
          ))}
        </span>
      </div>
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
