import { describe, expect, it } from 'vitest';
import { toSpeechText } from './speech-text';

describe('toSpeechText', () => {
  it('leaves plain text with no links untouched', () => {
    expect(toSpeechText('Just a normal reply.', 'en')).toBe('Just a normal reply.');
  });

  it('replaces a bare /try-on mention with a spoken phrase', () => {
    expect(toSpeechText('Try it at /try-on today.', 'en')).toBe('Try it at the try-on page today.');
  });

  it('replaces a bare /pricing mention with a spoken phrase', () => {
    expect(toSpeechText('See /pricing for plans.', 'en')).toBe('See the pricing page for plans.');
  });

  it('replaces the booking URL with a spoken phrase', () => {
    expect(toSpeechText('Book at https://calendar.app.google/ts89YZLki5MBw9tH9.', 'en')).toBe(
      'Book at the booking link.',
    );
  });

  it('uses Arabic phrases when the voice locale is Arabic', () => {
    expect(toSpeechText('راجع /pricing من فضلك.', 'ar')).toBe('راجع صفحة الأسعار من فضلك.');
  });

  it('speaks a human-authored link label as-is instead of replacing it', () => {
    const segments = toSpeechText('راجع <a href="/pricing">التسعير</a> هنا.', 'ar');
    expect(segments).toBe('راجع التسعير هنا.');
  });

  it('falls back to a generic phrase for an unrecognized external URL', () => {
    expect(toSpeechText('See https://example.com/x for details.', 'en')).toBe('See the link for details.');
  });
});
