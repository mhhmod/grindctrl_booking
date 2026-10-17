// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { effectiveLaunchState, holdoutBucket, launchAudience, type StoreLaunch } from './audience';

const NOW = new Date('2026-10-17T12:00:00.000Z');
const SALT = '0123456789abcdef0123456789abcdef';
const ids = Array.from({ length: 10_000 }, (_, index) => `visitor_${String(index).padStart(6, '0')}_abcdef`);
const launch = (overrides: Partial<StoreLaunch>): StoreLaunch => ({
  state: 'live', holdoutShare: null, holdoutStartedAt: null, holdoutEndsAt: null, salt: SALT, ...overrides,
});
const HOLDOUT = launch({ state: 'holdout', holdoutShare: 0.5, holdoutStartedAt: '2026-10-10T12:00:00.000Z', holdoutEndsAt: '2026-10-24T12:00:00.000Z' });
const ALL = ['n5_preview_mode', 'n6_holdout'];

describe('the holdout bucket (N6)', () => {
  it('keeps a visitor in the same arm', () => {
    for (const id of ids.slice(0, 200)) {
      expect(holdoutBucket(id, SALT, 0.5)).toBe(holdoutBucket(id, SALT, 0.5));
    }
  });

  it('splits 10,000 visitors evenly at 50/50', () => {
    const off = ids.filter((id) => holdoutBucket(id, SALT, 0.5) === 'off').length;
    expect(off).toBeGreaterThan(4_800);
    expect(off).toBeLessThan(5_200);
  });

  it('follows the share, and a new salt reshuffles the arms', () => {
    const off = ids.filter((id) => holdoutBucket(id, SALT, 0.2) === 'off').length;
    expect(off).toBeGreaterThan(1_850);
    expect(off).toBeLessThan(2_150);
    const otherSalt = 'fedcba9876543210fedcba9876543210';
    const moved = ids.filter((id) => holdoutBucket(id, SALT, 0.5) !== holdoutBucket(id, otherSalt, 0.5)).length;
    expect(moved).toBeGreaterThan(4_000);
  });
});

describe('who sees GrindCTRL (N5)', () => {
  const visitor = ids[0];

  it('shows it to everyone while the flag is off, whatever the state', () => {
    expect(launchAudience({ launch: launch({ state: 'preview' }), features: [], preview: false, visitorId: visitor, now: NOW }))
      .toEqual({ show: true, reason: null, bucket: null, test: false });
  });

  it('shows a store with no launch row to everyone: it is live, as today', () => {
    expect(launchAudience({ launch: null, features: ALL, preview: false, visitorId: visitor, now: NOW }).show).toBe(true);
  });

  it('hides a store in setup or preview from everyone but the owner', () => {
    for (const state of ['setup', 'preview'] as const) {
      expect(launchAudience({ launch: launch({ state }), features: ALL, preview: false, visitorId: visitor, now: NOW }))
        .toEqual({ show: false, reason: 'preview', bucket: null, test: false });
      expect(launchAudience({ launch: launch({ state }), features: ALL, preview: true, visitorId: visitor, now: NOW }))
        .toEqual({ show: true, reason: null, bucket: null, test: true });
    }
  });

  it('marks the owner\'s looks as test looks even once live', () => {
    expect(launchAudience({ launch: launch({ state: 'live' }), features: ALL, preview: true, visitorId: visitor, now: NOW }).test).toBe(true);
  });

  it('hides the holdout\'s off arm and shows the on arm', () => {
    const answers = ids.slice(0, 400).map((id) => launchAudience({ launch: HOLDOUT, features: ALL, preview: false, visitorId: id, now: NOW }));
    expect(answers.some((answer) => !answer.show && answer.reason === 'holdout' && answer.bucket === 'off')).toBe(true);
    expect(answers.some((answer) => answer.show && answer.bucket === 'on')).toBe(true);
    expect(answers.every((answer) => answer.show === (answer.bucket === 'on'))).toBe(true);
  });

  it('shows everyone once the holdout ends, or without n6_holdout, or without a visitor id', () => {
    const after = new Date('2026-10-25T00:00:00.000Z');
    expect(effectiveLaunchState(HOLDOUT, after)).toBe('live');
    const offId = ids.find((id) => holdoutBucket(id, SALT, 0.5) === 'off')!;
    expect(launchAudience({ launch: HOLDOUT, features: ALL, preview: false, visitorId: offId, now: after }).show).toBe(true);
    expect(launchAudience({ launch: HOLDOUT, features: ['n5_preview_mode'], preview: false, visitorId: offId, now: NOW }).show).toBe(true);
    expect(launchAudience({ launch: HOLDOUT, features: ALL, preview: false, visitorId: null, now: NOW }).show).toBe(true);
  });
});
