import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT } from './system-prompt';
import { BOOKING_URL } from '@/lib/booking';

describe('SYSTEM_PROMPT', () => {
  it('instructs the model to mirror the visitor\'s language', () => {
    expect(SYSTEM_PROMPT).toMatch(/same language/i);
  });

  it('includes the real booking link, not a placeholder', () => {
    expect(SYSTEM_PROMPT).toContain(BOOKING_URL);
  });

  it('names GrindCTRL\'s actual product so replies stay grounded', () => {
    expect(SYSTEM_PROMPT).toMatch(/try-on/i);
    expect(SYSTEM_PROMPT).toMatch(/Shopify/i);
  });

  it('forbids HTML and markdown link syntax, requiring bare addresses instead', () => {
    expect(SYSTEM_PROMPT).toMatch(/never HTML tags/i);
    expect(SYSTEM_PROMPT).toMatch(/never markdown/i);
  });
});
