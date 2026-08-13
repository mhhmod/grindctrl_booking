import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/* A browser-chrome frame for real product screenshots. The automations
   section shows actual GrindCTRL dashboard captures rather than illustration
   — the chrome bar is what tells a scanning eye "this is running software",
   not decoration for its own sake.

   Screenshots are the product's own English-language UI: never mirrored for
   RTL (see CLAUDE.md's rule against mirroring media that isn't meant to be),
   so this renders identically in both locales. */
export function ScreenshotFrame({
  src,
  alt,
  urlLabel,
  className,
}: {
  src: string;
  alt: string;
  urlLabel: string;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--gc-landing-shadow)]',
        className,
      )}
    >
      <div dir="ltr" className="flex items-center gap-2 border-b border-border bg-muted/50 px-3.5 py-2.5">
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-foreground/20" />
          <span className="size-2 rounded-full bg-foreground/20" />
          <span className="size-2 rounded-full bg-foreground/20" />
        </span>
        <span className="ms-1 truncate rounded-full bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground">
          {urlLabel}
        </span>
      </div>
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 620px"
          className="object-cover object-top"
        />
      </div>
    </figure>
  );
}
