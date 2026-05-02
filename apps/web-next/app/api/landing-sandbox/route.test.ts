import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/landing-sandbox/route';
import { resetLandingSandboxRateLimitForTests } from '@/lib/landing-sandbox/limits';

describe('POST /api/landing-sandbox', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetLandingSandboxRateLimitForTests();
    delete process.env.LANDING_SANDBOX_MODE;
    delete process.env.LANDING_TRIAL_INFLOW_URL;
    delete process.env.LANDING_TRIAL_INFLOW_TOKEN;
  });

  it('returns mock envelope when LANDING_SANDBOX_MODE is mock', async () => {
    process.env.LANDING_SANDBOX_MODE = 'mock';
    const request = new NextRequest('http://localhost/api/landing-sandbox', {
      method: 'POST',
      body: JSON.stringify({
        source: 'landing_sandbox',
        mode: 'workflow',
        locale: 'en',
        prompt: 'Route support tickets',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.fallback).toBe(false);
    expect(body.result.workflowSlug).toBe('workflow_planner');
  });

  it('returns valid mock envelopes for voice and file modes', async () => {
    process.env.LANDING_SANDBOX_MODE = 'mock';
    const voiceRequest = new NextRequest('http://localhost/api/landing-sandbox', {
      method: 'POST',
      body: JSON.stringify({
        source: 'landing_sandbox',
        mode: 'voice',
        locale: 'en',
        sessionId: 'smoke_voice_001',
        transcript: 'Capture missed calls and book appointments.',
      }),
      headers: { 'content-type': 'application/json' },
    });
    const fileRequest = new NextRequest('http://localhost/api/landing-sandbox', {
      method: 'POST',
      body: JSON.stringify({
        source: 'landing_sandbox',
        mode: 'file',
        locale: 'en',
        sessionId: 'smoke_file_001',
        prompt: 'Extract invoice fields and route to finance.',
        fileName: 'invoice-april-2026.pdf',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const voiceResponse = await POST(voiceRequest);
    const fileResponse = await POST(fileRequest);
    const voiceBody = await voiceResponse.json();
    const fileBody = await fileResponse.json();

    expect(voiceResponse.status).toBe(200);
    expect(fileResponse.status).toBe(200);
    expect(voiceBody.meta.mode).toBe('voice');
    expect(fileBody.meta.mode).toBe('file');
    expect(voiceBody.result.workflowSlug).toBe('voice_lead_capture');
    expect(fileBody.result.workflowSlug).toBe('file_image_intake');
    expect(voiceBody.result.executedActions).toEqual([]);
    expect(fileBody.result.externalRefs).toEqual([]);
  });

  it('rejects malformed request', async () => {
    const request = new NextRequest('http://localhost/api/landing-sandbox', {
      method: 'POST',
      body: JSON.stringify({
        source: 'browser',
        mode: 'workflow',
        locale: 'en',
        prompt: 'Route support tickets',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/invalid source/i);
  });

  it('does not expose LANDING_TRIAL_INFLOW_TOKEN in response', async () => {
    process.env.LANDING_SANDBOX_MODE = 'live';
    process.env.LANDING_TRIAL_INFLOW_URL = 'https://n8n.example.test/webhook/grindctrl-trial-inflow';
    process.env.LANDING_TRIAL_INFLOW_TOKEN = 'secret-token';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
    const request = new NextRequest('http://localhost/api/landing-sandbox', {
      method: 'POST',
      body: JSON.stringify({
        source: 'landing_sandbox',
        mode: 'workflow',
        locale: 'en',
        prompt: 'Route support tickets',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).not.toContain('secret-token');
    expect(text).not.toContain('n8n.example.test');
  });

  it('returns 429 with rate_limited contract after session cap', async () => {
    process.env.LANDING_SANDBOX_MODE = 'mock';
    const makeRequest = () =>
      new NextRequest('http://localhost/api/landing-sandbox', {
        method: 'POST',
        body: JSON.stringify({
          source: 'landing_sandbox',
          mode: 'workflow',
          locale: 'en',
          sessionId: 'smoke_workflow_001',
          prompt: 'Route support tickets',
        }),
        headers: { 'content-type': 'application/json' },
      });

    await POST(makeRequest());
    await POST(makeRequest());
    await POST(makeRequest());
    const limitedResponse = await POST(makeRequest());
    const limitedBody = await limitedResponse.json();

    expect(limitedResponse.status).toBe(429);
    expect(limitedBody.ok).toBe(false);
    expect(limitedBody.retryAfterSeconds).toBe(24 * 60 * 60);
    expect(limitedBody.meta.limitState).toBe('rate_limited');
    expect(limitedBody.result.executedActions).toEqual([]);
    expect(limitedBody.result.externalRefs).toEqual([]);
  });
});
