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
   result". That photo doesn't depict AI, try-on, or a scan of any kind — it's
   a product shot with a label stuck on it. This draws the thing itself: a
   viewfinder locks on, a beam sweeps a silhouette, a garment renders in. No
   face, no stock model — the shopper's own photo is the one this happens to,
   so putting a stranger's face here would misrepresent the product anyway.

   Everything is SVG so it clips and scales cleanly at every size this is
   asked to render at (a 430px card and a 640px card share one component).
   pathLength="1" on every stroked path makes stroke-dashoffset unit-agnostic
   — 0 to 1 regardless of the path's real length in viewBox units — so the
   "draws itself in" animation doesn't need per-path length math.

   GSAP plays the sequence once when the figure scrolls into view. Under
   prefers-reduced-motion it skips straight to the end state: brackets drawn,
   garment rendered, nothing moving — same contract as the rest of the site
   (see app/globals.css's prefers-reduced-motion block). Entrance motion is
   y-only by design, never x: an x-axis offset reads as "from the left" in
   LTR and silently reverses meaning under RTL, which is exactly the bug the
   collaborations marquee needed a dir="ltr" patch for. Nothing here needs
   that patch because nothing here moves sideways. */

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
  const garmentRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const sparkRef = useRef<SVGPathElement>(null);
  const gridRef = useRef<SVGGElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // End state, set up front so a reduced-motion visitor sees the
      // finished render immediately rather than a stuck wireframe.
      gsap.set(bracketsRef.current?.querySelectorAll('path') ?? [], { strokeDashoffset: 0 });
      gsap.set(garmentRef.current, { opacity: 1, scale: 1, transformOrigin: '50% 30%' });
      gsap.set(glowRef.current, { opacity: 0.5 });
      gsap.set(sparkRef.current, { opacity: 1, scale: 1, transformOrigin: '50% 50%' });
      gsap.set(gridRef.current, { opacity: 0.35 });
      gsap.set(beamClipRef.current, { yPercent: -120 });

      if (reduced) return;

      // Re-hide everything, then animate from the wireframe/scanning state
      // to the same end state above.
      gsap.set(bracketsRef.current?.querySelectorAll('path') ?? [], { strokeDashoffset: 1 });
      gsap.set(garmentRef.current, { opacity: 0, scale: 0.92 });
      gsap.set(glowRef.current, { opacity: 0 });
      gsap.set(sparkRef.current, { opacity: 0, scale: 0.4 });
      gsap.set(gridRef.current, { opacity: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 78%',
          once: true,
        },
        defaults: { ease: 'power2.out' },
      });

      tl.to(bracketsRef.current?.querySelectorAll('path') ?? [], {
        strokeDashoffset: 0,
        duration: 0.6,
        stagger: 0.08,
      })
        .to(gridRef.current, { opacity: 0.35, duration: 0.4 }, '<0.1')
        .fromTo(
          beamClipRef.current,
          { yPercent: -120 },
          { yPercent: 260, duration: 1.1, ease: 'power1.inOut' },
          '<0.15',
        )
        .to(
          garmentRef.current,
          { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(1.5)' },
          '<0.35',
        )
        .to(glowRef.current, { opacity: 0.5, duration: 0.8 }, '<')
        .to(
          sparkRef.current,
          { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)' },
          '-=0.25',
        );
    },
    { scope: rootRef },
  );

  const compact = size === 'compact';

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative isolate mx-auto w-full overflow-hidden rounded-3xl border border-border bg-[linear-gradient(160deg,var(--muted)/0.55,var(--background))]',
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

      <svg
        viewBox="0 0 320 360"
        className="absolute inset-0 size-full"
        aria-hidden="true"
      >
        <defs>
          <clipPath id="gc-vision-silhouette-clip">
            <circle cx="160" cy="72" r="36" />
            <path d="M78 344c0-96 34-150 82-150s82 54 82 150Z" />
          </clipPath>
          <linearGradient id="gc-vision-garment-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="gc-vision-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="45%" stopColor="var(--primary)" stopOpacity="0.9" />
            <stop offset="55%" stopColor="var(--primary)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Ambient scan-grid texture, decorative only. */}
        <g ref={gridRef} stroke="var(--foreground)" strokeOpacity="0.5" strokeWidth="0.5">
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1="0" x2="320" y1={24 + i * 36} y2={24 + i * 36} />
          ))}
        </g>

        {/* Ghosted silhouette: always visible, low opacity, gives the scan
            something to land on before the garment renders in. */}
        <g opacity="0.28" fill="none" stroke="var(--foreground)" strokeWidth="2.5">
          <circle cx="160" cy="72" r="36" />
          <path d="M78 344c0-96 34-150 82-150s82 54 82 150" />
        </g>

        {/* Garment: a crew-neck tee outline that materialises from wireframe
            to filled. This is the part standing in for "the product". */}
        <path
          ref={garmentRef}
          d="M113 176c9-11 24-18 47-18s38 7 47 18l24 22-20 24-12-9v129H121V213l-12 9-20-24Z"
          fill="url(#gc-vision-garment-fill)"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Soft glow seated behind the render, reads as "AI is doing this". */}
        <circle ref={glowRef} cx="160" cy="220" r="120" fill="var(--primary)" opacity="0" style={{ filter: 'blur(48px)' }} />

        {/* Scan beam, clipped to the silhouette so it lights the figure
            rather than sweeping the whole card. */}
        <g clipPath="url(#gc-vision-silhouette-clip)">
          <rect ref={beamClipRef} x="0" y="-60" width="320" height="90" fill="url(#gc-vision-beam)" />
        </g>

        {/* Viewfinder corner brackets. pathLength=1 makes the draw-in
            animation unit-agnostic. */}
        <g ref={bracketsRef} stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" fill="none">
          <path pathLength="1" strokeDasharray="1" d="M20 46V26a6 6 0 0 1 6-6h20" />
          <path pathLength="1" strokeDasharray="1" d="M274 20h20a6 6 0 0 1 6 6v20" />
          <path pathLength="1" strokeDasharray="1" d="M300 314v20a6 6 0 0 1-6 6h-20" />
          <path pathLength="1" strokeDasharray="1" d="M46 340H26a6 6 0 0 1-6-6v-20" />
        </g>

        {/* Completion spark, mirrors the hero badge's language. */}
        <path
          ref={sparkRef}
          d="m272 62 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"
          fill="var(--primary)"
        />
      </svg>

      {caption ? (
        <p className="absolute inset-x-4 bottom-4 z-10 rounded-full bg-foreground/85 px-3 py-2 text-center text-xs font-semibold text-background">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
