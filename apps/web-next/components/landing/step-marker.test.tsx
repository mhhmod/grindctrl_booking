import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Shirt } from 'lucide-react';
import { StepMarker } from '@/components/landing/step-marker';

describe('StepMarker', () => {
  it('renders the step number as two digits', () => {
    render(<StepMarker index={0} icon={Shirt} />);
    expect(screen.getByText('01')).toBeInTheDocument();
  });

  it('counts from one, not zero', () => {
    render(<StepMarker index={2} icon={Shirt} />);
    expect(screen.getByText('03')).toBeInTheDocument();
  });

  /* The numeral is decorative — the ordered list already conveys sequence to
     assistive tech, so announcing "01" again is noise. */
  it('hides the decorative numeral from assistive technology', () => {
    const { container } = render(<StepMarker index={0} icon={Shirt} />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
