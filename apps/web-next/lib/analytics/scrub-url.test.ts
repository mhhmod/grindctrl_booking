import { describe, expect, it } from 'vitest';
import { scrubUrl } from './scrub-url';

describe('scrubUrl', () => {
  it('removes the token param but keeps everything else', () => {
    expect(scrubUrl('https://app.example.com/claim?token=abc123&foo=bar')).toBe(
      'https://app.example.com/claim?foo=bar',
    );
  });

  it('removes redirect_url too, including its own encoded token', () => {
    expect(
      scrubUrl('https://app.example.com/sign-in?redirect_url=%2Fclaim%3Ftoken%3Dabc&next=/dashboard'),
    ).toBe('https://app.example.com/sign-in?next=%2Fdashboard');
  });

  it('leaves a URL without a scrubbed param unchanged, byte for byte', () => {
    const input = 'https://app.example.com/dashboard/messenger?tab=overview';
    expect(scrubUrl(input)).toBe(input);
  });

  it('strips a token from a bare relative pathname', () => {
    expect(scrubUrl('/claim?token=abc123')).toBe('/claim');
  });

  it('removes storefront capability material from a fragment', () => {
    expect(
      scrubUrl(
        'https://app.example.com/embed/try-on?product=tee#storefrontContext=header.payload.signature&storefrontNonce=abcdefghijklmnopqrstuvwx&panel=upload',
      ),
    ).toBe('https://app.example.com/embed/try-on?product=tee#panel=upload');
  });

  it('removes an all-secret storefront fragment completely', () => {
    expect(
      scrubUrl(
        '/embed/try-on#storefrontContext=header.payload.signature&storefrontNonce=abcdefghijklmnopqrstuvwx',
      ),
    ).toBe('/embed/try-on');
  });

  it('returns a non-URL string unchanged', () => {
    expect(scrubUrl('not a url at all')).toBe('not a url at all');
  });
});
