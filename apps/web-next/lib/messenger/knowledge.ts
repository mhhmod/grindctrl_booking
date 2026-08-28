import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { isPrivateIp } from '@/lib/pricing/geo';
import { getMessengerServiceClient } from './db';
import { requireOwnedSite } from './provisioning';
import { recordAudit } from './conversations';

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  source: 'manual' | 'url';
  source_url: string | null;
  status: 'active' | 'disabled';
  last_synced_at: string | null;
  updated_at: string;
}

export const KNOWLEDGE_MAX_ENTRIES_PER_SITE = 50;
const FETCH_TIMEOUT_MS = 12_000;
const FETCH_MAX_BYTES = 400_000;

function mapEntry(row: Record<string, unknown>): KnowledgeEntry {
  return {
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    source: (row.source as KnowledgeEntry['source']) ?? 'manual',
    source_url: (row.source_url as string | null) ?? null,
    status: (row.status as KnowledgeEntry['status']) ?? 'active',
    last_synced_at: (row.last_synced_at as string | null) ?? null,
    updated_at: row.updated_at as string,
  };
}

export async function listKnowledge(siteId: string): Promise<KnowledgeEntry[]> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('messenger_knowledge')
    .select('*')
    .eq('widget_site_id', siteId)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(KNOWLEDGE_MAX_ENTRIES_PER_SITE);
  if (res.error) throw new Error(`knowledge list failed: ${res.error.message}`);
  return ((res.data ?? []) as Array<Record<string, unknown>>).map(mapEntry);
}

/** Grounding set for the AI: active entries only, newest-updated first. */
export async function getActiveKnowledge(siteId: string): Promise<KnowledgeEntry[]> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('messenger_knowledge')
    .select('*')
    .eq('widget_site_id', siteId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(30);
  if (res.error) throw new Error(`active knowledge failed: ${res.error.message}`);
  return ((res.data ?? []) as Array<Record<string, unknown>>).map(mapEntry);
}

export async function addManualKnowledge(input: {
  clerkUserId: string;
  siteId: string;
  title: string;
  content: string;
}): Promise<KnowledgeEntry> {
  await requireOwnedSite(input.clerkUserId, input.siteId);
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('messenger_knowledge')
    .insert({
      widget_site_id: input.siteId,
      title: input.title.trim().slice(0, 200),
      content: input.content.trim().slice(0, 20_000),
      source: 'manual',
      status: 'active',
    })
    .select('*')
    .single();
  if (res.error) throw new Error(`knowledge create failed: ${res.error.message}`);
  await recordAudit({
    siteId: input.siteId,
    actorClerkUserId: input.clerkUserId,
    action: 'knowledge_added',
    detail: { id: res.data.id, source: 'manual' },
  });
  return mapEntry(res.data as unknown as Record<string, unknown>);
}

/** Server-side page fetch + tag-strip so merchant JS never runs here and no
 *  storefront secret is needed. Content is capped hard before storage. */
export function extractReadableText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const text = withoutScripts
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 15_000);
}

/* This fetch is merchant-triggered but runs from our server with our network
   position, so it is an SSRF primitive unless the destination is checked —
   and checking only the submitted URL is not enough, since a public host can
   redirect into the private range. Every hop is validated. */
const MAX_REDIRECTS = 3;

function assertPublicTarget(parsed: URL): void {
  if (parsed.protocol !== 'https:') throw new Error('Only https:// URLs are supported.');
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    isPrivateIp(host)
  ) {
    throw new Error('That address is not reachable from the public internet.');
  }
}

export async function fetchUrlKnowledge(url: string): Promise<{ title: string; content: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Enter a valid https:// URL.');
  }
  assertPublicTarget(parsed);

  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    res = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'text/html' },
      redirect: 'manual',
    }).catch(() => null);
    if (!res) break;
    if (res.status < 300 || res.status > 399) break;
    const location = res.headers.get('location');
    if (!location) break;
    parsed = new URL(location, parsed);
    assertPublicTarget(parsed);
    res = null;
  }
  if (!res || !res.ok) throw new Error('Could not reach that page. Check the URL and try again.');
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('html') && !contentType.includes('text')) {
    throw new Error('That link does not look like a readable page.');
  }
  const buffer = await res.arrayBuffer();
  const html = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, FETCH_MAX_BYTES));
  const content = extractReadableText(html);
  if (content.length < 40) throw new Error('That page had almost no readable text.');
  const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return { title: (titleMatch?.[1] ?? parsed.hostname).trim(), content };
}

export async function addUrlKnowledge(input: {
  clerkUserId: string;
  siteId: string;
  url: string;
}): Promise<KnowledgeEntry> {
  await requireOwnedSite(input.clerkUserId, input.siteId);
  const { title, content } = await fetchUrlKnowledge(input.url);
  return addManualKnowledge({
    clerkUserId: input.clerkUserId,
    siteId: input.siteId,
    title,
    content,
  }).then(async (entry) => {
    const supabase = getMessengerServiceClient();
    await supabase
      .from('messenger_knowledge')
      .update({ source: 'url', source_url: input.url.slice(0, 500), last_synced_at: new Date().toISOString() })
      .eq('id', entry.id);
    return { ...entry, source: 'url' as const, source_url: input.url.slice(0, 500) };
  });
}

/** Re-fetches an existing url-source entry in place. */
export async function reSyncKnowledge(input: { clerkUserId: string; siteId: string; entryId: string }): Promise<void> {
  const owned = await requireOwnedSite(input.clerkUserId, input.siteId);
  void owned;
  const supabase = getMessengerServiceClient();
  const current = await supabase
    .from('messenger_knowledge')
    .select('*')
    .eq('id', input.entryId)
    .eq('widget_site_id', input.siteId)
    .maybeSingle();
  if (!current.data) throw new Error('Knowledge entry not found.');
  const entry = mapEntry(current.data as unknown as Record<string, unknown>);
  if (entry.source !== 'url' || !entry.source_url) throw new Error('Only linked pages can be re-synced.');

  const { content } = await fetchUrlKnowledge(entry.source_url);
  await supabase
    .from('messenger_knowledge')
    .update({ content, last_synced_at: new Date().toISOString() })
    .eq('id', entry.id);
}

export async function setKnowledgeStatus(input: {
  clerkUserId: string;
  siteId: string;
  entryId: string;
  status: 'active' | 'disabled';
}): Promise<void> {
  await requireOwnedSite(input.clerkUserId, input.siteId);
  const supabase = getMessengerServiceClient();
  await supabase
    .from('messenger_knowledge')
    .update({ status: input.status })
    .eq('id', input.entryId)
    .eq('widget_site_id', input.siteId);
}

export async function removeKnowledge(input: { clerkUserId: string; siteId: string; entryId: string }): Promise<void> {
  await requireOwnedSite(input.clerkUserId, input.siteId);
  const supabase = getMessengerServiceClient();
  await supabase.from('messenger_knowledge').delete().eq('id', input.entryId).eq('widget_site_id', input.siteId);
  await recordAudit({
    siteId: input.siteId,
    actorClerkUserId: input.clerkUserId,
    action: 'knowledge_removed',
    detail: { id: input.entryId },
  });
}

/** Dashboard-facing wrapper that also proves caller identity once. */
export async function currentClerkUser(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return userId;
}
