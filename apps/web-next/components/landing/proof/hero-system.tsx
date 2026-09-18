'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { cn } from '@/lib/utils';
import type { ProofCopy, StopKey } from './proof-copy';

/* The hero's proof: one shopper moving through four real product screens.
   Every frame is a real capture (scripts/capture-visual-proof.mjs,
   scripts/crop-visual-proof.mjs) or a real try-on output
   (scripts/generate-tryon-proof.ts). The numbers mark a true sequence.

   One set of frames serves every width. Below xl they stack as a readable
   story with captions; at xl the same frames overlap in sequence order.
   The selector row lets a visitor jump straight to one signal -- the
   frame it names gets emphasis and its caption becomes visible at every
   width, not just sr-only at xl. Nothing here requires JavaScript to be
   understood: with it off, all four frames and captions already render,
   the selector just adds a shortcut. Each image is still requested once,
   selecting never triggers a new network request. */

const FRAME =
  'relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_rgb(0_0_0/0.05),0_18px_40px_-18px_rgb(30_20_10/0.3)]';

type Stop = {
  key: StopKey;
  place: string;
  badge: string;
  image: (locale: SiteLocale) => { src: string; width: number; height: number };
  sizes: string;
  imageClass: string;
  frameClass?: string;
  priority?: boolean;
  alt: (copy: ProofCopy) => string;
};

const STOPS: Stop[] = [
  {
    key: 'signal',
    place: 'xl:start-0 xl:top-[8%] xl:w-[36%]',
    badge: 'xl:start-3 xl:-top-3',
    image: () => ({ src: '/landing/proof/tryon/woman-linen-shirt.webp', width: 922, height: 1152 }),
    sizes: '(min-width: 1280px) 232px, (min-width: 640px) 45vw, 92vw',
    imageClass: 'aspect-square object-cover object-[50%_18%] xl:aspect-[4/5] xl:object-center',
    priority: true,
    alt: (copy) => copy.proofTabs.shopping.alt,
  },
  {
    key: 'context',
    place: 'xl:start-[28%] xl:top-[3%] xl:z-[1] xl:w-[52%]',
    badge: 'xl:end-3 xl:-top-3',
    image: (locale) => ({ src: `/landing/proof/hero-chat-${locale}.webp`, width: 760, height: 800 }),
    sizes: '(min-width: 1280px) 336px, (min-width: 640px) 45vw, 92vw',
    imageClass: '',
    priority: true,
    alt: (copy) => copy.proofTabs.conversations.alt,
  },
  {
    key: 'action',
    place: 'xl:end-0 xl:top-[60%] xl:z-[2] xl:w-[53%]',
    badge: 'xl:end-3 xl:-top-3',
    image: (locale) => ({ src: `/landing/proof/hero-inbox-${locale}.webp`, width: 672, height: 262 }),
    sizes: '(min-width: 1280px) 340px, (min-width: 640px) 45vw, 92vw',
    imageClass: '',
    alt: (copy) => copy.proofTabs.leads.alt,
  },
  {
    key: 'outcome',
    place: 'xl:bottom-[1%] xl:start-[3%] xl:z-[3] xl:w-[78%]',
    badge: 'xl:start-3 xl:-top-3',
    /* Three tiles are only readable at full width, so narrow screens crop the
       same image to its first two tiles instead of loading a second file. */
    image: (locale) => ({ src: `/landing/proof/hero-report-${locale}.webp`, width: 1160, height: 226 }),
    sizes: '(min-width: 1280px) 500px, (min-width: 640px) 68vw, 138vw',
    frameClass: 'aspect-[770/226] xl:aspect-auto',
    imageClass: 'h-full w-[150.65%] max-w-none object-cover object-left rtl:object-right xl:w-full',
    alt: (copy) => copy.proofTabs.reporting.alt,
  },
];

function StopBadge({ index, label, className }: { index: number; label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-background/95 py-1 pe-3 ps-1 text-xs font-semibold text-foreground shadow-sm',
        className,
      )}
    >
      <span className="grid size-5 place-items-center rounded-full bg-foreground text-[11px] font-bold text-background tabular-nums">
        {index}
      </span>
      {label}
    </span>
  );
}

export function HeroSystem({ locale, copy }: { locale: SiteLocale; copy: ProofCopy }) {
  const [active, setActive] = useState<StopKey>('signal');

  return (
    <figure aria-label={copy.heroVisualLabel} className="min-w-0">
      <div
        role="group"
        aria-label={copy.heroSelectorLabel}
        className="mb-4 flex min-w-0 gap-2 overflow-x-auto pb-1 xl:mb-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {STOPS.map((stop, i) => {
          const isActive = stop.key === active;
          return (
            <button
              key={stop.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActive(stop.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'grid size-4 place-items-center rounded-full text-[10px] font-bold tabular-nums',
                  isActive ? 'bg-background text-foreground' : 'bg-foreground/10 text-foreground/70',
                )}
              >
                {i + 1}
              </span>
              {copy.stops[stop.key].label}
            </button>
          );
        })}
      </div>

      <p className="mb-4 hidden min-w-0 text-sm text-muted-foreground xl:mb-5 xl:block" aria-live="polite">
        {copy.stops[active].caption}
      </p>

      <ol className="grid min-w-0 gap-6 sm:grid-cols-2 xl:relative xl:mx-auto xl:block xl:aspect-square xl:w-full xl:max-w-[640px]">
        {STOPS.map((stop, i) => {
          const image = stop.image(locale);
          const { label, caption } = copy.stops[stop.key];
          const isActive = stop.key === active;
          return (
            <li key={stop.key} className={cn('relative grid min-w-0 content-start gap-2.5 xl:absolute xl:block', stop.place)}>
              <div className="flex min-w-0 flex-col gap-1 xl:contents">
                <StopBadge index={i + 1} label={label} className={cn('xl:absolute xl:z-10', stop.badge)} />
                <p className="text-sm text-muted-foreground xl:sr-only">{caption}</p>
              </div>
              <div
                className={cn(
                  FRAME,
                  stop.frameClass,
                  'transition-[opacity,box-shadow,border-color] duration-300 ease-out motion-reduce:transition-none',
                  isActive
                    ? 'border-foreground/50 opacity-100 shadow-[0_2px_6px_rgb(0_0_0/0.08),0_30px_60px_-20px_rgb(30_20_10/0.5)]'
                    : 'xl:opacity-70',
                )}
              >
                <Image
                  src={image.src}
                  alt={stop.alt(copy)}
                  width={image.width}
                  height={image.height}
                  sizes={stop.sizes}
                  priority={stop.priority}
                  className={cn('block w-full', stop.imageClass)}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <figcaption className="mt-5 flex flex-wrap items-center gap-2 text-xs leading-5 text-muted-foreground xl:mt-3">
        <span className="rounded-full border border-border bg-background px-2 py-0.5 font-semibold text-foreground/80">
          {copy.demoDataBadge}
        </span>
        <span className="min-w-0">{copy.demoNote}</span>
      </figcaption>
    </figure>
  );
}
