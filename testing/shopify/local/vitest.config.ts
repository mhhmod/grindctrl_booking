import path from 'node:path';
import { createRequire } from 'node:module';
const app = path.resolve(import.meta.dirname, '../../../apps/web-next');
const require = createRequire(path.join(app,'package.json'));
export default {
  root: app,
  resolve: { alias: { '@': app, '@supabase/supabase-js': require.resolve('@supabase/supabase-js'),
    '@upstash/redis': require.resolve('@upstash/redis'), '@upstash/ratelimit': require.resolve('@upstash/ratelimit'),
    vitest: path.join(app,'node_modules/vitest/dist/index.js') } },
  test: { environment: 'node', setupFiles: [path.join(app,'vitest.setup.ts')],
    include: [path.resolve(import.meta.dirname,
      ({recovery:'recovery.local.ts',redis:'redis.local.ts','redis-outage':'redis-outage.local.ts',
         'redis-recovery':'redis-recovery.local.ts'} as Record<string,string>)[process.env.M1_LOCAL_PHASE??'']??'runtime.local.ts')],
    maxWorkers: 1, testTimeout: 30000, hookTimeout: 30000 },
};
