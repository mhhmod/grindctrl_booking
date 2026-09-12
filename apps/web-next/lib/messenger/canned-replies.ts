import 'server-only';

import { getMessengerServiceClient } from './db';
import { recordAudit } from './conversations';
import type { MessengerSiteView } from './provisioning';

export interface CannedReply {
  id: string;
  title: string;
  content: string;
  status: 'active' | 'disabled';
  sort_order: number;
  updated_at: string;
}

export const CANNED_REPLY_TITLE_MAX = 100;
export const CANNED_REPLY_CONTENT_MAX = 2000;
export const CANNED_REPLIES_MAX_PER_SITE = 50;

function mapReply(row: Record<string, unknown>): CannedReply {
  return {
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    status: (row.status as CannedReply['status']) ?? 'active',
    sort_order: (row.sort_order as number) ?? 0,
    updated_at: row.updated_at as string,
  };
}

export async function listCannedReplies(siteId: string): Promise<CannedReply[]> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('messenger_canned_replies')
    .select('*')
    .eq('widget_site_id', siteId)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(CANNED_REPLIES_MAX_PER_SITE);
  if (res.error) throw new Error(`canned replies list failed: ${res.error.message}`);
  return ((res.data ?? []) as Array<Record<string, unknown>>).map(mapReply);
}

/** Insert set for the composer: active replies only, newest-updated first. */
export async function getActiveCannedReplies(siteId: string): Promise<CannedReply[]> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('messenger_canned_replies')
    .select('*')
    .eq('widget_site_id', siteId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(CANNED_REPLIES_MAX_PER_SITE);
  if (res.error) throw new Error(`active canned replies failed: ${res.error.message}`);
  return ((res.data ?? []) as Array<Record<string, unknown>>).map(mapReply);
}

export async function addCannedReply(input: {
  site: MessengerSiteView;
  actorClerkUserId: string;
  title: string;
  content: string;
}): Promise<CannedReply> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('messenger_canned_replies')
    .insert({
      widget_site_id: input.site.id,
      title: input.title.trim().slice(0, CANNED_REPLY_TITLE_MAX),
      content: input.content.trim().slice(0, CANNED_REPLY_CONTENT_MAX),
      status: 'active',
    })
    .select('*')
    .single();
  if (res.error) throw new Error(`canned reply create failed: ${res.error.message}`);
  await recordAudit({
    siteId: input.site.id,
    actorClerkUserId: input.actorClerkUserId,
    action: 'canned_reply_added',
    detail: { id: res.data.id },
  });
  return mapReply(res.data as unknown as Record<string, unknown>);
}

export async function setCannedReplyStatus(input: {
  site: MessengerSiteView;
  replyId: string;
  status: 'active' | 'disabled';
}): Promise<void> {
  const supabase = getMessengerServiceClient();
  await supabase
    .from('messenger_canned_replies')
    .update({ status: input.status })
    .eq('id', input.replyId)
    .eq('widget_site_id', input.site.id);
}

export async function removeCannedReply(input: {
  site: MessengerSiteView;
  actorClerkUserId: string;
  replyId: string;
}): Promise<void> {
  const supabase = getMessengerServiceClient();
  await supabase.from('messenger_canned_replies').delete().eq('id', input.replyId).eq('widget_site_id', input.site.id);
  await recordAudit({
    siteId: input.site.id,
    actorClerkUserId: input.actorClerkUserId,
    action: 'canned_reply_removed',
    detail: { id: input.replyId },
  });
}
