import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { canonicalShopDomain } from '@/lib/messenger/shop-tenancy';
import { sendShopifyDataRequest, sendShopifyPrivacyAlert } from '@/lib/email/shopify-privacy-sender';
import type { ShopifyCustomerRecords } from '@/lib/email/shopify-privacy';

type PrivacyTopic = 'customers/data_request' | 'customers/redact' | 'shop/redact';
interface PrivacyRequest {
  webhookId: string;
  topic: PrivacyTopic;
  shopDomain: string;
  payload: unknown;
}
type Visitor = Record<string, unknown> & { id: string; user_email: string | null };
type Conversation = Record<string, unknown> & { id: string };

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service configuration is missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

function throwRpcError(error: { message: string } | null): void {
  if (!error) return;
  throw new Error(error.message);
}

type ServiceClient = ReturnType<typeof getServiceClient>;

// Use the number actually returned, since PostgREST can cap a requested page.
// Continue until an empty page so exports/files are never silently truncated.
async function readAll<T>(page: (start: number, end: number) => PromiseLike<{
  data: T[] | null; error: { message: string } | null;
}>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const result = await page(rows.length, rows.length + 499);
    throwRpcError(result.error);
    if (!result.data?.length) return rows;
    rows.push(...result.data);
  }
}

async function merchantRecipients(client: ServiceClient, shop: string): Promise<string[]> {
  const owner = await client.from('tryon_shops').select('owner_clerk_user_id').eq('shop_domain', shop).maybeSingle();
  throwRpcError(owner.error);
  if (!owner.data?.owner_clerk_user_id) return [];
  const profile = await client.from('profiles').select('email').eq('clerk_user_id', owner.data.owner_clerk_user_id).maybeSingle();
  throwRpcError(profile.error);
  const email = profile.data?.email?.trim();
  return email ? [email] : []; // Sender falls back to the existing alert mailbox.
}

function customerIdentity(payload: unknown): { email: string; id: string | number | null } {
  const customer = payload && typeof payload === 'object' && 'customer' in payload ? payload.customer : null;
  if (!customer || typeof customer !== 'object' || !('email' in customer)
    || typeof customer.email !== 'string' || !customer.email.trim()) {
    throw new Error('Customer email is missing; manual handling is required');
  }
  return {
    email: customer.email.trim(),
    id: 'id' in customer && (typeof customer.id === 'string' || typeof customer.id === 'number') ? customer.id : null,
  };
}

async function matchingVisitors(client: ServiceClient, siteId: string, email: string): Promise<Visitor[]> {
  // Escape SQL LIKE metacharacters. PostgREST also treats '*' as '%'; the
  // exact comparison below prevents that alias from matching another person.
  const pattern = email.replace(/[\\%_]/g, '\\$&');
  const visitors = await readAll((start, end) => client.from('widget_visitors').select('*')
    .eq('widget_site_id', siteId).ilike('user_email', pattern).order('id').range(start, end).returns<Visitor[]>());
  return visitors.filter((visitor) => visitor.user_email?.toLowerCase() === email.toLowerCase());
}

async function conversationsFor(client: ServiceClient, siteId: string, visitorId: string): Promise<Conversation[]> {
  return readAll((start, end) => client.from('widget_conversations').select('*')
    .eq('widget_site_id', siteId).eq('visitor_id', visitorId).order('id').range(start, end).returns<Conversation[]>());
}

async function removeAttachments(client: ServiceClient, siteId: string, conversationId?: string): Promise<void> {
  const attachments = await readAll((start, end) => {
    let query = client.from('messenger_attachments').select('storage_path').eq('widget_site_id', siteId);
    if (conversationId) query = query.eq('conversation_id', conversationId);
    return query.order('id').range(start, end).returns<Array<{ storage_path: string }>>();
  });
  const paths = [...new Set(attachments.map((attachment) => attachment.storage_path))];
  for (let start = 0; start < paths.length; start += 100) {
    const result = await client.storage.from('messenger-attachments').remove(paths.slice(start, start + 100));
    throwRpcError(result.error);
  }
}

async function redactShop(client: ServiceClient, shop: string, siteId?: string): Promise<void> {
  if (siteId) {
    await removeAttachments(client, siteId);
    const result = await client.from('widget_sites').delete().eq('id', siteId);
    throwRpcError(result.error);
  }
  // These subsystems have no widget_sites FK. Zero affected rows is success.
  // Intentionally retain tryon_credit_ledger as GrindCTRL's merchant billing audit
  // trail for accounting, tax, and legal retention obligations, not customer PII.
  // Its tryon_credit_ledger_no_update_or_delete trigger calls
  // reject_tryon_credit_ledger_mutation() to reject every DELETE and UPDATE.
  // Exclusion is intentional retention, not an oversight; do not add it here.
  for (const [table, column] of [
    ['tryon_jobs', 'shop'],
    ['tryon_settings', 'shop'],
    ['tryon_subscriptions', 'shop_domain'],
    ['shopify_shop_tokens', 'shop_domain'],
    ['tryon_shops', 'shop_domain'],
  ]) {
    const result = await client.from(table).delete().eq(column, shop);
    throwRpcError(result.error);
  }
}

async function customerRecords(client: ServiceClient, siteId: string, visitors: Visitor[]): Promise<ShopifyCustomerRecords[]> {
  const records: ShopifyCustomerRecords[] = [];
  for (const visitor of visitors) {
    const conversations: ShopifyCustomerRecords['conversations'] = [];
    for (const conversation of await conversationsFor(client, siteId, visitor.id)) {
      const messages = await readAll((start, end) => client.from('widget_messages').select('role, content, created_at')
        .eq('conversation_id', conversation.id).order('created_at').order('id').range(start, end)
        .returns<Array<{ role: string; content: string; created_at: string }>>());
      const feedback = await readAll((start, end) => client.from('messenger_feedback').select('rating, comment')
        .eq('conversation_id', conversation.id).order('id').range(start, end)
        .returns<Array<{ rating: number; comment: string | null }>>());
      conversations.push({ conversation, messages, feedback });
    }
    records.push({ visitor, conversations });
  }
  return records;
}

async function updateRequest(client: ServiceClient, id: string, changes: Record<string, unknown>): Promise<void> {
  const result = await client.from('shopify_privacy_requests').update(changes).eq('id', id).select('id').maybeSingle();
  throwRpcError(result.error);
  if (!result.data) throw new Error('Privacy request status could not be recorded');
}

/** Reject only before durable recording. After the insert, any failure is a
 * manual-handling case; duplicate deliveries must never repeat side effects.
 * A process interruption leaves a received row for manual reconciliation. */
export async function processShopifyPrivacyRequest(input: PrivacyRequest): Promise<void> {
  const client = getServiceClient();
  const shopDomain = canonicalShopDomain(input.shopDomain);
  const inserted = await client.from('shopify_privacy_requests').upsert({
    webhook_id: input.webhookId, topic: input.topic, shop_domain: shopDomain, payload: input.payload,
  }, { onConflict: 'webhook_id', ignoreDuplicates: true }).select('id, attempts').maybeSingle();
  throwRpcError(inserted.error);
  if (!inserted.data) return;

  const requestId = inserted.data.id;
  const attempts = inserted.data.attempts + 1;
  const context = { webhookId: input.webhookId, shopDomain, topic: input.topic };
  let to: string[] = [];
  try {
    if (process.env.SHOPIFY_PRIVACY_PROCESSING_ENABLED !== 'true') {
      to = await merchantRecipients(client, shopDomain);
      const alert = await sendShopifyPrivacyAlert({ ...context, reason: 'disabled', to });
      if (!alert.sent) throw new Error('Manual-handling alert email was not sent');
      return; // Received, not fulfilled. Enabling the flag does not replay this row.
    }

    await updateRequest(client, requestId, { attempts });
    const site = await client.from('widget_sites').select('id').eq('domain', shopDomain).maybeSingle();
    throwRpcError(site.error);
    const siteId = site.data?.id;
    if (input.topic === 'shop/redact') {
      await redactShop(client, shopDomain, siteId);
    } else {
      const customer = customerIdentity(input.payload);
      const visitors = siteId ? await matchingVisitors(client, siteId, customer.email) : [];
      if (input.topic === 'customers/redact') {
        for (const visitor of siteId ? visitors : []) {
          for (const conversation of await conversationsFor(client, siteId, visitor.id)) {
            await removeAttachments(client, siteId, conversation.id);
          }
          const result = await client.from('widget_visitors').delete().eq('widget_site_id', siteId).eq('id', visitor.id);
          throwRpcError(result.error);
        }
      } else {
        to = await merchantRecipients(client, shopDomain);
        const records = siteId ? await customerRecords(client, siteId, visitors) : [];
        const sent = await sendShopifyDataRequest({
          ...context, customerEmail: customer.email, customerId: customer.id, visitors: records, to,
        });
        if (!sent.sent) throw new Error('Customer data request email was not sent');
      }
    }
    await updateRequest(client, requestId, { status: 'completed', processed_at: new Date().toISOString(), last_error: null });
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);
    try {
      await updateRequest(client, requestId, { status: 'failed', attempts, last_error: message, processed_at: null });
    } catch (statusError) {
      message += `; recording failure status also failed: ${statusError instanceof Error ? statusError.message : String(statusError)}`;
      console.error('[shopify] privacy request status update failed', { webhookId: input.webhookId });
    }
    const alert = await sendShopifyPrivacyAlert({ ...context, reason: 'failed', error: message, to });
    if (!alert.sent) console.error('[shopify] privacy request needs manual attention; alert email unavailable', { webhookId: input.webhookId });
  }
}
