import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TryGrindctrlSandbox } from '@/components/landing/try-grindctrl-sandbox';
import { LANDING_PREVIEW_STORAGE_KEY } from '@/lib/trial/landing-preview-handoff';

vi.mock('@/lib/landing-sandbox/client', () => ({
  runLandingSandbox: vi.fn(async (input: { mode: 'workflow' | 'voice' | 'file'; prompt?: string; transcript?: string; fileName?: string }) => {
    const workflowSlug =
      input.mode === 'voice' ? 'voice_lead_capture' : input.mode === 'file' ? 'file_image_intake' : 'workflow_planner';
    const route =
      input.mode === 'voice' ? 'lead_capture' : input.mode === 'file' ? 'intake_triage' : 'support_and_ops_routing';

    return {
      ok: true,
      fallback: false,
      message: 'Preview generated locally.',
      retryAfterSeconds: null,
      result: {
        status: 'completed',
        workflowSlug,
        summary: `Preview summary for ${input.fileName || input.transcript || input.prompt || 'preview'}`,
        confidence: 90,
        extractedEntities: { source: input.fileName || input.transcript || input.prompt || 'text_prompt' },
        decision: { route, priority: 'medium', handoffRequired: input.mode === 'voice' },
        recommendedAction: 'Start a 14-day trial to save this preview.',
        executedActions: [],
        externalRefs: [],
        auditTrail: ['preview_input_received'],
        observability: { providerRefs: [], latencyMs: 0, costEstimate: 0 },
      },
      meta: {
        source: 'landing_sandbox',
        mode: input.mode,
        locale: 'en',
        timestamp: new Date().toISOString(),
        limitState: 'ok',
      },
    };
  }),
}));

describe('TryGrindctrlSandbox', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('generates a local workflow preview and shows trial CTAs after value', async () => {
    render(<TryGrindctrlSandbox />);

    expect(screen.queryByText(/^Unlock the full workflow$/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/process description/i), {
      target: { value: 'Route support issues and qualify sales leads from one intake flow.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate workflow preview/i }));

    expect(await screen.findByText(/workflow_planner/i)).toBeInTheDocument();
    expect(screen.getByText(/support_and_ops_routing/i)).toBeInTheDocument();
    const signUpLinks = screen.getAllByRole('link', { name: /start 14-day trial/i });
    const signInLink = screen.getByRole('link', { name: /sign in/i });
    expect(signUpLinks.length).toBeGreaterThan(0);
    for (const link of signUpLinks) {
      expect(link).toHaveAttribute('href', '/sign-up?from=landing-preview');
    }
    expect(signInLink).toHaveAttribute('href', '/sign-in?from=landing-preview');

    const saved = JSON.parse(window.localStorage.getItem(LANDING_PREVIEW_STORAGE_KEY) || 'null');
    expect(saved?.source).toBe('landing_sandbox');
    expect(saved?.mode).toBe('workflow');
    expect(saved?.workflowSlug).toBe('workflow_planner');
    expect(saved?.decision?.route).toBe('support_and_ops_routing');
    expect(typeof saved?.createdAt).toBe('string');
  });

  it('supports voice lead capture through the sandbox API helper', async () => {
    render(<TryGrindctrlSandbox />);

    fireEvent.click(screen.getByRole('button', { name: /voice lead capture/i }));
    fireEvent.change(screen.getByLabelText(/voice transcript/i), {
      target: { value: 'Dental clinic needs missed-call lead capture for urgent appointment requests.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate workflow preview/i }));

    expect(await screen.findByText(/voice_lead_capture/i)).toBeInTheDocument();
    expect(screen.getAllByText(/lead_capture/i).length).toBeGreaterThan(0);
  });

  it('supports voice audio upload from the recorder panel', async () => {
    render(<TryGrindctrlSandbox />);

    fireEvent.click(screen.getByRole('button', { name: /voice lead capture/i }));
    const input = screen.getByLabelText(/upload voice file/i) as HTMLInputElement;
    const file = new File(['voice note'], 'lead-note.webm', { type: 'audio/webm' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /generate workflow preview/i }));

    expect(await screen.findByText(/voice_lead_capture/i)).toBeInTheDocument();
    expect(screen.getByText('lead-note.webm')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/uploaded voice preview ready for guided routing/i)).toBeInTheDocument();
  });

  it('supports file and image intake with a preview upload', async () => {
    render(<TryGrindctrlSandbox />);

    fireEvent.click(screen.getByRole('button', { name: /file\/image intake/i }));
    const input = screen.getByLabelText(/upload file or image/i) as HTMLInputElement;
    const file = new File(['invoice total due'], 'invoice.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /generate workflow preview/i }));

    expect(await screen.findByText(/file_image_intake/i)).toBeInTheDocument();
    expect(screen.getByText('invoice.txt')).toBeInTheDocument();
    expect(screen.getByText(/ready to unlock: save, deploy, sync, and export/i)).toBeInTheDocument();
  });

  it('blocks the fourth guided preview locally', async () => {
    render(<TryGrindctrlSandbox />);

    const prompt = screen.getByLabelText(/process description/i);
    const generate = screen.getByRole('button', { name: /generate workflow preview/i });
    fireEvent.change(prompt, { target: { value: 'Build an AI inbox and escalation workflow.' } });

    fireEvent.click(generate);
    await waitFor(() => expect(screen.getByText(/workflow_planner/i)).toBeInTheDocument());

    fireEvent.click(generate);
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem('gc-landing-guided-preview-runs-v1') || '[]')).toHaveLength(2),
    );
    fireEvent.click(generate);
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem('gc-landing-guided-preview-runs-v1') || '[]')).toHaveLength(3),
    );
    fireEvent.click(generate);

    expect(screen.getByText(/completed today's guided previews/i)).toBeInTheDocument();
  });
});
