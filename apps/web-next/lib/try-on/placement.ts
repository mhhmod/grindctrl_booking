/* Where a store's Try-On button goes (Pack B, Pick a spot): next to the Buy
   button (auto), at a spot the owner picked on their own product page, or
   floating at the bottom start corner. The spot's selector is applied by the
   storefront engine with querySelectorAll, so it is held to the same small
   grammar the edit chrome (public/widget/v1/pick-spot.js) builds. */

export type SpotPosition = 'before' | 'after';
/** label and pathHint are dashboard metadata; storefronts receive only selector and position. */
export type PickSpot = { selector: string; position: SpotPosition; label: string; pathHint: string };
export type PlacementMode = 'auto' | 'spot' | 'floating';
export type ButtonPlacement = { placement: PlacementMode; spot?: PickSpot };
export type PublicPlacement = { placement: PlacementMode; spot?: { selector: string; position: SpotPosition } };

export const AUTO_PLACEMENT: ButtonPlacement = { placement: 'auto' };
export const SPOT_SELECTOR_MAX = 300;
export const SPOT_DEPTH_MAX = 5;
export const SPOT_LABEL_MAX = 60;
export const SPOT_PATH_MAX = 1024;
export const PLACEMENT_MODES: readonly PlacementMode[] = ['auto', 'spot', 'floating'];

const NAME = '[A-Za-z_][A-Za-z0-9_-]*';
// A complete double-quoted value: no quote, backslash or control character can end it early.
const VALUE = `"[A-Za-z0-9_./: -]{1,80}"`;
const ATTRIBUTE = `\\[${NAME}(?:[*^$]?=${VALUE})?\\]`;
const COMPOUND = new RegExp(`^(?:[a-z][a-z0-9-]*)?(?:#${NAME}|\\.${NAME}|${ATTRIBUTE})*$`);

/** One compound selector per level, joined by a descendant space or " > ".
 *  No pseudo classes, lists, escapes, single quotes or unquoted values. */
export function validSpotSelector(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > SPOT_SELECTOR_MAX || value.trim() !== value) return false;
  // ">" is the child combinator, checked below; everything else here has no place in the grammar.
  if (/javascript:/i.test(value) || /[\\'`<{};,\u0000-\u001f]/.test(value)) return false;
  // Split outside quoted values only; quoted values hold no quote, so pairs are exact.
  const levels: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '"') quoted = !quoted;
    if (!quoted && (ch === ' ' || ch === '>')) {
      if (current) levels.push(current);
      current = '';
      if (ch === '>' && (value[i - 1] !== ' ' || value[i + 1] !== ' ')) return false;
      continue;
    }
    current += ch;
  }
  if (quoted || !current) return false;
  levels.push(current);
  return levels.length <= SPOT_DEPTH_MAX && levels.every((level) => level !== '' && COMPOUND.test(level));
}

export function validPathHint(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= SPOT_PATH_MAX &&
    /^\/(?!\/)/.test(value) && !/[?#\\\u0000-\u001f\s]/.test(value);
}

export function parseSpot(value: unknown): PickSpot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const s = value as Record<string, unknown>;
  if (!validSpotSelector(s.selector) || (s.position !== 'before' && s.position !== 'after')) return null;
  if (typeof s.label !== 'string' || /[\u0000-\u001f<>]/.test(s.label)) return null;
  const label = s.label.replace(/\s+/g, ' ').trim();
  if (label.length > SPOT_LABEL_MAX || !validPathHint(s.pathHint)) return null;
  return { selector: s.selector, position: s.position, label, pathHint: s.pathHint };
}

export function parsePlacement(value: unknown): ButtonPlacement | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!PLACEMENT_MODES.includes(v.placement as PlacementMode)) return null;
  const spot = v.spot === undefined || v.spot === null ? null : parseSpot(v.spot);
  if (v.spot !== undefined && v.spot !== null && !spot) return null;
  if (v.placement === 'spot' && !spot) return null;
  return { placement: v.placement as PlacementMode, ...(spot ? { spot } : {}) };
}

/** What storefront config responses carry: the spot only while it is in use. */
export function publicPlacement(value: ButtonPlacement): PublicPlacement {
  if (value.placement === 'spot' && value.spot) {
    return { placement: 'spot', spot: { selector: value.spot.selector, position: value.spot.position } };
  }
  return { placement: value.placement === 'floating' ? 'floating' : 'auto' };
}
