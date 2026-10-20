/* Where the making-the-look screen stands (02-try-on.md, TryOn-Waiting).
   A job reports only processing, then completed or failed, so the steps
   cannot follow real server stages yet (item 16, contract N38). They run
   in order over the store's own estimate, and the last one holds until
   the look arrives. The seconds count down from that estimate and are
   dropped, never shown as zero or less, once it runs out. */

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
}: {
  elapsedMs: number;
  estimateSeconds: number | null;
  stepCount: number;
}): MakingProgress {
  const elapsed = Math.max(0, elapsedMs);
  const last = Math.max(0, stepCount - 1);
  const estimateMs = estimateSeconds && estimateSeconds > 0 ? estimateSeconds * 1000 : null;

  if (estimateMs === null) {
    return {
      stepIndex: Math.min(last, Math.floor(elapsed / DEFAULT_STEP_MS)),
      secondsLeft: null,
      fraction: Math.min(MAX_FRACTION, 1 - Math.exp(-elapsed / UNKNOWN_PACE_MS)),
    };
  }

  const left = Math.ceil((estimateMs - elapsed) / 1000);
  return {
    stepIndex: Math.min(last, Math.floor((elapsed / estimateMs) * Math.max(1, stepCount))),
    secondsLeft: left >= 1 ? left : null,
    fraction: Math.min(MAX_FRACTION, elapsed / estimateMs),
  };
}
