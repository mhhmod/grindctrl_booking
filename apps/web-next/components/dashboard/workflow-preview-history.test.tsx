import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { WorkflowPreviewHistory } from '@/components/dashboard/workflow-preview-history';
import { saveLandingPreviewHandoff } from '@/lib/trial/landing-preview-handoff';

describe('WorkflowPreviewHistory', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders empty state when no preview exists', () => {
    render(<WorkflowPreviewHistory />);

    expect(screen.getByText(/no saved preview yet/i)).toBeInTheDocument();
  });

  it('renders latest preview when local handoff exists', () => {
    saveLandingPreviewHandoff({
      source: 'landing_sandbox',
      mode: 'workflow',
      workflowSlug: 'workflow_planner',
      summary: 'Support + leads routing summary.',
      confidence: 92,
      extractedEntities: { intent: 'support' },
      decision: {
        route: 'support_queue',
        priority: 'high',
        handoffRequired: true,
      },
      recommendedAction: 'Request implementation plan.',
    });

    render(<WorkflowPreviewHistory />);

    expect(screen.getByText(/workflow_planner/i)).toBeInTheDocument();
    expect(screen.getByText(/support \+ leads routing summary/i)).toBeInTheDocument();
    expect(screen.getByText(/92% confidence/i)).toBeInTheDocument();
  });
});
