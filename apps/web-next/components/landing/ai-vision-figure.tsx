'use client';

import React, { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { cn } from '@/lib/utils';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

/* What this replaces: a stock photo of a man in a T-shirt, captioned "example
   result" — no AI, no scan, no try-on visible in the frame, just a product
   shot. This draws the thing itself: a viewfinder locks onto a figure, and
   the figure renders in.

   First version drew the head as a separate circle sitting above a separate
   torso shape, with a floating spark icon and faint grid lines. Screenshotted
   at rest it read as three unrelated pieces rather than one coherent figure —
   "the combination of shapes is weird, not unified". This version is a
   SINGLE closed path (head flows into shoulders flows into torso, no seam),
   with the garment suggested by contour lines drawn on that one shape rather
   than a second shape overlapping it, and nothing floating separately from
   the figure. One shape, one accent, one frame.

   pathLength="1" on every stroked path keeps the draw-in animation
   unit-agnostic regardless of viewBox geometry. GSAP plays the sequence once
   on scroll-in; under prefers-reduced-motion it skips straight to the
   finished state. Entrance motion is y-only, never x — an x-axis offset
   reads as "from the left" in LTR and silently reverses under RTL, the exact
   bug the collaborations marquee needed a dir="ltr" patch for. */

type Size = 'compact' | 'card';

export function AiVisionFigure({
  caption,
  alt,
  previewLabel,
  size = 'card',
  className,
}: {
  caption?: string;
  alt: string;
  previewLabel?: string;
  size?: Size;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const beamClipRef = useRef<SVGRectElement>(null);
  const bracketsRef = useRef<SVGGElement>(null);
  const figureRef = useRef<SVGPathElement>(null);
  const contourRef = useRef<SVGGElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const accentRef = useRef<SVGCircleElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // End state up front, so a reduced-motion visitor sees the finished
      // render immediately rather than a stuck wireframe.
      gsap.set(bracketsRef.current?.querySelectorAll('path') ?? [], { strokeDashoffset: 0 });
      gsap.set(figureRef.current, { fillOpacity: 1 });
      gsap.set(contourRef.current, { opacity: 1 });
      gsap.set(glowRef.current, { opacity: 0.45 });
      gsap.set(accentRef.current, { opacity: 1, scale: 1, transformOrigin: '50% 50%' });
      gsap.set(beamClipRef.current, { yPercent: -140 });

      if (reduced) return;

      gsap.set(bracketsRef.current?.querySelectorAll('path') ?? [], { strokeDashoffset: 1 });
      gsap.set(figureRef.current, { fillOpacity: 0 });
      gsap.set(contourRef.current, { opacity: 0 });
      gsap.set(glowRef.current, { opacity: 0 });
      gsap.set(accentRef.current, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: rootRef.current, start: 'top 78%', once: true },
        defaults: { ease: 'power2.out' },
      });

      tl.to(bracketsRef.current?.querySelectorAll('path') ?? [], {
        strokeDashoffset: 0,
        duration: 0.55,
        stagger: 0.07,
      })
        .fromTo(
          beamClipRef.current,
          { yPercent: -140 },
          { yPercent: 260, duration: 1, ease: 'power1.inOut' },
          '<0.1',
        )
        .to(figureRef.current, { fillOpacity: 1, duration: 0.65 }, '<0.3')
        .to(glowRef.current, { opacity: 0.45, duration: 0.7 }, '<')
        .to(contourRef.current, { opacity: 1, duration: 0.4 }, '-=0.2')
        .to(accentRef.current, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(3)' }, '-=0.15');
    },
    { scope: rootRef },
  );

  const compact = size === 'compact';

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative isolate mx-auto w-full overflow-hidden rounded-3xl border border-border bg-[linear-gradient(160deg,var(--muted)/0.5,var(--background))]',
        compact ? 'aspect-[4/5] max-w-sm' : 'aspect-[4/5]',
        className,
      )}
      role="img"
      aria-label={alt}
    >
      {previewLabel ? (
        <span className="absolute end-3 top-3 z-10 rounded-full bg-foreground/90 px-3 py-1 text-xs font-semibold text-background sm:end-5 sm:top-5">
          {previewLabel}
        </span>
      ) : null}

      <svg viewBox="0 0 320 400" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <clipPath id="gc-vision-figure-clip">
            <path d="M160 68c34 0 56 24 56 61 0 22-8 38-21 49 36 10 65 41 71 87v112H74V265c6-46 35-77 71-87-13-11-21-27-21-49 0-37 22-61 56-61Z" />
          </clipPath>
          <linearGradient id="gc-vision-figure-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.85" />
            <stop offset="45%" stopColor="var(--primary)" stopOpacity="0.62" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="gc-vision-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="45%" stopColor="white" stopOpacity="0.8" />
            <stop offset="55%" stopColor="white" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Soft depth glow, seated behind the figure. */}
        <circle ref={glowRef} cx="160" cy="230" r="132" fill="var(--primary)" opacity="0" style={{ filter: 'blur(56px)' }} />

        {/* Ghosted outline: always visible at rest, gives the scan something
            to land on. One continuous path — head, shoulders and torso share
            a single outline, so it never reads as separate shapes. */}
        <path
          d="M160 68c34 0 56 24 56 61 0 22-8 38-21 49 36 10 65 41 71 87v112H74V265c6-46 35-77 71-87-13-11-21-27-21-49 0-37 22-61 56-61Z"
          fill="none"
          stroke="var(--foreground)"
          strokeOpacity="0.22"
          strokeWidth="2"
        />

        {/* The same path, filled — this is the "render" the scan produces.
            No second overlapping shape; only fillOpacity changes. */}
        <path
          ref={figureRef}
          d="M160 68c34 0 56 24 56 61 0 22-8 38-21 49 36 10 65 41 71 87v112H74V265c6-46 35-77 71-87-13-11-21-27-21-49 0-37 22-61 56-61Z"
          fill="url(#gc-vision-figure-fill)"
          fillOpacity="0"
        />

        {/* Garment contour: a crew neckline and a hem line traced on the
            figure, not a separate shape competing with it. */}
        <g ref={contourRef} fill="none" stroke="var(--background)" strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round">
          <path d="M118 190c14 12 30 18 42 18s28-6 42-18" />
          <path d="M87 372h146" strokeOpacity="0.35" />
        </g>

        {/* Scan beam, clipped to the figure so it lights the person rather
            than sweeping the whole card. */}
        <g clipPath="url(#gc-vision-figure-clip)">
          <rect ref={beamClipRef} x="0" y="-80" width="320" height="110" fill="url(#gc-vision-beam)" />
        </g>

        {/* Single accent: a small mark at the neckline, where the render
            "locks in" — not a spark floating in a corner unrelated to
            anything else on the card. */}
        <circle ref={accentRef} cx="160" cy="196" r="5" fill="var(--primary)" opacity="0" />
        <circle cx="160" cy="196" r="9" fill="none" stroke="var(--primary)" strokeOpacity="0.4" strokeWidth="1.5" />

        {/* Viewfinder brackets, tight around the figure rather than the
            whole card — reads as "locked onto this", not decoration. */}
        <g ref={bracketsRef} stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" fill="none">
          <path pathLength="1" strokeDasharray="1" d="M44 78V58a6 6 0 0 1 6-6h20" />
          <path pathLength="1" strokeDasharray="1" d="M250 52h20a6 6 0 0 1 6 6v20" />
          <path pathLength="1" strokeDasharray="1" d="M276 342v20a6 6 0 0 1-6 6h-20" />
          <path pathLength="1" strokeDasharray="1" d="M70 368H50a6 6 0 0 1-6-6v-20" />
        </g>
      </svg>

      {caption ? (
        <p className="absolute inset-x-4 bottom-4 z-10 rounded-full bg-foreground/85 px-3 py-2 text-center text-xs font-semibold text-background">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
