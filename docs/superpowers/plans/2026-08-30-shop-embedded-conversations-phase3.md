# Conversations in the Shopify Embedded App — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the sixth and last dashboard messenger component, `ConversationsPanel`, into the Shopify embedded app — same component, same `actions`-prop pattern as the five editors Phase 2 already ported, so a merchant can read and reply to shopper conversations without leaving Shopify admin.

**Architecture:** Identical to Phase 2's pattern, extended to the one component it deliberately skipped. `conversations-panel.tsx` stops importing `fetchConversationMessages`/`staffReply`/`takeoverConversation`/`releaseConversation`/`closeConversationAction` from `app/dashboard/messenger/actions.ts` directly and takes them via the existing `actions` prop instead. A new `POST /api/shopify/store-chat/thread` route — one route, an `op` discriminator, same shape as Phase 2's `/knowledge` route — is the embedded equivalent, authenticating by verified Shopify session token and resolving the conversation by `(conversationId, site.id)` so a token for shop A can never reach shop B's thread. `MessengerTabs`'s existing `showConversationsTab` flag flips on for the embedded shell.

**Tech Stack:** Same as Phase 2 — Next.js 15 App Router, Supabase, vitest + `@testing-library/react`. No schema migration.

**Correction to the record — read before starting.** Phase 2's plan (`docs/superpowers/plans/2026-08-30-shop-embedded-store-chat.md`) deferred this component to a "Phase 3," reasoning that `staffReply`/`takeoverConversation` resolve an actor via `getProfileId(actorClerkUserId)`, and that the synthetic `shop-<domain>` profile an embedded actor resolves to "is deleted once a merchant claims their store" per the original design doc's section 5 — which would make `getProfileId` throw for a claimed store's embedded conversations.

That premise was never actually implemented and is false on `main` today. Verified directly against the code, not the design doc's prose:

- `app/claim/page.tsx` (the claim-redeem flow) contains no delete of any kind.
- `adoptSite` in `lib/messenger/provisioning.ts` (`git grep -n "function adoptSite" -A 20`) only updates `widget_sites.workspace_id` and `created_by_profile_id`. It never touches `profiles` or `workspaces`.
- `getProfileId` (`lib/messenger/provisioning.ts:397`) is a bare `select('id').eq('clerk_user_id', clerkUserId).maybeSingle()` — no join, no workspace-membership check, no ownership check of any kind.

The practical result: the synthetic profile becomes orphaned on claim (no workspace references it anymore) but the row is never removed, so `getProfileId(shopProfileId(shop))` succeeds identically before and after a claim. This is, incidentally, already exactly "attribute the action to the store rather than a specific person" — the option chosen when this was raised — so no schema or logic change is needed to get that property; the existing mechanism already has it. There is a real, separate, non-blocking note at the end of this plan about the orphaned rows themselves.

---

## Task 14: Contract methods, `ConversationsPanel` refactor, `messenger-tabs.tsx` wiring

**Files:**
- Modify: `apps/web-next/lib/messenger/dashboard-actions-contract.ts`
- Modify: `apps/web-next/components/dashboard/messenger/conversations-panel.tsx`
- Create: `apps/web-next/components/dashboard/messenger/conversations-panel.test.tsx`
- Modify: `apps/web-next/components/dashboard/messenger/messenger-tabs.tsx`

`app/dashboard/messenger/actions.ts` already exports all five functions with the signatures below (Phase 1/pre-existing) — this task only widens the shared contract and re-points the one component that still imports them directly.

- [ ] **Step 1: Add the five conversation methods to the contract**

In `apps/web-next/lib/messenger/dashboard-actions-contract.ts`, add the import and five methods:

```ts
import type { TriageResult } from './attachments';

export interface FetchMessagesResult {
  ok: true;
  status: string;
  messages: Array<{ id: string; role: string; content: string; createdAt: string; author?: string }>;
  attachments: Record<string, { url: string; mime: string; triage: TriageResult | null }>;
}

export interface MessengerHostActions {
  saveDraftSection(siteId: string, section: MessengerSection, payload: object): Promise<ActionResult>;
  publishConfig(siteId: string): Promise<ActionResult>;
  setMessengerEnabled(siteId: string, enabled: boolean): Promise<ActionResult>;
  addKnowledge(formData: FormData): Promise<ActionResult>;
  updateKnowledgeStatus(siteId: string, entryId: string, status: 'active' | 'disabled'): Promise<ActionResult>;
  deleteKnowledge(siteId: string, entryId: string): Promise<ActionResult>;
  syncKnowledge(siteId: string, entryId: string): Promise<ActionResult>;
  fetchConversationMessages(siteId: string, conversationId: string): Promise<FetchMessagesResult | { ok: false }>;
  staffReply(siteId: string, conversationId: string, text: string): Promise<ActionResult>;
  takeoverConversation(siteId: string, conversationId: string): Promise<ActionResult>;
  releaseConversation(siteId: string, conversationId: string): Promise<ActionResult>;
  closeConversationAction(siteId: string, conversationId: string): Promise<ActionResult>;
}
```

`app/dashboard/messenger/actions.ts` exports every one of these five with this exact signature already — `import * as messengerActions from './actions'` in `page.tsx` satisfies the widened interface with no dashboard-side change, same as Task 13.

- [ ] **Step 2: Write the failing test for `ConversationsPanel`**

```tsx
// apps/web-next/components/dashboard/messenger/conversations-panel.test.tsx
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationsPanel, type ConversationListItem } from './conversations-panel';

const fetchConversationMessages = vi.fn();
const staffReply = vi.fn();
const takeoverConversation = vi.fn();
const releaseConversation = vi.fn();
const closeConversationAction = vi.fn();

const actions = {
  fetchConversationMessages,
  staffReply,
  takeoverConversation,
  releaseConversation,
  closeConversationAction,
};

const CONVERSATIONS: ConversationListItem[] = [
  {
    id: 'conv-1',
    status: 'open',
    startedAt: '2026-08-30T10:00:00.000Z',
    lastMessageAt: '2026-08-30T10:05:00.000Z',
    visitorEmail: 'shopper@example.com',
    visitorName: null,
    handoffReason: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  fetchConversationMessages.mockResolvedValue({
    ok: true,
    status: 'open',
    messages: [{ id: 'm-1', role: 'user', content: 'Where is my order?', createdAt: '2026-08-30T10:00:00.000Z' }],
    attachments: {},
  });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('ConversationsPanel', () => {
  it('loads messages through the injected actions prop, not a direct import', async () => {
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);

    await waitFor(() => expect(fetchConversationMessages).toHaveBeenCalledWith('site-1', 'conv-1'));
    expect(await screen.findByText('Where is my order?')).toBeInTheDocument();
  });

  it('takes over the conversation through actions.takeoverConversation', async () => {
    takeoverConversation.mockResolvedValue({ ok: true });
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);
    await screen.findByText('Where is my order?');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Take over' }));
    });

    expect(takeoverConversation).toHaveBeenCalledWith('site-1', 'conv-1');
  });

  it('sends a staff reply through actions.staffReply', async () => {
    staffReply.mockResolvedValue({ ok: true });
    render(<ConversationsPanel locale="en" siteId="site-1" conversations={CONVERSATIONS} actions={actions} />);
    await screen.findByText('Where is my order?');

    fireEvent.change(screen.getByLabelText('Type your reply…'), { target: { value: 'Shipped yesterday!' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    expect(staffReply).toHaveBeenCalledWith('site-1', 'conv-1', 'Shipped yesterday!');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run components/dashboard/messenger/conversations-panel.test.tsx`
Expected: FAIL — `ConversationsPanel` doesn't accept an `actions` prop yet, and its internal calls still hit the (unmocked in this test) direct import.

- [ ] **Step 4: Refactor `conversations-panel.tsx`**

Replace the import block:

```ts
import {
  closeConversationAction,
  fetchConversationMessages,
  releaseConversation,
  staffReply,
  takeoverConversation,
} from '@/app/dashboard/messenger/actions';
```

with:

```ts
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
```

Replace the function signature:

```tsx
export function ConversationsPanel({
  locale,
  siteId,
  conversations,
  actions,
}: {
  locale: 'en' | 'ar';
  siteId: string;
  conversations: ConversationListItem[];
  actions: Pick<
    MessengerHostActions,
    'fetchConversationMessages' | 'staffReply' | 'takeoverConversation' | 'releaseConversation' | 'closeConversationAction'
  >;
}) {
```

Replace the five call sites (identical positions, just prefixed):
- `const result = await fetchConversationMessages(siteId, selectedId);` → `const result = await actions.fetchConversationMessages(siteId, selectedId);`
- `const result = await staffReply(siteId, selectedId, text);` → `const result = await actions.staffReply(siteId, selectedId, text);`
- `act(() => takeoverConversation(siteId, selectedId))` → `act(() => actions.takeoverConversation(siteId, selectedId))`
- `act(() => releaseConversation(siteId, selectedId))` → `act(() => actions.releaseConversation(siteId, selectedId))`
- `act(() => closeConversationAction(siteId, selectedId))` → `act(() => actions.closeConversationAction(siteId, selectedId))`

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/dashboard/messenger/conversations-panel.test.tsx`
Expected: PASS, 3/3.

- [ ] **Step 6: Wire `actions` through `messenger-tabs.tsx` and stop hard-coding `showConversationsTab`'s effective default**

Replace the Conversations render block:

```tsx
      {showConversationsTab && tab === 'conversations' && (
        <ConversationsPanel locale={locale} siteId={siteId} conversations={conversations} actions={actions} />
      )}
```

(Only the added `actions={actions}` changes here — `showConversationsTab` itself is untouched; Task 17 is what actually turns it on for the embedded shell.)

- [ ] **Step 7: Run the full messenger component suite and typecheck**

Run: `npx vitest run components/dashboard/messenger app/dashboard/messenger` && `npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add lib/messenger/dashboard-actions-contract.ts components/dashboard/messenger/conversations-panel.tsx components/dashboard/messenger/conversations-panel.test.tsx components/dashboard/messenger/messenger-tabs.tsx
git commit -m "refactor(messenger): ConversationsPanel takes an actions prop instead of importing server actions directly"
```

---

## Task 15: Route `POST /api/shopify/store-chat/thread`

**Files:**
- Create: `apps/web-next/app/api/shopify/store-chat/thread/route.ts`
- Test: `apps/web-next/app/api/shopify/store-chat/thread/route.test.ts`

One route, five operations selected by `op` — mirrors `fetchConversationMessages`/`staffReply`/`takeoverConversation`/`releaseConversation`/`closeConversationAction` from `actions.ts`, resolving the site by verified shop domain and the conversation by `(conversationId, site.id)` — never trusting a site id from the request body, same invariant as every other Phase 2 route.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-next/app/api/shopify/store-chat/thread/route.test.ts
// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authenticateMock,
  ensureShopOwnedSiteMock,
  getConversationForSiteMock,
  listMessagesMock,
  appendMessageMock,
  recordAuditMock,
  takeOverConversationMock,
  returnConversationToAiMock,
  closeConversationMock,
  getProfileIdMock,
  listConversationAttachmentsMock,
  signAttachmentUrlsMock,
} = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  ensureShopOwnedSiteMock: vi.fn(),
  getConversationForSiteMock: vi.fn(),
  listMessagesMock: vi.fn(),
  appendMessageMock: vi.fn(),
  recordAuditMock: vi.fn(),
  takeOverConversationMock: vi.fn(),
  returnConversationToAiMock: vi.fn(),
  closeConversationMock: vi.fn(),
  getProfileIdMock: vi.fn(),
  listConversationAttachmentsMock: vi.fn(),
  signAttachmentUrlsMock: vi.fn(),
}));

vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: authenticateMock }));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: ensureShopOwnedSiteMock }));
vi.mock('@/lib/messenger/shop-tenancy', () => ({ shopProfileId: (domain: string) => `shop-${domain}` }));
vi.mock('@/lib/messenger/provisioning', () => ({ getProfileId: getProfileIdMock }));
vi.mock('@/lib/messenger/conversations', () => ({
  getConversationForSite: getConversationForSiteMock,
  listMessages: listMessagesMock,
  appendMessage: appendMessageMock,
  recordAudit: recordAuditMock,
  takeOverConversation: takeOverConversationMock,
  returnConversationToAi: returnConversationToAiMock,
  closeConversation: closeConversationMock,
}));
vi.mock('@/lib/messenger/attachments', () => ({
  listConversationAttachments: listConversationAttachmentsMock,
  signAttachmentUrls: signAttachmentUrlsMock,
}));

import { POST } from './route';

function req(body: unknown): NextRequest {
  return new NextRequest(
    new Request('https://grindctrl.cloud/api/shopify/store-chat/thread', {
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
  ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
  listConversationAttachmentsMock.mockResolvedValue([]);
  signAttachmentUrlsMock.mockResolvedValue({});
});

describe('POST /api/shopify/store-chat/thread', () => {
  it('returns 401 without a valid session token', async () => {
    authenticateMock.mockReturnValue(null);
    const res = await POST(req({ op: 'messages', conversationId: 'c-1' }));
    expect(res.status).toBe(401);
    expect(ensureShopOwnedSiteMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the conversation does not belong to the token-resolved site', async () => {
    getConversationForSiteMock.mockResolvedValue(null);
    const res = await POST(req({ op: 'messages', conversationId: 'attacker-conv' }));
    expect(getConversationForSiteMock).toHaveBeenCalledWith('attacker-conv', 'site-real');
    expect(res.status).toBe(404);
  });

  it('op=messages returns messages and signed attachments', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    listMessagesMock.mockResolvedValue([
      { id: 'm-1', role: 'user', content: 'hi', created_at: '2026-08-30T10:00:00.000Z', metadata: {} },
    ]);
    const res = await POST(req({ op: 'messages', conversationId: 'c-1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      status: 'open',
      messages: [{ id: 'm-1', role: 'user', content: 'hi', createdAt: '2026-08-30T10:00:00.000Z', author: undefined }],
      attachments: {},
    });
  });

  it('op=reply takes over an open conversation before appending, using the shop as actor', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    getProfileIdMock.mockResolvedValue('profile-shop-1');
    takeOverConversationMock.mockResolvedValue({ id: 'c-1', status: 'handoff_active' });
    appendMessageMock.mockResolvedValue({ message: {}, replayed: false });

    const res = await POST(req({ op: 'reply', conversationId: 'c-1', text: 'On it!' }));

    expect(getProfileIdMock).toHaveBeenCalledWith('shop-demo.myshopify.com');
    expect(takeOverConversationMock).toHaveBeenCalledWith('c-1', 'profile-shop-1');
    expect(appendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'c-1', role: 'assistant', content: 'On it!' }),
    );
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-real', actorClerkUserId: 'shop-demo.myshopify.com' }),
    );
    expect(res.status).toBe(200);
  });

  it('op=takeover records the audit trail against the shop, not a person', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    getProfileIdMock.mockResolvedValue('profile-shop-1');
    takeOverConversationMock.mockResolvedValue({ id: 'c-1', status: 'handoff_active' });

    const res = await POST(req({ op: 'takeover', conversationId: 'c-1' }));
    expect(res.status).toBe(200);
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ actorClerkUserId: 'shop-demo.myshopify.com', action: 'conversation_taken_over' }),
    );
  });

  it('op=release returns the conversation to AI', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'handoff_active' });
    returnConversationToAiMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    const res = await POST(req({ op: 'release', conversationId: 'c-1' }));
    expect(res.status).toBe(200);
  });

  it('op=close closes the conversation', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    closeConversationMock.mockResolvedValue({ id: 'c-1', status: 'closed' });
    const res = await POST(req({ op: 'close', conversationId: 'c-1' }));
    expect(res.status).toBe(200);
  });

  it('rejects an unknown op', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    const res = await POST(req({ op: 'nope', conversationId: 'c-1' }));
    expect(res.status).toBe(400);
  });

  it('returns a generic 500 instead of leaking a raw infra error when an op throws', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    getProfileIdMock.mockRejectedValue(new Error('connection to profiles table reset'));
    const res = await POST(req({ op: 'takeover', conversationId: 'c-1' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'Action failed. Please try again.' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/shopify/store-chat/thread/route.test.ts`
Expected: FAIL — route module does not exist.

- [ ] **Step 3: Write the route**

```ts
// apps/web-next/app/api/shopify/store-chat/thread/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { shopProfileId } from '@/lib/messenger/shop-tenancy';
import { getProfileId } from '@/lib/messenger/provisioning';
import {
  appendMessage,
  closeConversation,
  getConversationForSite,
  listMessages,
  recordAudit,
  returnConversationToAi,
  takeOverConversation,
} from '@/lib/messenger/conversations';
import { listConversationAttachments, signAttachmentUrls } from '@/lib/messenger/attachments';

type ThreadBody =
  | { op: 'messages'; conversationId: string }
  | { op: 'reply'; conversationId: string; text: string }
  | { op: 'takeover'; conversationId: string }
  | { op: 'release'; conversationId: string }
  | { op: 'close'; conversationId: string };

/* Embedded equivalent of the dashboard's fetchConversationMessages / staffReply /
   takeoverConversation / releaseConversation / closeConversationAction actions.
   The site is always resolved from the verified session token's shop, and the
   conversation is always scoped to that site via getConversationForSite —
   never trusted from the request body — the same invariant every other
   Phase 2 route documents and enforces.

   The audit actor is shopProfileId(shop): the store, not a specific person.
   getProfileId resolves it whether or not the store has since been claimed —
   that profile row is never deleted, only orphaned, on claim (see the note
   at the top of this plan). */
export async function POST(request: NextRequest) {
  const session = authenticateShopifyRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let site;
  try {
    site = await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[store-chat thread] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const body = (await request.json()) as ThreadBody;
  const conversation = await getConversationForSite(body.conversationId, site.id);
  if (!conversation) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  const actorClerkUserId = shopProfileId(session.shop);

  if (body.op === 'messages') {
    try {
      const [messages, rows] = await Promise.all([
        listMessages(conversation.id, { limit: 200 }),
        listConversationAttachments(conversation.id),
      ]);
      const linked = rows.filter((row) => row.message_id);
      const signed = await signAttachmentUrls(linked.map((row) => row.storage_path));
      const attachments: Record<string, { url: string; mime: string; triage: unknown }> = {};
      for (const row of linked) {
        const url = signed[row.storage_path];
        if (url) attachments[row.message_id as string] = { url, mime: row.mime, triage: row.triage };
      }
      return NextResponse.json({
        ok: true,
        status: conversation.status,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.created_at,
          author: m.metadata.author ?? (m.role === 'assistant' ? 'ai' : undefined),
        })),
        attachments,
      });
    } catch (error) {
      console.error('[store-chat thread] failed to load messages', error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  try {
    switch (body.op) {
      case 'reply': {
        const trimmed = body.text.trim().slice(0, 2000);
        if (!trimmed) return NextResponse.json({ ok: false, error: 'Message is empty.' }, { status: 400 });
        if (conversation.status === 'open') {
          const taken = await takeOverConversation(conversation.id, await getProfileId(actorClerkUserId));
          if (!taken) {
            return NextResponse.json({ ok: false, error: 'Conversation state changed. Refresh and retry.' }, { status: 400 });
          }
        }
        await appendMessage({ conversationId: conversation.id, role: 'assistant', content: trimmed, metadata: { author: 'human' } });
        await recordAudit({
          siteId: site.id,
          actorClerkUserId,
          action: 'conversation_taken_over',
          detail: { conversationId: conversation.id },
        });
        return NextResponse.json({ ok: true });
      }
      case 'takeover': {
        const taken = await takeOverConversation(conversation.id, await getProfileId(actorClerkUserId));
        if (!taken) {
          return NextResponse.json({ ok: false, error: 'Conversation is no longer available for takeover.' }, { status: 400 });
        }
        await recordAudit({
          siteId: site.id,
          actorClerkUserId,
          action: 'conversation_taken_over',
          detail: { conversationId: conversation.id },
        });
        return NextResponse.json({ ok: true });
      }
      case 'release': {
        const released = await returnConversationToAi(conversation.id);
        if (!released) {
          return NextResponse.json({ ok: false, error: 'Only an active human conversation can be returned to AI.' }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }
      case 'close': {
        const closed = await closeConversation(conversation.id);
        if (!closed) return NextResponse.json({ ok: false, error: 'Conversation already closed.' }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ ok: false, error: 'Unknown operation.' }, { status: 400 });
    }
  } catch (error) {
    console.error('[store-chat thread] operation failed', error);
    return NextResponse.json({ ok: false, error: 'Action failed. Please try again.' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/shopify/store-chat/thread/route.test.ts`
Expected: PASS, 9/9.

- [ ] **Step 5: Commit**

```bash
git add app/api/shopify/store-chat/thread
git commit -m "feat(shopify): add embedded Store Chat conversation thread route"
```

---

## Task 16: Embedded adapter — five thread methods

**Files:**
- Modify: `apps/web-next/components/shopify/store-chat-actions.ts`
- Modify: `apps/web-next/components/shopify/store-chat-actions.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `apps/web-next/components/shopify/store-chat-actions.test.ts`, inside the existing `describe('useStoreChatActions', ...)` block:

```ts
  it('fetchConversationMessages posts op=messages and returns the parsed body', async () => {
    fetchMock.mockResolvedValue({ json: () => Promise.resolve({ ok: true, status: 'open', messages: [], attachments: {} }) });
    const { result } = renderHook(() => useStoreChatActions());
    const res = await result.current.fetchConversationMessages('client-side-site-id', 'conv-1');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/shopify/store-chat/thread',
      expect.objectContaining({ body: JSON.stringify({ op: 'messages', conversationId: 'conv-1' }) }),
    );
    expect(res).toEqual({ ok: true, status: 'open', messages: [], attachments: {} });
  });

  it('staffReply posts op=reply with the text', async () => {
    const { result } = renderHook(() => useStoreChatActions());
    await result.current.staffReply('site-id', 'conv-1', 'On it!');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/shopify/store-chat/thread',
      expect.objectContaining({ body: JSON.stringify({ op: 'reply', conversationId: 'conv-1', text: 'On it!' }) }),
    );
  });

  it('takeoverConversation, releaseConversation, and closeConversationAction post their matching op', async () => {
    const { result } = renderHook(() => useStoreChatActions());
    await result.current.takeoverConversation('site-id', 'conv-1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/shopify/store-chat/thread',
      expect.objectContaining({ body: JSON.stringify({ op: 'takeover', conversationId: 'conv-1' }) }),
    );
    await result.current.releaseConversation('site-id', 'conv-1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/shopify/store-chat/thread',
      expect.objectContaining({ body: JSON.stringify({ op: 'release', conversationId: 'conv-1' }) }),
    );
    await result.current.closeConversationAction('site-id', 'conv-1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/shopify/store-chat/thread',
      expect.objectContaining({ body: JSON.stringify({ op: 'close', conversationId: 'conv-1' }) }),
    );
  });

  it('fetchConversationMessages returns a bare failure, matching the dashboard shape, when fetch itself rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useStoreChatActions());
    await expect(result.current.fetchConversationMessages('site-id', 'conv-1')).resolves.toEqual({ ok: false });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shopify/store-chat-actions.test.ts`
Expected: FAIL — `useStoreChatActions()`'s returned object has no `fetchConversationMessages`/`staffReply`/`takeoverConversation`/`releaseConversation`/`closeConversationAction`.

- [ ] **Step 3: Implement the five methods**

In `apps/web-next/components/shopify/store-chat-actions.ts`, add the import and a second helper alongside `postJson`:

```ts
import type { FetchMessagesResult, MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';

async function postThreadRead(conversationId: string): Promise<FetchMessagesResult | { ok: false }> {
  try {
    const token = await getShopifySessionToken();
    const res = await fetch('/api/shopify/store-chat/thread', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'messages', conversationId }),
    });
    return (await res.json()) as FetchMessagesResult | { ok: false };
  } catch {
    return { ok: false };
  }
}
```

Add to the returned object inside `useStoreChatActions`:

```ts
      fetchConversationMessages: (_siteId, conversationId: string) => postThreadRead(conversationId),
      staffReply: (_siteId, conversationId: string, text: string) =>
        postJson('/api/shopify/store-chat/thread', { op: 'reply', conversationId, text }),
      takeoverConversation: (_siteId, conversationId: string) =>
        postJson('/api/shopify/store-chat/thread', { op: 'takeover', conversationId }),
      releaseConversation: (_siteId, conversationId: string) =>
        postJson('/api/shopify/store-chat/thread', { op: 'release', conversationId }),
      closeConversationAction: (_siteId, conversationId: string) =>
        postJson('/api/shopify/store-chat/thread', { op: 'close', conversationId }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/shopify/store-chat-actions.test.ts`
Expected: PASS, 8/8 (4 pre-existing plus the 4 added in Step 1).

- [ ] **Step 5: Commit**

```bash
git add components/shopify/store-chat-actions.ts components/shopify/store-chat-actions.test.ts
git commit -m "feat(shopify): wire the embedded actions adapter to the conversation thread route"
```

---

## Task 17: Turn on the Conversations tab in the embedded shell

**Files:**
- Modify: `apps/web-next/components/shopify/store-chat-embedded.tsx`
- Modify: `apps/web-next/components/shopify/store-chat-embedded.test.tsx`

Everything needed already exists after Tasks 14–16 — this task only removes the one flag that was hiding it, and wraps the five new methods the same way Task 13 wrapped `publishConfig` (re-pull `/state` after a successful mutation, since there's no `revalidatePath` equivalent here). `takeoverConversation`/`releaseConversation`/`closeConversationAction`/`staffReply` all change conversation state the dashboard's own overview stats and conversation list should reflect; `fetchConversationMessages` is a pure read and needs no wrapping.

- [ ] **Step 1: Write the failing test**

Add to `apps/web-next/components/shopify/store-chat-embedded.test.tsx`:

```tsx
  it('renders the Conversations tab in the embedded shell', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(STATE_RESPONSE) });
    render(<StoreChatEmbedded locale="en" />);
    await screen.findByText('Demo store');
    expect(screen.getByRole('button', { name: 'Conversations' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shopify/store-chat-embedded.test.tsx`
Expected: FAIL — `showConversationsTab={false}` still hides the tab.

- [ ] **Step 3: Remove the flag and wrap the five new methods**

In `apps/web-next/components/shopify/store-chat-embedded.tsx`, delete the line `showConversationsTab={false}` from the `<MessengerTabs>` element entirely (the prop defaults to `true`).

Add to the `actions` `useMemo` object, alongside the six existing wrapped methods:

```ts
      takeoverConversation: async (siteId, conversationId) => {
        const result = await rawActions.takeoverConversation(siteId, conversationId);
        if (result.ok) void loadState();
        return result;
      },
      releaseConversation: async (siteId, conversationId) => {
        const result = await rawActions.releaseConversation(siteId, conversationId);
        if (result.ok) void loadState();
        return result;
      },
      closeConversationAction: async (siteId, conversationId) => {
        const result = await rawActions.closeConversationAction(siteId, conversationId);
        if (result.ok) void loadState();
        return result;
      },
      staffReply: async (siteId, conversationId, text) => {
        const result = await rawActions.staffReply(siteId, conversationId, text);
        if (result.ok) void loadState();
        return result;
      },
      // Pure read — no state to refresh.
      fetchConversationMessages: rawActions.fetchConversationMessages,
```

In `apps/web-next/components/shopify/store-chat-embedded.test.tsx`, add the five new methods to the mocked `useStoreChatActions()` return object (needed now that `MessengerHostActions` requires them):

```ts
    takeoverConversation: vi.fn(),
    releaseConversation: vi.fn(),
    closeConversationAction: vi.fn(),
    staffReply: vi.fn(),
    fetchConversationMessages: vi.fn().mockResolvedValue({ ok: true, status: 'open', messages: [], attachments: {} }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/shopify/store-chat-embedded.test.tsx`
Expected: PASS, 5/5.

- [ ] **Step 5: Run the full suite, typecheck, and build**

Run: `npx vitest run` && `npx tsc --noEmit` && `npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 6: Manual embedded smoke check**

Same as Phase 2's Task 12 Step 10 — open `/shopify/app?locale=en` outside a real Shopify iframe, confirm the Conversations tab button now appears alongside the other five and switching to it shows the same "could not load" state the others show (App Bridge can't resolve a token outside Shopify), not a crash. Full verification (a live conversation, an actual takeover) requires a real Shopify dev store session and a live shopper conversation, which is out of scope for this local check.

- [ ] **Step 7: Commit**

```bash
git add components/shopify/store-chat-embedded.tsx components/shopify/store-chat-embedded.test.tsx
git commit -m "feat(shopify): turn on the Conversations tab in the embedded app"
```

---

## Final integration check

- [ ] `npx vitest run --silent` — full suite green, note the new total test count.
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npx next lint` — no new errors beyond the four pre-existing `components/assistant/*` ones.
- [ ] `npm run build` — succeeds.
- [ ] Confirm no route under `app/api/shopify/store-chat/*` imports `requireOwnedSite` or anything from `@clerk/nextjs/server`.
- [ ] Confirm `getConversationForSite` is the only cross-tenant guard the new route relies on — grep the route for any place a client-supplied id reaches a query without first passing through it.

## What execution changed

All four tasks shipped on `feat/embedded-conversations`, implemented via Codex CLI (one task per dispatch), each diff independently re-verified before commit. Final state: **799/799 tests** (up from 782 before this phase), `tsc --noEmit` clean, `next lint` unchanged at the same 4 pre-existing `components/assistant/*` errors, production build succeeds (all 6 `/api/shopify/store-chat/*` routes present, including the new `thread` route), and a manual browser check confirmed the Conversations tab button now renders in the embedded shell and degrades to the same graceful "could not load" state as every other tab outside a real Shopify iframe.

Two small defects found and fixed during execution, neither a Codex mistake:

1. **This plan's own test count was wrong.** Task 16's Step 4 said "PASS, 9/9"; the file actually ends up with 8 (4 pre-existing + 4 added). Codex caught the discrepancy itself, correctly implemented the 4 tests exactly as specified rather than padding to hit the wrong number, and flagged it in its report. Fixed in the plan.

2. **Task 14 introduced a `react-hooks/exhaustive-deps` warning** in `conversations-panel.tsx`: the `load` callback started calling `actions.fetchConversationMessages` but its dependency array wasn't updated to include `actions`. Harmless in practice — every `actions` value that reaches this component (the dashboard's `messengerActions` module namespace, the embedded `useMemo`-stabilized wrapper) is referentially stable across renders — but a stale-closure risk is a stale-closure risk regardless of whether anything currently triggers it. Not caught until Task 17's lint gate, since earlier tasks in this phase weren't individually lint-checked (a gap in my own per-task verification, not the plan's). Fixed directly.

Also confirmed empirically, not just asserted: every downstream use inside the new `/thread` route (`appendMessage`, `recordAudit`) references `conversation.id` — the value returned by `getConversationForSite`'s server-side lookup — never `body.conversationId`, the client-supplied one. The client-supplied id is used exactly once, as the lookup key that either resolves to a conversation scoped to the token-verified site or returns nothing; nothing downstream can act on an unscoped id.

## Known, non-blocking follow-up

Orphaned synthetic profiles: every claimed store leaves behind a `profiles` row (and the workspace it was created under) that nothing references anymore. Harmless today — `getProfileId` finds it by `clerk_user_id` regardless of workspace membership, which is exactly what this phase relies on — but it is unbounded growth with no cleanup path. Worth a follow-up if it ever needs to be reclaimed (e.g. for storage accounting or GDPR-style deletion requests tied to a shop rather than a person); not addressed here since nothing in this phase requires it and deleting a profile a live query might still depend on is exactly the kind of change that needs its own careful design, not a rider on this one.
