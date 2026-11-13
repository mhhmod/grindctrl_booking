'use client';

import { Check } from 'lucide-react';
import type { MakingProgress } from '@/lib/try-on/making-progress';
import type { SheetCopy } from '@/lib/try-on/sheet-copy';
import { SheetLayout } from './sheet-layout';

/* The shopper's photo stays visible while real status drives the steps.
   The sheet owns the polite live region; the continuous scan and the
   eased bar only convey that work continues, never that it has finished.

   The merchant's loading animation (TryOnStudio) decides which of the three
   leads, as its dashboard preview shows it:
     steps  the checklist, with a thin bar
     pulse  the product photo pulsing, no bar and no checklist
     bar    a tall progress bar, no checklist
   The bar conveys ongoing work, not a measured completion percentage. */
export function SheetMakingStep({
  copy,
  photoDataUrl,
  piece,
  steps,
  progress,
  loadingStyle = 'steps',
  inline = false,
}: {
  copy: SheetCopy;
  photoDataUrl: string | null;
  piece: { name: string; imageUrl: string };
  steps: string[];
  progress: MakingProgress;
  /** The merchant's loading animation from TryOnStudio. */
  loadingStyle?: 'steps' | 'pulse' | 'bar';
  inline?: boolean;
}) {
  const current = steps[progress.stepIndex] ?? '';

  const content = (
    <>
      <div className="flex flex-col gap-5 short:gap-4" aria-busy="true" data-loading-style={loadingStyle}>
        <div className="flex items-end justify-center gap-3">
          {photoDataUrl && (
            <div className="relative w-36 max-w-[50%] overflow-hidden rounded-2xl border sm:w-44 short:w-24">
              {/* A data URL the shopper chose; next/image cannot optimise it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoDataUrl} alt={copy.yourPhotoAlt} className="aspect-[3/4] w-full object-cover" />
              {loadingStyle === 'steps' && <div
                aria-hidden="true"
                className="gc-anim-scan absolute start-0 end-0 top-0 h-[36%] bg-gradient-to-b from-transparent to-primary/25 motion-reduce:hidden"
              />}
            </div>
          )}
          {piece.imageUrl && (
            // The store's own product image, already on Shopify's CDN.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={piece.imageUrl} alt={piece.name} className={`aspect-[3/4] w-24 rounded-xl border bg-muted/40 object-cover sm:w-28 short:w-16 ${loadingStyle === 'pulse' ? 'motion-safe:animate-pulse' : ''}`} />
          )}
        </div>

        {loadingStyle !== 'pulse' && <div data-making-bar className={`${loadingStyle === 'bar' ? 'h-2.5' : 'h-1'} w-full overflow-hidden rounded-full bg-muted`} aria-hidden="true">
          <div
            className={`h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none ${progress.overEstimate ? 'motion-safe:animate-pulse' : ''}`}
            style={{ width: `${Math.round(progress.fraction * 1000) / 10}%` }}
          />
        </div>}

        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{copy.makingTitle}</h2>
          {progress.overEstimate ? (
            <p className="text-sm text-muted-foreground">{copy.makingAlmostThere}</p>
          ) : progress.secondsLeft !== null && (
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
    </>
  );
  return inline ? content : <SheetLayout>{content}</SheetLayout>;
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
