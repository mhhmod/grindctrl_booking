import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/theme-provider';
import { CollaborationsMarquee } from '@/components/landing/collaborations-marquee';

const nextThemesProvider = vi.hoisted(() => vi.fn());

vi.mock('next-themes', () => ({
  ThemeProvider: (props: { children: React.ReactNode }) => {
    nextThemesProvider(props);
    return props.children;
  },
}));

describe('CollaborationsMarquee theming', () => {
  it('switches the theme without transitioning chips through the opposite theme color', () => {
    const { container } = render(
      <ThemeProvider>
        <CollaborationsMarquee />
      </ThemeProvider>,
    );

    expect(container.querySelectorAll('[class~="bg-card/70"]')).toHaveLength(24);
    expect(nextThemesProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        attribute: 'class',
        defaultTheme: 'light',
        disableTransitionOnChange: true,
        enableSystem: false,
      }),
    );
  });
});
