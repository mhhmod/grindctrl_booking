import { describe, expect, it } from 'vitest';
import { InMemoryStore } from './rate-limiter-store';
import { draw, getBudgetSummary } from './rate-limiter';

describe('draw', () => {
  it('allows a chat draw within the anon tier budget', () => {
    const store = new InMemoryStore();

    const result = draw(store, 'tenant-a', 'anon', 'chat:tokens', 10, 0);

    expect(result.allowed).toBe(true);
  });

  it('isolates budgets between tenants — one customer exhausting their budget never blocks another', () => {
    const store = new InMemoryStore();

    const exhausted = draw(store, 'tenant-a', 'anon', 'stt:requests', 3, 0);
    expect(exhausted.allowed).toBe(true);
    const blockedA = draw(store, 'tenant-a', 'anon', 'stt:requests', 1, 0);
    expect(blockedA.allowed).toBe(false);

    const stillOkB = draw(store, 'tenant-b', 'anon', 'stt:requests', 1, 0);
    expect(stillOkB.allowed).toBe(true);
  });

  it('isolates budgets between resources for the same tenant', () => {
    const store = new InMemoryStore();
    draw(store, 'tenant-a', 'anon', 'stt:requests', 3, 0); // exhausts stt:requests

    const chatStillOk = draw(store, 'tenant-a', 'anon', 'chat:tokens', 10, 0);
    expect(chatStillOk.allowed).toBe(true);
  });

  it('gives the authenticated tier a larger budget than anon for the same resource', () => {
    const store = new InMemoryStore();

    const anonDenied = draw(store, 'tenant-a', 'anon', 'chat:tokens', 6_401, 0);
    expect(anonDenied.allowed).toBe(false);

    const authAllowed = draw(store, 'tenant-a', 'auth', 'chat:tokens', 6_401, 0);
    expect(authAllowed.allowed).toBe(true);
  });
});

describe('getBudgetSummary', () => {
  it('reports a fresh anon tenant as having full turns available with no wait', () => {
    const store = new InMemoryStore();

    const summary = getBudgetSummary(store, 'tenant-a', 'anon', 0);

    expect(summary.chat.remaining).toBe(8); // 6400 tokens / 800 per turn
    expect(summary.chat.resetSeconds).toBe(0);
    expect(summary.voice.remaining).toBe(3); // 3 stt:requests is the tightest of the 4 voice buckets
    expect(summary.voice.resetSeconds).toBe(0);
  });

  it('reports zero voice turns and an accurate wait once the tightest voice resource is exhausted', () => {
    const store = new InMemoryStore();
    draw(store, 'tenant-a', 'anon', 'stt:requests', 3, 0); // exhausts the 3-request budget

    const summary = getBudgetSummary(store, 'tenant-a', 'anon', 0);

    expect(summary.voice.remaining).toBe(0);
    // stt:requests refills 3 per 24h -> 1 request back in 8h = 28800s
    expect(summary.voice.resetSeconds).toBe(28_800);
    expect(summary.chat.remaining).toBe(8); // untouched, independent bucket
  });
});
