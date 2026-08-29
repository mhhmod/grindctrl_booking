import 'server-only';

import { getMessengerServiceClient } from './db';
import { decideOrigin, type DomainPatternRow } from './origins';
import { resolveMessengerConfig } from './config';
import type { MessengerConfig } from './types';
import type { MessengerBehaviour } from './types';

/* Server-side resolution used by every public messenger endpoint: an embed
   key resolves to exactly one site, the caller's origin must be admitted,
   and only the PUBLISHED configuration is ever served to storefronts. */

export interface ResolvedPublicSite {
  id: string;
  name: string;
  embed_key: string;
  status: string;
  settings_version: number;
  workspace_id: string;
  config: MessengerConfig;
  security: { allow_localhost: boolean };
  patterns: DomainPatternRow[];
}

export async function loadPublicSite(embedKey: string): Promise<ResolvedPublicSite | null> {
  const supabase = getMessengerServiceClient();
  const siteRes = await supabase
    .from('widget_sites')
    .select('id, name, embed_key, status, settings_json, settings_version, workspace_id')
    .eq('embed_key', embedKey)
    .maybeSingle();
  if (siteRes.error || !siteRes.data) return null;
  const row = siteRes.data as Record<string, unknown>;

  const domainsRes = await supabase
    .from('widget_domains')
    .select('pattern, verification_status, environment')
    .eq('widget_site_id', row.id as string);

  const settings = (row.settings_json ?? {}) as Record<string, unknown>;
  const securityRaw = (settings.security ?? {}) as Record<string, unknown>;

  return {
    id: row.id as string,
    name: row.name as string,
    embed_key: row.embed_key as string,
    status: row.status as string,
    settings_version: (row.settings_version as number) ?? 1,
    workspace_id: row.workspace_id as string,
    config: resolveMessengerConfig(settings),
    security: { allow_localhost: securityRaw.allow_localhost === true },
    patterns: ((domainsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      pattern: String(row.pattern ?? ''),
      verification_status: String(row.verification_status ?? ''),
      environment: String(row.environment ?? 'production'),
    })) satisfies DomainPatternRow[],
  };
}

/** Resolves a site by its store domain (Shopify app-embed path: the theme
 *  block knows only the shop's permanent domain — zero merchant setup). */
export async function loadPublicSiteByDomain(shopDomain: string): Promise<ResolvedPublicSite | null> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('widget_sites')
    .select('id, name, embed_key, status, settings_json, settings_version')
    .eq('domain', shopDomain.toLowerCase())
    .limit(1)
    .maybeSingle();
  if (res.error || !res.data) return null;
  const byKey = await loadPublicSite((res.data as { embed_key: string }).embed_key);
  return byKey;
}
export function originAllowed(
  site: ResolvedPublicSite,
  origin: string | null | undefined,
): boolean {
  return decideOrigin({ origin, patterns: site.patterns, security: site.security }).allowed;
}

/** Business-hours check in the merchant's configured timezone. */
export function isWithinAvailabilityHours(behaviour: MessengerBehaviour, now: Date): boolean {
  if (behaviour.availabilityMode === 'always') return true;
  if (!behaviour.availabilityTimezone || behaviour.availabilityHours.length === 0) return true;

  let parts: { weekday?: string; hour?: string; minute?: string };
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: behaviour.availabilityTimezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now).reduce<{ weekday?: string; hour?: string; minute?: string }>(
      (acc, part) => {
        if (part.type === 'weekday') acc.weekday = part.value;
        if (part.type === 'hour') acc.hour = part.value;
        if (part.type === 'minute') acc.minute = part.value;
        return acc;
      },
      {},
    );
  } catch {
    return true; // Bad tz string must not take the widget offline.
  }

  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday ?? '');
  if (dayIndex < 0 || parts.hour === undefined || parts.minute === undefined) return true;
  // "24" can appear with hourCycle h24 quirks; normalize.
  const hour = Number(parts.hour) % 24;
  const minuteOfDay = hour * 60 + Number(parts.minute);

  return behaviour.availabilityHours.some(
    (window) => window.day === dayIndex && minuteOfDay >= window.startMinute && minuteOfDay < window.endMinute,
  );
}

/* Public JSON payload delivered to loader + embed. Contains no secrets —
   the embed key is a public identifier by design. */
export interface PublicMessengerPayload {
  v: number;
  key: string;
  storeName: string;
  active: boolean;
  available: boolean;
  aiEnabled: boolean;
  appearance: MessengerConfig['appearance'];
  behaviour: Pick<
    MessengerConfig['behaviour'],
    | 'welcomeTitle'
    | 'welcomeSubtitle'
    | 'inputPlaceholder'
    | 'greetingEnabled'
    | 'greetingDelaySeconds'
    | 'greeting'
    | 'proactiveEnabled'
    | 'proactiveDelaySeconds'
    | 'targetingMode'
    | 'excludePatterns'
  >;
}

export function toPublicPayload(
  site: {
    name: string;
    embed_key: string;
    status: string;
    settings_version: number;
    config: MessengerConfig;
  },
  now: Date,
): PublicMessengerPayload {
  const active = site.status === 'active';
  return {
    v: site.settings_version,
    key: site.embed_key,
    storeName: site.name,
    active,
    available: active && isWithinAvailabilityHours(site.config.behaviour, now),
    aiEnabled: active && site.config.ai.enabled,
    appearance: site.config.appearance,
    behaviour: {
      welcomeTitle: site.config.behaviour.welcomeTitle,
      welcomeSubtitle: site.config.behaviour.welcomeSubtitle,
      inputPlaceholder: site.config.behaviour.inputPlaceholder,
      greetingEnabled: site.config.behaviour.greetingEnabled,
      greetingDelaySeconds: site.config.behaviour.greetingDelaySeconds,
      greeting: site.config.behaviour.greeting,
      proactiveEnabled: site.config.behaviour.proactiveEnabled,
      proactiveDelaySeconds: site.config.behaviour.proactiveDelaySeconds,
      targetingMode: site.config.behaviour.targetingMode,
      excludePatterns: site.config.behaviour.excludePatterns,
    },
  };
}
