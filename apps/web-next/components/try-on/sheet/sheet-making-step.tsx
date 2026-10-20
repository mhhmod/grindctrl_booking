'use client';

import { Check } from 'lucide-react';
import type { MakingProgress } from '@/lib/try-on/making-progress';
import type { SheetCopy } from '@/lib/try-on/sheet-copy';

/* TryOn-Waiting (02-try-on.md): the shopper's photo with the piece beside
   it, a thin bar, "Making your look", the seconds left on the store's own
   estimate, then the store's loading steps. Done steps get a tick, the
   current one a spinner, the rest stay dim. The steps are announced by
   the sheet's own live region, so nothing here is a live region. Keep
   browsing and Cancel wait for asynchronous looks (item 16, N38): today
   leaving or cancelling would still use the look. */
export function SheetMakingStep({
  copy,
  photoDataUrl,
  piece,
  steps,
  progress,
  loadingStyle = 'steps',
}: {
  copy: SheetCopy;
  photoDataUrl: string | null;
  piece: { name: string; imageUrl: string };
  steps: string[];
  progress: MakingProgress;
  /** The merchant's loading animation from TryOnStudio. */
  loadingStyle?: 'steps' | 'pulse' | 'bar';
}) {
  const current = steps[progress.stepIndex] ?? '';

  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className={`flex items-end justify-center gap-3 ${loadingStyle === 'pulse' ? 'motion-safe:animate-pulse' : ''}`}>
        {photoDataUrl && (
          // A data URL the shopper chose; next/image cannot optimise it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoDataUrl} alt={copy.yourPhotoAlt} className="aspect-[3/4] w-36 rounded-2xl border object-cover sm:w-44" />
        )}
        {piece.imageUrl && (
          // The store's own product image, already on Shopify's CDN.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={piece.imageUrl} alt={piece.name} className="aspect-[3/4] w-24 rounded-xl border bg-muted/40 object-cover sm:w-28" />
        )}
      </div>

      <div className={`${loadingStyle === 'bar' ? 'h-1.5' : 'h-1'} w-full overflow-hidden rounded-full bg-muted`} aria-hidden="true">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-linear motion-reduce:transition-none"
          style={{ width: `${Math.round(progress.fraction * 1000) / 10}%` }}
        />
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{copy.makingTitle}</h2>
        {progress.secondsLeft !== null && (
          <p className="text-sm tabular-nums text-muted-foreground">{copy.secondsLeft(progress.secondsLeft)}</p>
        )}
      </div>

      {loadingStyle === 'steps' ? (
        <ol className="space-y-3">
          {steps.map((label, index) => {
            const state = index < progress.stepIndex ? 'done' : index === progress.stepIndex ? 'current' : 'next';
            return (
              <li
                key={`${index}-${label}`}
                aria-current={state === 'current' ? 'step' : undefined}
                className={`flex items-center gap-3 text-base ${state === 'next' ? 'text-muted-foreground/70' : 'text-foreground'} ${state === 'current' ? 'font-medium' : ''}`}
              >
                <StepMark state={state} />
                {label}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="flex items-center gap-3 text-base font-medium text-foreground">
          <StepMark state="current" />
          {current}
        </p>
      )}
    </div>
  );
}

function StepMark({ state }: { state: 'done' | 'current' | 'next' }) {
  if (state === 'done') {
    return (
      <span
        className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--gc-success-soft,#e3f1e5)] text-[var(--gc-success,#2f6b3a)]"
        aria-hidden="true"
      >
        <Check className="size-3.5" />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className="grid size-6 shrink-0 place-items-center" aria-hidden="true">
        <span className="size-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary motion-reduce:animate-none" />
      </span>
    );
  }
  return (
    <span className="grid size-6 shrink-0 place-items-center" aria-hidden="true">
      <span className="size-2 rounded-full bg-muted-foreground/40" />
    </span>
  );
}
