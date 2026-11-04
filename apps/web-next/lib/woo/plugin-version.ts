/* Plugin version rules shared by the server and the dashboard (client-safe). */

/** Dotted numeric version compare: -1, 0 or 1. Non-numeric tails are ignored. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split(/[-+]/)[0].split('.').map((n) => Number.parseInt(n, 10) || 0);
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/** Order lookup needs the plugin routes added in 0.3.0. Store Chat itself
 *  keeps working on older plugins. */
export const WOO_ORDER_LOOKUP_MIN_PLUGIN_VERSION = '0.3.0';

export function pluginSupportsOrderLookup(pluginVersion: string): boolean {
  return compareVersions(pluginVersion, WOO_ORDER_LOOKUP_MIN_PLUGIN_VERSION) >= 0;
}
