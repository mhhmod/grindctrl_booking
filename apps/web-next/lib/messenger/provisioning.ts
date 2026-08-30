import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { getMessengerServiceClient } from './db';
import { isPlaceholderEmail, PLACEHOLDER_EMAIL_SUFFIX } from './emails';
import { canonicalShopDomain, findSiteByDomain, isShopProfileId, StoreOwnedByAnotherAccountError } from './shop-tenancy';
import type { WidgetSiteRow } from './types';

export { isPlaceholderEmail };

/* Lazy provisioning of the existing profiles -> workspaces -> widget_sites
   foundation. The dashboard's original workspace RPC was never provisioned
   in production, so Messenger creates these rows directly (service role)
   the first time a merchant opens the Messenger section — idempotently.
   Everything downstream (RLS policies, analytics RPCs, Install page data)
   already understands this shape, which is precisely why we reuse it. */

/* Three attempts at ~150ms of total added latency, and only on the racing
   path — a first visit that collides with itself. Every later visit takes
   the `existing` branch and never reaches the loop. */
const PROFILE_CREATE_ATTEMPTS = 3;
const PROFILE_RETRY_BASE_MS = 50;

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
  if (existing.data) {
    const row = existing.data as ProfileRow;
    /* Provisioning ran before any real address was available, so the row
       holds a placeholder nobody can receive mail at. Upgrade it the first
       time a real one arrives — and never the other way round, or a later
       visit would wipe a working address. */
    if (email && !isPlaceholderEmail(email) && isPlaceholderEmail(row.email)) {
      const updated = await supabase.from('profiles').update({ email }).eq('id', row.id);
      if (updated.error) throw new Error(`profile email upgrade failed: ${updated.error.message}`);
      return { ...row, email };
    }
    return row;
  }

  /* Read-then-insert is not atomic, and a first visit renders this page more
     than once concurrently — both reads miss, both insert, one dies on
     profiles_clerk_user_id_key. `on conflict do nothing` makes the write
     itself safe; ignoreDuplicates (rather than a real upsert) is deliberate,
     because an upsert would overwrite a known email with the noreply
     placeholder on every later visit.

     What that still leaves: DO NOTHING reports success *without writing*
     when a concurrent request holds the unique-index slot, and the winner's
     row is not guaranteed to be visible to this connection the moment our
     statement returns. This code used to read once and assume it was —
     "whoever won the race, the row is committed by now" — which threw and
     500'd the entire dashboard on a user's first ever visit. It happened in
     production at 2026-08-29 22:20:10, where the winning row's transaction
     had started at .224 and the loser's read at .978 still came back empty;
     Next prefetching this route while navigating to it supplies the second
     request. Retrying the write as well as the read also covers the case
     where the winner rolled back, which re-reading alone would never fix. */
  for (let attempt = 0; attempt < PROFILE_CREATE_ATTEMPTS; attempt += 1) {
    const insert = await supabase
      .from('profiles')
      .upsert(
        { clerk_user_id: clerkUserId, email: email ?? `${clerkUserId}${PLACEHOLDER_EMAIL_SUFFIX}` },
        { onConflict: 'clerk_user_id', ignoreDuplicates: true },
      );
    if (insert.error) throw new Error(`profile create failed: ${insert.error.message}`);

    const settled = await supabase
      .from('profiles')
      .select('id, clerk_user_id, email')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();
    if (settled.error) throw new Error(`profile lookup failed: ${settled.error.message}`);
    if (settled.data) return settled.data as ProfileRow;

    // Bounded: a page that hangs is worse than one that reports a failure.
    if (attempt < PROFILE_CREATE_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, PROFILE_RETRY_BASE_MS * (attempt + 1)));
    }
  }
  throw new Error('profile create failed: row missing after insert');
}

/* Oldest-first everywhere, deliberately: workspaces has no unique key on
   owner_profile_id, so a concurrent first visit can leave two rows behind.
   An unordered limit(1) would then hop between them from request to request
   and a merchant's sites would appear to come and go. Oldest wins, which is
   also what the bootstrap_workspace RPC picks. */
async function ensureWorkspace(profileId: string, clerkUserId: string): Promise<string> {
  const supabase = getMessengerServiceClient();
  const existing = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_profile_id', profileId)
    .order('created_at', { ascending: true })
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
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (raced.data) return raced.data.id as string;
    throw new Error(`workspace create failed: ${insert.error.message}`);
  }
  /* Re-read rather than trusting our own insert: a concurrent render may
     have committed an earlier workspace, and both requests must agree on
     which one is the merchant's. handle_new_workspace_owner adds the owner
     membership on whichever rows were created. */
  const settled = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_profile_id', profileId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (settled.data?.id as string) ?? (insert.data.id as string);
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

/** Site ids for the sidebar badge count — read-only, never provisions.
 *  listMessengerSites() calls ensureProfile/ensureWorkspace, which INSERT a
 *  profile and workspace row the first time they're missing. That's fine
 *  when the merchant is actually opening Store Chat, but the badge runs on
 *  every dashboard navigation (e.g. Try-On), and a user who has never opened
 *  Store Chat must not get a workspace provisioned as a side effect of
 *  looking at an unrelated page. No profile/workspace yet just means no
 *  sites yet, so short-circuit to []. */
export async function listMessengerSiteIdsReadOnly(clerkUserId: string): Promise<string[]> {
  const supabase = getMessengerServiceClient();
  const profile = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  if (profile.error || !profile.data) return [];

  const workspace = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_profile_id', profile.data.id as string)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (workspace.error || !workspace.data) return [];

  const sites = await supabase
    .from('widget_sites')
    .select('id')
    .eq('workspace_id', workspace.data.id as string);
  if (sites.error) return [];
  return ((sites.data ?? []) as Array<{ id: string }>).map((row) => row.id);
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
  // REQUIRED, not cosmetic: uq_widget_sites_domain and
  // widget_sites_domain_canonical_check reject anything but the canonical
  // form, so every reference to `domain` below must use this value, not the
  // raw argument.
  domain = domain ? canonicalShopDomain(domain) : domain;

  const supabase = getMessengerServiceClient();
  const sites = await listMessengerSites(clerkUserId);
  const found = domain
    ? sites.find((site) => site.domain === domain || site.name === domain)
    : sites.find((site) => !site.domain);
  if (found) return found;

  const profile = await ensureProfile(clerkUserId, null);
  const workspaceId = await ensureWorkspace(profile.id, clerkUserId);

  /* Before creating anything, ask whether this STORE already has a config
     somewhere — not merely in the caller's workspace. It usually will: the
     embedded Shopify app provisions one on first open under a synthetic
     shop profile. Skipping this check is exactly how one storefront ended
     up able to have two configs with two embed keys, one live and one being
     edited. uq_widget_sites_domain now makes the second insert fail
     outright, so this is also what turns a raw constraint violation into an
     answer the merchant can act on. */
  if (domain) {
    const existing = await findSiteByDomain(domain);
    if (existing && existing.workspace_id !== workspaceId) {
      // A store parked under a synthetic shop profile belongs to whoever
      // proves they run it. A store held by a real account does not — and
      // an owner we cannot identify is not an invitation either.
      if (!existing.ownerClerkUserId || !isShopProfileId(existing.ownerClerkUserId)) {
        throw new StoreOwnedByAnotherAccountError(domain);
      }
      const adopted = await supabase
        .from('widget_sites')
        .update({ workspace_id: workspaceId, created_by_profile_id: profile.id })
        .eq('id', existing.id);
      if (adopted.error) throw new Error(`site adoption failed: ${adopted.error.message}`);

      const refreshed = await listMessengerSites(clerkUserId);
      const mine = refreshed.find((site) => site.id === existing.id);
      if (mine) return mine;
    }
  }

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
