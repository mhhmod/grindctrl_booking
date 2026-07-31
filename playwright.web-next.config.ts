import { defineConfig, devices } from '@playwright/test';

/* Separate from playwright.config.ts, which targets the Vite site on 4173.
   This one runs only the apps/web-next specs against Next on 3100. */
export default defineConfig({
  testDir: './apps/web-next/e2e',
  // First test pays Next dev's cold compile of the landing page.
  timeout: 120_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
  },
  /* ponytail: uses the locally installed Chrome so this suite needs no
     ~150MB browser download. Drop `channel` and run `npx playwright install
     chromium` if this ever has to run somewhere without Chrome (e.g. CI). */
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: 'npm run dev -- --port 3100',
    cwd: './apps/web-next',
    port: 3100,
    reuseExistingServer: true,
    // ponytail: Next dev cold-starts and compiles the landing page on first
    // request; anything under a couple of minutes flakes on a cold cache.
    timeout: 240_000,
  },
});
