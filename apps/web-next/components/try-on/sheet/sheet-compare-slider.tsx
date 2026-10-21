'use client';

import { useRef, useState } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

/* TryOn-Desktop's before and after slider: the shopper's photo on the
   start side, the look on the end side, and a round handle between them
   that can be dragged, moved with the arrow keys, or put anywhere with a
   click. Right to left, the photo is on the right. */
export function SheetCompareSlider({
  photoSrc,
  lookSrc,
  label,
  photoLabel,
  lookLabel,
  lookAlt,
  photoAlt,
  aiPreview,
  rtl,
}: {
  photoSrc: string;
  lookSrc: string;
  /** "Drag to compare your photo and the look". */
  label: string;
  photoLabel: string;
  lookLabel: string;
  lookAlt: string;
  photoAlt: string;
  aiPreview: string;
  rtl: boolean;
}) {
  // How much of the frame, from the start side, shows the photo.
  const [share, setShare] = useState(50);
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const fromPointer = (clientX: number) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const fromLeft = ((clientX - box.left) / box.width) * 100;
    setShare(clamp(rtl ? 100 - fromLeft : fromLeft));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 20 : 5;
    // The handle moves the way the arrow points, whichever way the text runs.
    const towardEnd = rtl ? -1 : 1;
    if (event.key === 'ArrowRight') setShare((value) => clamp(value + step * towardEnd));
    else if (event.key === 'ArrowLeft') setShare((value) => clamp(value - step * towardEnd));
    else if (event.key === 'ArrowUp') setShare((value) => clamp(value + step));
    else if (event.key === 'ArrowDown') setShare((value) => clamp(value - step));
    else if (event.key === 'Home') setShare(0);
    else if (event.key === 'End') setShare(100);
    else return;
    event.preventDefault();
  };

  const handleAt = rtl ? 100 - share : share;
  const photoClip = rtl ? `inset(0 0 0 ${100 - share}%)` : `inset(0 ${100 - share}% 0 0)`;

  return (
    <div
      ref={frame}
      className="relative aspect-[3/4] w-full touch-none select-none overflow-hidden rounded-2xl border bg-muted/30"
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        fromPointer(event.clientX);
      }}
      onPointerMove={(event) => {
        if (dragging.current) fromPointer(event.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the look lives in this page as a data URL */}
      <img src={lookSrc} alt={lookAlt} className="absolute inset-0 size-full object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: photoClip }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the shopper's own photo, never uploaded for this */}
        <img src={photoSrc} alt={photoAlt} className="size-full object-cover" draggable={false} />
      </div>

      <span className="absolute start-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
        {photoLabel}
      </span>
      <span className="absolute end-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
        {lookLabel}
      </span>
      <span className="absolute bottom-3 end-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
        {aiPreview}
      </span>

      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-background shadow" style={{ left: `${handleAt}%` }}>
        <div
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(share)}
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          className="pointer-events-auto absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full bg-background text-foreground shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ChevronsLeftRight className="size-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}
