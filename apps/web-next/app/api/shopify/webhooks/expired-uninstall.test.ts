// @vitest-environment node
import { createHash, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireShopToken, setShopTokenClientForTests } from '@/lib/shopify/tokens';

const { recordEvent } = vi.hoisted(() => ({ recordEvent: vi.fn() }));
vi.mock('@/lib/shopify/installation-events', () => ({ recordInstallationEvent: recordEvent }));
import { POST } from './route';

const shop = 'expiry.myshopify.com';
const body = JSON.stringify({ id: 123, myshopify_domain: shop });
let db: PGlite;
function request(delivery = 'original', triggeredAt = '2000-01-01T00:00:00Z') {
  return new NextRequest('https://isolated.example/api/shopify/webhooks', {
    method: 'POST', body, headers: {
      'x-shopify-topic': 'app/uninstalled', 'x-shopify-shop-domain': shop,
      'x-shopify-webhook-id': delivery, 'x-shopify-triggered-at': triggeredAt,
      'x-shopify-hmac-sha256': createHmac('sha256', 'secret-a').update(body).digest('base64'),
    },
  });
}
async function installation(app: string) {
  return (await db.query<Record<string, unknown>>(
    'select * from shopify_installations where shop_domain=$1 and app_client_id=$2', [shop, app])).rows[0];
}
const exchange = async () => ({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh',
  expires_in: 3600, refresh_token_expires_in: 86400, scope: 'read_products' });
async function manualCase() {
  const a = await installation('app-a');
  const ids = (await db.query<{id: string}>('select id from shopify_installation_events')).rows.map(row => row.id);
  return { shop_domain: shop, app_client_id: 'app-a', installation_id: a.id,
    credential_version: a.credential_version, receipt_ids: ids, store_id: 'synthetic-shop-123',
    observed_at: (await db.query<{time: string}>('select clock_timestamp()::text as time')).rows[0].time,
    operator_id: 'approved-test-operator', reviewer_id: 'independent-test-reviewer',
    ticket_ref: 'synthetic-incident', approval_ref: 'synthetic-operation-approval',
    authority: 'shopify_authenticated_admin_and_registration', evidence_ref: 'restricted-synthetic-evidence', evidence_sha256: 'a'.repeat(64) };
}
async function reconcile(input: object) {
  const template = await readFile(resolve(process.cwd(), '../../supabase/operations/shopify_uninstall_reconciliation.sql'), 'utf8');
  try { await db.exec(template.replace('__APPROVED_CASE_JSON__', JSON.stringify(input))); }
  catch (error) { await db.exec('rollback'); throw error; }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table tryon_shops(shop_domain text primary key,status text,installed_at timestamptz,
      last_seen_at timestamptz,updated_at timestamptz,uninstalled_at timestamptz);`);
  for (const file of ['20261024_shopify_installation_isolation.sql', '20261024_shopify_review_remediation.sql']) {
    await db.exec(await readFile(resolve(process.cwd(), '../../supabase', file), 'utf8'));
  }
}, 60000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubEnv('SHOPIFY_APPS', JSON.stringify([{ clientId: 'app-a', secret: 'secret-a' }, { clientId: 'app-b', secret: 'secret-b' }]));
  vi.stubEnv('SHOPIFY_API_KEY', ''); vi.stubEnv('SHOPIFY_API_SECRET', '');
  vi.stubEnv('SHOPIFY_TOKEN_ENC_KEY', Buffer.alloc(32, 7).toString('base64'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await db.exec('truncate shopify_credential_audit,shopify_installation_events,shopify_installations,tryon_shops');
  setShopTokenClientForTests({
    from: () => {
      const filters: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters[key] = value; return query; },
        limit: async () => ({ data: (await db.query<Record<string, unknown>>('select * from shopify_installations')).rows.filter(
          row => Object.entries(filters).every(([key, value]) => row[key] === value)), error: null }),
      };
      return query;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      // Execute actual lease/rotation/uninstall SQL; never substitute a state-machine mock.
      if (name === 'resolve_shopify_uninstall') return { data: (await db.query<{ value: unknown }>(
        'select resolve_shopify_uninstall($1,$2,$3,$4,$5) as value',
        [args.p_event,args.p_installation,args.p_version,args.p_lease,args.p_outcome])).rows[0].value, error: null };
      expect(name).toBe('shopify_credential_operation');
      return { data: (await db.query<{ value: unknown }>(
        'select shopify_credential_operation($1,$2,$3,$4,$5::jsonb) as value',
        [args.p_shop,args.p_app,args.p_operation,args.p_lease,JSON.stringify(args.p_payload ?? {})])).rows[0].value, error: null };
    },
  } as unknown as SupabaseClient);
  recordEvent.mockImplementation(async event => ({ ...(await db.query<{ value: object }>(
    'select record_shopify_installation_event_v2($1,$2,$3,$4,$5::jsonb,$6,$7::timestamptz) as value',
    [event.appClientId,event.shopDomain,event.webhookId,event.topic,JSON.stringify(event.payload),
      createHash('sha256').update(JSON.stringify(event.payload)).digest('hex'),event.triggeredAt])).rows[0].value }));
  await acquireShopToken({ shopDomain: shop, appClientId: 'app-a', exchange });
  await acquireShopToken({ shopDomain: shop, appClientId: 'app-b', exchange });
  // Test fixture only: represent the passage of the provider-defined access lifetime.
  await db.query("update shopify_installations set access_expires_at=clock_timestamp()-interval '1 second' where app_client_id='app-a'");
});
afterEach(() => { setShopTokenClientForTests(null); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('uninstall after access expiry and failed refresh following revocation', () => {
  it.each([401,503])('retains a durable unresolved receipt on refresh HTTP %s, including altered-header retries', async status => {
    const beforeB = await installation('app-b');
    const merchant = (await db.query('select * from tryon_shops')).rows;
    const fetchMock = vi.fn().mockImplementation(async () => new Response('{"error":"invalid_request"}', {
      status, headers: { 'Retry-After': '180' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    for (const [id, time] of [['original','2000-01-01T00:00:00Z'],['original','2099-01-01T00:00:00Z'],['altered','2099-01-01T00:00:00Z']]) {
      const response = await POST(request(id, time));
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('60');
    }
    expect(fetchMock).toHaveBeenCalledTimes(1); // Terminal refresh or durable cooldown prevents loops.
    expect(fetchMock.mock.calls[0][0]).toBe(`https://${shop}/admin/oauth/access_token`);
    const a = await installation('app-a');
    expect(a.status).toBe(status === 401 ? 'reauthorization_required' : 'active');
    expect(a.access_token_ciphertext).toBeTruthy();
    expect(a.refresh_token_ciphertext).toBeTruthy();
    expect(a.lease_id).toBeNull();
    const receipts = (await db.query('select status,processed_at,verification from shopify_installation_events')).rows;
    expect(receipts).toHaveLength(2);
    for (const receipt of receipts) expect(receipt).toMatchObject({ status: 'manual_required', processed_at: null, verification: null });
    expect(await installation('app-b')).toEqual(beforeB);
    expect((await db.query('select * from tryon_shops')).rows).toEqual(merchant);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/synthetic-access|synthetic-refresh|secret-a/);

    // An approved fresh OAuth acquisition is the authoritative recovery, never a header timestamp.
    await acquireShopToken({ shopDomain: shop, appClientId: 'app-a', exchange });
    const reconnected = await installation('app-a');
    expect(reconnected.status).toBe('active');
    expect(reconnected.credential_version).toBe(Number(a.credential_version) + 1);
    expect(await installation('app-b')).toEqual(beforeB);
    expect((await db.query<{status: string}>('select status from shopify_installation_events')).rows.every(row => row.status === 'manual_required')).toBe(true);
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: { currentAppInstallation: { id: 'gid://shopify/AppInstallation/1' } } })));
    expect((await POST(request('original', '2099-01-01T00:00:00Z'))).status).toBe(200);
    expect((await installation('app-a')).credential_version).toBe(reconnected.credential_version);
    expect((await installation('app-a')).status).toBe('active');
    expect(await installation('app-b')).toEqual(beforeB);
    expect((await db.query("select status,reason from shopify_installation_events where webhook_id='original'")).rows[0])
      .toMatchObject({ status: 'ignored', reason: 'current_installation_verified_active' });
  });
  it('rehearses separately approved manual closure of disabled A without affecting B, including duplicate closure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"invalid_request"}', { status: 401 })));
    expect((await POST(request())).status).toBe(503);
    const a = await installation('app-a'); const b = await installation('app-b');
    const merchant = (await db.query('select * from tryon_shops')).rows;
    const input = await manualCase();
    await reconcile(input);
    const closed = await installation('app-a');
    expect(closed.status).toBe('uninstalled');
    expect(closed.credential_version).toBe(Number(a.credential_version) + 1);
    expect(closed.access_token_ciphertext).toBeNull(); expect(closed.refresh_token_ciphertext).toBeNull();
    expect(await installation('app-b')).toEqual(b);
    expect((await db.query('select * from tryon_shops')).rows).toEqual(merchant);
    const receipt = (await db.query<{status: string; verification: Record<string, unknown>}>('select status,verification from shopify_installation_events')).rows[0];
    expect(receipt.status).toBe('completed');
    expect(receipt.verification).toMatchObject({ mode: 'approved_manual_reconciliation', installation_id: a.id,
      credential_version: a.credential_version, ticket_ref: input.ticket_ref, evidence_sha256: input.evidence_sha256 });
    await expect(reconcile(input)).rejects.toThrow('manual_reconciliation_fence_lost');
    expect(await installation('app-a')).toEqual(closed);
    expect((await POST(request())).status).toBe(200); // Already completed receipt, no second mutation.
    expect(await installation('app-b')).toEqual(b);
  });
  it('rejects stale/mismatched evidence, foreign receipts and a newly reauthorized generation during manual closure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"invalid_request"}', { status: 401 })));
    expect((await POST(request())).status).toBe(503);
    const input = await manualCase(); const a = await installation('app-a'); const b = await installation('app-b');
    await expect(reconcile({ ...input, reviewer_id: input.operator_id })).rejects.toThrow('manual_reconciliation_evidence_required');
    await expect(reconcile({ ...input, observed_at: '2000-01-01T00:00:00Z' })).rejects.toThrow('manual_reconciliation_observation_stale');
    await expect(reconcile({ ...input, credential_version: Number(a.credential_version) + 1 })).rejects.toThrow('manual_reconciliation_fence_lost');
    await expect(reconcile({ ...input, receipt_ids: ['00000000-0000-0000-0000-000000000001'] })).rejects.toThrow('manual_reconciliation_receipt_mismatch');
    expect(await installation('app-a')).toEqual(a); expect(await installation('app-b')).toEqual(b);
    await acquireShopToken({ shopDomain: shop, appClientId: 'app-a', exchange });
    const fresh = await installation('app-a');
    await expect(reconcile(input)).rejects.toThrow('manual_reconciliation_fence_lost');
    expect(await installation('app-a')).toEqual(fresh); expect(await installation('app-b')).toEqual(b);
  });
});
