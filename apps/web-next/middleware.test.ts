import { describe, expect, it } from 'vitest';
import { config } from './middleware';

/* The matcher's negative-lookahead pattern is the single source of truth for
   which routes run Clerk's middleware. This exact bug shipped once already:
   /api/shopify/* was excluded (cookie-less third-party context) but the
   embedded app's own page tree at /shopify/* was not, so Clerk's
   cross-domain handshake ran inside the Shopify iframe and broke it
   ("admin.shopify.com refused to connect"). A regex string with no test
   coverage is exactly the kind of thing that regresses silently when
   someone adds the next cookie-less route and forgets this list. */
const [pattern] = config.matcher;
const matcher = new RegExp(`^${pattern}$`);

describe('middleware matcher', () => {
  it('excludes the embedded Shopify app page tree from Clerk', () => {
    expect(matcher.test('/shopify/app')).toBe(false);
    expect(matcher.test('/shopify/app/anything')).toBe(false);
  });

  it('excludes the Shopify API route handlers from Clerk', () => {
    expect(matcher.test('/api/shopify/store-chat/draft')).toBe(false);
  });

  it('excludes the storefront embed and try-on API from Clerk', () => {
    expect(matcher.test('/embed/messenger')).toBe(false);
    expect(matcher.test('/api/try-on/generate')).toBe(false);
  });

  it('excludes static files (paths containing a dot)', () => {
    expect(matcher.test('/favicon.ico')).toBe(false);
  });

  it('still runs Clerk on the dashboard, which genuinely needs it', () => {
    expect(matcher.test('/dashboard/messenger')).toBe(true);
  });
});
