/* Single source of truth for turning saved widget settings into CSS tokens.

   This exists because the same `radiusPx` setting used to be interpreted
   three different ways: the embed panel clamped it at 24, the catalog button
   clamped it at 999, and the product-page button did not clamp at all. One
   slider, three shapes.

   Two tokens come out of one setting on purpose:
     --radius              panels, cards, and surfaces. Capped, because a
                           card with a 999px radius turns into a lozenge.
     --gc-control-radius   pills and buttons. Uncapped, so "999 = fully
                           round" still means fully round.

   Kept free of server-only imports so both the server-rendered embed and the
   client dashboard preview can share it. */

export const MAX_PANEL_RADIUS_PX = 24;
const MAX_CONTROL_RADIUS_PX = 999;

export type AppearanceInput = {
  accentBg: string;
  accentFg: string;
  radiusPx: number;
};

export type AppearanceTokens = {
  '--primary': string;
  '--primary-foreground': string;
  '--radius': string;
  '--gc-control-radius': string;
};

/* Settings arrive from the database, so a null, a string, or a NaN is
   possible however careful the form is. Fall back rather than emit
   `NaNpx`, which silently disables every radius on the widget. */
function safeRadius(value: number): number {
  if (!Number.isFinite(value) || value < 0) return MAX_CONTROL_RADIUS_PX;
  return value;
}

export function toAppearanceTokens(settings: AppearanceInput): AppearanceTokens {
  const radius = safeRadius(settings.radiusPx);

  return {
    '--primary': settings.accentBg,
    '--primary-foreground': settings.accentFg,
    '--radius': `${Math.min(radius, MAX_PANEL_RADIUS_PX)}px`,
    '--gc-control-radius': `${Math.min(radius, MAX_CONTROL_RADIUS_PX)}px`,
  };
}
