import { describe, expect, it } from 'vitest';
import { BEATS, LEN, SCENE_ORDER } from './story-data';
import { buildStops, keyDirection, nearestStop, stepTarget } from './story-rules';

/* The story's stops, and how a key press moves between them. Wheel and touch
   input are not part of it: the browser scrolls. */

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

describe('one key press, one beat', () => {
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

  it('finds the nearest stop to a scroll position', () => {
    expect(nearestStop(stops, 900)).toEqual([2, 45]);
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
