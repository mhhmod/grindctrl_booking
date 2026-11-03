import React from 'react';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';
import { V16PageSkeleton } from './skeletons';

describe('V16PageSkeleton', () => {
  it.each([
    ['en', 'today', 'Loading'],
    ['en', 'tabs', 'Loading'],
    ['en', 'card', 'Loading'],
    ['ar', 'today', 'جارٍ التحميل'],
    ['ar', 'tabs', 'جارٍ التحميل'],
  ] as const)('tells a screen reader once that the %s page (%s) is loading', (locale, variant, text) => {
    const { container } = render(<V16PageSkeleton locale={locale} variant={variant} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent(text);
    // The shapes are decoration: hidden from assistive technology.
    expect(container.querySelector('[aria-hidden="true"]')?.children.length).toBeGreaterThan(0);
  });
});
