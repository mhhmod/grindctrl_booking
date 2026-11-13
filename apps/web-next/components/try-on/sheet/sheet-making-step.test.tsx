// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getSheetCopy } from '@/lib/try-on/sheet-copy';
import { makingProgress } from '@/lib/try-on/making-progress';
import { SheetMakingStep } from './sheet-making-step';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe('the wait for a real look', () => {
  it.each(['en', 'ar'] as const)('reassures after the estimate in %s while keeping the photo and active motion', (locale) => {
    const copy = getSheetCopy(locale);
    const { container } = render(
      <SheetMakingStep
        copy={copy}
        photoDataUrl="data:image/jpeg;base64,cGhvdG8="
        piece={{ name: 'Shirt', imageUrl: 'https://cdn.shopify.com/shirt.jpg' }}
        steps={copy.makingSteps}
        progress={makingProgress({ elapsedMs: 40_000, estimateSeconds: 30, stepCount: 3, stage: 'making' })}
      />,
    );
    expect(screen.getByAltText(copy.yourPhotoAlt)).toBeVisible();
    expect(screen.getByText(copy.makingAlmostThere)).toBeVisible();
    expect(screen.queryByText(copy.secondsLeft(1))).not.toBeInTheDocument();
    expect(screen.queryByText(copy.lookReady)).not.toBeInTheDocument();
    expect(container.querySelector('[aria-current="step"]')).toHaveTextContent(copy.makingSteps[1]);
    expect(container.querySelector('.gc-anim-scan')).toHaveClass('motion-reduce:hidden');
    expect(container.querySelector('[style*="width"]')).toHaveClass('motion-safe:animate-pulse');
  });
});

describe('the merchant loading animation on the storefront', () => {
  it.each(['en', 'ar'] as const)('distinguishes all three styles while keeping real stages and reduced motion (%s)', (locale) => {
    const copy = getSheetCopy(locale, 'everyone');
    for (const loadingStyle of ['steps', 'pulse', 'bar'] as const) {
      const { container, unmount } = render(<SheetMakingStep inline copy={copy} loadingStyle={loadingStyle}
        photoDataUrl="data:image/png;base64,AA" piece={{ name: 'Abaya', imageUrl: 'https://cdn.shopify.com/abaya.jpg' }}
        steps={copy.makingSteps} progress={makingProgress({ elapsedMs: 5000, estimateSeconds: 20, stepCount: 3, stage: 'making', acceptedElapsedMs: 1000 })} />);
      expect(container.querySelector('[data-loading-style]')).toHaveAttribute('data-loading-style', loadingStyle);
      expect(screen.getByRole('heading', { name: copy.makingTitle })).toBeInTheDocument();
      expect(Boolean(screen.queryByRole('list'))).toBe(loadingStyle === 'steps');
      expect(Boolean(container.querySelector('[data-making-bar]'))).toBe(loadingStyle !== 'pulse');
      expect(Boolean(container.querySelector('.gc-anim-scan'))).toBe(loadingStyle === 'steps');
      expect(screen.getByRole('img', { name: 'Abaya' }).className.includes('motion-safe:animate-pulse')).toBe(loadingStyle === 'pulse');
      if (loadingStyle === 'bar') expect(container.querySelector('[data-making-bar]')).toHaveClass('h-2.5');
      expect(container.textContent).toContain(copy.makingSteps[1]);
      // No invented measured percentage or premature completion.
      expect(container.textContent).not.toContain('%');
      unmount();
    }
  });
});
