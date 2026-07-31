import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIGNED_IN_PATH,
  resolveSignInDestination,
  safeRedirectPath,
} from './redirect';

describe('safeRedirectPath', () => {
  it('accepts a same-site absolute path', () => {
    expect(safeRedirectPath('/dashboard/leads')).toBe('/dashboard/leads');
    expect(safeRedirectPath('/dashboard/try-on?shop=a.myshopify.com')).toBe(
      '/dashboard/try-on?shop=a.myshopify.com',
    );
  });

  it('rejects an absolute URL to another origin', () => {
    // redirect_url comes from the query string, so it is attacker-controlled.
    expect(safeRedirectPath('https://evil.example/steal')).toBeNull();
    expect(safeRedirectPath('http://evil.example')).toBeNull();
  });

  it('rejects protocol-relative URLs', () => {
    // Browsers read "//evil.example" as a host, not a path. This is the
    // open-redirect people miss when they only check for a leading slash.
    expect(safeRedirectPath('//evil.example')).toBeNull();
    expect(safeRedirectPath('///evil.example')).toBeNull();
  });

  it('rejects backslash variants some parsers normalise to a slash', () => {
    expect(safeRedirectPath('/\\evil.example')).toBeNull();
    expect(safeRedirectPath('/\\/evil.example')).toBeNull();
  });

  it('rejects control characters used to smuggle a scheme', () => {
    expect(safeRedirectPath('/\nhttps://evil.example')).toBeNull();
    expect(safeRedirectPath('/\thttps://evil.example')).toBeNull();
  });

  it('rejects anything that is not a string', () => {
    for (const bad of [undefined, null, 42, {}, []]) {
      expect(safeRedirectPath(bad)).toBeNull();
    }
  });
});

describe('resolveSignInDestination', () => {
  it('honours a safe redirect_url so the user reaches the page they wanted', () => {
    expect(resolveSignInDestination('/dashboard/leads')).toBe('/dashboard/leads');
  });

  it('falls back to the dashboard when redirect_url is absent', () => {
    expect(resolveSignInDestination(undefined)).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it('falls back to the dashboard rather than following a hostile redirect', () => {
    expect(resolveSignInDestination('https://evil.example')).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(resolveSignInDestination('//evil.example')).toBe(DEFAULT_SIGNED_IN_PATH);
  });
});
