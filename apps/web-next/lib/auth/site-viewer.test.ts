import { describe, expect, it } from 'vitest';
import { siteViewerFromUser, SIGNED_IN_HOME } from './site-viewer';

describe('siteViewerFromUser', () => {
  it('keeps only what the header draws: initials and a photo address', () => {
    const viewer = siteViewerFromUser({
      firstName: 'mahmoud',
      lastName: 'sabry',
      hasImage: true,
      imageUrl: 'https://img.clerk.com/abc',
      primaryEmailAddress: { emailAddress: 'owner@example.com' },
    });
    expect(viewer).toEqual({ signedIn: true, initials: 'MS', imageUrl: 'https://img.clerk.com/abc' });
    expect(JSON.stringify(viewer)).not.toContain('example.com');
  });

  it('uses Arabic names whole, and falls back to the email initial', () => {
    expect(siteViewerFromUser({ firstName: 'محمود', lastName: null })).toMatchObject({ initials: 'م' });
    expect(siteViewerFromUser({ primaryEmailAddress: { emailAddress: 'sara@example.com' } })).toMatchObject({ initials: 'S' });
  });

  it('skips Clerk’s generated placeholder and anything not https', () => {
    expect(siteViewerFromUser({ firstName: 'A', hasImage: false, imageUrl: 'https://img.clerk.com/default' })).toMatchObject({ imageUrl: null });
    expect(siteViewerFromUser({ firstName: 'A', hasImage: true, imageUrl: 'javascript:alert(1)' })).toMatchObject({ imageUrl: null });
  });

  it('is still signed in when the user could not be read', () => {
    expect(siteViewerFromUser(null)).toEqual({ signedIn: true, initials: null, imageUrl: null });
  });

  it('sends signed-in CTAs to the dashboard', () => {
    expect(SIGNED_IN_HOME).toBe('/dashboard');
  });
});
