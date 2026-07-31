import React from 'react';
import Image from 'next/image';

/* Replaces BeforeAfterSlider. That component was well built — RTL-aware clip
   maths, pointer capture, full keyboard support, ~170 lines — but none of it
   mattered because the interaction was never discovered. */
export function TryOnRevealFigure({
  caption,
  alt,
  productSrc,
  resultSrc,
}: {
  caption: string;
  alt: string;
  productSrc: string;
  resultSrc: string;
}) {
  return (
    <figure
      aria-label={alt}
      className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-muted"
    >
      <Image
        src={productSrc}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 384px"
        className="gc-tryon-garment object-cover"
      />
      <Image
        src={resultSrc}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 384px"
        className="gc-tryon-reveal object-cover"
      />
      <figcaption className="gc-tryon-caption absolute inset-x-4 bottom-4 rounded-full bg-foreground/85 px-3 py-2 text-center text-xs font-semibold text-background">
        {caption}
      </figcaption>
    </figure>
  );
}
