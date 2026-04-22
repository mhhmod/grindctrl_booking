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
  const conversationId = body?.conversation_id;
  const content = body?.content;
  const contentType = typeof body?.content_type === 'string' ? body.content_type : 'text';
  const intentId = typeof body?.intent_id === 'string' ? body.intent_id : null;

  if (!conversationId || typeof conversationId !== 'string') {
    return errorJson(400, 'conversation_id_required', 'conversation_id is required.', undefined, corsHeaders(originParsed.origin));
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return errorJson(400, 'content_required', 'content is required.', undefined, corsHeaders(originParsed.origin));
  }

  if (!['text', 'intent', 'event'].includes(contentType)) {
    return errorJson(400, 'content_type_invalid', 'content_type is invalid.', undefined, corsHeaders(originParsed.origin));
  }

  const supabase = serviceClient();

  // Verify conversation belongs to this site
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

  const nowIso = new Date().toISOString();

  const { data: msg, error: msgErr } = await supabase
    .from('widget_messages')
    .insert({
      conversation_id: conversationId,
      role: 'user',
      content: content.trim(),
      content_type: contentType,
      intent_id: intentId,
      metadata: { origin: originParsed.origin }
    })
    .select('id')
    .single();

  if (msgErr || !msg) {
    return errorJson(500, 'message_insert_failed', 'Failed to store message.', undefined, corsHeaders(originParsed.origin));
  }

  await supabase
    .from('widget_conversations')
    .update({ last_message_at: nowIso })
    .eq('id', conversationId);

  await supabase.from('widget_events').insert({
    widget_site_id: claims.widget_site_id,
    conversation_id: conversationId,
    event_name: 'message_sent',
    payload: {
      message_id: msg.id,
      content_type: contentType,
      intent_id: intentId,
      origin: originParsed.origin
    }
  });

  // Optional forwarding to n8n (best-effort)
  const n8nMessages = getOptionalEnv('N8N_WEBHOOK_MESSAGES');
  await maybeForwardN8n(n8nMessages, {
    event: 'message_sent',
    site_id: claims.widget_site_id,
    conversation_id: conversationId,
    message_id: msg.id,
    content: content.trim(),
    content_type: contentType,
    intent_id: intentId,
    page_url: null,
    origin: originParsed.origin,
    timestamp: nowIso
  });

  return json(200, { ok: true, message_id: msg.id }, corsHeaders(originParsed.origin));
});
