export interface DrawResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export interface RateLimiterStore {
  atomicDraw(key: string, cost: number, capacity: number, refillPerMs: number, now: number): DrawResult;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class InMemoryStore implements RateLimiterStore {
  private buckets = new Map<string, Bucket>();

  atomicDraw(key: string, cost: number, capacity: number, refillPerMs: number, now: number): DrawResult {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    const elapsed = Math.max(0, now - bucket.lastRefill);
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);
    bucket.lastRefill = now;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return { allowed: true, remaining: bucket.tokens, resetMs: 0 };
    }

    const missing = cost - bucket.tokens;
    const resetMs = refillPerMs > 0 ? Math.ceil(missing / refillPerMs) : Infinity;
    return { allowed: false, remaining: bucket.tokens, resetMs };
  }
}
