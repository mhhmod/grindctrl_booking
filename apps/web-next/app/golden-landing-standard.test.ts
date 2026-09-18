/* Guards the "Golden Landing Standard" — see docs/golden-landing-standard.md
   and AGENTS.md's "Landing and marketing pages" section. These pages share
   one composition system on purpose (one wrapper, one container width, one
   small motion vocabulary); this file makes drift from that system a test
   failure instead of something only caught in review, or not at all — see
   golden-landing-standard.md's own history section for the /pricing eyebrow
   regression this whole suite exists to stop repeating.

   Source-text assertions, not rendering: several of these pages are async
   server components reading cookies()/headers(), which is awkward to
   render in vitest's jsdom environment and unnecessary — the facts checked
   here (which wrapper a file uses, which container class, which files
   exist) are all true or false in the source text itself. */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GOLDEN_PAGES } from '../e2e/golden-pages';

const ROOT = join(__dirname, '..');
const read = (relPath: string) => readFileSync(join(ROOT, relPath), 'utf8');

const LANDING_ROOT_CLASS =
  'gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground';

describe('every golden page exists and wraps in the shared landing root', () => {
  for (const golden of GOLDEN_PAGES) {
    const pagePath = golden.path === '/' ? 'app/page.tsx' : `app${golden.path}/page.tsx`;

    it(`${golden.name}: ${pagePath} exists`, () => {
      expect(existsSync(join(ROOT, pagePath)), `golden-pages.ts lists ${golden.path} but ${pagePath} is missing`).toBe(
        true,
      );
    });

    if (golden.usesLandingRoot) {
      it(`${golden.name}: wraps in LandingLocaleProvider with the shared root className`, () => {
        const src = read(pagePath);
        expect(src).toMatch(/import\s*\{\s*LandingLocaleProvider\s*\}\s*from\s*'@\/components\/landing\/landing-locale'/);
        expect(src, `${pagePath} should use the same className string every golden page uses — a page-specific variant is exactly the kind of one-off this standard exists to prevent`).toContain(
          LANDING_ROOT_CLASS,
        );
      });
    }
  }
});

describe('page-primitives.tsx is the documented Launch UI-derived foundation', () => {
  const src = read('components/marketing/page-primitives.tsx');

  it('names Launch UI as the structural reference', () => {
    expect(src).toMatch(/Launch UI/);
    expect(src).toMatch(/github\.com\/launch-ui\/launch-ui/);
  });

  it('exports the expected primitive set', () => {
    for (const name of ['MarketingPage', 'CtaRow', 'ProductHero', 'ProductSection', 'NotLiveList']) {
      expect(src, `page-primitives.tsx should export ${name}`).toMatch(new RegExp(`export function ${name}\\b`));
    }
  });

  it('uses the golden container width (max-w-7xl), not a narrower one', () => {
    expect(src).toMatch(/max-w-7xl/);
    expect(src, 'a stray max-w-6xl would silently narrow every page-primitives.tsx page below the golden standard').not.toMatch(
      /max-w-6xl/,
    );
  });
});

describe('the shared MarketingPage shell is what shopping/conversations/operations/integrations/security actually use', () => {
  // pricing and roi predate page-primitives.tsx and are the one documented
  // exception (their own hero/currency/calculator needs), not a target here.
  const primitiveConsumers = ['shopping', 'conversations', 'operations', 'integrations', 'security'];

  for (const name of primitiveConsumers) {
    it(`${name}-page-content.tsx composes MarketingPage rather than hand-rolling the shell`, () => {
      const src = read(`components/${name}/${name}-page-content.tsx`);
      expect(src).toMatch(/from\s*'@\/components\/marketing\/page-primitives'/);
      expect(src).toMatch(/<MarketingPage/);
      expect(
        src,
        `${name}-page-content.tsx imports AmbientBackground/SiteHeader/SiteFooter directly instead of composing them through MarketingPage — that is the exact duplication page-primitives.tsx exists to prevent`,
      ).not.toMatch(/from\s*'@\/components\/landing\/(ambient-background|site-header|site-footer)'/);
    });
  }
});

describe('the approved motion vocabulary still exists', () => {
  const css = read('app/globals.css');

  it.each(['gc-fade-in-up', 'gc-scroll-reveal', 'gc-spotlight', 'gc-card-hover'])(
    '.%s is still defined in globals.css',
    (cls) => {
      expect(css, `${cls} is part of the documented approved motion vocabulary (docs/golden-landing-standard.md) — if it was intentionally renamed or removed, update that doc and this test together`).toMatch(
        new RegExp(`\\.${cls}\\b`),
      );
    },
  );
});
