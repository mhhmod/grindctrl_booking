import { defineConfig } from '@playwright/test';

// Dedicated, credential-free local test. Never point this config at a live shop.
process.env.GC_SHOPIFY_MULTI_APP_TEST = '1';
export default defineConfig({
  testDir: './e2e', testMatch: 'shopify-multi-app-entry.spec.ts',
  outputDir: '../../work/shopify-isolation-browser', workers: 1,
  use: { baseURL: 'http://127.0.0.1:3191',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox'] } : {},
  },
  webServer: {
    command: 'npm run start -- -p 3191', url: 'http://127.0.0.1:3191/api/health',
    reuseExistingServer: false, timeout: 120000,
    env: {
      SHOPIFY_APPS: JSON.stringify([{clientId:'app-a',secret:'local-test-a'},{clientId:'app-b',secret:'local-test-b'}]),
      SHOPIFY_API_KEY:'',SHOPIFY_API_SECRET:'',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'',CLERK_SECRET_KEY:'',
      NEXT_PUBLIC_SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',OPENROUTER_API_KEY:'',GROQ_API_KEY:'',
      GRINDCTRL_CAPABILITY_SECRET:'local-test-only-independent-core-key-over-32-bytes',
    },
  },
});
