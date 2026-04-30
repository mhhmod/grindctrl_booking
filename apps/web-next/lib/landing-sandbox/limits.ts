import { createHash } from 'node:crypto';

const DAY_MS = 24 * 60 * 60 * 1000;
const sessionRunsMap = new Map<string, number[]>();
const ipRunsMap = new Map<string, number[]>();

function hashId(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

function pruneRecent(entries: number[], now: number) {
  const cutoff = now - DAY_MS;
  return entries.filter((value) => value > cutoff);
}

function getRecentRuns(map: Map<string, number[]>, key: string, now: number) {
  const current = pruneRecent(map.get(key) ?? [], now);
  map.set(key, current);
  return current;
}

function addRun(map: Map<string, number[]>, key: string, now: number) {
  const current = getRecentRuns(map, key, now);
  current.push(now);
  map.set(key, current);
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number | null;
  reason: 'session' | 'ip' | null;
}

export function enforceLandingSandboxRateLimit(input: { sessionId?: string; ip: string }, now = Date.now()): RateLimitResult {
  const hashedIp = hashId(input.ip || 'unknown');
  const ipRuns = getRecentRuns(ipRunsMap, hashedIp, now);
  if (ipRuns.length >= 5) {
    return { ok: false, retryAfterSeconds: 24 * 60 * 60, reason: 'ip' };
  }

  const sessionKey = input.sessionId ? hashId(input.sessionId) : null;
  if (sessionKey) {
    const sessionRuns = getRecentRuns(sessionRunsMap, sessionKey, now);
    if (sessionRuns.length >= 3) {
      return { ok: false, retryAfterSeconds: 24 * 60 * 60, reason: 'session' };
    }
  }

  addRun(ipRunsMap, hashedIp, now);
  if (sessionKey) {
    addRun(sessionRunsMap, sessionKey, now);
  }

  return { ok: true, retryAfterSeconds: null, reason: null };
}

export function resetLandingSandboxRateLimitForTests() {
  sessionRunsMap.clear();
  ipRunsMap.clear();
}
