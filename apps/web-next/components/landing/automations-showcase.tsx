'use client';

import React, { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { Icon } from '@/components/icons';
import { ScreenshotFrame } from '@/components/landing/screenshot-frame';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

/* Real dashboard captures, not illustration or stock photography — the
   qualification framing in the copy above this component is honest because
   of that: these four screens and the stat row are pulled from an actual
   GrindCTRL account, not invented for the page. Values and image paths live
   here rather than in the translated dictionary because a number and a file
   path aren't translatable content; only the labels and captions are. */

const STATS = [
  { value: 12842, label: 'automationsStatMessages' as const },
  { value: 342, label: 'automationsStatLeads' as const },
  { value: 28, label: 'automationsStatAutomations' as const },
  { value: 1.42, decimals: 2, suffix: 's', label: 'automationsStatResponse' as const },
];

const CARDS = [
  { src: '/landing/proof-whatsapp.jpg', urlLabel: 'grindctrl.app/inbox/whatsapp' },
  { src: '/landing/proof-operations.jpg', urlLabel: 'grindctrl.app/operations' },
  { src: '/landing/proof-leads.jpg', urlLabel: 'grindctrl.app/leads' },
  { src: '/landing/proof-inbox.png', urlLabel: 'grindctrl.app/inbox' },
];

function formatStat(value: number, decimals?: number): string {
  if (decimals) return value.toFixed(decimals);
  return Math.round(value).toLocaleString('en-US');
}

export function AutomationsShowcase({
  qualifiers,
  statLabels,
  cards,
}: {
  qualifiers: string[];
  statLabels: Record<(typeof STATS)[number]['label'], string>;
  cards: { label: string; caption: string }[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const statRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  useGSAP(
    () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      statRefs.current.forEach((el, i) => {
        if (el) el.textContent = formatStat(STATS[i].value, STATS[i].decimals) + (STATS[i].suffix ?? '');
      });
      gsap.set(cardRefs.current, { opacity: 1, y: 0, scale: 1 });

      if (reduced) return;

      gsap.set(cardRefs.current, { opacity: 0, y: 28, scale: 0.97 });

      // Counters animate together once the stat row is in view.
      ScrollTrigger.create({
        trigger: rootRef.current,
        start: 'top 75%',
        once: true,
        onEnter: () => {
          STATS.forEach((stat, i) => {
            const el = statRefs.current[i];
            if (!el) return;
            const counter = { val: 0 };
            gsap.to(counter, {
              val: stat.value,
              duration: 1.4,
              ease: 'power2.out',
              onUpdate: () => {
                el.textContent = formatStat(counter.val, stat.decimals) + (stat.suffix ?? '');
              },
            });
          });
        },
      });

      // Cards enter with a stagger, y-only (never x — see AiVisionFigure for
      // why), then drift at slightly different scroll-linked depths so they
      // read as independent panes rather than one flat grid.
      gsap.to(cardRefs.current, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 70%',
          once: true,
        },
      });

      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        gsap.to(card, {
          yPercent: i % 2 === 0 ? -4 : 4,
          ease: 'none',
          scrollTrigger: {
            trigger: card,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.6,
          },
        });
      });
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="flex flex-col gap-10">
      <ul className="flex flex-wrap gap-x-6 gap-y-2.5">
        {qualifiers.map((qualifier) => (
          <li key={qualifier} className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="text-primary" aria-hidden="true">
              <Icon icon={CheckmarkCircle02Icon} size={17} />
            </span>
            {qualifier}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-border py-8 sm:grid-cols-4">
        {STATS.map((stat, i) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <span
              ref={(el) => {
                statRefs.current[i] = el;
              }}
              dir="ltr"
              className="text-[28px] font-bold tracking-tight text-foreground sm:text-4xl"
            >
              {formatStat(stat.value, stat.decimals)}
              {stat.suffix ?? ''}
            </span>
            <span className="text-[13px] leading-snug text-muted-foreground">{statLabels[stat.label]}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {CARDS.map((card, i) => (
          <div
            key={card.src}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="flex flex-col gap-3"
          >
            <ScreenshotFrame src={card.src} alt={cards[i]?.label ?? ''} urlLabel={card.urlLabel} />
            <div className="px-1">
              <h3 className="text-sm font-semibold text-foreground">{cards[i]?.label}</h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{cards[i]?.caption}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
