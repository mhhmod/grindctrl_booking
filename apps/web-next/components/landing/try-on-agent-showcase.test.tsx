import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TryOnAgentShowcase } from '@/components/landing/try-on-agent-showcase';

describe('TryOnAgentShowcase', () => {
  it('renders the try-on product story, workflow, state note, and CTA links', () => {
    render(<TryOnAgentShowcase />);

    expect(screen.getByText('AI visual sales for fashion')).toBeInTheDocument();
    expect(screen.getByRole('heading', {
      name: 'Let shoppers preview products on themselves before they buy.',
    })).toBeInTheDocument();
    expect(screen.getByText(/turn product curiosity into high-intent leads/i)).toBeInTheDocument();

    for (const step of [
      'Product selected',
      'Customer photo uploaded',
      'Demo preview generated',
      'Lead captured',
      'WhatsApp follow-up ready',
    ]) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }

    expect(screen.getAllByText('Premium Ringer Tee').length).toBeGreaterThan(0);
    for (const detail of [
      'cream/off-white body',
      'chocolate-brown ringer trim',
      'athletic/muscle-fit silhouette',
      'demo mode active',
    ]) {
      expect(screen.getByText(detail)).toBeInTheDocument();
    }

    for (const value of [
      'Reduce hesitation',
      'Capture high-intent leads',
      'Connect WhatsApp/CRM follow-up',
      'Embed on storefronts later',
    ]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }

    expect(screen.getByText(/Demo mode is available now/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /try the demo/i })).toHaveAttribute('href', '/try-on');
    expect(screen.getByRole('link', { name: /view dashboard/i })).toHaveAttribute('href', '/dashboard/try-on');
    expect(screen.getByRole('link', { name: /start business trial/i })).toHaveAttribute('href', '/sign-up');
  });
});
