import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { getEnv } from '../_shared/env.ts';
import { errorJson, getOrigin, json, parseUrlOrigin, safeJsonBody } from '../_shared/http.ts';
import { getBearerToken, verifyEmbedToken } from '../_shared/jwt.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { isOriginAllowedForSite } from '../_shared/authz.ts';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseUtm(url: string | null): Record<string, string> {
  if (!url) return {};
  try {
    const u = new URL(url);
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    const out: Record<string, string> = {};
    for (const k of keys) {
      const v = u.searchParams.get(k);
      if (v) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

Deno.serve(async (req: Request) => {
  const origin = getOrigin(req);
  const preflight = handleOptions(req, origin);
  if (preflight) return preflight;

  if (!origin) return errorJson(400, 'origin_required', 'Origin header is required.');
  const originParsed = parseUrlOrigin(origin);
  if (!originParsed) return errorJson(400, 'origin_invalid', 'Origin header is invalid.');

  const token = getBearerToken(req);
  if (!token) return errorJson(401, 'unauthorized', 'Missing Authorization bearer token.');

  let claims;
  try {
    claims = await verifyEmbedToken(getEnv('WIDGET_EMBED_JWT_SECRET'), token);
  } catch {
    return errorJson(401, 'unauthorized', 'Invalid embed session token.');
  }

  if (claims.origin !== originParsed.origin) {
    return errorJson(403, 'origin_mismatch', 'Origin does not match embed session.', undefined, corsHeaders(originParsed.origin));
  }

  if (!(await isOriginAllowedForSite(claims.widget_site_id, originParsed.origin))) {
    return errorJson(403, 'domain_not_allowed', 'Domain is not allowed for this embed key.');
  }

  const body = await safeJsonBody(req);
  const conversationId = typeof body?.conversation_id === 'string' ? body.conversation_id : null;
  const intentId = typeof body?.intent_id === 'string' ? body.intent_id : null;

  const lead = body?.lead || {};
  const name = typeof lead?.name === 'string' ? lead.name.trim() : null;
  const email = typeof lead?.email === 'string' ? lead.email.trim() : null;
  const phone = typeof lead?.phone === 'string' ? lead.phone.trim() : null;
  const company = typeof lead?.company === 'string' ? lead.company.trim() : null;
  const consent = body?.consent && typeof body.consent === 'object' ? body.consent : null;

  if (email && !isValidEmail(email)) {
    return errorJson(400, 'email_invalid', 'Email is invalid.', undefined, corsHeaders(originParsed.origin));
  }

  const supabase = serviceClient();

  // Load site settings (enforce required_fields + consent mode)
  const { data: site, error: siteErr } = await supabase
    .from('widget_sites')
    .select('id, workspace_id, settings_json')
    .eq('id', claims.widget_site_id)
    .limit(1)
    .maybeSingle();

  if (siteErr || !site) {
    return errorJson(500, 'site_load_failed', 'Failed to load site.', undefined, corsHeaders(originParsed.origin));
  }

  const leadsCfg = site.settings_json?.leads || {};
  const leadsEnabled = Boolean(leadsCfg.enabled ?? false);
  if (!leadsEnabled) {
    return errorJson(403, 'leads_disabled', 'Lead capture is disabled.', undefined, corsHeaders(originParsed.origin));
  }

  const requiredFields: string[] = Array.isArray(leadsCfg.required_fields) ? leadsCfg.required_fields.map(String) : [];
  if (requiredFields.includes('email') && (!email || !isValidEmail(email))) {
    return errorJson(400, 'email_required', 'Email is required.', undefined, corsHeaders(originParsed.origin));
  }
  if (requiredFields.includes('name') && (!name || !name.length)) {
    return errorJson(400, 'name_required', 'Name is required.', undefined, corsHeaders(originParsed.origin));
  }

  const consentMode = String(leadsCfg.consent?.mode || 'none');
  if (consentMode === 'checkbox') {
    const accepted = Boolean(consent?.accepted);
    if (!accepted) {
      return errorJson(400, 'consent_required', 'Consent is required.', undefined, corsHeaders(originParsed.origin));
    }
  }

  // Pull attribution from conversation when available
  let pageUrl: string | null = null;
  let referrer: string | null = null;
  let visitorId: string | null = null;

  if (conversationId) {
    const { data: conv } = await supabase
      .from('widget_conversations')
      .select('id, widget_site_id, last_page_url, last_referrer, visitor_id')
      .eq('id', conversationId)
      .limit(1)
      .maybeSingle();

    if (conv && conv.widget_site_id === claims.widget_site_id) {
      pageUrl = conv.last_page_url || null;
      referrer = conv.last_referrer || null;
      visitorId = conv.visitor_id || null;
    }
  }

  const utm = parseUtm(pageUrl);

  const { data: leadRow, error: leadErr } = await supabase
    .from('widget_leads')
    .insert({
      widget_site_id: claims.widget_site_id,
      workspace_id: site.workspace_id,
      name,
      email,
      phone,
      company,
      source_domain: originParsed.host,
      conversation_id: conversationId,
      intent_id: intentId,
      visitor_id: visitorId,
      page_url: pageUrl,
      referrer,
      status: 'new',
      consent: consentMode === 'none' ? null : consent,
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
      utm_term: utm.utm_term || null,
      utm_content: utm.utm_content || null
    })
    .select('id')
    .single();

  if (leadErr || !leadRow) {
    return errorJson(500, 'lead_insert_failed', 'Failed to store lead.', undefined, corsHeaders(originParsed.origin));
  }

  await supabase.from('widget_events').insert({
    widget_site_id: claims.widget_site_id,
    conversation_id: conversationId,
    event_name: 'lead_captured',
    payload: {
      lead_id: leadRow.id,
      origin: originParsed.origin
    }
  });

  return json(200, { ok: true, lead_id: leadRow.id }, corsHeaders(originParsed.origin));
});
