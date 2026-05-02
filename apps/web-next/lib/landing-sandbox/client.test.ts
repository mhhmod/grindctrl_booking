import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runLandingSandbox } from '@/lib/landing-sandbox/client';

describe('landing sandbox browser client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls /api/landing-sandbox', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          fallback: false,
          message: 'ok',
          retryAfterSeconds: null,
          result: {
            status: 'completed',
            workflowSlug: 'workflow_planner',
            summary: 'Workflow mapped.',
            confidence: 90,
            extractedEntities: {},
            decision: { route: 'support', priority: 'medium', handoffRequired: false },
            recommendedAction: 'Start a 14-day trial.',
            executedActions: [],
            externalRefs: [],
            auditTrail: [],
            observability: { providerRefs: [], latencyMs: 0, costEstimate: 0 },
          },
          meta: {
            source: 'landing_sandbox',
            mode: 'workflow',
            locale: 'en',
            timestamp: new Date().toISOString(),
            limitState: 'ok',
          },
        }),
      } as Response),
    );

    const response = await runLandingSandbox({
      source: 'landing_sandbox',
      mode: 'workflow',
      locale: 'en',
      prompt: 'Route support tickets',
    });

    expect(fetch).toHaveBeenCalledWith('/api/landing-sandbox', expect.objectContaining({ method: 'POST' }));
    expect(response.result.workflowSlug).toBe('workflow_planner');
  });
});
