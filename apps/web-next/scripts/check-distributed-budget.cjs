/* Explicit operator-only smoke check. Six Redis commands, one random probe
 * key, <=60s expiry. Never touches a real tenant bucket or invokes AI. */
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
const { loadEnvConfig } = require('@next/env');
const { Redis } = require('@upstash/redis');

async function main() {
  const root = resolve(__dirname, '..');
  loadEnvConfig(root);
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('configuration_missing');
  }
  const source = readFileSync(resolve(root, 'lib/assistant/distributed-budget.ts'), 'utf8');
  const script = source.match(/export const DRAW_SCRIPT = `([\s\S]*?)`;/)?.[1];
  if (!script) throw new Error('script_not_found');
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    retry: false,
    signal: () => AbortSignal.timeout(5000),
  });
  const key = `gc-release-probe:${randomUUID()}`;
  try {
    const first = await redis.eval(script, [key], [1, 3, 3 / 60000]);
    const second = await redis.eval(script, [key], [2, 3, 3 / 60000]);
    const denied = await redis.eval(script, [key], [1, 3, 3 / 60000]);
    const peek = await redis.eval(script, [key], [0, 3, 3 / 60000]);
    const ttl = await redis.pttl(key);
    if (Number(first?.[0]) !== 1 || Number(second?.[0]) !== 1 || Number(denied?.[0]) !== 0 || Number(denied?.[2]) <= 0 || Number(peek?.[0]) !== 1 || ttl <= 0 || ttl > 60000) {
      throw new Error('budget_contract_failed');
    }
    console.log(JSON.stringify({ redisProbe: 'passed', authorizedDraws: 2, deniedDraws: 1, zeroCostRead: true, expiresWithin60Seconds: true }));
  } finally {
    await redis.del(key);
  }
}

main().catch(() => {
  // Do not print provider errors: SDK transport errors can contain URLs.
  console.error('Distributed budget probe failed; see configuration/network access.');
  process.exitCode = 1;
});
