/* Where the making-the-look screen stands (02-try-on.md, TryOn-Waiting).
   Without real stages the steps run in order over the store's own
   estimate, and the last one holds until the look arrives. A store whose
   looks are made after the answer (contract N38) reports real stages, and
   the steps follow them: the first step until the provider starts, then
   the others paced by the estimate while it fits and renders the piece,
   and the last at once when the look is being saved. Polls come every few
   seconds, so the short saving stage alone could not be relied on to show
   the last step. The seconds count down from that estimate and are dropped,
   never shown as zero or less, once it runs out. */

import type { TryOnStage } from './types';

/** Step pace when the store has too few looks for an estimate. */
export const DEFAULT_STEP_MS = 8_000;
/** The bar never fills before the look is actually there. */
export const MAX_FRACTION = 0.95;
/** The bar's pace without an estimate: about 63 percent at 20 seconds. */
const UNKNOWN_PACE_MS = 20_000;

export type MakingProgress = {
  /** The step that is running; earlier ones are done. */
  stepIndex: number;
  /** Whole seconds left on the estimate, or null with none left or none known. */
  secondsLeft: number | null;
  /** How full the bar is, 0 to MAX_FRACTION. */
  fraction: number;
};

export function makingProgress({
  elapsedMs,
  estimateSeconds,
  stepCount,
  stage = null,
}: {
  elapsedMs: number;
  estimateSeconds: number | null;
  stepCount: number;
  /** The server's own stage, when the store's looks report one. */
  stage?: TryOnStage | null;
}): MakingProgress {
  const elapsed = Math.max(0, elapsedMs);
  const last = Math.max(0, stepCount - 1);
  const estimateMs = estimateSeconds && estimateSeconds > 0 ? estimateSeconds * 1000 : null;

  const paced =
    estimateMs === null
      ? Math.min(last, Math.floor(elapsed / DEFAULT_STEP_MS))
      : Math.min(last, Math.floor((elapsed / estimateMs) * Math.max(1, stepCount)));
  const stepIndex = stage ? stagedStep(stage, paced, last) : paced;

  if (estimateMs === null) {
    return {
      stepIndex,
      secondsLeft: null,
      fraction: Math.min(MAX_FRACTION, 1 - Math.exp(-elapsed / UNKNOWN_PACE_MS)),
    };
  }

  const left = Math.ceil((estimateMs - elapsed) / 1000);
  return {
    stepIndex,
    secondsLeft: left >= 1 ? left : null,
    fraction: Math.min(MAX_FRACTION, elapsed / estimateMs),
  };
}

/** The step a real stage allows: received holds the first, making moves
 *  on from the second with time, and finishing shows the last. */
function stagedStep(stage: TryOnStage, paced: number, last: number): number {
  if (stage === 'received') return 0;
  if (stage === 'finishing') return last;
  return Math.max(paced, Math.min(1, last));
}
