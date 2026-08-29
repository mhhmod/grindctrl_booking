/* The action seam.

   Today the assistant returns prose. Order lookup needs it to *request*
   something the server then authorizes, so there is exactly one channel for
   that, with one shape, and a server-side registry of what may be asked.

   The rule that makes it safe: **the model proposes, the server disposes.**
   An action never carries authorization. Who the shopper is comes from the
   conversation record and the proxy-signed token, never from arguments the
   model wrote — a model that invents `customer_id` finds no field to put it
   in, because the schema has none.

   No 'server-only': this is parsing and validation, and it is meant to be
   unit-tested directly. */

export const ACTION_SENTINEL = '<<GC_ACTION>>';

/** Everything the server is willing to be asked to do. Unknown names are
 *  discarded and recorded, never surfaced and never guessed at. */
export const ACTION_REGISTRY = ['lookup_order'] as const;
export type ActionName = (typeof ACTION_REGISTRY)[number];

export interface LookupOrderAction {
  name: 'lookup_order';
  /** Digits only, or null when the shopper is verified and needs no number. */
  orderNumber: string | null;
  /** Lowercased, or null. Proof only — never an identity claim. */
  email: string | null;
}

export type ParsedAction = LookupOrderAction;

export type ActionParse =
  | { kind: 'prose'; text: string }
  | { kind: 'action'; action: ParsedAction }
  | { kind: 'rejected'; reason: 'unknown_action' | 'malformed' | 'multiple_actions' };

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

/** "1234", "#1234", "no. 1234", "order 1234" all name the same order.
 *  Digits only, which is Shopify's default order naming; a store using a
 *  custom alphanumeric order name is a documented gap, not a silent one. */
export function normalizeOrderNumber(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const digits = String(raw).replace(/\D+/g, '');
  return digits.length >= 1 && digits.length <= 12 ? digits : null;
}

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > 200) return null;
  return EMAIL_RE.test(trimmed) ? trimmed : null;
}

/** Parses one model turn. Prose is returned as-is; an action line replaces
 *  the turn entirely, because the phrasing comes from a second completion
 *  once the server knows what actually happened. */
export function parseModelTurn(raw: string): ActionParse {
  const first = raw.indexOf(ACTION_SENTINEL);
  if (first < 0) return { kind: 'prose', text: raw.trim() };

  /* The loop guard: one action per shopper turn, full stop. A model that
     emits two is not trusted to have meant either, so the turn is rejected
     rather than executing the first and hoping. */
  if (raw.indexOf(ACTION_SENTINEL, first + ACTION_SENTINEL.length) >= 0) {
    return { kind: 'rejected', reason: 'multiple_actions' };
  }

  const body = raw.slice(first + ACTION_SENTINEL.length).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return { kind: 'rejected', reason: 'malformed' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.slice(start, end + 1));
  } catch {
    return { kind: 'rejected', reason: 'malformed' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'rejected', reason: 'malformed' };
  }

  const record = parsed as Record<string, unknown>;
  const name = record.action;
  if (typeof name !== 'string' || !ACTION_REGISTRY.includes(name as ActionName)) {
    return { kind: 'rejected', reason: 'unknown_action' };
  }

  /* Only the two declared arguments are read. Anything else the model
     invented — customer_id, verified, shop — is dropped here and never
     reaches the executor. */
  return {
    kind: 'action',
    action: {
      name: 'lookup_order',
      orderNumber: normalizeOrderNumber(record.order_number),
      email: normalizeEmail(record.email),
    },
  };
}
