import 'server-only';

import { loadPublicSite, originAllowed, type ResolvedPublicSite } from './public-api';
import { getConversationForVisitor, getVisitor } from './conversations';
import type { ConversationRecord } from './types';

/* The identical five checks every storefront-facing messenger endpoint has
   to pass before it may touch anything: valid key shape, live site, admitted
   origin, a visitor that exists under THIS site, and a conversation that
   belongs to THAT visitor. Getting any one of them wrong is a cross-tenant
   read, so they live in one place rather than being retyped per route.

   bootstrap/send/feedback predate this and keep their own copies: send in
   particular interleaves a per-session rate limiter between the origin check
   and the visitor lookup, and reordering a live limiter to share code would
   be paying a behaviour change for a tidier diff. New routes use this. */

export const EMBED_KEY_RE = /^[a-z0-9_]{6,80}$/i;
export const ANON_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ShopperSession {
  site: ResolvedPublicSite;
  visitor: { id: string; user_email: string | null };
  conversation: ConversationRecord;
}

export type SessionResult =
  | ({ ok: true } & ShopperSession)
  | { ok: false; code: string; status: number };

export async function resolveShopperSession(input: {
  key: unknown;
  origin: unknown;
  anonymousId: unknown;
  conversationId: unknown;
}): Promise<SessionResult> {
  const key = typeof input.key === 'string' ? input.key : '';
  const origin = typeof input.origin === 'string' ? input.origin : null;
  const anonymousId = typeof input.anonymousId === 'string' ? input.anonymousId : '';
  const conversationId = typeof input.conversationId === 'string' ? input.conversationId : '';

  if (!EMBED_KEY_RE.test(key)) return { ok: false, code: 'bad_key', status: 400 };
  if (!ANON_ID_RE.test(anonymousId)) return { ok: false, code: 'bad_session', status: 400 };
  if (!UUID_RE.test(conversationId)) return { ok: false, code: 'bad_conversation', status: 400 };

  const site = await loadPublicSite(key);
  if (!site || site.status !== 'active') return { ok: false, code: 'not_found', status: 404 };
  if (!originAllowed(site, origin)) return { ok: false, code: 'origin_not_allowed', status: 403 };

  /* Scoped by site id, so an embed key for store A cannot address a visitor
     of store B even with that visitor's anonymous id in hand. */
  const visitor = await getVisitor(site.id, anonymousId);
  if (!visitor) return { ok: false, code: 'bad_session', status: 403 };

  const conversation = await getConversationForVisitor(conversationId, visitor.id);
  if (!conversation) return { ok: false, code: 'bad_conversation', status: 403 };

  return { ok: true, site, visitor, conversation };
}
