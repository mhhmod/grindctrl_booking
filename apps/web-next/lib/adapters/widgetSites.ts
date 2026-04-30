import 'server-only';

import type { JsonObject, SettingsJson, WidgetSite } from '@/lib/types';

export function getSettingsDefaults(): SettingsJson {
  return {
    branding: {
      brand_name: '',
      assistant_name: 'Support',
      logo_url: '',
      avatar_url: '',
      launcher_label: 'Support',
      launcher_icon: 'chat',
      theme_mode: 'auto',
      radius_style: 'soft',
      attribution: {
        mode: 'auto',
        show_powered_by: true,
      },
    },
    widget: {
      position: 'bottom-right',
      default_open: false,
      show_intents: true,
      rtl_supported: true,
      locale: 'auto',
    },
    leads: {
      enabled: false,
      capture_timing: 'off',
      fields: ['name', 'email'],
      required_fields: ['email'],
      prompt_title: '',
      prompt_subtitle: '',
      skippable: false,
      dedupe: { mode: 'session' },
      consent: { mode: 'none', text: '', privacy_url: '' },
    },
    routing: {
      default_intent_behavior: 'chat',
      handoff: { enabled: false, channel: 'email', target: '' },
      availability: { enabled: false, timezone: 'UTC', hours: [] },
    },
    security: {
      allow_localhost: true,
      allowed_iframe_parents: [],
      rate_limits: { bootstrap_per_min: 60, messages_per_min: 20, leads_per_hour: 30 },
    },
  };
}

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeSettingsJson(raw: unknown): SettingsJson {
  const defaults = getSettingsDefaults();
  const source = isPlainObject(raw) ? raw : {};
  const branding = isPlainObject(source.branding) ? source.branding : {};
  const widget = isPlainObject(source.widget) ? source.widget : {};
  const leads = isPlainObject(source.leads) ? source.leads : {};
  const routing = isPlainObject(source.routing) ? source.routing : {};
  const routingAvailability = isPlainObject(routing.availability) ? routing.availability : {};
  const security = isPlainObject(source.security) ? source.security : {};

  return {
    ...defaults,
    ...source,
    branding: {
      ...defaults.branding,
      ...branding,
      attribution: {
        ...defaults.branding.attribution,
        ...(isPlainObject(branding.attribution) ? branding.attribution : {}),
      },
    },
    widget: {
      ...defaults.widget,
      ...widget,
    },
    leads: {
      ...defaults.leads,
      ...leads,
      fields: Array.isArray(leads.fields) ? leads.fields.map(String) : defaults.leads.fields,
      required_fields: Array.isArray(leads.required_fields) ? leads.required_fields.map(String) : defaults.leads.required_fields,
      dedupe: {
        ...defaults.leads.dedupe,
        ...(isPlainObject(leads.dedupe) ? leads.dedupe : {}),
      },
      consent: {
        ...defaults.leads.consent,
        ...(isPlainObject(leads.consent) ? leads.consent : {}),
      },
    },
    routing: {
      ...defaults.routing,
      ...routing,
      handoff: {
        ...defaults.routing.handoff,
        ...(isPlainObject(routing.handoff) ? routing.handoff : {}),
      },
      availability: {
        ...defaults.routing.availability,
        ...routingAvailability,
        hours: Array.isArray(routingAvailability.hours) ? routingAvailability.hours : defaults.routing.availability.hours,
      },
    },
    security: {
      ...defaults.security,
      ...security,
      allowed_iframe_parents: Array.isArray(security.allowed_iframe_parents) ? security.allowed_iframe_parents.map(String) : defaults.security.allowed_iframe_parents,
      rate_limits: {
        ...defaults.security.rate_limits,
        ...(isPlainObject(security.rate_limits) ? security.rate_limits : {}),
      },
    },
  };
}

export function selectWidgetSite(sites: WidgetSite[], siteId?: string | string[]) {
  const resolvedSiteId = Array.isArray(siteId) ? siteId[0] : siteId;
  return sites.find((site) => site.id === resolvedSiteId) ?? sites[0] ?? null;
}

export function buildWidgetSiteUpdateRpcParams(input: {
  clerkUserId: string;
  siteId: string;
  name?: string | null;
  status?: string | null;
  settingsJson?: JsonObject | null;
}) {
  return {
    p_clerk_user_id: input.clerkUserId,
    p_site_id: input.siteId,
    p_name: input.name ?? null,
    p_status: input.status ?? null,
    p_settings_json: input.settingsJson ?? null,
  };
}

export async function updateWidgetSite(input: {
  clerkUserId: string;
  siteId: string;
  name?: string | null;
  status?: string | null;
  settingsJson?: JsonObject | null;
}) {
  const { callRpc } = await import('@/lib/adapters/rpc');
  return callRpc<WidgetSite>('dashboard_update_widget_site', buildWidgetSiteUpdateRpcParams(input));
}
