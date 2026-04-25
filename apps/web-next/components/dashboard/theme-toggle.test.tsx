import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';

const setTheme = vi.fn();
let resolvedTheme = 'dark';

vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme,
    setTheme,
  }),
}));

describe('ThemeToggle', () => {
  it('switches from dark to light using an accessible button', () => {
    resolvedTheme = 'dark';
    setTheme.mockClear();

    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));

    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('switches from light to dark using an accessible button', () => {
    resolvedTheme = 'light';
    setTheme.mockClear();

    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));

    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});
