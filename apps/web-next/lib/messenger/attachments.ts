import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { getMessengerServiceClient } from './db';
import { ATTACHMENT_EXTENSIONS, type AttachmentMime } from './image';

/* Storage and bookkeeping for shopper image attachments.

   The server writes to storage, never the browser: no signed-upload URL and
   no storage credential is ever handed to a storefront. Reads are the same
   in reverse — staff receive a URL that expires in five minutes, minted
   after the ownership check the caller has already performed. */

export const ATTACHMENT_BUCKET = 'messenger-attachments';
export const ATTACHMENT_RETENTION_DAYS = 90;
export const SIGNED_URL_TTL_SECONDS = 300;

/** Uploads per conversation: a burst limit and a lifetime limit. Both are
 *  needed — the burst stops a script, the lifetime stops a slow drip. */
export const ATTACHMENT_BURST_LIMIT = 3;
export const ATTACHMENT_BURST_WINDOW_MS = 10 * 60 * 1000;
export const ATTACHMENT_LIFETIME_LIMIT = 10;
/** Vision triage is the expensive part; uploads keep working past this. */
export const TRIAGE_DAILY_LIMIT_PER_SITE = 200;

export interface TriageResult {
  description: string;
  category: 'damaged' | 'wrong_item' | 'wrong_size' | 'unclear' | 'not_an_issue';
  confidence: number;
}

export interface AttachmentRecord {
  id: string;
  conversation_id: string;
  message_id: string | null;
  storage_path: string;
  mime: string;
  bytes: number;
  triage: TriageResult | null;
  created_at: string;
}

function retentionCutoffIso(): string {
  return new Date(Date.now() - ATTACHMENT_RETENTION_DAYS * 86_400_000).toISOString();
}

export type AttachmentQuota = 'ok' | 'burst' | 'lifetime';

/** Both counts in one round trip: the lifetime total is the row count, and
 *  the burst count is a filter over the same rows. Only the newest
 *  ATTACHMENT_LIFETIME_LIMIT rows are needed to decide either. */
export async function checkAttachmentQuota(conversationId: string): Promise<AttachmentQuota> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('messenger_attachments')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(ATTACHMENT_LIFETIME_LIMIT);
  if (res.error) throw new Error(`attachment quota check failed: ${res.error.message}`);

  const rows = (res.data ?? []) as Array<{ created_at: string }>;
  if (rows.length >= ATTACHMENT_LIFETIME_LIMIT) return 'lifetime';

  const since = Date.now() - ATTACHMENT_BURST_WINDOW_MS;
  const recent = rows.filter((row) => new Date(row.created_at).getTime() >= since).length;
  return recent >= ATTACHMENT_BURST_LIMIT ? 'burst' : 'ok';
}

export async function triageBudgetRemaining(siteId: string): Promise<boolean> {
  const supabase = getMessengerServiceClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const res = await supabase
    .from('messenger_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('widget_site_id', siteId)
    .gte('created_at', since)
    .not('triage', 'is', null);
  if (res.error) return false; // Unknown budget is treated as spent.
  return (res.count ?? 0) < TRIAGE_DAILY_LIMIT_PER_SITE;
}

/** Writes the object, then the row. Site id is the first path segment, so a
 *  crafted conversation id cannot address another tenant's prefix — and
 *  every id in the path is server-generated or already ownership-checked. */
export async function storeAttachment(input: {
  siteId: string;
  conversationId: string;
  mime: AttachmentMime;
  bytes: Buffer;
}): Promise<{ id: string; storagePath: string }> {
  const supabase = getMessengerServiceClient();
  const storagePath = `${input.siteId}/${input.conversationId}/${randomUUID()}.${ATTACHMENT_EXTENSIONS[input.mime]}`;

  const upload = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(storagePath, input.bytes, { contentType: input.mime, upsert: false });
  if (upload.error) throw new Error(`attachment upload failed: ${upload.error.message}`);

  const row = await supabase
    .from('messenger_attachments')
    .insert({
      widget_site_id: input.siteId,
      conversation_id: input.conversationId,
      storage_path: storagePath,
      mime: input.mime,
      bytes: input.bytes.length,
      sha256: createHash('sha256').update(input.bytes).digest('hex'),
    })
    .select('id')
    .single();
  if (row.error) {
    /* The object is already written. Leaving it orphaned means storage the
       retention sweep will never find (it walks rows, not objects), so undo
       it before surfacing the failure. */
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
    throw new Error(`attachment record failed: ${row.error.message}`);
  }
  return { id: row.data.id as string, storagePath };
}

export async function linkAttachmentToMessage(attachmentId: string, messageId: string): Promise<void> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('messenger_attachments')
    .update({ message_id: messageId })
    .eq('id', attachmentId);
  if (res.error) console.error('[messenger] attachment link failed:', res.error.message);
}

export async function saveTriage(attachmentId: string, triage: TriageResult): Promise<void> {
  const supabase = getMessengerServiceClient();
  const res = await supabase.from('messenger_attachments').update({ triage }).eq('id', attachmentId);
  if (res.error) console.error('[messenger] triage save failed:', res.error.message);
}

/** Staff-side listing. Rows past retention are neither returned nor kept:
 *  there is no scheduled sweep, so the moment someone looks at a
 *  conversation is the moment its expired objects get reclaimed. Stores
 *  nobody opens keep their objects — a documented limitation. */
export async function listConversationAttachments(conversationId: string): Promise<AttachmentRecord[]> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('messenger_attachments')
    .select('id, conversation_id, message_id, storage_path, mime, bytes, triage, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(ATTACHMENT_LIFETIME_LIMIT * 2);
  if (res.error) throw new Error(`attachment list failed: ${res.error.message}`);

  const cutoff = retentionCutoffIso();
  const rows = (res.data ?? []) as unknown as AttachmentRecord[];
  const expired = rows.filter((row) => row.created_at < cutoff);
  if (expired.length > 0) void purgeAttachments(expired).catch(() => {});
  return rows.filter((row) => row.created_at >= cutoff);
}

async function purgeAttachments(rows: AttachmentRecord[]): Promise<void> {
  const supabase = getMessengerServiceClient();
  await supabase.storage.from(ATTACHMENT_BUCKET).remove(rows.map((row) => row.storage_path));
  await supabase
    .from('messenger_attachments')
    .delete()
    .in('id', rows.map((row) => row.id));
}

/** Short-lived read URLs, one round trip for the whole thread. Never
 *  persisted and never returned to a storefront — only to a dashboard
 *  request that already proved site ownership. The staff view re-polls
 *  every 15s, so links refresh long before the five minutes are up. */
export async function signAttachmentUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const supabase = getMessengerServiceClient();
  const res = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (res.error || !res.data) {
    console.error('[messenger] signed urls failed:', res.error?.message);
    return {};
  }
  const signed: Record<string, string> = {};
  for (const entry of res.data) {
    if (entry.path && entry.signedUrl) signed[entry.path] = entry.signedUrl;
  }
  return signed;
}

/** Bytes back out of storage, for the vision call. */
export async function readAttachmentBytes(storagePath: string): Promise<Buffer | null> {
  const supabase = getMessengerServiceClient();
  const res = await supabase.storage.from(ATTACHMENT_BUCKET).download(storagePath);
  if (res.error || !res.data) return null;
  return Buffer.from(await res.data.arrayBuffer());
}
