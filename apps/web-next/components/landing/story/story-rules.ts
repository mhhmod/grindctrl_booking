/* The pure rules of the story, kept apart from the DOM so they can be
   tested: where the stops are, which stop a key press moves to, and which
   stop a scroll position belongs to. Scrolling itself is the browser's: the
   prototype's wheel gate, touch pacing and settle tween (design/prototype/
   logic/director11.js in the site-v15 handoff bundle) were removed because
   intercepting wheel and touch input blocks native scrolling. */

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const lerpStops = (st: readonly number[], x: number) => {
  const i = Math.min(st.length - 2, Math.floor(x));
  const f = clamp(x - i, 0, 1);
  return st[i] + (st[i + 1] - st[i]) * f;
};
export const r1 = (x: number) => String(Math.round(x * 10) / 10);
export const r2 = (x: number) => String(Math.round(x * 100) / 100);
export const r3 = (x: number) => String(Math.round(x * 1000) / 1000);
export const r4 = (x: number) => String(Math.round(x * 10000) / 10000);

/** How close (px) the page must be to a stop to count as on it. */
export const STOP_SLOP = 6;

export type Beat = { scene: string; i: number; y: number };

/** Beats sorted top to bottom, then one extra stop where the rest of the page starts. */
export function buildStops(beats: Beat[], restY: number): { beats: Beat[]; stops: number[] } {
  const sorted = [...beats].sort((a, b) => a.y - b.y);
  return { beats: sorted, stops: sorted.map((b) => b.y).concat([restY]) };
}

export function nearestStop(stops: readonly number[], y: number): [index: number, distance: number] {
  let k = -1;
  let best = Infinity;
  stops.forEach((sy, i) => {
    const dist = Math.abs(sy - y);
    if (dist < best) {
      best = dist;
      k = i;
    }
  });
  return [k, best];
}

/** The stop one key press moves to from `y`, or -1 when there is none that way.
 *  On a stop it moves to the neighbour; between stops, to the next one ahead. */
export function stepTarget(stops: readonly number[], y: number, dir: 1 | -1): number {
  const [k, best] = nearestStop(stops, y);
  let t: number;
  if (best <= STOP_SLOP) t = k + dir;
  else if (dir > 0) t = stops.findIndex((sy) => sy > y + STOP_SLOP);
  else {
    t = -1;
    stops.forEach((sy, i) => {
      if (sy < y - STOP_SLOP) t = i;
    });
  }
  return t < 0 || t >= stops.length ? -1 : t;
}

type KeyLike = {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  defaultPrevented?: boolean;
  target: EventTarget | null;
};

/** Which way a key moves the story, or 0 when the key is not the story's. */
export function keyDirection(e: KeyLike): 1 | -1 | 0 {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return 0;
  const target = e.target as (HTMLElement & { isContentEditable?: boolean }) | null;
  const tag = target?.tagName ?? '';
  if (/INPUT|TEXTAREA|SELECT/.test(tag) || target?.isContentEditable) return 0;
  let dir: 1 | -1 | 0 = 0;
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) dir = 1;
  else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) dir = -1;
  if (dir && e.key === ' ' && /^(BUTTON|A)$/.test(tag)) return 0;
  return dir;
}

/** Legacy anchors from the previous landing, mapped to the new sections. */
export const LEGACY_HASH: Record<string, string> = { how: 'journey', demo: 'try', benefits: 'product' };
