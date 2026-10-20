// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SheetCompareSlider } from './sheet-compare-slider';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

/* TryOn-Desktop's before and after slider: dragged, moved with the arrow
   keys or placed with a click, and labelled for screen readers. */
function renderSlider(rtl = false) {
  render(
    <SheetCompareSlider
      photoSrc="data:image/png;base64,cGhvdG8="
      lookSrc="data:image/png;base64,bG9vaw=="
      label="Drag to compare your photo and the look"
      photoLabel="Your photo"
      lookLabel="Your look"
      lookAlt="You wearing the Layla Embroidered Abaya"
      photoAlt="Your original photo"
      aiPreview="AI preview"
      rtl={rtl}
    />,
  );
  return screen.getByRole('slider', { name: 'Drag to compare your photo and the look' });
}

describe('the before and after slider', () => {
  it('moves with the arrow keys, and jumps to either end', () => {
    const slider = renderSlider();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '55');
    fireEvent.keyDown(slider, { key: 'ArrowLeft', shiftKey: true });
    expect(slider).toHaveAttribute('aria-valuenow', '35');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
  });

  it('moves the way the arrow points in Arabic too, with the photo on the right', () => {
    const slider = renderSlider(true);
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '45');
    expect(slider.parentElement!.style.left).toBe('55%');
  });

  it('follows a click or a drag across the frame', () => {
    const slider = renderSlider();
    const frame = slider.closest('.aspect-\\[3\\/4\\]') as HTMLElement;
    frame.getBoundingClientRect = () => ({ left: 100, width: 400, top: 0, height: 533, right: 500, bottom: 533, x: 100, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(frame, { clientX: 400, pointerId: 1 });
    expect(slider).toHaveAttribute('aria-valuenow', '75');
    fireEvent.pointerMove(frame, { clientX: 200, pointerId: 1 });
    expect(slider).toHaveAttribute('aria-valuenow', '25');
    fireEvent.pointerUp(frame, { pointerId: 1 });
    fireEvent.pointerMove(frame, { clientX: 450, pointerId: 1 });
    expect(slider).toHaveAttribute('aria-valuenow', '25');
  });
});
