import React from 'react';
import type { LucideIcon } from 'lucide-react';

/* Was three copies of a hairline ring plus a detached number. The ring sat
   almost the same colour as the page, so the icon had no ground and the number
   read as a second, unrelated mark. One solid tile, one numeral behind it. */
export function StepMarker({
  index,
  icon: IconComponent,
}: {
  index: number;
  icon: LucideIcon;
}) {
  const label = String(index + 1).padStart(2, '0');

  return (
    <span className="relative inline-flex">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-3 start-0 select-none text-[64px] font-extrabold leading-none tracking-tight text-foreground/[0.07]"
      >
        {label}
      </span>
      <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-foreground text-background">
        <IconComponent className="size-6" strokeWidth={1.7} aria-hidden="true" />
      </span>
    </span>
  );
}
