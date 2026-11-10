/* The server advances the stages; elapsed time only eases the bar. A
   store's recent median is an estimate, never evidence that a stage or
   look has finished. After that estimate the countdown disappears while
   the scanning treatment and reassuring copy keep the wait visibly live. */

import type { TryOnStage } from './types';
import { TRYON_EXPECTED_PROVIDER_MS } from './models';

/** The bar never fills before the look is actually there. */
export const MAX_FRACTION = 0.95;
/** The bar's pace without an estimate: about 60 percent at 20 seconds. */
const UNKNOWN_PACE_MS = 20_000;

export type MakingProgress = {
  /** The step that is running; earlier ones are done. */
  stepIndex: number;
  /** Whole seconds left on the estimate, or null with none left or none known. */
  secondsLeft: number | null;
  /** How full the bar is, 0 to MAX_FRACTION. */
  fraction: number;
  /** The known estimate has passed; replace the countdown with reassurance. */
  overEstimate: boolean;
};

export function makingProgress({
  elapsedMs,
  estimateSeconds,
  stepCount,
  stage = null,
  acceptedElapsedMs,
}: {
  elapsedMs: number;
  estimateSeconds: number | null;
  stepCount: number;
  /** The server's own stage, when the store's looks report one. */
  stage?: TryOnStage | null;
  /** null before acceptance; elapsed since acceptance otherwise. */
  acceptedElapsedMs?: number | null;
}): MakingProgress {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const last = Math.max(0, stepCount - 1);
  const estimateMs = estimateSeconds !== null && Number.isFinite(estimateSeconds) && estimateSeconds > 0
    ? estimateSeconds * 1000
    : null;
  if (acceptedElapsedMs !== undefined) {
    const providerMs = estimateMs ?? TRYON_EXPECTED_PROVIDER_MS;
    const accepted = acceptedElapsedMs !== null;
    const workingMs = Math.max(0, acceptedElapsedMs ?? 0);
    return {
      stepIndex: !accepted ? 0 : stage === 'finishing' || workingMs >= providerMs * 0.85 ? last : Math.min(1, last),
      secondsLeft: accepted && estimateMs && workingMs < estimateMs ? Math.ceil((estimateMs - workingMs) / 1000) : null,
      fraction: accepted
        ? 0.12 + (MAX_FRACTION - 0.12) * (1 - Math.exp(-2.5 * workingMs / providerMs))
        : 0.12 * (1 - Math.exp(-elapsed / 10_000)),
      overEstimate: accepted && workingMs >= providerMs,
    };
  }
  const stepIndex = stage === 'finishing' ? last : stage === 'making' ? Math.min(1, last) : 0;

  if (estimateMs === null) {
    return {
      stepIndex,
      secondsLeft: null,
      fraction: MAX_FRACTION * (1 - Math.exp(-elapsed / UNKNOWN_PACE_MS)),
      overEstimate: false,
    };
  }

  const left = Math.ceil((estimateMs - elapsed) / 1000);
  return {
    stepIndex,
    secondsLeft: left >= 1 ? left : null,
    // About 93% at the median, then an increasingly gentle approach to 95%.
    fraction: MAX_FRACTION * (1 - Math.exp((-4 * elapsed) / estimateMs)),
    overEstimate: elapsed >= estimateMs,
  };
}
