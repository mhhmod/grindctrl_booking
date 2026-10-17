import { createHash } from 'node:crypto';

/* Who sees GrindCTRL on a store (N5 and N6, phase zero item 9).

   setup and preview: only the owner, through the signed preview link.
   live: everyone, as every store is today.
   holdout: one share of visitors does not see it, the rest do, each
   visitor bucketed once from their id and the store's salt, so the same
   visitor always lands in the same arm and both arms can be measured.
   After the holdout ends the store counts as live.

   All of it applies only while the store's n5_preview_mode flag is on, and
   holdout also needs n6_holdout; with the flags off the answer is always
   today's: show. No server-only import, so the bucket test runs alone. */

export type LaunchState = 'setup' | 'preview' | 'live' | 'holdout';
export const LAUNCH_STATES: readonly LaunchState[] = ['setup', 'preview', 'live', 'holdout'];

export interface StoreLaunch {
  state: LaunchState;
  /** The share of visitors who do NOT see GrindCTRL during the holdout. */
  holdoutShare: number | null;
  holdoutStartedAt: string | null;
  holdoutEndsAt: string | null;
  salt: string;
}

export type HoldoutBucket = 'on' | 'off';

export interface LaunchAudience {
  show: boolean;
  /** Why it is hidden: still being set up, or this visitor's arm. */
  reason: 'preview' | 'holdout' | null;
  /** The visitor's arm while a holdout runs. */
  bucket: HoldoutBucket | null;
  /** The owner, from the preview link: their looks are test looks. */
  test: boolean;
}

const SHOW: LaunchAudience = { show: true, reason: null, bucket: null, test: false };

/** One visitor's arm: stable for the same id and salt, and `share` of all
 *  ids land in "off". */
export function holdoutBucket(visitorId: string, salt: string, share: number): HoldoutBucket {
  const digest = createHash('sha256').update(`${salt}:${visitorId}`, 'utf8').digest();
  const point = digest.readUInt32BE(0) / 0x1_0000_0000;
  return point < share ? 'off' : 'on';
}

/** The state that applies now: a holdout past its end is live. */
export function effectiveLaunchState(launch: StoreLaunch | null, now: Date): LaunchState {
  if (!launch) return 'live';
  if (launch.state !== 'holdout') return launch.state;
  const ends = launch.holdoutEndsAt ? Date.parse(launch.holdoutEndsAt) : NaN;
  if (!Number.isFinite(ends) || now.getTime() >= ends) return 'live';
  return 'holdout';
}

export function launchAudience(input: {
  launch: StoreLaunch | null;
  features: readonly string[];
  /** The request carried a valid preview link for this store. */
  preview: boolean;
  visitorId: string | null;
  now: Date;
}): LaunchAudience {
  if (!input.features.includes('n5_preview_mode')) return SHOW;
  if (input.preview) return { show: true, reason: null, bucket: null, test: true };

  const state = effectiveLaunchState(input.launch, input.now);
  if (state === 'setup' || state === 'preview') return { show: false, reason: 'preview', bucket: null, test: false };
  if (state === 'holdout' && input.features.includes('n6_holdout') && input.launch?.holdoutShare) {
    // A visitor the scripts could not give an id to sees it: nobody is
    // hidden from by accident.
    if (!input.visitorId) return SHOW;
    const bucket = holdoutBucket(input.visitorId, input.launch.salt, input.launch.holdoutShare);
    return bucket === 'off'
      ? { show: false, reason: 'holdout', bucket, test: false }
      : { show: true, reason: null, bucket, test: false };
  }
  return SHOW;
}

/** The anonymous id both storefront scripts share (gc_tryon_vid). */
export function launchVisitorId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value) ? value : null;
}

/** What the dashboard shows: the state that applies now, and how far into
 *  a running holdout the store is (day 1 is its first day). */
export function launchView(launch: StoreLaunch | null, now: Date): {
  state: LaunchState;
  holdoutDay: number | null;
  holdoutDays: number | null;
} {
  const state = effectiveLaunchState(launch, now);
  if (state !== 'holdout' || !launch?.holdoutStartedAt || !launch.holdoutEndsAt) {
    return { state, holdoutDay: null, holdoutDays: null };
  }
  const started = Date.parse(launch.holdoutStartedAt);
  const ends = Date.parse(launch.holdoutEndsAt);
  const day = 86_400_000;
  return {
    state,
    holdoutDay: Math.max(1, Math.floor((now.getTime() - started) / day) + 1),
    holdoutDays: Math.max(1, Math.round((ends - started) / day)),
  };
}

