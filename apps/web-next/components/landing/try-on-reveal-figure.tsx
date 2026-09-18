import React from 'react';

/* The try-on moment, told the way the Shopify button tells it.

   This replaced a drift-and-wipe of a garment photo onto a figure. That version
   read as a clothing brand, because the subject was the garment. Here the
   subject is the scan — a beam sweeps down a ghosted silhouette, a ring pulses
   outward, a sparkle lands — which is what the product actually does to a
   shopper's photo.

   Geometry and timings are lifted from the Shopify widget
   (extensions/tryon-block/assets/tryon.css) deliberately, so the landing page
   and the button a merchant installs read as one product rather than two.

   Pure CSS keyframes: nothing on the main thread, no library. Nothing here is
   interactive, and the accessible name on the figure carries the whole message,
   so a visitor who never sees the motion loses nothing. */
export function TryOnRevealFigure({ caption, alt }: { caption: string; alt: string }) {
  return (
    <figure
      aria-label={alt}
      className="relative mx-auto grid aspect-square w-full max-w-sm place-items-center overflow-hidden rounded-2xl border border-border bg-muted/40"
    >
      <div className="relative grid size-44 place-items-center sm:size-52">
        {/* Sized off the badge rather than the figure, so it stays proportional
            at every breakpoint instead of drifting on small phones. */}
        <span
          aria-hidden="true"
          className="gc-scan-ring pointer-events-none absolute inset-0 rounded-full border-2 border-primary/70"
        />

        {/* The badge, whose gradient pans behind the silhouette — the shine. */}
        <span
          aria-hidden="true"
          className="gc-scan-badge grid size-full place-items-center rounded-full p-[6px]"
          style={{
            background:
              'linear-gradient(120deg, var(--gc-scan-from, #ff9a3d), var(--gc-scan-to, #ffd76e), var(--gc-scan-from, #ff9a3d))',
            backgroundSize: '220% 220%',
          }}
        >
          <span className="grid size-full place-items-center rounded-full bg-background/90">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
              className="size-3/4 text-foreground"
              aria-hidden="true"
            >
              <defs>
                <clipPath id="gc-landing-bust-clip">
                  <circle cx="12" cy="6.6" r="3.2" />
                  <path d="M4.6 21c0-4.5 3.3-7.2 7.4-7.2s7.4 2.7 7.4 7.2Z" />
                </clipPath>
              </defs>

              {/* The ghosted silhouette the beam reveals. */}
              <g opacity="0.5">
                <circle cx="12" cy="6.6" r="3.2" />
                <path d="M4.6 21c0-4.5 3.3-7.2 7.4-7.2s7.4 2.7 7.4 7.2Z" />
              </g>

              {/* Clipped to the silhouette so the beam lights the person rather
                  than sweeping across the whole badge. */}
              <g clipPath="url(#gc-landing-bust-clip)">
                <rect className="gc-scan-beam" x="2" y="1" width="20" height="2.4" rx="1.2" />
              </g>

              <path
                className="gc-scan-spark"
                d="m20 2.6.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z"
              />
            </svg>
          </span>
        </span>
      </div>

      <figcaption className="absolute inset-x-4 bottom-4 rounded-full bg-foreground/85 px-3 py-2 text-center text-xs font-semibold text-background">
        {caption}
      </figcaption>
    </figure>
  );
}
