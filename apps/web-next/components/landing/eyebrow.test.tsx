import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Eyebrow } from '@/components/landing/eyebrow';

describe('Eyebrow', () => {
  it('uses uppercase and wide tracking in English', () => {
    render(<Eyebrow locale="en">How it works</Eyebrow>);

    const el = screen.getByText('How it works');
    expect(el.className).toContain('uppercase');
    expect(el.className).toContain('tracking-[0.16em]');
  });

  /* Arabic is cursive. Letter-spacing breaks the joins between glyphs and
     inflates the measured width, which is what pushed these strings past the
     viewport at 320px. Uppercase is meaningless for Arabic script. */
  it('drops uppercase and tracking in Arabic', () => {
    render(<Eyebrow locale="ar">كيف تعمل</Eyebrow>);

    const el = screen.getByText('كيف تعمل');
    expect(el.className).not.toContain('uppercase');
    expect(el.className).not.toContain('tracking-');
  });

  /* Pins the deliberate size bump: text-xs (12px) must win over the base
     text-[11px] via twMerge. Guards against class-ordering changes silently
     flipping this back to 11px. */
  it('bumps Arabic to text-xs, overriding the base text-[11px]', () => {
    render(<Eyebrow locale="ar">كيف تعمل</Eyebrow>);

    const el = screen.getByText('كيف تعمل');
    expect(el.className).toContain('text-xs');
    expect(el.className).not.toContain('text-[11px]');
  });

  it('allows callers to add classes without losing the base ones', () => {
    render(<Eyebrow locale="en" className="mb-4">Pricing</Eyebrow>);

    const el = screen.getByText('Pricing');
    expect(el.className).toContain('mb-4');
    expect(el.className).toContain('text-muted-foreground');
  });
});
