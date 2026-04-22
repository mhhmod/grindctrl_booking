import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { getEnv } from '../_shared/env.ts';
import { errorJson, getOrigin, json, parseUrlOrigin, safeJsonBody } from '../_shared/http.ts';
import { anyAllowedDomainMatch, isLocalhostHost } from '../_shared/domains.ts';
import { signEmbedToken } from '../_shared/jwt.ts';
import { serviceClient } from '../_shared/supabase.ts';

const RUNTIME_VERSION = '1.0.0';
const EMBED_TOKEN_TTL_SEC = 60 * 60;

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function pickSettings(site: any): any {
  const settings = site?.settings_json && typeof site.settings_json === 'object' ? site.settings_json : {};
  const settingsVersion = typeof site?.settings_version === 'number' ? site.settings_version : 1;

  const branding = settings.branding || {};
  const widget = settings.widget || {};
  const leads = settings.leads || {};

  return {
    settingsVersion,
    branding: {
      brand_name: String(branding.brand_name || ''),
      assistant_name: String(branding.assistant_name || 'Support'),
      logo_url: String(branding.logo_url || ''),
      avatar_url: String(branding.avatar_url || ''),
      launcher_label: String(branding.launcher_label || 'Support'),
      launcher_icon: String(branding.launcher_icon || 'chat'),
      theme_mode: String(branding.theme_mode || 'auto'),
      radius_style: String(branding.radius_style || 'soft'),
      attribution: {
        mode: String(branding.attribution?.mode || 'auto'),
        show_powered_by: normalizeBoolean(branding.attribution?.show_powered_by, true)
      }
    },
    widget: {
      position: String(widget.position || 'bottom-right'),
      default_open: normalizeBoolean(widget.default_open, false),
      show_intents: normalizeBoolean(widget.show_intents, true),
      rtl_supported: normalizeBoolean(widget.rtl_supported, true),
      locale: String(widget.locale || 'auto')
    },
    leads: {
      enabled: normalizeBoolean(leads.enabled, false),
      capture_timing: String(leads.capture_timing || 'off'),
      fields: Array.isArray(leads.fields) ? leads.fields.map(String) : [],
      required_fields: Array.isArray(leads.required_fields) ? leads.required_fields.map(String) : [],
      prompt_title: String(leads.prompt_title || ''),
      prompt_subtitle: String(leads.prompt_subtitle || ''),
      skippable: normalizeBoolean(leads.skippable, false),
      dedupe: { mode: String(leads.dedupe?.mode || 'session') },
      consent: {
        mode: String(leads.consent?.mode || 'none'),
        text: String(leads.consent?.text || ''),
        privacy_url: String(leads.consent?.privacy_url || '')
      }
    }
  };
}

Deno.serve(async (req: Request) => {
  const origin = getOrigin(req);
  const preflight = handleOptions(req, origin);
  if (preflight) return preflight;

  if (!origin) {
    return errorJson(400, 'origin_required', 'Origin header is required.');
  }

  const originParsed = parseUrlOrigin(origin);
  if (!originParsed) {
    return errorJson(400, 'origin_invalid', 'Origin header is invalid.');
  }

  const body = await safeJsonBody(req);
  const embedKey = body?.embedKey;
  if (!embedKey || typeof embedKey !== 'string') {
    return errorJson(400, 'embed_key_required', 'embedKey is required.', undefined, corsHeaders(originParsed.origin));
  }

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('widget_sites')
    .select(
      `id, workspace_id, name, status, settings_json, settings_version,
       widget_domains(pattern, domain, verification_status, environment, disabled_at),
       widget_intents(id, name, label, description, icon, enabled, behavior, sort_order, message_text, external_url, routing_json, action_type)`
    )
    .eq('embed_key', embedKey)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return errorJson(401, 'embed_key_invalid', 'Invalid embed key.', undefined, corsHeaders(originParsed.origin));
  }

  if (data.status !== 'active') {
    return errorJson(403, 'site_inactive', 'Widget site is not active.', undefined, corsHeaders(originParsed.origin));
  }

  const settings = pickSettings(data);
  const allowLocalhost = Boolean((data.settings_json?.security?.allow_localhost) ?? true);

  const host = originParsed.host;
  const domains = Array.isArray((data as any).widget_domains) ? (data as any).widget_domains : [];

  const verifiedPatterns = domains
    .filter((d: any) => d && d.verification_status === 'verified' && !d.disabled_at)
    .map((d: any) => String(d.pattern || d.domain || ''))
    .filter((p: string) => p);

  const isLocal = isLocalhostHost(host);
  const domainAllowed = (isLocal && allowLocalhost) || anyAllowedDomainMatch(host, verifiedPatterns);
  if (!domainAllowed) {
    // Do not set ACAO for disallowed origin.
    return errorJson(403, 'domain_not_allowed', 'Domain is not allowed for this embed key.');
  }

  const jwtSecret = getEnv('WIDGET_EMBED_JWT_SECRET');
  const token = await signEmbedToken(
    jwtSecret,
    {
      widget_site_id: data.id,
      origin: originParsed.origin,
      scopes: ['session:start', 'message:send', 'message:poll', 'lead:submit', 'event:ingest']
    },
    EMBED_TOKEN_TTL_SEC
  );

  const intents = Array.isArray((data as any).widget_intents) ? (data as any).widget_intents : [];
  const effectiveIntents = intents
    .filter((i: any) => i && i.enabled === true)
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((i: any) => ({
      id: i.id,
      name: String(i.name || i.label || ''),
      label: String(i.label || ''),
      description: i.description ? String(i.description) : null,
      icon: String(i.icon || 'chat'),
      sort_order: Number(i.sort_order || 0),
      behavior: String(i.behavior || (i.action_type === 'external_link' ? 'open_url' : i.action_type === 'escalate' ? 'handoff' : 'send_message')),
      message_text: i.message_text ? String(i.message_text) : null,
      external_url: i.external_url ? String(i.external_url) : null,
      routing: i.routing_json && typeof i.routing_json === 'object' ? i.routing_json : {}
    }));

  return json(
    200,
    {
      ok: true,
      runtime: { version: RUNTIME_VERSION, config_version: settings.settingsVersion },
      site: {
        id: data.id,
        name: data.name,
        branding: settings.branding,
        widget: settings.widget,
        leads: settings.leads,
        intents: effectiveIntents
      },
      auth: { embed_session_token: token, expires_in_sec: EMBED_TOKEN_TTL_SEC },
      polling: { min_interval_ms: 1500, max_interval_ms: 6000 }
    },
    corsHeaders(originParsed.origin)
  );
});
