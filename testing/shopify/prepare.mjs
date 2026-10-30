// Local-file preparation only. No resource creation, connection, SQL or deploy.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateManifest } from './config.mjs';

if (process.argv.length !== 4) throw new Error('usage: node testing/shopify/prepare.mjs APPROVED_MANIFEST OUTPUT_DIR');
const manifest = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
validateManifest(manifest);
const output = resolve(process.argv[3]);
mkdirSync(output, { recursive: true, mode: 0o700 });
for (const folder of ['config', 'state']) mkdirSync(join(output,folder), { mode: 0o700 });
writeFileSync(join(output,'config','manifest.json'), JSON.stringify(manifest,null,2), { flag: 'wx', mode: 0o600 });
writeFileSync(join(output,'config','control.json'), JSON.stringify({image:'success',chat:'success'}), { flag:'wx',mode:0o600 });
writeFileSync(join(output,'state','budget.json'), JSON.stringify({run_id:manifest.run_id,used:0,events:[]}), { flag:'wx',mode:0o600 });
const files = ['20260909_shopify_privacy_requests.sql','20261024_shopify_installation_isolation.sql',
  '20261024_shopify_review_remediation.sql','20261024_shopify_privacy_casework.sql'];
const order = files.map(file => ({file:`supabase/${file}`,sha256:createHash('sha256').update(readFileSync(resolve('supabase',file))).digest('hex')}));
writeFileSync(join(output,'migration-plan.json'),JSON.stringify({
  status:'BLOCKED_UNTIL_BASELINE_REVIEW',executed:false,baseline_sha256:null,
  warning:'M1 deltas do not create the missing base tryon_shops/credit schema. Never use a simplified ledger or restore production data.',
  ordered_deltas_after_verified_baseline:order,
  excluded:'supabase/operations/shopify_uninstall_reconciliation.sql requires separate per-case authorization',
},null,2),{flag:'wx',mode:0o600});
console.info('Local files prepared; no infrastructure or SQL executed. Preserve the state directory across restarts.');
