import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('local preparation never overwrites an existing budget and leaves migration application blocked',t=>{
  const dir=mkdtempSync(join(tmpdir(),'gc-prepare-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const source=join(dir,'approved.json'),output=join(dir,'output');
  const c={environment:'controlled-test',synthetic_only:true,run_id:'synthetic-run-prepare',approval_ref:'synthetic-review',
    source_release:'c'.repeat(40),harness_revision:'d'.repeat(40),
    expires_at:new Date(Date.now()+3600_000).toISOString(),drain_until:new Date(Date.now()+4200_000).toISOString(),
    project_ref:'abcdefghijklmnopqrst',preview_origin:'https://preview.example.org',shops:['synthetic.myshopify.com'],
    app_client_ids:['a'.repeat(32),'b'.repeat(32)],additional_hosts:[],max_calls:24,max_concurrent:2};
  writeFileSync(source,JSON.stringify(c));
  const run=()=>spawnSync(process.execPath,[resolve('testing/shopify/prepare.mjs'),source,output],{encoding:'utf8'});
  assert.equal(run().status,0);
  const budget=join(output,'state','budget.json');const before=readFileSync(budget,'utf8');
  assert.notEqual(run().status,0);assert.equal(readFileSync(budget,'utf8'),before);
  const plan=JSON.parse(readFileSync(join(output,'migration-plan.json'),'utf8'));
  assert.equal(plan.status,'BLOCKED_UNTIL_BASELINE_REVIEW');assert.equal(plan.executed,false);assert.equal(plan.baseline_sha256,null);
  assert.equal(plan.ordered_deltas_after_verified_baseline.length,4);
  assert.match(plan.excluded,/separate per-case/);
});
test('null target template refuses preparation before creating files',t=>{
  const dir=mkdtempSync(join(tmpdir(),'gc-unbound-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const output=join(dir,'output');
  const result=spawnSync(process.execPath,[resolve('testing/shopify/prepare.mjs'),resolve('testing/shopify/manifest.example.json'),output],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.equal(existsSync(output),false);
});
