import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TryGrindctrlSandbox } from '@/components/landing/try-grindctrl-sandbox';

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
    expect(screen.getAllByRole('link', { name: /start 14-day trial/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('supports voice lead capture without calling fetch', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    render(<TryGrindctrlSandbox />);

    fireEvent.click(screen.getByRole('button', { name: /voice lead capture/i }));
    fireEvent.change(screen.getByLabelText(/voice transcript/i), {
      target: { value: 'Dental clinic needs missed-call lead capture for urgent appointment requests.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate workflow preview/i }));

    expect(await screen.findByText(/voice_lead_capture/i)).toBeInTheDocument();
    expect(screen.getAllByText(/lead_capture/i).length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
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
