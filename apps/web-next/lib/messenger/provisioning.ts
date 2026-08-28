import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { getMessengerServiceClient } from './db';
import type { WidgetSiteRow } from './types';

/* Lazy provisioning of the existing profiles -> workspaces -> widget_sites
   foundation. The dashboard's original workspace RPC was never provisioned
   in production, so Messenger creates these rows directly (service role)
   the first time a merchant opens the Messenger section — idempotently.
   Everything downstream (RLS policies, analytics RPCs, Install page data)
   already understands this shape, which is precisely why we reuse it. */

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export interface ProfileRow {
  id: string;
  clerk_user_id: string;
  email: string;
}

export async function requireClerkUser(): Promise<{ userId: string; email: string | null }> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();
  return { userId, email: null };
}

async function ensureProfile(clerkUserId: string, email: string | null): Promise<ProfileRow> {
  const supabase = getMessengerServiceClient();
  const existing = await supabase
    .from('profiles')
    .select('id, clerk_user_id, email')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  if (existing.error) throw new Error(`profile lookup failed: ${existing.error.message}`);
  if (existing.data) return existing.data as ProfileRow;

  const insert = await supabase
    .from('profiles')
    .insert({ clerk_user_id: clerkUserId, email: email ?? `${clerkUserId}@users.noreply.clerk.dev` })
    .select('id, clerk_user_id, email')
    .single();
  if (insert.error) {
    // Concurrent first visit: another request created it first.
    const raced = await supabase
      .from('profiles')
      .select('id, clerk_user_id, email')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();
    if (raced.data) return raced.data as ProfileRow;
    throw new Error(`profile create failed: ${insert.error.message}`);
  }
  return insert.data as ProfileRow;
}

async function ensureWorkspace(profileId: string, clerkUserId: string): Promise<string> {
  const supabase = getMessengerServiceClient();
  const existing = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_profile_id', profileId)
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(`workspace lookup failed: ${existing.error.message}`);
  if (existing.data) return existing.data.id as string;

  const slug = `gc-${clerkUserId.replace(/[^a-zA-Z0-9]/g, '').slice(-12).toLowerCase()}-${Date.now()
    .toString(36)
    .slice(-4)}`;
  const insert = await supabase
    .from('workspaces')
    .insert({ name: 'My workspace', slug, owner_profile_id: profileId })
    .select('id')
    .single();
  if (insert.error) {
    const raced = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_profile_id', profileId)
      .limit(1)
      .maybeSingle();
    if (raced.data) return raced.data.id as string;
    throw new Error(`workspace create failed: ${insert.error.message}`);
  }
  // handle_new_workspace_owner trigger adds owner membership automatically.
  return insert.data.id as string;
}

export interface MessengerSiteView extends WidgetSiteRow {
  hasDraft: boolean;
}

function toView(row: Record<string, unknown>): MessengerSiteView {
  return {
    id: row.id as string,
    workspace_id: row.workspace_id as string,
    name: row.name as string,
    embed_key: row.embed_key as string,
    status: row.status as WidgetSiteRow['status'],
    domain: (row.domain as string | null) ?? null,
    settings_json: (row.settings_json as Record<string, unknown>) ?? {},
    settings_version: (row.settings_version as number) ?? 1,
    settings_draft: (row.settings_draft as Record<string, unknown> | null) ?? null,
    hasDraft: Boolean(row.settings_draft && Object.keys(row.settings_draft as object).length > 0),
  };
}

/** All widget sites inside workspaces owned by this Clerk user. */
export async function listMessengerSites(clerkUserId: string, email?: string | null): Promise<MessengerSiteView[]> {
  const supabase = getMessengerServiceClient();
  const profile = await ensureProfile(clerkUserId, email ?? null);
  const workspaceId = await ensureWorkspace(profile.id, clerkUserId);

  const rows = await supabase
    .from('widget_sites')
    .select(
      'id, workspace_id, name, embed_key, status, domain, settings_json, settings_version, settings_draft',
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  if (rows.error) throw new Error(`site list failed: ${rows.error.message}`);
  return ((rows.data ?? []) as Array<Record<string, unknown>>).map(toView);
}

/** Creates (once) a site for a store domain within the caller's workspace.
 *  A null domain is a real state — the merchant has no store connected yet —
 *  and must stay null rather than being stamped with a sentinel string that
 *  outlives the condition it described. */
export async function ensureMessengerSite(
  clerkUserId: string,
  domain: string | null,
  displayName?: string,
): Promise<MessengerSiteView> {
  const supabase = getMessengerServiceClient();
  const sites = await listMessengerSites(clerkUserId);
  const found = domain
    ? sites.find((site) => site.domain === domain || site.name === domain)
    : sites.find((site) => !site.domain);
  if (found) return found;

  const profile = await ensureProfile(clerkUserId, null);
  const workspaceId = await ensureWorkspace(profile.id, clerkUserId);
  const inserted = await supabase
    .from('widget_sites')
    .insert({
      workspace_id: workspaceId,
      name: displayName ?? domain ?? 'My store',
      domain,
      status: 'draft',
      created_by_profile_id: profile.id,
      settings_json: {},
    })
    .select(
      'id, workspace_id, name, embed_key, status, domain, settings_json, settings_version, settings_draft',
    )
    .single();
  if (inserted.error) {
    const raced = await listMessengerSites(clerkUserId);
    const racedFound = raced.find((site) => (site.domain ?? '') === domain || site.name === domain);
    if (racedFound) return racedFound;
    throw new Error(`site create failed: ${inserted.error.message}`);
  }
  return toView(inserted.data as unknown as Record<string, unknown>);
}

/** Authorization gate for every mutating dashboard action. */
export async function requireOwnedSite(clerkUserId: string, siteId: string): Promise<MessengerSiteView> {
  const sites = await listMessengerSites(clerkUserId);
  const site = sites.find((candidate) => candidate.id === siteId);
  if (!site) throw new UnauthorizedError();
  return site;
}

/** Profile row id for assignment bookkeeping on conversations. */
export async function getProfileId(clerkUserId: string): Promise<string> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  if (res.error || !res.data) throw new Error('Profile lookup failed.');
  return res.data.id as string;
}
