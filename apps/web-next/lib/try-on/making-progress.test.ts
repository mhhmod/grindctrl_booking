import { describe, expect, it } from 'vitest';
import { MAX_FRACTION, makingProgress } from './making-progress';

describe('making the look', () => {
  it('keeps reading until acceptance, fits while working, and holds final details at 85% of Muse time', () => {
    const at = (elapsedMs: number, acceptedElapsedMs: number | null, stage: 'received' | 'making' | 'finishing' = 'making') =>
      makingProgress({ elapsedMs, acceptedElapsedMs, estimateSeconds: null, stepCount: 3, stage });
    const phases = [at(0, null), at(30_000, null), at(30_000, 0), at(35_000, 5_000), at(42_000, 12_000), at(120_000, 90_000)];
    expect(phases.map((p) => p.stepIndex)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(at(31_000, 1000, 'finishing').stepIndex).toBe(2);
    for (let i = 0; i < phases.length; i++) {
      expect(phases[i].fraction).toBeLessThan(1);
      if (i) expect(phases[i].fraction).toBeGreaterThanOrEqual(phases[i - 1].fraction);
    }
  });
  it('counts down only while the real median estimate is credible', () => {
    const at = (s: number) => makingProgress({ elapsedMs: s * 1000, estimateSeconds: 12, stepCount: 3 });
    expect(at(0)).toEqual({ stepIndex: 0, secondsLeft: 12, fraction: 0, overEstimate: false });
    expect(at(3.2)).toMatchObject({ stepIndex: 0, secondsLeft: 9, overEstimate: false });
    expect(at(11.2)).toMatchObject({ stepIndex: 0, secondsLeft: 1, overEstimate: false });
    expect(at(6).fraction).toBeGreaterThan(at(3).fraction);
    expect(at(12).fraction).toBeCloseTo(0.93, 2);
  });

  it('switches to reassurance at the estimate without claiming a result or a later stage', () => {
    for (const s of [12, 12.5, 40]) {
      const progress = makingProgress({ elapsedMs: s * 1000, estimateSeconds: 12, stepCount: 3, stage: 'making' });
      expect(progress.stepIndex).toBe(1);
      expect(progress.secondsLeft).toBeNull();
      expect(progress.overEstimate).toBe(true);
      expect(progress.fraction).toBeLessThanOrEqual(MAX_FRACTION);
    }
  });

  it('never reaches done or 100 percent before a result, even after a very long wait', () => {
    for (const estimateSeconds of [null, 1, 30, 60]) {
      for (const stage of [null, 'received', 'making', 'finishing'] as const) {
        for (const elapsedMs of [0, 3_300, 30_000, 120_000, 60 * 60_000]) {
          const progress = makingProgress({ elapsedMs, estimateSeconds, stepCount: 3, stage });
          expect(progress.fraction).toBeGreaterThanOrEqual(0);
          expect(progress.fraction).toBeLessThan(1);
          expect(progress.fraction).toBeLessThanOrEqual(MAX_FRACTION);
          expect(progress.stepIndex).toBeLessThan(3);
        }
      }
    }
  });

  it('eases the bar without inventing stages or a time when no median is known', () => {
    const at = (elapsedMs: number) => makingProgress({ elapsedMs, estimateSeconds: null, stepCount: 3 });
    expect(at(0)).toEqual({ stepIndex: 0, secondsLeft: null, fraction: 0, overEstimate: false });
    expect(at(80_000).stepIndex).toBe(0);
    expect(at(80_000).secondsLeft).toBeNull();
    expect(at(80_000).overEstimate).toBe(false);
    expect(at(10_000).fraction).toBeLessThan(at(20_000).fraction);
  });

  it('copes with invalid estimates, a clock before the start, and one step', () => {
    expect(makingProgress({ elapsedMs: -500, estimateSeconds: 10, stepCount: 1 })).toEqual({ stepIndex: 0, secondsLeft: 10, fraction: 0, overEstimate: false });
    expect(makingProgress({ elapsedMs: 9_000, estimateSeconds: 10, stepCount: 1, stage: 'finishing' }).stepIndex).toBe(0);
    for (const estimateSeconds of [NaN, Infinity, -1, 0]) {
      const progress = makingProgress({ elapsedMs: 9_000, estimateSeconds, stepCount: 3 });
      expect(progress.secondsLeft).toBeNull();
      expect(progress.overEstimate).toBe(false);
      expect(Number.isFinite(progress.fraction)).toBe(true);
    }
  });

  it('advances the labels only when the real server status advances', () => {
    const at = (elapsedMs: number, stage: 'received' | 'making' | 'finishing', stepCount = 3) =>
      makingProgress({ elapsedMs, estimateSeconds: 12, stepCount, stage }).stepIndex;
    for (const elapsedMs of [0, 3_300, 12_000, 120_000]) {
      expect(at(elapsedMs, 'received')).toBe(0);
      expect(at(elapsedMs, 'making')).toBe(1);
      expect(at(elapsedMs, 'finishing')).toBe(2);
      expect(at(elapsedMs, 'making', 5)).toBe(1);
      expect(at(elapsedMs, 'finishing', 5)).toBe(4);
    }
  });
});
