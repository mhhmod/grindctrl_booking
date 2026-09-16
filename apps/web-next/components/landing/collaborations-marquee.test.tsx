import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/theme-provider';
import { CollaborationsMarquee } from '@/components/landing/collaborations-marquee';
import type { IntegrationStateLabels } from '@/components/landing/collaborations-marquee';

const nextThemesProvider = vi.hoisted(() => vi.fn());

vi.mock('next-themes', () => ({
  ThemeProvider: (props: { children: React.ReactNode }) => {
    nextThemesProvider(props);
    return props.children;
  },
}));

describe('CollaborationsMarquee theming', () => {
  const labels: IntegrationStateLabels = {
    implemented: 'Implemented',
    'setup-required': 'Setup required',
    'evidence-required': 'Evidence required',
    planned: 'Planned',
    infrastructure: 'Infrastructure',
  };

  it('switches the theme without transitioning chips through the opposite theme color', () => {
    const { container } = render(
      <ThemeProvider>
        <CollaborationsMarquee labels={labels} />
      </ThemeProvider>,
    );

    expect(container.querySelectorAll('[class~="bg-card/70"]')).toHaveLength(12);
    expect(nextThemesProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        attribute: 'class',
        defaultTheme: 'light',
        disableTransitionOnChange: true,
        enableSystem: false,
      }),
    );
  });

  it('shows relationship depth without presenting every logo as implemented', () => {
    const { getAllByText } = render(<CollaborationsMarquee labels={labels} />);

    expect(getAllByText('Implemented').length).toBeGreaterThan(0);
    expect(getAllByText('Setup required').length).toBeGreaterThan(0);
    expect(getAllByText('Planned').length).toBeGreaterThan(0);
    expect(getAllByText('Infrastructure').length).toBeGreaterThan(0);
  });

  it('keeps every integration in a static wrapping semantic list', () => {
    render(<CollaborationsMarquee labels={labels} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(12);
    expect(screen.getByRole('list')).toHaveClass('flex-wrap');
    expect(screen.getByText('Shopify')).toBeVisible();
    expect(screen.getByText('Supabase')).toBeVisible();
  });
});
