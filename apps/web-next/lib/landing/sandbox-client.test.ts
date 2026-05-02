import { describe, expect, it, vi } from 'vitest';
import {
  getLandingSandboxMode,
  runLandingSandboxPreview,
} from '@/lib/landing/sandbox-client';
import type { LandingSandboxClient } from '@/lib/landing/sandbox-contract';

const request = {
  mode: 'workflow' as const,
  prompt: 'Route support questions and sales leads into the right queue.',
  locale: 'en' as const,
  source: 'landing_sandbox' as const,
};

describe('landing sandbox client', () => {
  it('uses mock mode by default and returns a valid envelope', async () => {
    const envelope = await runLandingSandboxPreview(request, { env: {} });

    expect(getLandingSandboxMode({})).toBe('mock');
    expect(envelope.ok).toBe(true);
    expect(envelope.result.status).toBe('completed');
    expect(envelope.result.workflowSlug).toBe('workflow_planner');
    expect(envelope.meta.source).toBe('landing_sandbox');
    expect(envelope.meta.mode).toBe('workflow');
  });

  it('does not call live mode unless explicitly enabled', async () => {
    const liveClient: LandingSandboxClient = {
      runPreview: vi.fn(),
    };

    await runLandingSandboxPreview(request, {
      env: { LANDING_SANDBOX_MODE: 'mock' },
      liveClient,
    });

    expect(liveClient.runPreview).not.toHaveBeenCalled();
  });

  it('calls live mode only when explicitly enabled', async () => {
    const liveEnvelope = await runLandingSandboxPreview(request, { env: {} });
    const liveClient: LandingSandboxClient = {
      runPreview: vi.fn().mockResolvedValue(liveEnvelope),
    };

    await runLandingSandboxPreview(request, {
      env: { LANDING_SANDBOX_MODE: 'live' },
      liveClient,
    });

    expect(liveClient.runPreview).toHaveBeenCalledWith(request);
  });

  it('keeps executedActions and externalRefs empty in mock mode', async () => {
    const envelope = await runLandingSandboxPreview(request, {
      env: { LANDING_SANDBOX_MODE: 'mock' },
    });

    expect(envelope.result.executedActions).toEqual([]);
    expect(envelope.result.externalRefs).toEqual([]);
    expect(envelope.result.observability.providerRefs).toEqual([]);
  });
});
