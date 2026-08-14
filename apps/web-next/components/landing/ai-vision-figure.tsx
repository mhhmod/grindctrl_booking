'use client';

import React, { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { cn } from '@/lib/utils';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

/* What this replaces: a stock photo of a man in a T-shirt — no AI, no scan,
   no try-on visible in the frame. Two SVG versions came before this one:

   v1 drew the head as a separate circle floating above a separate torso
   shape, with a floating spark icon — read as disconnected pieces, not one
   figure.

   v2 fixed that (one continuous path, no seam) but added a viewfinder frame,
   a scan beam, garment contour lines, and an accent dot — eight animated
   pieces in total. Feedback on it: "more symmetric, more elegant, cheaper,
   humanized, not geometric, simple."

   This version is ONE path — a plain bust silhouette, not scanning-drone
   chrome — with every coordinate computed as a mirror pair around x=160, so
   symmetry is guaranteed by the numbers rather than eyeballed. Three moving
   parts: the silhouette fills in, a soft glow breathes behind it, one ring
   pulses outward once. No brackets, no beam, no contour lines, no floating
   accent — the shape itself is the point.

   pathLength isn't needed here (no stroke-dasharray draw-in this time).
   GSAP plays once on scroll-in; prefers-reduced-motion skips straight to
   the finished state. Motion is y/scale/opacity only, never x — an x-axis
   offset reads as "from the left" in LTR and reverses under RTL. */

type Size = 'compact' | 'card';

/* Every x-coordinate below is 160 ± the same offset as its mirror twin.
   Head circle: center (160,110) r=54, kappa*r ≈ 29.83 → control x 130.17/189.83.
   Body: shoulder points 121.5/198.5 (∓38.5), base corners 24/296 (∓136). */
const FIGURE_PATH =
  'M160 56C189.83 56 214 80.17 214 110C214 124.85 208.07 138.3 198.5 148.15C253 162 296 210 296 380L24 380C24 210 67 162 121.5 148.15C111.93 138.3 106 124.85 106 110C106 80.17 130.17 56 160 56Z';

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
  const figureRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const pulseRef = useRef<SVGCircleElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // End state up front, so a reduced-motion visitor sees the finished
      // render immediately rather than a stuck outline.
      gsap.set(figureRef.current, { fillOpacity: 1 });
      gsap.set(glowRef.current, { opacity: 0.4, scale: 1, transformOrigin: '50% 50%' });
      gsap.set(pulseRef.current, { opacity: 0 });

      if (reduced) return;

      gsap.set(figureRef.current, { fillOpacity: 0 });
      gsap.set(glowRef.current, { opacity: 0, scale: 0.85, transformOrigin: '50% 50%' });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: rootRef.current, start: 'top 78%', once: true },
        defaults: { ease: 'power2.out' },
      });

      tl.to(glowRef.current, { opacity: 0.4, scale: 1, duration: 0.8 })
        .to(figureRef.current, { fillOpacity: 1, duration: 0.7 }, '<0.15')
        .fromTo(
          pulseRef.current,
          { opacity: 0.5, scale: 0.7, transformOrigin: '50% 50%' },
          { opacity: 0, scale: 1.6, duration: 1.1, ease: 'power1.out' },
          '<0.1',
        )
        // Gentle continuous breathing once the reveal settles — elegant, not busy.
        .to(glowRef.current, {
          opacity: 0.55,
          scale: 1.04,
          duration: 2.6,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
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
          <linearGradient id="gc-vision-figure-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.88" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Soft depth glow, centred on the figure — breathes gently once settled. */}
        <circle ref={glowRef} cx="160" cy="200" r="140" fill="var(--primary)" opacity="0" style={{ filter: 'blur(60px)' }} />

        {/* Single outward pulse on reveal, then gone — the only "scan" cue. */}
        <circle ref={pulseRef} cx="160" cy="200" r="150" fill="none" stroke="var(--primary)" strokeWidth="2" opacity="0" />

        {/* Ghosted outline, always visible at rest. */}
        <path d={FIGURE_PATH} fill="none" stroke="var(--foreground)" strokeOpacity="0.22" strokeWidth="2" />

        {/* The render itself — same path, filled. No second shape, no seam. */}
        <path ref={figureRef} d={FIGURE_PATH} fill="url(#gc-vision-figure-fill)" fillOpacity="0" />
      </svg>

      {caption ? (
        <p className="absolute inset-x-4 bottom-4 z-10 rounded-full bg-foreground/85 px-3 py-2 text-center text-xs font-semibold text-background">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
