import path from 'node:path';
import { createRequire } from 'node:module';
const app = path.resolve(import.meta.dirname, '../../../apps/web-next');
const require = createRequire(path.join(app,'package.json'));
export default {
  root: app,
  resolve: { alias: { '@': app, '@supabase/supabase-js': require.resolve('@supabase/supabase-js'),
    vitest: path.join(app,'node_modules/vitest/dist/index.js') } },
  test: { environment: 'node', setupFiles: [path.join(app,'vitest.setup.ts')],
    include: [path.resolve(import.meta.dirname,process.env.M1_LOCAL_PHASE==='recovery'?'recovery.local.ts':'runtime.local.ts')],
    maxWorkers: 1, testTimeout: 30000, hookTimeout: 30000 },
};
