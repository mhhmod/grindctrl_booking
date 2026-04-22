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
    // Domain removed/disabled after token issuance.
    return errorJson(403, 'domain_not_allowed', 'Domain is not allowed for this embed key.');
  }

  const body = await safeJsonBody(req);
  const anonymousId = body?.visitor?.anonymous_id;
  if (!anonymousId || typeof anonymousId !== 'string') {
    return errorJson(400, 'anonymous_id_required', 'visitor.anonymous_id is required.', undefined, corsHeaders(originParsed.origin));
  }

  const pageUrl = typeof body?.page?.url === 'string' ? body.page.url : null;
  const pageTitle = typeof body?.page?.title === 'string' ? body.page.title : null;
  const referrer = req.headers.get('referer') || null;

  const email = typeof body?.visitor?.email === 'string' ? body.visitor.email : null;
  const name = typeof body?.visitor?.name === 'string' ? body.visitor.name : null;
  const resumeConversationId = typeof body?.conversation_id === 'string' ? body.conversation_id : null;

  const supabase = serviceClient();

  // Upsert visitor
  const { data: visitorRow, error: visitorErr } = await supabase
    .from('widget_visitors')
    .upsert(
      {
        widget_site_id: claims.widget_site_id,
        anonymous_id: anonymousId,
        user_email: email,
        user_name: name,
        last_seen_at: new Date().toISOString()
      },
      { onConflict: 'widget_site_id,anonymous_id' }
    )
    .select('id')
    .maybeSingle();

  if (visitorErr || !visitorRow) {
    return errorJson(500, 'visitor_upsert_failed', 'Failed to create visitor.', undefined, corsHeaders(originParsed.origin));
  }

  // Resume if caller provided a conversation_id for this site + visitor.
  if (resumeConversationId) {
    const { data: existing } = await supabase
      .from('widget_conversations')
      .select('id, widget_site_id, visitor_id, status')
      .eq('id', resumeConversationId)
      .limit(1)
      .maybeSingle();

    if (
      existing &&
      existing.widget_site_id === claims.widget_site_id &&
      existing.visitor_id === visitorRow.id &&
      (existing.status === 'open' || existing.status === 'handoff_requested' || existing.status === 'handoff_active')
    ) {
      await supabase
        .from('widget_conversations')
        .update({ last_page_url: pageUrl, last_referrer: referrer })
        .eq('id', existing.id);

      return json(
        200,
        { ok: true, conversation_id: existing.id, visitor_id: visitorRow.id },
        corsHeaders(originParsed.origin)
      );
    }
  }

  // Create a new conversation
  const { data: convRow, error: convErr } = await supabase
    .from('widget_conversations')
    .insert({
      widget_site_id: claims.widget_site_id,
      visitor_id: visitorRow.id,
      status: 'open',
      last_page_url: pageUrl,
      last_referrer: referrer,
      metadata: { page_title: pageTitle }
    })
    .select('id')
    .single();

  if (convErr || !convRow) {
    return errorJson(500, 'conversation_create_failed', 'Failed to create conversation.', undefined, corsHeaders(originParsed.origin));
  }

  // Event record (best-effort)
  await supabase.from('widget_events').insert({
    widget_site_id: claims.widget_site_id,
    conversation_id: convRow.id,
    event_name: 'conversation_start',
    payload: {
      page_url: pageUrl,
      page_title: pageTitle,
      origin: originParsed.origin
    }
  });

  return json(
    200,
    { ok: true, conversation_id: convRow.id, visitor_id: visitorRow.id },
    corsHeaders(originParsed.origin)
  );
});
