import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { GOLDEN_PAGES } from './golden-pages';
import { waitForPageReady } from './page-ready';

const LOCALES = ['en', 'ar'] as const;

/* WCAG 2.2 AA, matching the global "Customer-facing UI should target WCAG
   2.2 AA by default" rule. axe cannot detect every WCAG failure — it is a
   floor, not a substitute for a real screen-reader pass — but it catches
   the mechanical, regressable ones: missing labels, bad contrast, invalid
   ARIA, broken heading order, duplicate ids. Any violation here is real;
   axe does not produce style-preference noise the way some linters do. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/* /try-on is checked here too. It stays out of golden-pages.ts on purpose
   (it has its own layout, and mobile-overflow.spec.ts already lists it, so a
   second entry there would duplicate test titles), but it is a public page
   and has to meet the same bar. */
const A11Y_PAGES = [...GOLDEN_PAGES.map(({ name, path }) => ({ name, path })), { name: 'try-on', path: '/try-on' }];

for (const golden of A11Y_PAGES) {
  for (const locale of LOCALES) {
    test(`${golden.name} has no automatically-detectable WCAG 2.2 AA violations in ${locale}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([{ name: 'gc-locale', value: locale, url: baseURL! }]);
      await page.goto(golden.path);
      await waitForPageReady(page, golden.path);

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      if (results.violations.length > 0) {
        const summary = results.violations
          .map((v) => `[${v.impact}] ${v.id} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'}): ${v.help}\n  ${v.helpUrl}\n  first target: ${v.nodes[0]?.target.join(' ')}`)
          .join('\n\n');
        expect(results.violations, `axe violations on ${golden.path} (${locale}):\n\n${summary}`).toEqual([]);
      }
    });
  }
}
