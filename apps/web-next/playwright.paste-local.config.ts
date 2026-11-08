import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'paste-tryon-local.spec.ts',
  fullyParallel: true,
  workers: 2,
  use: { browserName: 'chromium', channel: 'chrome', headless: true },
  outputDir: 'output/playwright/paste-local',
  reporter: 'list',
});
