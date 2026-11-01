import { defineConfig, devices } from '@playwright/test';

// The Docker SQL preview only. Use the browser pinned by package-lock.json,
// exactly as release CI does; a host Chromium version is not a visual baseline.
// The fixed router blocks browser egress to external services. Never point this
// configuration at a merchant store, production origin or public preview.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'golden-standard-visual.spec.ts',
  workers: 2,
  retries: 0,
  timeout: 120_000,
  reporter: 'list',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  use: {
    baseURL: 'http://127.0.0.1:3102',
    proxy: { server: 'http://127.0.0.1:54380', bypass: '127.0.0.1,localhost' },
  },
});
