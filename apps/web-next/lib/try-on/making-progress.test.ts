import { describe, expect, it } from 'vitest';
import { DEFAULT_STEP_MS, MAX_FRACTION, makingProgress } from './making-progress';

describe('making the look', () => {
  it('runs the steps in order over the estimate and counts the seconds down', () => {
    const at = (s: number) => makingProgress({ elapsedMs: s * 1000, estimateSeconds: 12, stepCount: 3 });
    expect(at(0)).toEqual({ stepIndex: 0, secondsLeft: 12, fraction: 0 });
    expect(at(3.2)).toMatchObject({ stepIndex: 0, secondsLeft: 9 });
    expect(at(4)).toMatchObject({ stepIndex: 1, secondsLeft: 8 });
    expect(at(8.5)).toMatchObject({ stepIndex: 2, secondsLeft: 4 });
    expect(at(11.2)).toMatchObject({ stepIndex: 2, secondsLeft: 1 });
    expect(at(6).fraction).toBeCloseTo(0.5);
  });

  it('holds the last step and drops the seconds once the estimate runs out', () => {
    for (const s of [12, 12.5, 40]) {
      const progress = makingProgress({ elapsedMs: s * 1000, estimateSeconds: 12, stepCount: 3 });
      expect(progress.stepIndex).toBe(2);
      expect(progress.secondsLeft).toBeNull();
      expect(progress.fraction).toBe(MAX_FRACTION);
    }
  });

  it('paces the steps without promising a time when the store has no estimate', () => {
    const at = (ms: number) => makingProgress({ elapsedMs: ms, estimateSeconds: null, stepCount: 3 });
    expect(at(0)).toEqual({ stepIndex: 0, secondsLeft: null, fraction: 0 });
    expect(at(DEFAULT_STEP_MS).stepIndex).toBe(1);
    expect(at(DEFAULT_STEP_MS * 10).stepIndex).toBe(2);
    expect(at(10 * 60_000).fraction).toBe(MAX_FRACTION);
    expect(at(10_000).fraction).toBeLessThan(at(20_000).fraction);
  });

  it('copes with a clock before the start, and with one step', () => {
    expect(makingProgress({ elapsedMs: -500, estimateSeconds: 10, stepCount: 1 })).toEqual({ stepIndex: 0, secondsLeft: 10, fraction: 0 });
    expect(makingProgress({ elapsedMs: 9_000, estimateSeconds: 10, stepCount: 1 }).stepIndex).toBe(0);
  });

  it('follows real stages when the store reports them (N38)', () => {
    const at = (s: number, stage: 'received' | 'making' | 'finishing', steps = 3) =>
      makingProgress({ elapsedMs: s * 1000, estimateSeconds: 12, stepCount: steps, stage }).stepIndex;
    // Received holds the first step however long it takes.
    expect(at(9, 'received')).toBe(0);
    // Making starts on the second step and moves on with the estimate.
    expect(at(0, 'making')).toBe(1);
    expect(at(9, 'making')).toBe(2);
    expect(at(40, 'making')).toBe(2);
    // Finishing shows the last step at once.
    expect(at(1, 'finishing')).toBe(2);
    // With five steps, making moves through the rest with time.
    expect([0, 5, 8, 30].map((s) => at(s, 'making', 5))).toEqual([1, 2, 3, 4]);
    expect(at(0, 'finishing', 5)).toBe(4);
    // One step is always that step.
    expect(at(5, 'making', 1)).toBe(0);
  });
});
