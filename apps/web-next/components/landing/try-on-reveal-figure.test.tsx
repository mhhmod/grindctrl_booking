import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TryOnRevealFigure } from '@/components/landing/try-on-reveal-figure';

const CAPTION = 'See it on before you buy';
const ALT = 'A scan sweeps a shopper silhouette, showing the garment being fitted.';

function renderFigure() {
  return render(<TryOnRevealFigure caption={CAPTION} alt={ALT} />);
}

describe('TryOnRevealFigure', () => {
  /* Nothing here is operable, so the message has to survive entirely without
     motion. This is the whole accessibility argument for making it passive. */
  it('states the outcome in text for assistive technology', () => {
    renderFigure();

    expect(screen.getByRole('figure', { name: /scan sweeps a shopper silhouette/i }))
      .toBeInTheDocument();
  });

  it('shows the caption', () => {
    renderFigure();
    expect(screen.getByText(CAPTION)).toBeInTheDocument();
  });

  /* Every moving part is decorative. The figure's own accessible name carries
     the meaning, so announcing the silhouette or the sparkle again would be
     noise to a screen reader. */
  it('hides every decorative layer from assistive technology', () => {
    const { container } = renderFigure();

    const decorative = container.querySelectorAll('span[aria-hidden="true"], svg');
    expect(decorative.length).toBeGreaterThan(0);

    for (const el of Array.from(container.querySelectorAll('svg'))) {
      expect(el.getAttribute('aria-hidden')).toBe('true');
    }
  });

  /* The scan motif is what makes this read as AI processing a photo rather
     than as a clothing brand, and it is shared with the Shopify button. If the
     beam or the badge disappears, the figure has lost its point. */
  it('renders the shared scan choreography', () => {
    const { container } = renderFigure();

    expect(container.querySelector('.gc-scan-badge'), 'gradient shine').not.toBeNull();
    expect(container.querySelector('.gc-scan-beam'), 'scan beam').not.toBeNull();
    expect(container.querySelector('.gc-scan-ring'), 'ring pulse').not.toBeNull();
    expect(container.querySelector('.gc-scan-spark'), 'sparkle').not.toBeNull();
  });

  /* The beam is clipped to the silhouette so it lights the person rather than
     sweeping the whole badge. Losing the clip is a silent visual regression. */
  it('clips the beam to the silhouette', () => {
    const { container } = renderFigure();

    const clipped = container.querySelector('g[clip-path]');
    expect(clipped).not.toBeNull();
    expect(clipped?.querySelector('.gc-scan-beam')).not.toBeNull();
  });
});
