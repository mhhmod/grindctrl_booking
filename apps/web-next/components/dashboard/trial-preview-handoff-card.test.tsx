import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrialPreviewHandoffCard } from '@/components/dashboard/trial-preview-handoff-card';
import {
  LANDING_PREVIEW_STORAGE_KEY,
  saveLandingPreviewHandoff,
} from '@/lib/trial/landing-preview-handoff';

function seedValidPreview() {
  saveLandingPreviewHandoff({
    source: 'landing_sandbox',
    mode: 'workflow',
    workflowSlug: 'workflow_planner',
    summary: 'Route support tickets and leads.',
    confidence: 91,
    extractedEntities: { owner: 'support_ops' },
    decision: {
      route: 'support_and_ops_routing',
      priority: 'medium',
      handoffRequired: false,
    },
    recommendedAction: 'Start a 14-day trial to save this preview.',
  });
}

describe('TrialPreviewHandoffCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('renders preview card with valid handoff data', async () => {
    seedValidPreview();

    render(<TrialPreviewHandoffCard />);

    expect(await screen.findByText(/your first ai workflow preview is ready/i)).toBeInTheDocument();
    expect(screen.getByText(/workflow_planner/i)).toBeInTheDocument();
    expect(screen.getByText(/route support tickets and leads/i)).toBeInTheDocument();
    expect(screen.getByText(/91% confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/support_and_ops_routing/i)).toBeInTheDocument();
    expect(screen.getByText(/medium/i)).toBeInTheDocument();
    expect(screen.getByText(/^no$/i)).toBeInTheDocument();
    expect(screen.getByText(/start a 14-day trial to save this preview/i)).toBeInTheDocument();
  });

  it('handles malformed localStorage and renders empty state', async () => {
    window.localStorage.setItem(LANDING_PREVIEW_STORAGE_KEY, JSON.stringify({ bad: true }));

    render(<TrialPreviewHandoffCard />);

    expect(await screen.findByText(/start with a guided ai workflow preview/i)).toBeInTheDocument();
    expect(window.localStorage.getItem(LANDING_PREVIEW_STORAGE_KEY)).toBeNull();
  });

  it('changes label after save to trial review click', async () => {
    seedValidPreview();
    render(<TrialPreviewHandoffCard />);

    const saveButton = await screen.findByRole('button', { name: /save to trial review/i });
    fireEvent.click(saveButton);

    const savedButton = screen.getByRole('button', { name: /saved for trial review/i });
    expect(savedButton).toBeDisabled();
  });

  it('renders empty state when no preview exists', async () => {
    render(<TrialPreviewHandoffCard />);

    expect(await screen.findByText(/start with a guided ai workflow preview/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /try playground/i })).toHaveAttribute('href', '/#try-grindctrl');
    expect(screen.getByRole('link', { name: /request implementation plan/i })).toHaveAttribute('href', '/dashboard/implementation');
  });

  it('falls back safely when localStorage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage_unavailable');
    });

    render(<TrialPreviewHandoffCard />);

    expect(await screen.findByText(/start with a guided ai workflow preview/i)).toBeInTheDocument();
  });
});
