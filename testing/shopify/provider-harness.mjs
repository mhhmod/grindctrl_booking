import { readFileSync, writeFileSync, renameSync, mkdirSync, rmdirSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { forbiddenHost } from './config.mjs';

export const SYNTHETIC_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZQAAAABJRU5ErkJggg==';

// One preview replica only. The invocation count survives restarts/refunds;
// a stale lock, corrupt state or full budget fails closed, never resets itself.
export function reserveInvocation(file, c, kind) {
  const lock = `${file}.lock`;
  mkdirSync(lock);
  try {
    const state = JSON.parse(readFileSync(file, 'utf8'));
    if (state.run_id !== c.run_id || !Number.isInteger(state.used) || state.used < 0 ||
      state.used >= c.max_calls || !Array.isArray(state.events) || state.events.length !== state.used) throw new Error('controlled_budget_denied');
    const event = { sequence: state.used + 1, kind, at: new Date().toISOString() };
    state.used++; state.events.push(event);
    const temp = `${file}.pending`;
    writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
    const fd = openSync(temp, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temp, file);
    const dir = openSync(dirname(file), 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
    return event.sequence;
  } finally { rmdirSync(lock); }
}

function control(file) {
  const c = JSON.parse(readFileSync(file, 'utf8'));
  if (!['success', 'failure', 'pause'].includes(c.image) || !['success', 'failure', 'pause'].includes(c.chat)) {
    throw new Error('controlled_scenario_invalid');
  }
  return c;
}

/** Only provider wire responses are substituted. Auth, credits, storage,
 * jobs, finalization and refund stay in the application's original live path. */
export function createProviderHarness(c, { stateFile, controlFile, fetchImpl = globalThis.fetch }) {
  let active = 0;
  return async function controlledFetch(input, init) {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const kind = url.origin === 'https://openrouter.ai' && method === 'POST' && !url.search &&
      (url.pathname === '/api/v1/images' ? 'image' : url.pathname === '/api/v1/chat/completions' ? 'chat' : null);
    if (kind) {
      if (Date.parse(c.expires_at) <= Date.now()) throw new Error('controlled_run_expired');
      if (active >= c.max_concurrent) throw new Error('controlled_concurrency_denied');
      active++;
      try {
        reserveInvocation(stateFile, c, kind);
        const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
        const deadline = Date.now() + 60_000;
        let scenario = control(controlFile)[kind];
        while (scenario === 'pause') {
          if (Date.now() >= deadline || Date.parse(c.expires_at) <= Date.now()) throw new Error('controlled_pause_expired');
          await delay(100, undefined, { signal: signal ?? undefined });
          scenario = control(controlFile)[kind];
        }
        signal?.throwIfAborted();
        // 422 avoids the app's transient HTTP retry policy; tests can repeat
        // deliberately, and every attempt consumes the durable run budget.
        if (scenario === 'failure') return Response.json({ error: { message: 'controlled-test synthetic failure' } }, { status: 422 });
        const payload = kind === 'image'
          ? { data: [{ b64_json: SYNTHETIC_PNG, media_type: 'image/png' }], usage: { cost: 0 } }
          : { model: 'controlled-test-synthetic', provider: 'controlled-test', usage: { cost: 0, prompt_tokens: 0, completion_tokens: 0 },
            choices: [{ message: { role: 'assistant', content: 'Synthetic controlled-test response; no AI provider was called.' } }] };
        return Response.json(payload, { headers: { 'X-Grindctrl-Controlled-Test': c.run_id } });
      } finally { active--; }
    }
    // Defence in depth. The internal-only app network + CONNECT gateway is
    // required as well; a fetch hook alone is not an OS network boundary.
    if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      (url.port || '80') === '3000' && !url.username && !url.password) return fetchImpl(input, init);
    // Preserve dependency access for reserved-job completion/refund during
    // the explicitly approved, <=15 minute drain; never allow new AI calls.
    if (Date.parse(c.drain_until) <= Date.now()) throw new Error('controlled_drain_expired');
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      forbiddenHost(url.hostname) || !c.hosts.has(url.hostname)) throw new Error('controlled_egress_denied');
    // Redirects must re-enter this guard rather than follow to another host.
    return fetchImpl(input, { ...init, redirect: 'error' });
  };
}
