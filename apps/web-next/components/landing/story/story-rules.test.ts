import { describe, expect, it } from 'vitest';
import { BEATS, LEN, SCENE_ORDER } from './story-data';
import {
  beatDuration,
  buildStops,
  keyDirection,
  nearestStop,
  settleDuration,
  stepTarget,
  WheelGate,
  wheelPixels,
} from './story-rules';

/* The pacing rules from 02-landing.md: where the stops are, and how a
   gesture becomes exactly one beat. */

describe('story stops', () => {
  it('has 21 beats plus one stop where the rest of the page starts', () => {
    const count = SCENE_ORDER.reduce((n, scene) => n + BEATS[scene].length, 0);
    expect(count).toBe(21);
    const { stops } = buildStops([{ scene: 'tryon', i: 0, y: 0 }], 5000);
    expect(stops).toEqual([0, 5000]);
  });

  it('places beats at the documented fractions of each scene length', () => {
    expect(BEATS.tryon).toEqual([0, 0.4, 0.7, 1]);
    expect(BEATS.product).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(LEN).toEqual({ tryon: 1.5, store: 1.5, ops: 1.5, product: 2, results: 1.5 });
  });

  it('sorts measured markers top to bottom', () => {
    const { beats, stops } = buildStops(
      [
        { scene: 'store', i: 0, y: 2250 },
        { scene: 'tryon', i: 1, y: 540 },
        { scene: 'tryon', i: 0, y: 0 },
      ],
      9000,
    );
    expect(beats.map((b) => `${b.scene}:${b.i}`)).toEqual(['tryon:0', 'tryon:1', 'store:0']);
    expect(stops).toEqual([0, 540, 2250, 9000]);
  });
});

describe('one gesture, one beat', () => {
  const stops = [0, 540, 945, 1350, 2250];

  it('moves to the neighbouring stop from a stop', () => {
    expect(stepTarget(stops, 540, 1)).toBe(2);
    expect(stepTarget(stops, 540, -1)).toBe(0);
    expect(stepTarget(stops, 543, 1)).toBe(2);
  });

  it('moves to the next stop ahead from between two stops', () => {
    expect(stepTarget(stops, 700, 1)).toBe(2);
    expect(stepTarget(stops, 700, -1)).toBe(1);
  });

  it('stops at either end', () => {
    expect(stepTarget(stops, 0, -1)).toBe(-1);
    expect(stepTarget(stops, 2250, 1)).toBe(-1);
  });

  it('finds the nearest stop for settling', () => {
    expect(nearestStop(stops, 900)).toEqual([2, 45]);
  });

  it('steps once a wheel stream adds up to 24px in one direction', () => {
    const gate = new WheelGate();
    expect(gate.feed(10, 0, false)).toBe(0);
    expect(gate.feed(10, 16, false)).toBe(0);
    expect(gate.feed(10, 32, false)).toBe(1);
  });

  it('swallows the long tail of a trackpad fling after the move lands', () => {
    const gate = new WheelGate();
    let t = 0;
    let steps = 0;
    /* The fling starts: one step. */
    steps += Math.abs(gate.feed(40, t, false));
    /* While the move runs (900ms), events are ignored. */
    for (t = 16; t < 900; t += 16) steps += Math.abs(gate.feed(30, t, true));
    gate.landed(t);
    /* The tail keeps decaying for another second, every event inside the lock extends it. */
    for (let mag = 28; t < 1900; t += 16, mag = Math.max(1, mag * 0.97)) steps += Math.abs(gate.feed(mag, t, false));
    expect(steps).toBe(1);
  });

  /** One gesture that stepped at 0ms and kept sending small deltas until 896ms, landing at 900ms. */
  function afterOneMove() {
    const gate = new WheelGate();
    expect(gate.feed(30, 0, false)).toBe(1);
    for (let t = 16; t < 900; t += 16) gate.feed(8, t, true);
    gate.landed(900);
    return gate;
  }

  it('takes a new gesture after 240ms of quiet', () => {
    const gate = afterOneMove();
    expect(gate.feed(8, 910, false)).toBe(0);
    expect(gate.feed(30, 1300, false)).toBe(1);
  });

  it('takes a new gesture when the magnitude jumps sharply inside the lock', () => {
    const gate = afterOneMove();
    expect(gate.feed(8, 910, false)).toBe(0);
    expect(gate.feed(40, 926, false)).toBe(1);
  });

  it('scales line and page wheel modes to pixels', () => {
    expect(wheelPixels(3, 1, 900)).toBe(96);
    expect(wheelPixels(1, 2, 900)).toBe(900);
    expect(wheelPixels(120, 0, 900)).toBe(120);
  });
});

describe('keys', () => {
  const key = (k: string, extra: Partial<Parameters<typeof keyDirection>[0]> = {}) =>
    keyDirection({ key: k, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, target: document.body, ...extra });

  it('moves forward on ArrowDown, PageDown and Space, back on ArrowUp, PageUp and Shift+Space', () => {
    expect(key('ArrowDown')).toBe(1);
    expect(key('PageDown')).toBe(1);
    expect(key(' ')).toBe(1);
    expect(key('ArrowUp')).toBe(-1);
    expect(key('PageUp')).toBe(-1);
    expect(key(' ', { shiftKey: true })).toBe(-1);
  });

  it('leaves Home, End and modified keys native', () => {
    expect(key('Home')).toBe(0);
    expect(key('End')).toBe(0);
    expect(key('ArrowDown', { altKey: true })).toBe(0);
    expect(key('ArrowDown', { ctrlKey: true })).toBe(0);
    expect(key('ArrowDown', { metaKey: true })).toBe(0);
  });

  it('ignores keys in fields and Space on buttons and links', () => {
    expect(key('ArrowDown', { target: document.createElement('input') })).toBe(0);
    expect(key('ArrowDown', { target: document.createElement('textarea') })).toBe(0);
    expect(key(' ', { target: document.createElement('button') })).toBe(0);
    expect(key(' ', { target: document.createElement('a') })).toBe(0);
    expect(key('ArrowDown', { target: document.createElement('button') })).toBe(1);
  });
});

describe('move timing', () => {
  it('takes 0.7 to 1.3 seconds from beat to beat', () => {
    expect(beatDuration(100)).toBe(700);
    expect(beatDuration(900)).toBe(870);
    expect(beatDuration(5000)).toBe(1300);
  });

  it('settles in 0.38 to 0.9 seconds', () => {
    expect(settleDuration(10)).toBe(380);
    expect(settleDuration(300)).toBe(470);
    expect(settleDuration(2000)).toBe(900);
  });
});
