import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetLandingSandboxRateLimitForTests } from '@/lib/landing-sandbox/limits';
import { runLandingSandbox } from '@/lib/landing-sandbox/service';
import { parseLandingSandboxInput } from '@/lib/landing-sandbox/validator';

describe('landing sandbox backend', () => {
  beforeEach(() => {
    resetLandingSandboxRateLimitForTests();
    vi.restoreAllMocks();
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_LANDING_SANDBOX_MODEL;
  });

  it('validates payload boundaries', () => {
    const invalid = parseLandingSandboxInput({
      mode: 'workflow',
      prompt: 'x'.repeat(501),
      source: 'landing_sandbox',
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.error).toMatch(/500 character limit/i);
  });

  it('rate limits after three session runs', async () => {
    const parsed = parseLandingSandboxInput({
      mode: 'workflow',
      sessionId: 'sess-1',
      prompt: 'Plan support workflow',
      source: 'landing_sandbox',
    });
    if (!parsed.ok || !parsed.input) throw new Error('parse failed');

    await runLandingSandbox(parsed.input, { ip: '1.1.1.1', userAgent: 'vitest' });
    await runLandingSandbox(parsed.input, { ip: '1.1.1.1', userAgent: 'vitest' });
    await runLandingSandbox(parsed.input, { ip: '1.1.1.1', userAgent: 'vitest' });
    const blocked = await runLandingSandbox(parsed.input, { ip: '1.1.1.1', userAgent: 'vitest' });

    expect(blocked.ok).toBe(false);
    expect(blocked.meta.limitState).toBe('rate_limited');
  });

  it('returns workflow fallback envelope when provider is unconfigured', async () => {
    const parsed = parseLandingSandboxInput({
      mode: 'workflow',
      sessionId: 'sess-2',
      prompt: 'Automate support escalation and lead capture',
      source: 'landing_sandbox',
    });
    if (!parsed.ok || !parsed.input) throw new Error('parse failed');

    const response = await runLandingSandbox(parsed.input, { ip: '2.2.2.2', userAgent: 'vitest' });
    expect(response.ok).toBe(true);
    expect(response.fallback).toBe(true);
    expect(response.result.executedActions).toEqual([]);
    expect(response.result.externalRefs).toEqual([]);
    expect(response.result.workflowSlug).toBe('workflow_planner');
  });

  it('handles voice mode with transcript only', async () => {
    const parsed = parseLandingSandboxInput({
      mode: 'voice',
      sessionId: 'sess-3',
      transcript: 'Hi I am Sara from Bright Dental and need pricing support.',
      source: 'landing_sandbox',
    });
    if (!parsed.ok || !parsed.input) throw new Error('parse failed');

    const response = await runLandingSandbox(parsed.input, { ip: '3.3.3.3', userAgent: 'vitest' });
    expect(response.ok).toBe(true);
    expect(response.result.workflowSlug).toBe('voice_lead_capture');
    expect(response.result.extractedEntities).toHaveProperty('company');
    expect(response.result.executedActions).toEqual([]);
  });

  it('handles file mode with metadata-first output', async () => {
    const parsed = parseLandingSandboxInput({
      mode: 'file',
      sessionId: 'sess-4',
      prompt: 'Analyze invoice payload and route to finance',
      source: 'landing_sandbox',
    });
    if (!parsed.ok || !parsed.input) throw new Error('parse failed');

    const response = await runLandingSandbox(parsed.input, { ip: '4.4.4.4', userAgent: 'vitest' });
    expect(response.ok).toBe(true);
    expect(response.result.workflowSlug).toBe('file_image_intake');
    expect(response.result.extractedEntities).toHaveProperty('route_hint');
    expect(response.result.externalRefs).toEqual([]);
  });

  it('falls back when provider responds with 429', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    process.env.GROQ_LANDING_SANDBOX_MODEL = 'test-model';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers([['retry-after', '11']]),
        json: async () => ({}),
      } as Response),
    );

    const parsed = parseLandingSandboxInput({
      mode: 'workflow',
      sessionId: 'sess-5',
      prompt: 'Design voice lead workflow',
      source: 'landing_sandbox',
    });
    if (!parsed.ok || !parsed.input) throw new Error('parse failed');

    const response = await runLandingSandbox(parsed.input, { ip: '5.5.5.5', userAgent: 'vitest' });
    expect(response.ok).toBe(true);
    expect(response.fallback).toBe(true);
    expect(response.retryAfterSeconds).toBe(11);
  });
});
