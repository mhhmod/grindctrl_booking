/** Short, bounded process cache, like proxy-config-cache. Expiry is anchored
 * before loading so slow reads never extend the freshness window. Each
 * instance expires independently; no Redis round trip on the button path. */
export class StorefrontConfigCache<T> {
  private static instances = new Set<{ clear(): void }>();
  constructor() { StorefrontConfigCache.instances.add(this); }
  static clearAll() { for (const cache of this.instances) cache.clear(); }
  private entries = new Map<string, { value: T; expires: number }>();

  async read(key: string, load: () => Promise<T>, ttl: (value: T) => number = () => 20_000): Promise<T> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && hit.expires > now) return hit.value;
    this.entries.delete(key);
    const value = await load(); // Rejections are never cached.
    const ms = Math.min(20_000, Math.max(0, ttl(value)));
    if (ms > 0) {
      if (this.entries.size >= 200) this.entries.delete(this.entries.keys().next().value!);
      this.entries.set(key, { value, expires: now + ms });
    }
    return value;
  }

  delete(key: string) { this.entries.delete(key); }
  clear() { this.entries.clear(); }
}

export type ConfigPhase = 'site' | 'settings' | 'plan' | 'flags';
export function configTiming() {
  const durations: Record<ConfigPhase, number> = { site: 0, settings: 0, plan: 0, flags: 0 };
  return {
    async measure<T>(phase: ConfigPhase, run: () => Promise<T>): Promise<T> {
      const start = performance.now();
      try { return await run(); } finally { durations[phase] += performance.now() - start; }
    },
    finish<T extends Response>(response: T): T {
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('Server-Timing', Object.entries(durations).map(([phase, ms]) => `${phase};dur=${ms.toFixed(1)}`).join(', '));
      return response;
    },
  };
}
