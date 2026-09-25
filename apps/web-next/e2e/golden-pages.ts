/* Single source of truth for which public pages are checked by the golden
   landing standard suite (responsive overflow, accessibility, visual
   regression, RTL mirroring). Add a new marketing page here once and every
   spec picks it up — the alternative (a hardcoded page list per spec file)
   is exactly how /pricing went untested after the landing rebuild: it
   existed, but nothing running in CI knew to check it. See
   docs/golden-landing-standard.md. */

export interface GoldenPage {
  /** Short, stable id used in test names and screenshot filenames. */
  name: string;
  path: string;
  /** True if the page wraps its content in LandingLocaleProvider with the
      shared `gc-landing-root gc-animated ...` className (every page built
      on components/marketing/page-primitives.tsx or site-landing.tsx does).
      False for pages with their own layout (try-on, sign-in), which read
      the same gc-locale cookie but set dir/lang on <html> directly instead. */
  usesLandingRoot: boolean;
  /** One representative section id used by the visual-regression spec to
      scroll a stable target into view instead of always shooting from the
      top. Omit to screenshot the full page from the top. */
  visualAnchor?: string;
}

export const GOLDEN_PAGES: GoldenPage[] = [
  { name: 'landing', path: '/', usesLandingRoot: true, visualAnchor: 'hero-title' },
  { name: 'pricing', path: '/pricing', usesLandingRoot: true },
  { name: 'roi', path: '/roi', usesLandingRoot: true },
  { name: 'shopping', path: '/shopping', usesLandingRoot: true },
  { name: 'conversations', path: '/conversations', usesLandingRoot: true },
  { name: 'operations', path: '/operations', usesLandingRoot: true },
  { name: 'integrations', path: '/integrations', usesLandingRoot: true },
  { name: 'security', path: '/security', usesLandingRoot: true },
];
