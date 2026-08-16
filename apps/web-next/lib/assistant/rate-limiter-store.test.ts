import { describe, expect, it } from 'vitest';
import { InMemoryStore } from './rate-limiter-store';

describe('InMemoryStore.atomicDraw', () => {
  it('allows a draw within capacity and reports remaining tokens', () => {
    const store = new InMemoryStore();

    const result = store.atomicDraw('tenant-a', 1, 5, 1, 0);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('denies a draw that exceeds available tokens and leaves the bucket unchanged', () => {
    const store = new InMemoryStore();
    store.atomicDraw('tenant-a', 3, 5, 1, 0);

    const denied = store.atomicDraw('tenant-a', 5, 5, 1, 0);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(2);

    const nextDraw = store.atomicDraw('tenant-a', 2, 5, 1, 0);
    expect(nextDraw.allowed).toBe(true);
    expect(nextDraw.remaining).toBe(0);
  });

  it('never double-spends under concurrent draws from the same tenant', async () => {
    const store = new InMemoryStore();
    const CAPACITY = 5;
    const REQUESTS = 20;

    const draw = async () => store.atomicDraw('tenant-a', 1, CAPACITY, 1, 0);
    const results = await Promise.all(Array.from({ length: REQUESTS }, draw));

    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(CAPACITY);
    expect(REQUESTS - allowedCount).toBe(REQUESTS - CAPACITY);
  });

  // 1 token per 1000ms, for numbers that are easy to verify by hand.
  const REFILL_PER_MS = 1 / 1000;

  it('refills tokens proportionally to elapsed time, capped at capacity', () => {
    const store = new InMemoryStore();
    store.atomicDraw('tenant-a', 5, 5, REFILL_PER_MS, 0); // drain to 0

    const partial = store.atomicDraw('tenant-a', 1, 5, REFILL_PER_MS, 4_000); // +4 tokens
    expect(partial.allowed).toBe(true);
    expect(partial.remaining).toBe(3); // 4 refilled, minus 1 drawn

    const capped = store.atomicDraw('tenant-a', 1, 5, REFILL_PER_MS, 100_000); // huge gap, caps at capacity
    expect(capped.remaining).toBe(4); // capacity 5, minus 1 drawn
  });

  it('reports the exact time until enough tokens refill on denial', () => {
    const store = new InMemoryStore();
    store.atomicDraw('tenant-a', 5, 5, REFILL_PER_MS, 0); // drain to 0

    const denied = store.atomicDraw('tenant-a', 5, 5, REFILL_PER_MS, 0);
    expect(denied.allowed).toBe(false);
    expect(denied.resetMs).toBe(5_000); // 5 tokens needed at 1 per 1000ms
  });
});
