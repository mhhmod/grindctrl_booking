import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetLandingSandboxRateLimitForTests } from '@/lib/landing-sandbox/limits';
import { runLandingSandbox } from '@/lib/landing-sandbox/service';
import { parseLandingSandboxInput } from '@/lib/landing-sandbox/validator';

const input = {
  mode: 'workflow',
  sessionId: 'sess-1',
  locale: 'en',
  prompt: 'Route support questions and sales leads into the right queue.',
  source: 'landing_sandbox',
} as const;

function parsedInput() {
  const parsed = parseLandingSandboxInput(input);
  if (!parsed.ok || !parsed.input) throw new Error('parse failed');
  return parsed.input;
}

describe('landing sandbox n8n bridge service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetLandingSandboxRateLimitForTests();
    delete process.env.LANDING_SANDBOX_MODE;
    delete process.env.LANDING_TRIAL_INFLOW_URL;
    delete process.env.LANDING_TRIAL_INFLOW_TOKEN;
    delete process.env.LANDING_TRIAL_INFLOW_TIMEOUT_MS;
  });

  it('returns mock envelope when sandbox mode is mock', async () => {
    process.env.LANDING_SANDBOX_MODE = 'mock';
    const fetchSpy = vi.spyOn(global, 'fetch');

    const envelope = await runLandingSandbox(parsedInput(), { ip: '1.1.1.1', userAgent: 'vitest' });

    expect(envelope.ok).toBe(true);
    expect(envelope.fallback).toBe(false);
    expect(envelope.meta.runtime).toBe('mock');
    expect(envelope.result.workflowSlug).toBe('workflow_planner');
    expect(envelope.result.executedActions).toEqual([]);
    expect(envelope.result.externalRefs).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to mock envelope if live n8n call fails', async () => {
    process.env.LANDING_SANDBOX_MODE = 'live';
    process.env.LANDING_TRIAL_INFLOW_URL = 'https://n8n.example.test/webhook/grindctrl-trial-inflow';
    process.env.LANDING_TRIAL_INFLOW_TOKEN = 'secret-token';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failed')));

    const envelope = await runLandingSandbox(parsedInput(), { ip: '2.2.2.2', userAgent: 'vitest' });

    expect(envelope.ok).toBe(true);
    expect(envelope.fallback).toBe(true);
    expect(envelope.meta.runtime).toBe('fallback');
    expect(envelope.result.executedActions).toEqual([]);
    expect(envelope.result.externalRefs).toEqual([]);
  });

  it('sends token only as server-side n8n request header', async () => {
    process.env.LANDING_SANDBOX_MODE = 'live';
    process.env.LANDING_TRIAL_INFLOW_URL = 'https://n8n.example.test/webhook/grindctrl-trial-inflow';
    process.env.LANDING_TRIAL_INFLOW_TOKEN = 'secret-token';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          message: 'ok',
          result: {
            status: 'completed',
            workflowSlug: 'workflow_planner',
            summary: 'Workflow mapped.',
            confidence: 90,
            extractedEntities: { owner: 'ops' },
            decision: { route: 'support', priority: 'medium', handoffRequired: false },
            recommendedAction: 'Start a 14-day trial to save this preview.',
            executedActions: ['unsafe_action'],
            externalRefs: ['unsafe_ref'],
            auditTrail: ['done'],
            observability: { providerRefs: ['n8n'], latencyMs: 10, costEstimate: 0 },
          },
          diagnostics_safe: { requestId: 'gc_test_request' },
        }),
      } as Response),
    );

    const envelope = await runLandingSandbox(parsedInput(), { ip: '3.3.3.3', userAgent: 'vitest' });
    const fetchMock = vi.mocked(fetch);
    const [, init] = fetchMock.mock.calls[0];

    expect(init?.headers).toMatchObject({ 'x-grindctrl-sandbox-token': 'secret-token' });
    expect(JSON.stringify(envelope)).not.toContain('secret-token');
    expect(envelope.meta.runtime).toBe('live');
    expect(envelope.meta.requestId).toBe('gc_test_request');
    expect(envelope.result.executedActions).toEqual([]);
    expect(envelope.result.externalRefs).toEqual([]);
    expect(envelope.result.observability.providerRefs).toEqual([]);
  });

  it('returns rate_limited envelope after session exceeds daily cap', async () => {
    process.env.LANDING_SANDBOX_MODE = 'mock';
    const context = { ip: '4.4.4.4', userAgent: 'vitest' };

    await runLandingSandbox(parsedInput(), context);
    await runLandingSandbox(parsedInput(), context);
    await runLandingSandbox(parsedInput(), context);
    const envelope = await runLandingSandbox(parsedInput(), context);

    expect(envelope.ok).toBe(false);
    expect(envelope.retryAfterSeconds).toBe(24 * 60 * 60);
    expect(envelope.meta.limitState).toBe('rate_limited');
    expect(envelope.result.executedActions).toEqual([]);
    expect(envelope.result.externalRefs).toEqual([]);
  });
});
