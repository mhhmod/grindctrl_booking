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
async function ensureWorkspace(profileId: string): Promise<string> {
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

  // A uniqueness token, not a user-facing handle: the profile id already is
  // one, and deriving it from the clerk id collapsed to a single value for
  // every shop on the platform (normalizeShopDomain guarantees every domain
  // ends `.myshopify.com`, so the old clerkUserId-derived slug stripped to
  // the same 'myshopifycom' tail for every store).
  const slug = `gc-${profileId}`;
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

export function shouldEnsureMessengerSite(
  sites: Array<Pick<MessengerSiteView, 'domain'>>,
  domain: string | null,
): boolean {
  return sites.length === 0 || Boolean(domain && !sites.some((site) => site.domain === domain));
}

/** After provisioning, the caller re-lists so a domain just attached to an
 *  existing row shows up. That re-list resolves the workspace again, and
 *  ensureWorkspace has no unique key on owner_profile_id, so a concurrent
 *  first visit can leave a second workspace behind and the re-list can come
 *  back empty for the row that was just created. The dashboard then rendered
 *  `sites[0].settings_json` on undefined and 500'd. Keeping the provisioned
 *  row as the floor makes "non-empty after provisioning" a property of one
 *  tested function instead of an assumption each caller has to remember. */
export function resolveProvisionedSites<T>(refreshed: readonly T[], ensured: T): T[] {
  return refreshed.length > 0 ? [...refreshed] : [ensured];
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

/** A single site by id, regardless of which workspace owns it — for callers
 *  (like ensureShopOwnedSite) that were handed the id by findSiteByDomain
 *  and don't need or want the owner-scoped listMessengerSites machinery. */
export async function getSiteView(siteId: string): Promise<MessengerSiteView> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('widget_sites')
    .select(
      'id, workspace_id, name, embed_key, status, domain, settings_json, settings_version, settings_draft',
    )
    .eq('id', siteId)
    .maybeSingle();
  if (res.error) throw new Error(`site lookup failed: ${res.error.message}`);
  if (!res.data) throw new Error(`site ${siteId} not found`);
  return toView(res.data as unknown as Record<string, unknown>);
}

/** All widget sites inside workspaces owned by this Clerk user. */
export async function listMessengerSites(clerkUserId: string, email?: string | null): Promise<MessengerSiteView[]> {
  const supabase = getMessengerServiceClient();
  const profile = await ensureProfile(clerkUserId, email ?? null);
  const workspaceId = await ensureWorkspace(profile.id);

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

/** Adoptable when it is already this caller's, or parked under a synthetic
 *  shop profile. Anything else is someone else's live storefront. Shared by
 *  both the main adopt-or-refuse check and the insert-error race fallback
 *  below — those two used to apply different rules, so a caller who lost the
 *  insert race against their own concurrent request could be refused their
 *  own store's site. */
function mayAdopt(owner: string | null, clerkUserId: string): boolean {
  return Boolean(owner) && (owner === clerkUserId || isShopProfileId(owner!));
}

/** Transfers an already-adoptable site into `workspaceId`. Compare-and-swap
 *  on (id, workspace_id): adoption is the only thing that ever changes
 *  workspace_id, so "still where I found it" means "still unclaimed since I
 *  looked" — without this, a second adopter racing the first would
 *  unconditionally steal a site the first adopter already won. Shared by the
 *  main adopt-or-refuse check and the insert-error race fallback so both
 *  paths transfer the same way instead of one silently refusing what the
 *  other would have adopted. */
async function adoptSite(
  existing: { id: string; workspace_id: string },
  workspaceId: string,
  profileId: string,
  domain: string,
): Promise<MessengerSiteView> {
  const supabase = getMessengerServiceClient();
  const adopted = await supabase
    .from('widget_sites')
    .update({ workspace_id: workspaceId, created_by_profile_id: profileId })
    .eq('id', existing.id)
    .eq('workspace_id', existing.workspace_id)
    .select(
      'id, workspace_id, name, embed_key, status, domain, settings_json, settings_version, settings_draft',
    )
    .maybeSingle();
  if (adopted.error) throw new Error(`site adoption failed: ${adopted.error.message}`);
  // Zero rows means someone else's adoption (or a deletion) claimed it
  // between our read and our write — not a state we can silently retry.
  if (!adopted.data) throw new StoreOwnedByAnotherAccountError(domain);
  return toView(adopted.data as unknown as Record<string, unknown>);
}

async function reconcileDomainlessOrphans(workspaceId: string, keepSiteId: string): Promise<void> {
  const supabase = getMessengerServiceClient();
  const orphans = await supabase
    .from('widget_sites')
    .select('id, settings_json, settings_draft')
    .eq('workspace_id', workspaceId)
    .is('domain', null)
    .neq('id', keepSiteId);
  if (orphans.error) throw new Error(`orphan lookup failed: ${orphans.error.message}`);

  for (const orphan of (orphans.data ?? []) as Array<{
    id: string;
    settings_json: unknown;
    settings_draft: unknown;
  }>) {
    const settingsEmpty = !orphan.settings_json || Object.keys(orphan.settings_json as object).length === 0;
    const draftEmpty = !orphan.settings_draft || Object.keys(orphan.settings_draft as object).length === 0;
    if (!settingsEmpty || !draftEmpty) {
      console.warn(`[messenger] orphan ${orphan.id} has settings/draft — leaving for manual review`);
      continue;
    }

    const [conversations, knowledge] = await Promise.all([
      supabase.from('widget_conversations').select('id', { count: 'exact', head: true }).eq('widget_site_id', orphan.id),
      supabase.from('messenger_knowledge').select('id', { count: 'exact', head: true }).eq('widget_site_id', orphan.id),
    ]);
    if ((conversations.count ?? 0) > 0 || (knowledge.count ?? 0) > 0) {
      console.warn(`[messenger] orphan ${orphan.id} has conversation/knowledge history — leaving for manual review`);
      continue;
    }

    const deleted = await supabase.from('widget_sites').delete().eq('id', orphan.id).eq('workspace_id', workspaceId);
    if (deleted.error) {
      console.warn(`[messenger] orphan ${orphan.id} delete failed: ${deleted.error.message}`);
    }
  }
}

/** Ensures a site exists for a store domain — adopting one another account
 *  already created (a synthetic shop profile, or a stray workspace of this
 *  same merchant's own — see the race note on ensureWorkspace above) rather
 *  than creating a duplicate, or refusing when a different real account
 *  holds it. A null domain is a real state — the merchant has no store
 *  connected yet — and must stay null rather than being stamped with a
 *  sentinel string that outlives the condition it described. */
export async function ensureMessengerSite(
  clerkUserId: string,
  domain: string | null,
  displayName?: string,
): Promise<MessengerSiteView> {
  // REQUIRED, not cosmetic: uq_widget_sites_domain and
  // widget_sites_domain_canonical_check reject anything but the canonical
  // form, so every reference to `domain` below must use this value, not the
  // raw argument. `|| null` also catches a whitespace-only input: it
  // canonicalises to '', which is legal under the CHECK and a live key in
  // the partial unique index (only NULL is exempt) — persisting it would
  // silently claim the domain-less slot instead of leaving it null.
  domain = domain ? canonicalShopDomain(domain) || null : null;

  const supabase = getMessengerServiceClient();
  const sites = await listMessengerSites(clerkUserId);
  const found = domain
    ? sites.find((site) => site.domain === domain || site.name === domain)
    : sites.find((site) => !site.domain);
  if (found) return found;

  const profile = await ensureProfile(clerkUserId, null);
  const workspaceId = await ensureWorkspace(profile.id);

  /* Before creating anything, ask whether this STORE already has a config
     somewhere — not merely in the caller's workspace. It usually will once
     the embedded Shopify app lands: it will provision one on first open
     under a synthetic shop profile. Skipping this check is exactly how one
     storefront ended up able to have two configs with two embed keys, one
     live and one being edited. uq_widget_sites_domain now makes the second
     insert fail outright, so this is also what turns a raw constraint
     violation into an answer the merchant can act on. */
  if (domain) {
    const existing = await findSiteByDomain(domain);
    if (existing && existing.workspace_id !== workspaceId) {
      const owner = existing.ownerClerkUserId;
      // ensureWorkspace's race (no unique key on owner_profile_id) can leave
      // a site in a stray *second* workspace of the same account, and
      // refusing there would lock the merchant out of their own store with
      // no retry that could ever clear it. A store held by a different real
      // account, or one we can't identify at all, is not adoptable.
      if (!mayAdopt(owner, clerkUserId)) {
        throw new StoreOwnedByAnotherAccountError(domain);
      }
      const adopted = await adoptSite(existing, workspaceId, profile.id, domain);
      try {
        await reconcileDomainlessOrphans(workspaceId, adopted.id);
      } catch (error) {
        // A reconcile failure must never turn a successful adopt into a user-visible error.
        console.warn('[messenger] orphan reconcile failed:', error instanceof Error ? error.message : error);
      }
      return adopted;
    }
  }

  if (domain) {
    const orphan = sites.find((site) => !site.domain);
    if (orphan) {
      const attached = await supabase
        .from('widget_sites')
        .update({ domain })
        .eq('id', orphan.id)
        .is('domain', null)
        .select(
          'id, workspace_id, name, embed_key, status, domain, settings_json, settings_version, settings_draft',
        )
        .maybeSingle();
      if (attached.error) throw new Error(`domain attach failed: ${attached.error.message}`);
      if (attached.data) return toView(attached.data as unknown as Record<string, unknown>);
      // CAS lost the race (a concurrent caller attached first) — fall through to the existing insert path below.
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
    const racedSites = await listMessengerSites(clerkUserId);
    const racedFound = domain
      ? racedSites.find((site) => site.domain === domain || site.name === domain)
      : racedSites.find((site) => !site.domain);
    if (racedFound) return racedFound;
    // The unique index can also be lost to a *different* Clerk user's insert
    // racing ours with no pre-existing row for either of us to adopt.
    // `racedSites` above is scoped to our own workspace and will never see
    // that row — ask globally so this reaches the readable refusal instead
    // of a raw 23505 unique-violation message.
    if (domain) {
      const claimed = await findSiteByDomain(domain);
      if (claimed && claimed.workspace_id !== workspaceId) {
        // Same adoptability rule as the main check above: a caller that lost
        // the insert race against its OWN concurrent request (e.g. two first
        // opens of an unclaimed shop, racing ensureWorkspace into two
        // workspaces for the same profile) must adopt what it just lost the
        // race for, not be told its own store belongs to someone else.
        if (mayAdopt(claimed.ownerClerkUserId, clerkUserId)) {
          const adopted = await adoptSite(claimed, workspaceId, profile.id, domain);
          try {
            await reconcileDomainlessOrphans(workspaceId, adopted.id);
          } catch (error) {
            // A reconcile failure must never turn a successful adopt into a user-visible error.
            console.warn('[messenger] orphan reconcile failed:', error instanceof Error ? error.message : error);
          }
          return adopted;
        }
        throw new StoreOwnedByAnotherAccountError(domain);
      }
    }
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
