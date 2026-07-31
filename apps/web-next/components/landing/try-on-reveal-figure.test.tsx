import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TryOnRevealFigure } from '@/components/landing/try-on-reveal-figure';

describe('TryOnRevealFigure', () => {
  /* The animation replaced an interactive slider. Nothing is operable now, so
     the message has to survive entirely without motion — this is the whole
     accessibility argument for making it passive. */
  it('states the outcome in text for assistive technology', () => {
    render(
      <TryOnRevealFigure
        caption="See it on before you buy"
        alt="A cream ringer T-shirt appears on a shopper."
        productSrc="/try-on/mock-product.png"
        resultSrc="/try-on/mock-result.png"
      />,
    );

    expect(
      screen.getByRole('figure', { name: /cream ringer t-shirt appears on a shopper/i }),
    ).toBeInTheDocument();
  });

  it('shows the caption', () => {
    render(
      <TryOnRevealFigure
        caption="See it on before you buy"
        alt="A cream ringer T-shirt appears on a shopper."
        productSrc="/try-on/mock-product.png"
        resultSrc="/try-on/mock-result.png"
      />,
    );

    expect(screen.getByText('See it on before you buy')).toBeInTheDocument();
  });

  /* The decorative layers must not be announced twice — the figure's own
     accessible name already carries the message. */
  it('marks the image layers decorative', () => {
    const { container } = render(
      <TryOnRevealFigure
        caption="See it on before you buy"
        alt="A cream ringer T-shirt appears on a shopper."
        productSrc="/try-on/mock-product.png"
        resultSrc="/try-on/mock-result.png"
      />,
    );

    for (const img of Array.from(container.querySelectorAll('img'))) {
      expect(img.getAttribute('alt')).toBe('');
    }
  });
});
