// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makingProgress } from '@/lib/try-on/making-progress';
import { getSheetCopy } from '@/lib/try-on/sheet-copy';
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
