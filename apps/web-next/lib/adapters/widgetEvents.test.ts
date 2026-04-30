import { describe, expect, it } from 'vitest';
import { normalizeWidgetEventsWindow } from '@/lib/adapters/widgetEvents';

describe('widgetEvents adapter', () => {
  it('normalizes supported chart windows', () => {
    expect(normalizeWidgetEventsWindow('24h')).toBe('24h');
    expect(normalizeWidgetEventsWindow('7d')).toBe('7d');
    expect(normalizeWidgetEventsWindow('30d')).toBe('30d');
  });

  it('falls back to 7d for invalid values', () => {
    expect(normalizeWidgetEventsWindow('')).toBe('7d');
    expect(normalizeWidgetEventsWindow('90d')).toBe('7d');
    expect(normalizeWidgetEventsWindow(undefined)).toBe('7d');
    expect(normalizeWidgetEventsWindow(null)).toBe('7d');
  });

  it('handles array-shaped search params', () => {
    expect(normalizeWidgetEventsWindow(['30d', '7d'])).toBe('30d');
    expect(normalizeWidgetEventsWindow(['nope'])).toBe('7d');
  });
});
