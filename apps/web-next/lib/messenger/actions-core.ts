import 'server-only';

import { getMessengerServiceClient } from './db';
import { recordAudit } from './conversations';
import {
  CONFIG_SECTIONS,
  MESSENGER_SECTION_NAMES,
  resolveMessengerConfig,
  toSettingsSections,
  type MessengerSection,
} from './config';
import type { MessengerSiteView } from './provisioning';

/* The dashboard's server actions (actions.ts) and the embedded Store Chat
   route handlers authorize a caller two completely different ways —
   requireOwnedSite's Clerk-session proof vs. ensureShopOwnedSite's verified
   shop-domain proof. Everything AFTER that point — validating the payload,
   writing widget_sites, recording the audit trail — is identical, so it
   lives here once. Every function takes a `site` its caller has already
   resolved and authorized; none of them re-check ownership.

   Infrastructure failures throw rather than returning `{ ok: false }`.
   Every caller must catch the throw and must not surface the raw
   `error.message` (Postgres/Supabase internals) to an untrusted client; map
   it to a generic message instead, as actions.ts's local `fail()` helper does
   for the dashboard. */

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function sectionToKey(section: MessengerSection, payload: Record<string, unknown>): Record<string, unknown> {
  return { [CONFIG_SECTIONS[section]]: payload };
}

/** `payload` must be the complete section object — publish performs a
 *  section-level replace, not a field-wise merge, so a partial payload
 *  here will reset the missing fields to defaults on publish. */
export async function saveDraftSectionForSite(
  site: MessengerSiteView,
  section: MessengerSection,
  payload: object,
): Promise<ActionResult> {
  // Section name arrives from the client, so it is checked against the
  // registry rather than trusted to be one of the declared union members.
  if (!MESSENGER_SECTION_NAMES.includes(section)) {
    return { ok: false, error: 'Unknown section.' };
  }
  const record = payload as Record<string, unknown>;

  const supabase = getMessengerServiceClient();
  const existingDraft = (site.settings_draft ?? {}) as Record<string, unknown>;
  const nextDraft = { ...existingDraft, ...sectionToKey(section, record) };
  const res = await supabase.from('widget_sites').update({ settings_draft: nextDraft }).eq('id', site.id);
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}

/* Several sections in ONE read-modify-write.

   Support Desk saved its four sections with Promise.all, and every
   saveDraftSectionForSite call reads settings_draft, merges its own section
   in, and writes the whole object back. Run concurrently against the same
   starting snapshot, the last write wins and the other three sections are
   lost — so a merchant could tick "Let shoppers attach a photo", press Save,
   get a success message, and find the box unchecked again, because the
   orderLookup write landed last and carried an older draft with it.

   Nothing about that failure is visible: each individual call really did
   succeed. Batching removes the race rather than papering over it with
   sequential awaits, and collapses four round trips into one, which is also
   the reason Save felt slow. */
export async function saveDraftSectionsForSite(
  site: MessengerSiteView,
  sections: ReadonlyArray<{ section: MessengerSection; payload: object }>,
): Promise<ActionResult> {
  if (sections.length === 0) return { ok: true };
  for (const entry of sections) {
    if (!MESSENGER_SECTION_NAMES.includes(entry.section)) {
      return { ok: false, error: 'Unknown section.' };
    }
  }

  const supabase = getMessengerServiceClient();
  const existingDraft = (site.settings_draft ?? {}) as Record<string, unknown>;
  const nextDraft = sections.reduce<Record<string, unknown>>(
    (draft, entry) => ({
      ...draft,
      ...sectionToKey(entry.section, entry.payload as Record<string, unknown>),
    }),
    { ...existingDraft },
  );
  const res = await supabase.from('widget_sites').update({ settings_draft: nextDraft }).eq('id', site.id);
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}

export async function publishConfigForSite(
  site: MessengerSiteView,
  actorClerkUserId: string,
): Promise<ActionResult> {
  const draft = site.settings_draft;
  if (!draft || Object.keys(draft).length === 0) {
    return { ok: false, error: 'Nothing to publish yet.' };
  }
  // Resolve once more against published so partial drafts land complete.
  const merged = {
    ...(site.settings_json as Record<string, unknown>),
    ...(draft as Record<string, unknown>),
  };
  const resolved = resolveMessengerConfig(merged);
  const nextSettings: Record<string, unknown> = {
    ...(site.settings_json as Record<string, unknown>),
    ...toSettingsSections(resolved),
  };

  /* Optimistic concurrency on the version we read: two callers publishing at
     once would otherwise both write version+1, so the second silently
     overwrites the first — and since storefronts cache by version, the lost
     publish looks like nothing happened. */
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('widget_sites')
    .update({
      settings_json: nextSettings,
      settings_version: site.settings_version + 1,
      settings_draft: null,
    })
    .eq('id', site.id)
    .eq('settings_version', site.settings_version)
    .select('id');
  if (res.error) throw new Error(res.error.message);
  if ((res.data ?? []).length === 0) {
    return { ok: false, error: 'Someone else published while you were editing. Refresh and try again.' };
  }

  await recordAudit({
    siteId: site.id,
    actorClerkUserId,
    action: 'config_published',
    detail: { version: site.settings_version + 1 },
  });
  return { ok: true, message: 'Published — live on your store within a minute.' };
}

export async function setMessengerEnabledForSite(
  site: MessengerSiteView,
  actorClerkUserId: string,
  enabled: boolean,
): Promise<ActionResult> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('widget_sites')
    .update({ status: enabled ? 'active' : 'draft' })
    .eq('id', site.id);
  if (res.error) throw new Error(res.error.message);
  await recordAudit({
    siteId: site.id,
    actorClerkUserId,
    action: enabled ? 'messenger_enabled' : 'messenger_disabled',
  });
  return { ok: true };
}
