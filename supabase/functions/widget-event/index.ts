import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { getEnv, getOptionalEnv } from '../_shared/env.ts';
import { errorJson, getOrigin, json, parseUrlOrigin, safeJsonBody } from '../_shared/http.ts';
import { getBearerToken, verifyEmbedToken } from '../_shared/jwt.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { isOriginAllowedForSite } from '../_shared/authz.ts';

async function maybeForwardN8n(url: string | null, payload: any) {
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    // Best-effort only
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
  const eventName = typeof body?.event === 'string' ? body.event : null;
  const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};

  if (!eventName) {
    return errorJson(400, 'event_required', 'event is required.', undefined, corsHeaders(originParsed.origin));
  }

  const supabase = serviceClient();
  const nowIso = new Date().toISOString();
  const conversationId = typeof payload?.conversation_id === 'string' ? payload.conversation_id : null;

  if (conversationId) {
    const { data: conv } = await supabase
      .from('widget_conversations')
      .select('id, widget_site_id')
      .eq('id', conversationId)
      .limit(1)
      .maybeSingle();

    if (!conv || conv.widget_site_id !== claims.widget_site_id) {
      return errorJson(403, 'forbidden', 'Conversation does not belong to this site.', undefined, corsHeaders(originParsed.origin));
    }
  }

  await supabase.from('widget_events').insert({
    widget_site_id: claims.widget_site_id,
    conversation_id: conversationId,
    event_name: eventName,
    payload: {
      ...payload,
      origin: originParsed.origin,
      host: originParsed.host,
      timestamp: nowIso
    }
  });

  const n8nEvents = getOptionalEnv('N8N_WEBHOOK_EVENTS');
  await maybeForwardN8n(n8nEvents, {
    event: eventName,
    site_id: claims.widget_site_id,
    conversation_id: conversationId,
    payload,
    origin: originParsed.origin,
    timestamp: nowIso
  });

  return json(200, { ok: true }, corsHeaders(originParsed.origin));
});
