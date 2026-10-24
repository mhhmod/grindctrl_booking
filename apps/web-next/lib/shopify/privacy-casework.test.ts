// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';

let db: PGlite;
beforeAll(async()=>{
  db=new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for (const file of ['20260909_shopify_privacy_requests.sql','20261024_shopify_installation_isolation.sql','20261024_shopify_privacy_casework.sql','20261024_shopify_privacy_casework.sql']) {
    await db.exec(await readFile(resolve(process.cwd(),'../../supabase',file),'utf8'));
  }
},60000);
afterAll(async()=>{await db?.close();});
async function createCase(source='installation',topic='shop/redact',completed=false) {
  const id=randomUUID();
  if(source==='legacy') await db.query(`insert into shopify_privacy_requests(id,webhook_id,topic,shop_domain,payload,status,received_at)
    values($1,$4,$2,'demo.myshopify.com','{}',$3,now()-interval '31 days')`,[id,topic,completed?'completed':'received',id]);
  else await db.query(`insert into shopify_installation_events(id,app_client_id,shop_domain,webhook_id,topic,payload,payload_digest,status,received_at)
    values($1,'app-a','demo.myshopify.com',$3,$2,'{}','digest','manual_required',now()-interval '31 days')`,[id,topic,id]);
  return id;
}
const evidence={ticket_ref:'restricted://ticket',scope_sha256:'a'.repeat(64),scope_ref:'restricted://manifest',reviewer:'reviewer-two',approval_ref:'restricted://approval',
  execution_ref:'restricted://execution',verification_ref:'restricted://verification',verification_passed:true,deletion_ref:'restricted://deletion',retained_records_ref:'restricted://none'};
async function act(id:string,action:string,details:object=evidence,source='installation',actor='operator-one') {
  return db.query('select record_shopify_privacy_case_action($1,$2,$3,$4,$5::jsonb)',[source,id,actor,action,JSON.stringify(details)]);
}
it('surfaces new and legacy overdue cases and never trusts old completed flags without evidence',async()=>{
  const fresh=await createCase();const old=await createCase('legacy','shop/redact',true);
  const rows=(await db.query<{id:string;overdue:boolean;reviewed_status:string;app_client_id:string|null}>('select * from shopify_privacy_work_queue where id in ($1,$2)',[fresh,old])).rows;
  expect(rows.every(r=>r.overdue)).toBe(true);
  expect(rows.find(r=>r.id===old)).toMatchObject({reviewed_status:'completion_unverified',app_client_id:null});
  expect(rows[0]).not.toHaveProperty('payload');
});
it('requires reviewed scope and actual execution/verification references before completion',async()=>{
  const id=await createCase();
  await expect(act(id,'fulfilled')).rejects.toThrow('approved_privacy_scope_required');
  await expect(act(id,'scoped',{...evidence,reviewer:'operator-one'})).rejects.toThrow('privacy_review_required');
  await act(id,'assigned',{ticket_ref:evidence.ticket_ref});
  await act(id,'scoped');
  await expect(act(id,'fulfilled',{...evidence,verification_ref:''})).rejects.toThrow('privacy_execution_evidence_required');
  await expect(act(id,'fulfilled',{...evidence,scope_sha256:'b'.repeat(64)})).rejects.toThrow('approved_privacy_scope_required');
  expect((await db.query<{status:string}>('select status from shopify_installation_events where id=$1',[id])).rows[0].status).toBe('manual_required');
  await act(id,'fulfilled');
  expect((await db.query<{status:string}>('select status from shopify_installation_events where id=$1',[id])).rows[0].status).toBe('completed');
  await expect(act(id,'fulfilled')).rejects.toThrow('privacy_case_already_closed');
});
it('requires legacy provenance evidence instead of inferring app ownership from shop domain',async()=>{
  const id=await createCase('legacy');
  await expect(act(id,'scoped',evidence,'legacy')).rejects.toThrow('legacy_privacy_provenance_required');
  const verified={...evidence,provenance_ref:'restricted://independent-mapping'};
  await act(id,'scoped',verified,'legacy'); await act(id,'fulfilled',verified,'legacy');
  expect((await db.query<{status:string}>('select status from shopify_privacy_requests where id=$1',[id])).rows[0].status).toBe('completed');
});
it('keeps legal retention holds unresolved and requires rescoping after release',async()=>{
  const id=await createCase();await act(id,'scoped');
  await expect(act(id,'retention_hold',{ticket_ref:evidence.ticket_ref})).rejects.toThrow('specific_retention_basis_required');
  await act(id,'retention_hold',{ticket_ref:evidence.ticket_ref,legal_basis_ref:'restricted://specific-legal-basis',review_at:'2026-11-01'});
  await act(id,'assigned',{ticket_ref:evidence.ticket_ref});
  await act(id,'escalated',{ticket_ref:evidence.ticket_ref});
  await expect(act(id,'fulfilled')).rejects.toThrow('approved_privacy_scope_required');
  expect((await db.query<{status:string}>('select status from shopify_installation_events where id=$1',[id])).rows[0].status).toBe('manual_required');
});
it('requires proof of secure data-request delivery and deletion evidence for redaction',async()=>{
  const request=await createCase('installation','customers/data_request');await act(request,'scoped');
  await expect(act(request,'fulfilled')).rejects.toThrow('privacy_delivery_evidence_required');
  await act(request,'fulfilled',{...evidence,delivery_ref:'restricted://merchant-receipt'});
  const redact=await createCase();await act(redact,'scoped');
  await expect(act(redact,'fulfilled',{...evidence,deletion_ref:''})).rejects.toThrow('privacy_deletion_evidence_required');
});
it('restricts queue/casework to service tooling and makes evidence append-only for service_role',async()=>{
  await db.exec('set role anon');
  try {await expect(db.query('select * from shopify_privacy_work_queue')).rejects.toThrow(/permission denied/);}
  finally {await db.exec('reset role');}
  await db.exec('set role service_role');
  try {
    await expect(db.query('update shopify_privacy_case_actions set actor=\'forged\'')).rejects.toThrow(/permission denied/);
    await expect(db.query('delete from shopify_privacy_case_actions')).rejects.toThrow(/permission denied/);
  } finally {await db.exec('reset role');}
});
