import { readManifest, validateEnvironment } from './config.mjs';
import { createProviderHarness } from './provider-harness.mjs';

// Imported only by the dedicated preview image, before Next/server modules.
// The production Dockerfile never copies or imports testing/shopify.
const c = readManifest('/run/controlled/manifest.json');
validateEnvironment(c, process.env);
globalThis.fetch = createProviderHarness(c, {
  stateFile: '/run/controlled-state/budget.json', controlFile: '/run/controlled/control.json',
});
process.env.OPENROUTER_API_KEY = 'controlled-test-sentinel-not-a-provider-credential';
process.env.TRYON_TEST_LOOKS_PER_DAY = '1';
console.info('[controlled-test] provider interception active', { run: c.run_id, synthetic: true });
