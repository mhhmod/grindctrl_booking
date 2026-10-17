/* The v16 icon set stays in step with the boards: every board icon has a
   glyph (or is a brand mark), the board's own drawing is used where
   Hugeicons has no match, and only directional icons mirror in Arabic. */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DIRECTIONAL_ICONS, GC_ICONS, GcIcon, type GcIconName } from './icons';

const ICON_DIR = join(__dirname, '../docs/handoff/product-v16/assets/icons');
const boardIcons = readdirSync(ICON_DIR)
  .filter((file) => file.endsWith('.svg'))
  .map((file) => file.slice(0, -4));
const BRAND_MARKS = ['shopify', 'wa'];

describe('the v16 icon set', () => {
  it('has a glyph for every board icon except the brand marks', () => {
    expect(boardIcons.length).toBeGreaterThan(70);
    const missing = boardIcons.filter((name) => !(name in GC_ICONS) && !BRAND_MARKS.includes(name));
    expect(missing).toEqual([]);
  });

  it('names nothing the boards do not draw', () => {
    expect(Object.keys(GC_ICONS).filter((name) => !boardIcons.includes(name))).toEqual([]);
  });

  it('leaves the brand stand-ins out', () => {
    for (const name of BRAND_MARKS) expect(name in GC_ICONS).toBe(false);
  });

  it.each(['desk', 'story'] as const)('draws %s from the board file', (name) => {
    const board = readFileSync(join(ICON_DIR, `${name}.svg`), 'utf8');
    const { container } = render(<GcIcon name={name} />);
    for (const path of container.querySelectorAll('path')) {
      expect(board).toContain(`d="${path.getAttribute('d')}"`);
    }
    for (const circle of container.querySelectorAll('circle')) {
      expect(board).toContain(`<circle cx="${circle.getAttribute('cx')}" cy="${circle.getAttribute('cy')}" r="${circle.getAttribute('r')}"`);
    }
  });
});

describe('GcIcon', () => {
  it.each(['arrow', 'back', 'chev', 'chevl', 'send'] as const)('mirrors %s in Arabic', (name) => {
    const { container } = render(<GcIcon name={name} />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('rtl:-scale-x-100');
  });

  it.each(['flag', 'person', 'camera', 'check', 'bell', 'refresh'] as const)('leaves %s as drawn', (name) => {
    const { container } = render(<GcIcon name={name} />);
    expect(container.querySelector('svg')!.getAttribute('class') ?? '').not.toContain('scale-x');
  });

  it('marks only real icon names as directional', () => {
    for (const name of DIRECTIONAL_ICONS) expect(name in GC_ICONS).toBe(true);
  });

  it('is hidden from assistive tech next to its words', () => {
    const { container } = render(<GcIcon name="bell" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
  });

  it('carries its own name when it stands alone', () => {
    const { getByRole } = render(<GcIcon name="bell" label="Notifications" />);
    expect(getByRole('img', { name: 'Notifications' })).toBeTruthy();
  });

  it('keeps the caller class and the size', () => {
    const { container } = render(<GcIcon name={'send' satisfies GcIconName} size={16} className="text-gc-success" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('class')).toBe('rtl:-scale-x-100 text-gc-success');
    expect(svg.getAttribute('width')).toBe('16');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
  });
});
