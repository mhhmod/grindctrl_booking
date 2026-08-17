import { describe, expect, it } from 'vitest';
import { linkifyMessage } from './linkify';

describe('linkifyMessage', () => {
  it('returns plain text untouched when there is nothing to link', () => {
    expect(linkifyMessage('Just a normal reply.')).toEqual([{ type: 'text', value: 'Just a normal reply.' }]);
  });

  it('linkifies an absolute URL and strips trailing punctuation from the href', () => {
    const segments = linkifyMessage('Book a call: https://calendar.app.google/abc123.');

    expect(segments).toEqual([
      { type: 'text', value: 'Book a call: ' },
      { type: 'link', href: 'https://calendar.app.google/abc123', label: 'https://calendar.app.google/abc123', external: true },
      { type: 'text', value: '.' },
    ]);
  });

  it('linkifies the known internal paths', () => {
    const segments = linkifyMessage('Try the demo at /try-on or see /pricing.');

    expect(segments).toEqual([
      { type: 'text', value: 'Try the demo at ' },
      { type: 'link', href: '/try-on', label: '/try-on', external: false },
      { type: 'text', value: ' or see ' },
      { type: 'link', href: '/pricing', label: '/pricing', external: false },
      { type: 'text', value: '.' },
    ]);
  });

  it('handles both an absolute URL and an internal path in the same message', () => {
    const segments = linkifyMessage('Book here: https://calendar.app.google/abc123 or try /try-on first.');

    expect(segments).toEqual([
      { type: 'text', value: 'Book here: ' },
      { type: 'link', href: 'https://calendar.app.google/abc123', label: 'https://calendar.app.google/abc123', external: true },
      { type: 'text', value: ' or try ' },
      { type: 'link', href: '/try-on', label: '/try-on', external: false },
      { type: 'text', value: ' first.' },
    ]);
  });

  it('does not treat a bare word containing "pricing" as a path', () => {
    expect(linkifyMessage('Our pricing model is simple.')).toEqual([
      { type: 'text', value: 'Our pricing model is simple.' },
    ]);
  });

  it('unwraps a literal <a href> the model emitted despite being told not to', () => {
    const segments = linkifyMessage('Try it at <a href="/try-on">/try-on</a> today.');

    expect(segments).toEqual([
      { type: 'text', value: 'Try it at ' },
      { type: 'link', href: '/try-on', label: '/try-on', external: false },
      { type: 'text', value: ' today.' },
    ]);
  });

  it('unwraps an HTML anchor whose visible label differs from its href (e.g. Arabic label)', () => {
    const segments = linkifyMessage('راجع <a href="/pricing">التسعير</a> هنا.');

    expect(segments).toEqual([
      { type: 'text', value: 'راجع ' },
      { type: 'link', href: '/pricing', label: 'التسعير', external: false },
      { type: 'text', value: ' هنا.' },
    ]);
  });

  it('unwraps an HTML anchor around an absolute URL', () => {
    const segments = linkifyMessage('Book at <a href="https://calendar.app.google/abc123">this link</a>.');

    expect(segments).toEqual([
      { type: 'text', value: 'Book at ' },
      { type: 'link', href: 'https://calendar.app.google/abc123', label: 'this link', external: true },
      { type: 'text', value: '.' },
    ]);
  });

  it('strips a trailing Arabic question mark from an absolute URL', () => {
    const segments = linkifyMessage('احجز عبر https://calendar.app.google/abc123؟');

    expect(segments).toEqual([
      { type: 'text', value: 'احجز عبر ' },
      { type: 'link', href: 'https://calendar.app.google/abc123', label: 'https://calendar.app.google/abc123', external: true },
      { type: 'text', value: '؟' },
    ]);
  });

  it('refuses to linkify an unsafe href scheme, keeping the visible label as plain text', () => {
    expect(linkifyMessage('Click <a href="javascript:alert(1)">here</a>.')).toEqual([
      { type: 'text', value: 'Click ' },
      { type: 'text', value: 'here' },
      { type: 'text', value: '.' },
    ]);
  });
});
