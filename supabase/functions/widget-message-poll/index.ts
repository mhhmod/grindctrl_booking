import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { getEnv } from '../_shared/env.ts';
import { errorJson, getOrigin, json, parseUrlOrigin, safeJsonBody } from '../_shared/http.ts';
import { getBearerToken, verifyEmbedToken } from '../_shared/jwt.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { isOriginAllowedForSite } from '../_shared/authz.ts';

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
  const conversationId = body?.conversation_id;
  const after = typeof body?.after === 'string' ? body.after : null;

  if (!conversationId || typeof conversationId !== 'string') {
    return errorJson(400, 'conversation_id_required', 'conversation_id is required.', undefined, corsHeaders(originParsed.origin));
  }

  const supabase = serviceClient();

  const { data: conv, error: convErr } = await supabase
    .from('widget_conversations')
    .select('id, widget_site_id')
    .eq('id', conversationId)
    .limit(1)
    .maybeSingle();

  if (convErr || !conv) {
    return errorJson(404, 'conversation_not_found', 'Conversation not found.', undefined, corsHeaders(originParsed.origin));
  }
  if (conv.widget_site_id !== claims.widget_site_id) {
    return errorJson(403, 'forbidden', 'Conversation does not belong to this site.', undefined, corsHeaders(originParsed.origin));
  }

  let query = supabase
    .from('widget_messages')
    .select('id, role, content, content_type, intent_id, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(50);

  if (after) {
    query = query.gt('created_at', after);
  }

  const { data: rows, error: msgErr } = await query;
  if (msgErr) {
    return errorJson(500, 'poll_failed', 'Failed to fetch messages.', undefined, corsHeaders(originParsed.origin));
  }

  return json(200, { ok: true, messages: rows || [] }, corsHeaders(originParsed.origin));
});
