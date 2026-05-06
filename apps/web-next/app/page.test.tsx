import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from '@/app/page';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock('@/components/landing/hero-workflow-preview', () => ({
  HeroWorkflowPreview: () => <div>Hero workflow preview</div>,
}));

vi.mock('@/components/landing/try-grindctrl-sandbox', () => ({
  TryGrindctrlSandbox: () => <section data-testid="try-grindctrl-sandbox">AI playground</section>,
}));

vi.mock('@/components/landing/landing-after-playground-sections', () => ({
  LandingAfterPlaygroundSections: () => <section>After playground sections</section>,
}));

describe('LandingPage', () => {
  it('shows Try-On nav and places the Try-On showcase before the playground', () => {
    const { container } = render(<LandingPage />);

    expect(screen.getByRole('link', { name: 'Try-On' })).toHaveAttribute('href', '#try-on-agent');
    expect(screen.getByRole('heading', {
      name: 'Let shoppers preview products on themselves before they buy.',
    })).toBeInTheDocument();

    const showcase = container.querySelector('#try-on-agent');
    const playground = screen.getByTestId('try-grindctrl-sandbox');

    expect(showcase).toBeInTheDocument();
    expect(showcase?.compareDocumentPosition(playground) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
