import { defineConfig, devices } from '@playwright/test';

/* Lives inside apps/web-next, not at the repo root, deliberately: the repo
   root's own playwright.config.ts (Vite site, port 4173) pins an older
   @playwright/test than this app does, and Playwright's config loader
   resolves node_modules relative to the config file itself — a config at
   the root loading specs from here would load two different copies of
   @playwright/test in one process and crash with "Requiring @playwright/test
   second time". Run this one from inside apps/web-next (`npx playwright
   test`), not `--config=../../playwright.web-next.config.ts` from root.

   Two ways to point this at a server:
   - Local dev (default): spawns `next dev` on 3100 and waits for it.
   - CI / against a running server: set PLAYWRIGHT_BASE_URL and this skips
     spawning anything, so next-release-check.yml can run these specs
     against the real production Docker candidate it already built and
     started (127.0.0.1:3101) rather than a second, different build. That
     also means visual-regression screenshots always come from the same
     Linux/Docker environment run to run, not compared across whatever OS
     happened to record the baseline (see e2e/golden-standard-visual.spec.ts
     and docs/golden-landing-standard.md). */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100';
const externalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  // First test pays Next dev's cold compile of the landing page.
  timeout: 120_000,
  // Local dev: 1, so tests don't stampede `next dev`'s cold compile of
  // whichever page they hit first. Against an already-built production
  // candidate (CI) there's no compile to stampede, and it can take real
  // concurrent load, so more workers cuts the golden-standard suite's
  // wall-clock time meaningfully (it's ~180 test cases).
  workers: externalServer ? 4 : 1,
  retries: externalServer ? 1 : 0,
  reporter: externalServer ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : [['list']],
  use: {
    baseURL,
    trace: externalServer ? 'retain-on-failure' : 'off',
  },
  /* ponytail: uses the locally installed Chrome so local runs need no
     ~150MB browser download. CI has no local Chrome, so it downloads the
     Playwright-managed Chromium via `playwright install` instead — see the
     "Golden landing standard checks" step in ../../.github/workflows/next-release-check.yml. */
  projects: [
    {
      name: 'chromium',
      use: externalServer ? { ...devices['Desktop Chrome'] } : { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: externalServer
    ? undefined
    : {
        /* `npx next dev` rather than `npm run dev --`: the npm shim crashes
           (exit 0xC0000409) when Playwright spawns it on Windows. */
        command: 'npx next dev --port 3100',
        port: 3100,
        reuseExistingServer: true,
        // ponytail: Next dev cold-starts and compiles the landing page on
        // first request; anything under a couple of minutes flakes on a
        // cold cache.
        timeout: 240_000,
      },
});
