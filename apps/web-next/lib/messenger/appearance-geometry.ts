import type { MessengerAppearance } from './types';

/* One source of truth for the two appearance settings that are geometry.

   Both were dead in the loader and half-dead in the dashboard preview, and
   they failed in the way that is hardest to report: the control moves, the
   preview reacts, the merchant publishes, and the storefront is unchanged.

   launcherSizePx: the loader hardcoded 48px, or 56px via a `.btn.icon-only`
   class it applied unconditionally. An earlier fix set the height inline but
   gated the width on an `iconOnly` flag derived from launcherLabel — and the
   label is set on most stores, so the width kept coming from the class and
   the button stayed 56px wide. The rendered button is always icon-only (its
   innerHTML is the SVG; the label is only ever an aria-label), so size is one
   number for both axes and there is no flag to get wrong.

   radiusStyle: never read anywhere. The launcher was a hardcoded pill, the
   panel a hardcoded 16px, the teaser a hardcoded 14px. */

export const LAUNCHER_MIN_PX = 44;
export const LAUNCHER_MAX_PX = 72;

/** Clamped to the same range the config parser enforces, so a hand-edited
 *  settings row cannot produce a launcher that covers the page. */
export function launcherSizePx(appearance: Pick<MessengerAppearance, 'launcherSizePx'>): number {
  const raw = Number(appearance.launcherSizePx);
  if (!Number.isFinite(raw)) return 56;
  return Math.min(Math.max(Math.round(raw), LAUNCHER_MIN_PX), LAUNCHER_MAX_PX);
}

type Radius = MessengerAppearance['radiusStyle'];

/* "soft" keeps the circular launcher and a generously rounded panel — the
   shape the widget has always had, so an existing store sees no change.
   "rounded" and "sharp" step down from there. Each surface gets its own
   value: a 6px launcher and a 6px panel do not read as the same decision at
   52px versus 384px wide. */
const LAUNCHER_RADIUS: Record<Radius, string> = {
  soft: '999px',
  rounded: '18px',
  sharp: '6px',
};

const PANEL_RADIUS: Record<Radius, string> = {
  soft: '20px',
  rounded: '14px',
  sharp: '4px',
};

function resolve(style: unknown, table: Record<Radius, string>): string {
  return style === 'rounded' || style === 'sharp' ? table[style] : table.soft;
}

export function launcherRadius(appearance: Pick<MessengerAppearance, 'radiusStyle'>): string {
  return resolve(appearance.radiusStyle, LAUNCHER_RADIUS);
}

export function panelRadius(appearance: Pick<MessengerAppearance, 'radiusStyle'>): string {
  return resolve(appearance.radiusStyle, PANEL_RADIUS);
}
