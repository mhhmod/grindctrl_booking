import { describe, expect, it } from 'vitest';
import { formatMmSs } from './i18n';

describe('formatMmSs', () => {
  it('formats seconds under a minute as 0:ss', () => {
    expect(formatMmSs(42)).toBe('0:42');
  });

  it('formats minutes and pads seconds', () => {
    expect(formatMmSs(125)).toBe('2:05');
  });

  it('clamps negative values to zero', () => {
    expect(formatMmSs(-5)).toBe('0:00');
  });
});
