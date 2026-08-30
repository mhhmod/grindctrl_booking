# Store Chat in the Shopify Embedded App — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make five of Store Chat's six dashboard editors (Appearance, Behaviour, AI & Knowledge, Support desk, Installation) usable inside the Shopify embedded app, under a renamed "GRINDCTRL" app shell with Try-On and Store Chat as separate tabs — reusing the exact same React components the dashboard renders, never a copy.

**Architecture:** Every mutating function in the messenger dashboard today resolves authorization via `requireOwnedSite(clerkUserId, siteId)` — a Clerk-session proof. The embedded app has no Clerk session; Phase 1 (shipped, `main`) proved shop identity a different way: `ensureShopOwnedSite(shopDomain)`, keyed on a verified Shopify session token. This plan extracts the *business logic* of `saveDraftSection`, `publishConfig`, `setMessengerEnabled`, and the five `knowledge.ts` mutations out of their Clerk-only authorization wrapper, so each takes an **already-resolved, already-authorized** `MessengerSiteView` instead of resolving it itself. Two thin callers then exist side by side: the dashboard's server actions (resolve via `requireOwnedSite`) and five new `/api/shopify/store-chat/*` route handlers (resolve via `ensureShopOwnedSite`). The five dashboard editor components stop importing server actions directly and instead take an `actions` prop typed against a shared interface; the dashboard injects the real server actions, the embedded shell injects a `fetch`-backed adapter that talks to the new routes.

**Tech Stack:** Next.js 15 App Router (Server Components + Route Handlers), Supabase (service-role client, unchanged schema — no migration in this phase), Shopify App Bridge (`window.shopify.idToken()`), vitest + `@testing-library/react`.

**Scope note — read before starting.** The original design doc (`docs/superpowers/specs/2026-08-30-shopify-unified-app-design.md`, section 6) lists all *six* dashboard editors and all *five* illustrative route handlers, including `conversations-panel.tsx` and a `POST /api/shopify/store-chat/thread` route, as part of "the shell, rename, and Store Chat config" phase. This plan deliberately **ships five components, not six**, and does **not** build a `/thread` route. Reason found during planning research, not present in the original spec: `staffReply`/`takeoverConversation` resolve a profile via `getProfileId(actorClerkUserId)`, and for a shop-owned (unclaimed) site the actor is the synthetic `shop-<domain>` profile — but per spec section 5, that synthetic profile **is deleted once a real merchant claims the store**. An embedded Conversations tab built now would silently break the moment a merchant claims their store, exactly the class of bug this project's review process exists to catch before it ships. Conversations correctly belongs in Phase 3 ("Conversations in the embedded app"), which spec section 10 already scopes separately and flags as "the only piece worth reconsidering on evidence" — this plan treats that boundary as real. `conversations-panel.tsx` is left completely untouched; it keeps importing `@/app/dashboard/messenger/actions` directly, exactly as it does on `main` today.

---

## Task 1: Shared Shopify request-authentication helper

**Files:**
- Modify: `apps/web-next/lib/shopify/session-token.ts`
- Modify: `apps/web-next/app/api/shopify/admin/settings/route.ts`
- Test: `apps/web-next/lib/shopify/session-token.test.ts` (new)

Two existing routes each inline their own "strip `Bearer ` off the Authorization header, then verify" logic, written slightly differently (`admin/settings/route.ts` uses `header.startsWith('Bearer ')`, exact-case; `claim/start/route.ts` uses `header.replace(/^bearer\s+/i, '')`, case-insensitive). Every Store Chat route this plan adds needs the same check. Extract it once, in the case-insensitive form, next to `verifySessionToken` itself.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-next/lib/shopify/session-token.test.ts
// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authenticateShopifyRequest } from './session-token';
import { createHmac } from 'node:crypto';

const SECRET = 'test-secret';

function makeToken(overrides: Partial<{ aud: string; dest: string; exp: number; nbf: number }> = {}): string {
  const b64url = (input: string) => Buffer.from(input).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      aud: 'fc095fe656d9029fdc249a4af2315f19',
      dest: 'https://demo.myshopify.com',
      exp: now + 60,
      nbf: now - 5,
      ...overrides,
    }),
  );
  const body = `${header}.${payload}`;
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function req(headers?: Record<string, string>): NextRequest {
  return new NextRequest(new Request('https://grindctrl.cloud/api/shopify/store-chat/state', { headers }));
}

beforeEach(() => {
  process.env.SHOPIFY_API_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.SHOPIFY_API_SECRET;
});

describe('authenticateShopifyRequest', () => {
  it('accepts a valid Bearer token', () => {
    const session = authenticateShopifyRequest(req({ authorization: `Bearer ${makeToken()}` }));
    expect(session).toEqual({ shop: 'demo.myshopify.com' });
  });

  it('accepts a lowercase bearer prefix', () => {
    const session = authenticateShopifyRequest(req({ authorization: `bearer ${makeToken()}` }));
    expect(session).toEqual({ shop: 'demo.myshopify.com' });
  });

  it('rejects a missing Authorization header', () => {
    expect(authenticateShopifyRequest(req())).toBeNull();
  });

  it('rejects a header with no token after the prefix', () => {
    expect(authenticateShopifyRequest(req({ authorization: 'Bearer ' }))).toBeNull();
  });

  it('rejects an invalid signature', () => {
    const session = authenticateShopifyRequest(req({ authorization: `Bearer ${makeToken()}xx` }));
    expect(session).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/shopify/session-token.test.ts`
Expected: FAIL — `authenticateShopifyRequest` is not exported from `./session-token`.

- [ ] **Step 3: Add the helper**

Add to `apps/web-next/lib/shopify/session-token.ts`, after the existing `verifySessionToken` export (keep the `NextRequest` import type-only so this stays a plain server module):

```ts
import type { NextRequest } from 'next/server';
```

(add near the top, after the `node:crypto` import)

```ts
/** Every Shopify-embedded route handler authenticates the same way: a
 *  Bearer session token from App Bridge's idToken(). One place to get the
 *  prefix-stripping right, instead of every route re-deriving it. */
export function authenticateShopifyRequest(request: NextRequest): VerifiedSession | null {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^bearer\s+/i, '').trim();
  if (!token) return null;
  return verifySessionToken(token);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/shopify/session-token.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Point the existing admin/settings route at the shared helper**

In `apps/web-next/app/api/shopify/admin/settings/route.ts`, replace:

```ts
import { verifySessionToken } from '@/lib/shopify/session-token';
```

with:

```ts
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
```

and replace the local `authenticate` function:

```ts
function authenticate(request: NextRequest) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return verifySessionToken(token);
}
```

with:

```ts
const authenticate = authenticateShopifyRequest;
```

- [ ] **Step 6: Run the full route test + typecheck**

Run: `npx vitest run app/api/shopify` && `npx tsc --noEmit`
Expected: existing tests still pass (there is no `admin/settings/route.test.ts` today — this is a behavior-preserving rename, verify by reading the diff, not by a new test), no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/shopify/session-token.ts lib/shopify/session-token.test.ts app/api/shopify/admin/settings/route.ts
git commit -m "feat(shopify): extract shared session-token request auth helper"
```

---

## Task 2: Extract `actions-core.ts` — the three config actions the embedded routes need

**Files:**
- Create: `apps/web-next/lib/messenger/actions-core.ts`
- Create: `apps/web-next/lib/messenger/actions-core.test.ts`
- Modify: `apps/web-next/app/dashboard/messenger/actions.ts`

`saveDraftSection`, `publishConfig`, and `setMessengerEnabled` in `actions.ts` each do exactly two things: resolve `site` via `requireOwnedSite(userId, siteId)`, then mutate `widget_sites` based on `site`. Split that: the mutation logic moves to `actions-core.ts`, taking an already-resolved `site: MessengerSiteView` (and, where an audit trail needs an actor, `actorClerkUserId: string`). `actions.ts`'s exports become thin wrappers that resolve `site` and call the core, unchanged in observable behavior. `discardDraft` and the conversation actions are **not** touched — nothing outside `actions.ts` needs them yet (see the Scope note above), and moving code with no second caller would be premature.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-next/lib/messenger/actions-core.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessengerSiteView } from './provisioning';

const { updateMock, recordAuditMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  recordAuditMock: vi.fn(),
}));

vi.mock('./db', () => ({
  getMessengerServiceClient: () => ({
    from: () => ({
      update: updateMock,
    }),
  }),
}));
vi.mock('./conversations', () => ({ recordAudit: recordAuditMock }));

import { publishConfigForSite, saveDraftSectionForSite, setMessengerEnabledForSite } from './actions-core';

function site(overrides: Partial<MessengerSiteView> = {}): MessengerSiteView {
  return {
    id: 'site-1',
    workspace_id: 'ws-1',
    name: 'Demo',
    embed_key: 'gc_demo',
    status: 'draft',
    domain: 'demo.myshopify.com',
    settings_json: {},
    settings_version: 3,
    settings_draft: null,
    hasDraft: false,
    ...overrides,
  };
}

function chain(result: { data?: unknown; error?: { message: string } | null }) {
  const builder = {
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveDraftSectionForSite', () => {
  it('rejects a section name outside the registry', async () => {
    updateMock.mockReturnValue(chain({ error: null }));
    const result = await saveDraftSectionForSite(site(), 'not-a-real-section' as never, {});
    expect(result).toEqual({ ok: false, error: 'Unknown section.' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('merges the section into the existing draft and writes it', async () => {
    updateMock.mockReturnValue(chain({ error: null }));
    const result = await saveDraftSectionForSite(
      site({ settings_draft: { messenger_appearance: { accentColor: '#000000' } } }),
      'behaviour',
      { greetingEnabled: false },
    );
    expect(result).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith({
      settings_draft: {
        messenger_appearance: { accentColor: '#000000' },
        messenger_behaviour: { greetingEnabled: false },
      },
    });
  });
});

describe('publishConfigForSite', () => {
  it('refuses to publish an empty draft', async () => {
    const result = await publishConfigForSite(site({ settings_draft: null }), 'actor-1');
    expect(result).toEqual({ ok: false, error: 'Nothing to publish yet.' });
  });

  it('reports a concurrent publish instead of overwriting it silently', async () => {
    updateMock.mockReturnValue(chain({ data: [], error: null }));
    const result = await publishConfigForSite(
      site({ settings_draft: { messenger_ai: { enabled: true } } }),
      'actor-1',
    );
    expect(result).toEqual({
      ok: false,
      error: 'Someone else published while you were editing. Refresh and try again.',
    });
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it('publishes, bumps the version, and records an audit entry', async () => {
    updateMock.mockReturnValue(chain({ data: [{ id: 'site-1' }], error: null }));
    const result = await publishConfigForSite(
      site({ settings_version: 3, settings_draft: { messenger_ai: { enabled: true } } }),
      'actor-1',
    );
    expect(result).toEqual({ ok: true, message: 'Published — live on your store within a minute.' });
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1', actorClerkUserId: 'actor-1', action: 'config_published' }),
    );
  });
});

describe('setMessengerEnabledForSite', () => {
  it('flips status and records the matching audit action', async () => {
    updateMock.mockReturnValue(chain({ error: null }));
    const result = await setMessengerEnabledForSite(site(), 'actor-1', true);
    expect(result).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith({ status: 'active' });
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'messenger_enabled' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/messenger/actions-core.test.ts`
Expected: FAIL — `./actions-core` does not exist.

- [ ] **Step 3: Write `actions-core.ts`**

```ts
// apps/web-next/lib/messenger/actions-core.ts
import 'server-only';

import { getMessengerServiceClient } from './db';
import { recordAudit } from './conversations';
import {
  CONFIG_SECTIONS,
  MESSENGER_SECTION_NAMES,
  resolveMessengerConfig,
  toSettingsSections,
  type MessengerSection,
} from './config';
import type { MessengerSiteView } from './provisioning';

/* The dashboard's server actions (actions.ts) and the embedded Store Chat
   route handlers authorize a caller two completely different ways —
   requireOwnedSite's Clerk-session proof vs. ensureShopOwnedSite's verified
   shop-domain proof. Everything AFTER that point — validating the payload,
   writing widget_sites, recording the audit trail — is identical, so it
   lives here once. Every function takes a `site` its caller has already
   resolved and authorized; none of them re-check ownership. */

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function sectionToKey(section: MessengerSection, payload: Record<string, unknown>): Record<string, unknown> {
  return { [CONFIG_SECTIONS[section]]: payload };
}

export async function saveDraftSectionForSite(
  site: MessengerSiteView,
  section: MessengerSection,
  payload: object,
): Promise<ActionResult> {
  // Section name arrives from the client, so it is checked against the
  // registry rather than trusted to be one of the declared union members.
  if (!MESSENGER_SECTION_NAMES.includes(section)) {
    return { ok: false, error: 'Unknown section.' };
  }
  const record = payload as Record<string, unknown>;
  // Validate through the resolver first so drafts can never poison config.
  const probe = resolveMessengerConfig({
    ...(site.settings_json as Record<string, unknown>),
    ...sectionToKey(section, record),
  });
  void probe;

  const supabase = getMessengerServiceClient();
  const existingDraft = (site.settings_draft ?? {}) as Record<string, unknown>;
  const nextDraft = { ...existingDraft, ...sectionToKey(section, record) };
  const res = await supabase.from('widget_sites').update({ settings_draft: nextDraft }).eq('id', site.id);
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}

export async function publishConfigForSite(
  site: MessengerSiteView,
  actorClerkUserId: string,
): Promise<ActionResult> {
  const draft = site.settings_draft;
  if (!draft || Object.keys(draft).length === 0) {
    return { ok: false, error: 'Nothing to publish yet.' };
  }
  // Resolve once more against published so partial drafts land complete.
  const merged = {
    ...(site.settings_json as Record<string, unknown>),
    ...(draft as Record<string, unknown>),
  };
  const resolved = resolveMessengerConfig(merged);
  const nextSettings: Record<string, unknown> = {
    ...(site.settings_json as Record<string, unknown>),
    ...toSettingsSections(resolved),
  };

  /* Optimistic concurrency on the version we read: two callers publishing at
     once would otherwise both write version+1, so the second silently
     overwrites the first — and since storefronts cache by version, the lost
     publish looks like nothing happened. */
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('widget_sites')
    .update({
      settings_json: nextSettings,
      settings_version: site.settings_version + 1,
      settings_draft: null,
    })
    .eq('id', site.id)
    .eq('settings_version', site.settings_version)
    .select('id');
  if (res.error) throw new Error(res.error.message);
  if ((res.data ?? []).length === 0) {
    return { ok: false, error: 'Someone else published while you were editing. Refresh and try again.' };
  }

  await recordAudit({
    siteId: site.id,
    actorClerkUserId,
    action: 'config_published',
    detail: { version: site.settings_version + 1 },
  });
  return { ok: true, message: 'Published — live on your store within a minute.' };
}

export async function setMessengerEnabledForSite(
  site: MessengerSiteView,
  actorClerkUserId: string,
  enabled: boolean,
): Promise<ActionResult> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('widget_sites')
    .update({ status: enabled ? 'active' : 'draft' })
    .eq('id', site.id);
  if (res.error) throw new Error(res.error.message);
  await recordAudit({
    siteId: site.id,
    actorClerkUserId,
    action: enabled ? 'messenger_enabled' : 'messenger_disabled',
  });
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/messenger/actions-core.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Refactor `actions.ts` to call the core**

In `apps/web-next/app/dashboard/messenger/actions.ts`, add to the imports:

```ts
import { saveDraftSectionForSite, publishConfigForSite, setMessengerEnabledForSite } from '@/lib/messenger/actions-core';
```

Replace the body of `saveDraftSection` (keep the same exported signature and the `try`/`catch(fail)` wrapper):

```ts
export async function saveDraftSection(
  siteId: string,
  section: MessengerSection,
  payload: object,
): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const site = await requireOwnedSite(userId, siteId);
    const result = await saveDraftSectionForSite(site, section, payload);
    if (result.ok) revalidatePath('/dashboard/messenger');
    return result;
  } catch (error) {
    return fail(error);
  }
}
```

Replace the body of `publishConfig`:

```ts
export async function publishConfig(siteId: string): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const site = await requireOwnedSite(userId, siteId);
    const result = await publishConfigForSite(site, userId);
    if (result.ok) revalidatePath('/dashboard/messenger');
    return result;
  } catch (error) {
    return fail(error);
  }
}
```

Replace the body of `setMessengerEnabled`:

```ts
export async function setMessengerEnabled(siteId: string, enabled: boolean): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const site = await requireOwnedSite(userId, siteId);
    const result = await setMessengerEnabledForSite(site, userId, enabled);
    if (result.ok) revalidatePath('/dashboard/messenger');
    return result;
  } catch (error) {
    return fail(error);
  }
}
```

Delete the now-unused local `sectionToKey` function and the `CONFIG_SECTIONS`/`resolveMessengerConfig`/`toSettingsSections` imports from `actions.ts` if nothing else in the file still uses them — check first (`toSettingsSections`/`resolveMessengerConfig`/`CONFIG_SECTIONS`/`sectionToKey` should now be unused in this file; `MESSENGER_SECTION_NAMES` is also now unused in this file since the check moved into `actions-core.ts`). Leave the `import type { MessengerSection } from '@/lib/messenger/config';` — the exported function signatures still need it.

- [ ] **Step 6: Run the existing actions test suite + typecheck**

Run: `npx vitest run app/dashboard/messenger/actions.test.ts` && `npx tsc --noEmit`
Expected: all existing tests still pass unchanged (this refactor must not change `actions.ts`'s observable behavior), no type errors, no unused-import lint warnings.

- [ ] **Step 7: Commit**

```bash
git add lib/messenger/actions-core.ts lib/messenger/actions-core.test.ts app/dashboard/messenger/actions.ts
git commit -m "refactor(messenger): extract site-scoped config actions shared by dashboard and embedded routes"
```

---

## Task 3: Refactor `knowledge.ts` to take an authorized site instead of resolving ownership itself

**Files:**
- Modify: `apps/web-next/lib/messenger/knowledge.ts`
- Modify: `apps/web-next/app/dashboard/messenger/actions.ts`
- Test: `apps/web-next/lib/messenger/knowledge.test.ts` (new — no test exists for this file today)

Same shape of change as Task 2, applied to `addManualKnowledge`, `addUrlKnowledge`, `reSyncKnowledge`, `setKnowledgeStatus`, `removeKnowledge`: each currently takes `{ clerkUserId, siteId, ... }` and opens with `await requireOwnedSite(input.clerkUserId, input.siteId)`. Change the parameter to `{ site: MessengerSiteView, actorClerkUserId: string, ... }` and delete that internal call — the caller now proves authorization before calling in, exactly like Task 2's core functions.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-next/lib/messenger/knowledge.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessengerSiteView } from './provisioning';

const { insertMock, updateMock, deleteMock, selectSingleMock, recordAuditMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  selectSingleMock: vi.fn(),
  recordAuditMock: vi.fn(),
}));

vi.mock('./db', () => ({
  getMessengerServiceClient: () => ({
    from: () => ({
      insert: insertMock,
      update: updateMock,
      delete: deleteMock,
    }),
  }),
}));
vi.mock('./conversations', () => ({ recordAudit: recordAuditMock }));

import { addManualKnowledge, removeKnowledge, setKnowledgeStatus } from './knowledge';

function site(overrides: Partial<MessengerSiteView> = {}): MessengerSiteView {
  return {
    id: 'site-1',
    workspace_id: 'ws-1',
    name: 'Demo',
    embed_key: 'gc_demo',
    status: 'active',
    domain: 'demo.myshopify.com',
    settings_json: {},
    settings_version: 1,
    settings_draft: null,
    hasDraft: false,
    ...overrides,
  };
}

function chain(result: { data?: unknown; error?: { message: string } | null }) {
  const builder = {
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addManualKnowledge', () => {
  it('writes the entry under the given site and records an audit entry, without checking ownership itself', async () => {
    insertMock.mockReturnValue(
      chain({ data: { id: 'k-1', title: 'Shipping', content: 'Ships in 2 days', source: 'manual', status: 'active', source_url: null, last_synced_at: null, updated_at: '2026-01-01' }, error: null }),
    );
    const entry = await addManualKnowledge({
      site: site(),
      actorClerkUserId: 'shop-demo.myshopify.com',
      title: 'Shipping',
      content: 'Ships in 2 days',
    });
    expect(entry.id).toBe('k-1');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ widget_site_id: 'site-1', title: 'Shipping' }),
    );
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1', actorClerkUserId: 'shop-demo.myshopify.com', action: 'knowledge_added' }),
    );
  });
});

describe('setKnowledgeStatus', () => {
  it('updates status scoped to the given site id', async () => {
    updateMock.mockReturnValue(chain({ error: null }));
    await setKnowledgeStatus({ site: site(), entryId: 'k-1', status: 'disabled' });
    expect(updateMock).toHaveBeenCalledWith({ status: 'disabled' });
  });
});

describe('removeKnowledge', () => {
  it('deletes scoped to the given site id and records an audit entry', async () => {
    deleteMock.mockReturnValue(chain({ error: null }));
    await removeKnowledge({ site: site(), actorClerkUserId: 'shop-demo.myshopify.com', entryId: 'k-1' });
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'knowledge_removed', detail: { id: 'k-1' } }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/messenger/knowledge.test.ts`
Expected: FAIL — current signatures take `{ clerkUserId, siteId, ... }`, not `{ site, ... }`; `requireOwnedSite` (mocked implicitly via `./provisioning`, unmocked here) would also throw since no real Supabase call can succeed in this test.

- [ ] **Step 3: Refactor `knowledge.ts`**

Replace the top of the file — drop the `requireOwnedSite` import (no longer called from here) and add the `MessengerSiteView` type import:

```ts
import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { isPrivateIp } from '@/lib/pricing/geo';
import { getMessengerServiceClient } from './db';
import { recordAudit } from './conversations';
import type { MessengerSiteView } from './provisioning';
```

Replace `addManualKnowledge`:

```ts
export async function addManualKnowledge(input: {
  site: MessengerSiteView;
  actorClerkUserId: string;
  title: string;
  content: string;
}): Promise<KnowledgeEntry> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('messenger_knowledge')
    .insert({
      widget_site_id: input.site.id,
      title: input.title.trim().slice(0, 200),
      content: input.content.trim().slice(0, 20_000),
      source: 'manual',
      status: 'active',
    })
    .select('*')
    .single();
  if (res.error) throw new Error(`knowledge create failed: ${res.error.message}`);
  await recordAudit({
    siteId: input.site.id,
    actorClerkUserId: input.actorClerkUserId,
    action: 'knowledge_added',
    detail: { id: res.data.id, source: 'manual' },
  });
  return mapEntry(res.data as unknown as Record<string, unknown>);
}
```

Replace `addUrlKnowledge`:

```ts
export async function addUrlKnowledge(input: {
  site: MessengerSiteView;
  actorClerkUserId: string;
  url: string;
}): Promise<KnowledgeEntry> {
  const { title, content } = await fetchUrlKnowledge(input.url);
  const entry = await addManualKnowledge({
    site: input.site,
    actorClerkUserId: input.actorClerkUserId,
    title,
    content,
  });
  const supabase = getMessengerServiceClient();
  await supabase
    .from('messenger_knowledge')
    .update({ source: 'url', source_url: input.url.slice(0, 500), last_synced_at: new Date().toISOString() })
    .eq('id', entry.id);
  return { ...entry, source: 'url' as const, source_url: input.url.slice(0, 500) };
}
```

Replace `reSyncKnowledge`:

```ts
/** Re-fetches an existing url-source entry in place. */
export async function reSyncKnowledge(input: { site: MessengerSiteView; entryId: string }): Promise<void> {
  const supabase = getMessengerServiceClient();
  const current = await supabase
    .from('messenger_knowledge')
    .select('*')
    .eq('id', input.entryId)
    .eq('widget_site_id', input.site.id)
    .maybeSingle();
  if (!current.data) throw new Error('Knowledge entry not found.');
  const entry = mapEntry(current.data as unknown as Record<string, unknown>);
  if (entry.source !== 'url' || !entry.source_url) throw new Error('Only linked pages can be re-synced.');

  const { content } = await fetchUrlKnowledge(entry.source_url);
  await supabase
    .from('messenger_knowledge')
    .update({ content, last_synced_at: new Date().toISOString() })
    .eq('id', entry.id);
}
```

Replace `setKnowledgeStatus`:

```ts
export async function setKnowledgeStatus(input: {
  site: MessengerSiteView;
  entryId: string;
  status: 'active' | 'disabled';
}): Promise<void> {
  const supabase = getMessengerServiceClient();
  await supabase
    .from('messenger_knowledge')
    .update({ status: input.status })
    .eq('id', input.entryId)
    .eq('widget_site_id', input.site.id);
}
```

Replace `removeKnowledge`:

```ts
export async function removeKnowledge(input: {
  site: MessengerSiteView;
  actorClerkUserId: string;
  entryId: string;
}): Promise<void> {
  const supabase = getMessengerServiceClient();
  await supabase.from('messenger_knowledge').delete().eq('id', input.entryId).eq('widget_site_id', input.site.id);
  await recordAudit({
    siteId: input.site.id,
    actorClerkUserId: input.actorClerkUserId,
    action: 'knowledge_removed',
    detail: { id: input.entryId },
  });
}
```

`listKnowledge`, `getActiveKnowledge`, `fetchUrlKnowledge`, `extractReadableText`, `assertPublicTarget`, `currentClerkUser` are unchanged — they already take a bare `siteId` (read-only, no ownership check today) or no site at all.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/messenger/knowledge.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Update `actions.ts`'s knowledge wrappers to resolve `site` and pass it through**

Replace `addKnowledge`:

```ts
export async function addKnowledge(formData: FormData): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const siteId = String(formData.get('siteId') ?? '');
    const title = String(formData.get('title') ?? '').trim();
    const content = String(formData.get('content') ?? '').trim();
    const url = String(formData.get('url') ?? '').trim();

    if (!siteId) return { ok: false, error: 'Missing site.' };
    const site = await requireOwnedSite(userId, siteId);
    if (url) {
      await addUrlKnowledge({ site, actorClerkUserId: userId, url });
      revalidatePath('/dashboard/messenger');
      return { ok: true, message: 'Page added to knowledge.' };
    }
    if (!title || !content) return { ok: false, error: 'Title and content are required.' };
    await addManualKnowledge({ site, actorClerkUserId: userId, title, content });
    revalidatePath('/dashboard/messenger');
    return { ok: true, message: 'Added to knowledge.' };
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    const friendly = /https|URL|page|readable/i.test(raw) ? raw : undefined;
    return fail(friendly ? new Error(friendly) : error);
  }
}
```

Replace `updateKnowledgeStatus`:

```ts
export async function updateKnowledgeStatus(
  siteId: string,
  entryId: string,
  status: 'active' | 'disabled',
): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const site = await requireOwnedSite(userId, siteId);
    await setKnowledgeStatus({ site, entryId, status });
    revalidatePath('/dashboard/messenger');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
```

Replace `deleteKnowledge`:

```ts
export async function deleteKnowledge(siteId: string, entryId: string): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const site = await requireOwnedSite(userId, siteId);
    await removeKnowledge({ site, actorClerkUserId: userId, entryId });
    revalidatePath('/dashboard/messenger');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
```

Replace `syncKnowledge`:

```ts
export async function syncKnowledge(siteId: string, entryId: string): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const site = await requireOwnedSite(userId, siteId);
    await reSyncKnowledge({ site, entryId });
    revalidatePath('/dashboard/messenger');
    return { ok: true, message: 'Re-synced.' };
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    const friendly = /https|URL|page|readable/i.test(raw) ? raw : undefined;
    return fail(friendly ? new Error(friendly) : error);
  }
}
```

- [ ] **Step 6: Run the full messenger test suite + typecheck**

Run: `npx vitest run lib/messenger app/dashboard/messenger` && `npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/messenger/knowledge.ts lib/messenger/knowledge.test.ts app/dashboard/messenger/actions.ts
git commit -m "refactor(messenger): knowledge mutations take an authorized site instead of resolving ownership themselves"
```

---

## Task 4: Shared App Bridge session-token client helper

**Files:**
- Create: `apps/web-next/lib/shopify/app-bridge-client.ts`
- Modify: `apps/web-next/components/shopify/admin-settings.tsx`
- Test: `apps/web-next/lib/shopify/app-bridge-client.test.ts` (new)

`admin-settings.tsx` has a local `withToken()` helper (poll for `window.shopify` up to 5s, then call `idToken()`) that the new embedded Store Chat actions adapter (Task 11) needs identically. Extract it.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-next/lib/shopify/app-bridge-client.test.ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getShopifySessionToken } from './app-bridge-client';

afterEach(() => {
  delete (window as unknown as { shopify?: unknown }).shopify;
  vi.useRealTimers();
});

describe('getShopifySessionToken', () => {
  it('returns the token once window.shopify is present', async () => {
    (window as unknown as { shopify: { idToken: () => Promise<string> } }).shopify = {
      idToken: () => Promise.resolve('tok-123'),
    };
    await expect(getShopifySessionToken()).resolves.toBe('tok-123');
  });

  it('throws if App Bridge never becomes ready', async () => {
    vi.useFakeTimers();
    // Attach the rejection expectation before advancing timers — otherwise
    // the promise rejects before anything is listening, and vitest reports
    // an unhandled rejection instead of a passing assertion.
    const pending = expect(getShopifySessionToken()).rejects.toThrow('App Bridge not ready');
    await vi.advanceTimersByTimeAsync(6000);
    await pending;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/shopify/app-bridge-client.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the helper**

```ts
// apps/web-next/lib/shopify/app-bridge-client.ts
'use client';

declare global {
  interface Window {
    shopify?: { idToken(): Promise<string> };
  }
}

/** App Bridge's script tag loads synchronously but not instantly relative to
 *  React mounting; poll up to 5s rather than assume it's ready immediately. */
export async function getShopifySessionToken(): Promise<string> {
  for (let i = 0; i < 50 && !window.shopify; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!window.shopify) throw new Error('App Bridge not ready');
  return window.shopify.idToken();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/shopify/app-bridge-client.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Point `admin-settings.tsx` at the shared helper**

In `apps/web-next/components/shopify/admin-settings.tsx`, remove the local `declare global { interface Window { shopify?: ... } }` block and the local `withToken` function; add:

```ts
import { getShopifySessionToken } from '@/lib/shopify/app-bridge-client';
```

Replace both call sites `await withToken()` with `await getShopifySessionToken()`.

- [ ] **Step 6: Run typecheck + build**

Run: `npx tsc --noEmit`
Expected: no type errors (the ambient `Window.shopify` declaration now lives in one module; TS merges it fine since it's still declared exactly once).

- [ ] **Step 7: Commit**

```bash
git add lib/shopify/app-bridge-client.ts lib/shopify/app-bridge-client.test.ts components/shopify/admin-settings.tsx
git commit -m "refactor(shopify): extract shared App Bridge session-token client helper"
```

---

## Task 5: Route `POST /api/shopify/store-chat/draft`

**Files:**
- Create: `apps/web-next/app/api/shopify/store-chat/draft/route.ts`
- Test: `apps/web-next/app/api/shopify/store-chat/draft/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-next/app/api/shopify/store-chat/draft/route.test.ts
// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateMock, ensureShopOwnedSiteMock, saveDraftSectionForSiteMock } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  ensureShopOwnedSiteMock: vi.fn(),
  saveDraftSectionForSiteMock: vi.fn(),
}));

vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: authenticateMock }));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: ensureShopOwnedSiteMock }));
vi.mock('@/lib/messenger/actions-core', () => ({ saveDraftSectionForSite: saveDraftSectionForSiteMock }));

import { POST } from './route';

function req(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest(
    new Request('https://grindctrl.cloud/api/shopify/store-chat/draft', {
      method: 'POST',
      headers: { authorization: 'Bearer tok', ...headers },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.resetAllMocks();
});

describe('POST /api/shopify/store-chat/draft', () => {
  it('returns 401 when the session token does not verify', async () => {
    authenticateMock.mockReturnValue(null);
    const res = await POST(req({ section: 'appearance', payload: {} }));
    expect(res.status).toBe(401);
    expect(ensureShopOwnedSiteMock).not.toHaveBeenCalled();
  });

  it('resolves the site from the verified shop, never from the body', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    saveDraftSectionForSiteMock.mockResolvedValue({ ok: true });

    const res = await POST(req({ siteId: 'attacker-supplied-id', section: 'appearance', payload: { accentColor: '#fff' } }));

    expect(ensureShopOwnedSiteMock).toHaveBeenCalledWith('demo.myshopify.com');
    expect(saveDraftSectionForSiteMock).toHaveBeenCalledWith({ id: 'site-real' }, 'appearance', { accentColor: '#fff' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('maps a failed save to a 400 with the result body', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    saveDraftSectionForSiteMock.mockResolvedValue({ ok: false, error: 'Unknown section.' });

    const res = await POST(req({ section: 'nope', payload: {} }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Unknown section.' });
  });

  it('returns 503 when shop provisioning fails', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockRejectedValue(new Error('db down'));

    const res = await POST(req({ section: 'appearance', payload: {} }));
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/shopify/store-chat/draft/route.test.ts`
Expected: FAIL — route module does not exist.

- [ ] **Step 3: Write the route**

```ts
// apps/web-next/app/api/shopify/store-chat/draft/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { saveDraftSectionForSite } from '@/lib/messenger/actions-core';
import type { MessengerSection } from '@/lib/messenger/config';

/* Embedded equivalent of the dashboard's saveDraftSection server action.
   The site is always resolved from the verified session token's shop —
   never from the request body — the same invariant admin/settings and
   claim/start already document and enforce. */

export async function POST(request: NextRequest) {
  const session = authenticateShopifyRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let site;
  try {
    site = await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[store-chat draft] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const body = (await request.json()) as { section?: MessengerSection; payload?: object };
  const result = await saveDraftSectionForSite(site, body.section as MessengerSection, body.payload ?? {});
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/shopify/store-chat/draft/route.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add app/api/shopify/store-chat/draft
git commit -m "feat(shopify): add embedded Store Chat draft-save route"
```

---

## Task 6: Route `POST /api/shopify/store-chat/publish`

**Files:**
- Create: `apps/web-next/app/api/shopify/store-chat/publish/route.ts`
- Test: `apps/web-next/app/api/shopify/store-chat/publish/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-next/app/api/shopify/store-chat/publish/route.test.ts
// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateMock, ensureShopOwnedSiteMock, publishConfigForSiteMock } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  ensureShopOwnedSiteMock: vi.fn(),
  publishConfigForSiteMock: vi.fn(),
}));

vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: authenticateMock }));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: ensureShopOwnedSiteMock }));
vi.mock('@/lib/messenger/actions-core', () => ({ publishConfigForSite: publishConfigForSiteMock }));
vi.mock('@/lib/messenger/shop-tenancy', () => ({ shopProfileId: (domain: string) => `shop-${domain}` }));

import { POST } from './route';

function req(): NextRequest {
  return new NextRequest(
    new Request('https://grindctrl.cloud/api/shopify/store-chat/publish', {
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('POST /api/shopify/store-chat/publish', () => {
  it('returns 401 without a valid session token', async () => {
    authenticateMock.mockReturnValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('publishes using the shop profile id as the audit actor', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    publishConfigForSiteMock.mockResolvedValue({ ok: true, message: 'Published — live on your store within a minute.' });

    const res = await POST(req());

    expect(publishConfigForSiteMock).toHaveBeenCalledWith({ id: 'site-real' }, 'shop-demo.myshopify.com');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, message: 'Published — live on your store within a minute.' });
  });

  it('maps "nothing to publish" to a 400', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    publishConfigForSiteMock.mockResolvedValue({ ok: false, error: 'Nothing to publish yet.' });

    const res = await POST(req());
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/shopify/store-chat/publish/route.test.ts`
Expected: FAIL — route module does not exist.

- [ ] **Step 3: Write the route**

```ts
// apps/web-next/app/api/shopify/store-chat/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { shopProfileId } from '@/lib/messenger/shop-tenancy';
import { publishConfigForSite } from '@/lib/messenger/actions-core';

export async function POST(request: NextRequest) {
  const session = authenticateShopifyRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let site;
  try {
    site = await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[store-chat publish] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  // The audit trail needs an actor. Before a claim, that IS the synthetic
  // shop profile Phase 1 provisions — the same identity ensureShopOwnedSite
  // just resolved `site` under. There is no other actor available from a
  // verified-shop-domain request.
  const result = await publishConfigForSite(site, shopProfileId(session.shop));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/shopify/store-chat/publish/route.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add app/api/shopify/store-chat/publish
git commit -m "feat(shopify): add embedded Store Chat publish route"
```

---

## Task 7: Route `POST /api/shopify/store-chat/enable`

**Files:**
- Create: `apps/web-next/app/api/shopify/store-chat/enable/route.ts`
- Test: `apps/web-next/app/api/shopify/store-chat/enable/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-next/app/api/shopify/store-chat/enable/route.test.ts
// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateMock, ensureShopOwnedSiteMock, setMessengerEnabledForSiteMock } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  ensureShopOwnedSiteMock: vi.fn(),
  setMessengerEnabledForSiteMock: vi.fn(),
}));

vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: authenticateMock }));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: ensureShopOwnedSiteMock }));
vi.mock('@/lib/messenger/actions-core', () => ({ setMessengerEnabledForSite: setMessengerEnabledForSiteMock }));
vi.mock('@/lib/messenger/shop-tenancy', () => ({ shopProfileId: (domain: string) => `shop-${domain}` }));

import { POST } from './route';

function req(body: unknown): NextRequest {
  return new NextRequest(
    new Request('https://grindctrl.cloud/api/shopify/store-chat/enable', {
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('POST /api/shopify/store-chat/enable', () => {
  it('returns 401 without a valid session token', async () => {
    authenticateMock.mockReturnValue(null);
    const res = await POST(req({ enabled: true }));
    expect(res.status).toBe(401);
  });

  it('toggles status for the token-resolved site', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    setMessengerEnabledForSiteMock.mockResolvedValue({ ok: true });

    const res = await POST(req({ enabled: true }));

    expect(setMessengerEnabledForSiteMock).toHaveBeenCalledWith({ id: 'site-real' }, 'shop-demo.myshopify.com', true);
    expect(res.status).toBe(200);
  });

  it('coerces a non-boolean enabled to false', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    setMessengerEnabledForSiteMock.mockResolvedValue({ ok: true });

    await POST(req({ enabled: 'yes' }));
    expect(setMessengerEnabledForSiteMock).toHaveBeenCalledWith({ id: 'site-real' }, 'shop-demo.myshopify.com', false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/shopify/store-chat/enable/route.test.ts`
Expected: FAIL — route module does not exist.

- [ ] **Step 3: Write the route**

```ts
// apps/web-next/app/api/shopify/store-chat/enable/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { shopProfileId } from '@/lib/messenger/shop-tenancy';
import { setMessengerEnabledForSite } from '@/lib/messenger/actions-core';

export async function POST(request: NextRequest) {
  const session = authenticateShopifyRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let site;
  try {
    site = await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[store-chat enable] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const body = (await request.json()) as { enabled?: unknown };
  const result = await setMessengerEnabledForSite(site, shopProfileId(session.shop), body.enabled === true);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/shopify/store-chat/enable/route.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add app/api/shopify/store-chat/enable
git commit -m "feat(shopify): add embedded Store Chat enable/disable route"
```

---

## Task 8: Route `GET /api/shopify/store-chat/state`

**Files:**
- Create: `apps/web-next/app/api/shopify/store-chat/state/route.ts`
- Test: `apps/web-next/app/api/shopify/store-chat/state/route.test.ts`

Returns everything the embedded shell needs to render `MessengerTabs` for one shop — the same data `app/dashboard/messenger/page.tsx` assembles, resolved by verified shop domain instead of by Clerk session + `?site=`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-next/app/api/shopify/store-chat/state/route.test.ts
// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authenticateMock,
  ensureShopOwnedSiteMock,
  getOverviewStatsMock,
  listConversationsForSiteMock,
  listKnowledgeMock,
  listManagedTryOnShopsMock,
} = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  ensureShopOwnedSiteMock: vi.fn(),
  getOverviewStatsMock: vi.fn(),
  listConversationsForSiteMock: vi.fn(),
  listKnowledgeMock: vi.fn(),
  listManagedTryOnShopsMock: vi.fn(),
}));

vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: authenticateMock }));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: ensureShopOwnedSiteMock }));
vi.mock('@/lib/messenger/conversations', () => ({
  getOverviewStats: getOverviewStatsMock,
  listConversationsForSite: listConversationsForSiteMock,
}));
vi.mock('@/lib/messenger/knowledge', () => ({ listKnowledge: listKnowledgeMock }));
vi.mock('@/lib/shopify/shops', () => ({ listManagedTryOnShops: listManagedTryOnShopsMock }));

import { GET } from './route';

function req(): NextRequest {
  return new NextRequest(
    new Request('https://grindctrl.cloud/api/shopify/store-chat/state', {
      headers: { authorization: 'Bearer tok' },
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  getOverviewStatsMock.mockResolvedValue({ totalConversations: 0 });
  listConversationsForSiteMock.mockResolvedValue([]);
  listKnowledgeMock.mockResolvedValue([]);
  listManagedTryOnShopsMock.mockResolvedValue([]);
});

describe('GET /api/shopify/store-chat/state', () => {
  it('returns 401 without a valid session token', async () => {
    authenticateMock.mockReturnValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('resolves the site from the verified shop and assembles the dashboard payload shape', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({
      id: 'site-1',
      name: 'Demo',
      embed_key: 'gc_demo',
      status: 'active',
      domain: 'demo.myshopify.com',
      settings_json: {},
      settings_version: 2,
      settings_draft: null,
      hasDraft: false,
    });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.site).toEqual(
      expect.objectContaining({ id: 'site-1', name: 'Demo', embedKey: 'gc_demo', active: true, version: 2 }),
    );
    expect(body.config).toBeDefined();
    expect(body.payload).toBeDefined();
    expect(body.conversations).toEqual([]);
    expect(body.knowledge).toEqual([]);
  });

  it('never lets one failed panel take the whole response down', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({
      id: 'site-1',
      name: 'Demo',
      embed_key: 'gc_demo',
      status: 'active',
      domain: 'demo.myshopify.com',
      settings_json: {},
      settings_version: 1,
      settings_draft: null,
      hasDraft: false,
    });
    getOverviewStatsMock.mockRejectedValue(new Error('stats down'));

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/shopify/store-chat/state/route.test.ts`
Expected: FAIL — route module does not exist.

- [ ] **Step 3: Write the route**

```ts
// apps/web-next/app/api/shopify/store-chat/state/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { mergeDraftOverPublished } from '@/lib/messenger/config';
import { getOverviewStats, listConversationsForSite } from '@/lib/messenger/conversations';
import { listKnowledge } from '@/lib/messenger/knowledge';
import { listManagedTryOnShops } from '@/lib/shopify/shops';
import { toPublicPayload } from '@/lib/messenger/public-api';

/* Embedded equivalent of app/dashboard/messenger/page.tsx's data assembly —
   same shape, resolved by verified shop domain instead of Clerk session +
   ?site=. Every panel is independently optional so one slow or broken read
   never takes the whole embedded tab down, matching the dashboard page's
   Promise.allSettled behavior. */

export async function GET(request: NextRequest) {
  const session = authenticateShopifyRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let site;
  try {
    site = await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[store-chat state] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const { config, hasDraft } = mergeDraftOverPublished(site.settings_json, site.settings_draft);
  const payload = toPublicPayload(
    { name: site.name, embed_key: site.embed_key, status: site.status, settings_version: site.settings_version, config },
    new Date(),
  );

  const [statsRes, conversationsRes, knowledgeRes, shopsRes] = await Promise.allSettled([
    getOverviewStats(site.id),
    listConversationsForSite(site.id),
    listKnowledge(site.id),
    listManagedTryOnShops(),
  ]);

  const stats = statsRes.status === 'fulfilled' ? statsRes.value : null;
  const conversations = conversationsRes.status === 'fulfilled' ? conversationsRes.value : [];
  const knowledge = knowledgeRes.status === 'fulfilled' ? knowledgeRes.value : [];
  let detectedAt: string | null = null;
  if (shopsRes.status === 'fulfilled' && site.domain) {
    const match = shopsRes.value.find((shop) => shop.domain === site.domain);
    detectedAt = match && match.status === 'installed' && match.lastSeenAt ? match.lastSeenAt : null;
  }
  for (const failed of [statsRes, conversationsRes, knowledgeRes, shopsRes]) {
    if (failed.status === 'rejected') {
      console.error('[store-chat state] a panel failed:', failed.reason);
    }
  }

  return NextResponse.json({
    site: {
      id: site.id,
      name: site.name,
      domain: site.domain,
      embedKey: site.embed_key,
      active: site.status === 'active',
      version: site.settings_version,
      hasDraft,
      detectedAt,
    },
    config,
    payload,
    stats,
    conversations: conversations.map((c) => ({
      id: c.id,
      status: c.status,
      startedAt: c.started_at,
      lastMessageAt: c.last_message_at,
      visitorEmail: c.visitor_email,
      visitorName: c.visitor_name,
      handoffReason: c.handoff_reason,
    })),
    knowledge,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/shopify/store-chat/state/route.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add app/api/shopify/store-chat/state
git commit -m "feat(shopify): add embedded Store Chat state route"
```

---

## Task 9: Route `POST /api/shopify/store-chat/knowledge`

**Files:**
- Create: `apps/web-next/app/api/shopify/store-chat/knowledge/route.ts`
- Test: `apps/web-next/app/api/shopify/store-chat/knowledge/route.test.ts`

One route, five operations selected by `op` — mirrors `addKnowledge`/`updateKnowledgeStatus`/`deleteKnowledge`/`syncKnowledge` from `actions.ts`, now calling the Task 3 site-first `knowledge.ts` functions directly (no `requireOwnedSite` available or needed here).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-next/app/api/shopify/store-chat/knowledge/route.test.ts
// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authenticateMock,
  ensureShopOwnedSiteMock,
  addManualKnowledgeMock,
  addUrlKnowledgeMock,
  setKnowledgeStatusMock,
  removeKnowledgeMock,
  reSyncKnowledgeMock,
} = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  ensureShopOwnedSiteMock: vi.fn(),
  addManualKnowledgeMock: vi.fn(),
  addUrlKnowledgeMock: vi.fn(),
  setKnowledgeStatusMock: vi.fn(),
  removeKnowledgeMock: vi.fn(),
  reSyncKnowledgeMock: vi.fn(),
}));

vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: authenticateMock }));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: ensureShopOwnedSiteMock }));
vi.mock('@/lib/messenger/shop-tenancy', () => ({ shopProfileId: (domain: string) => `shop-${domain}` }));
vi.mock('@/lib/messenger/knowledge', () => ({
  addManualKnowledge: addManualKnowledgeMock,
  addUrlKnowledge: addUrlKnowledgeMock,
  setKnowledgeStatus: setKnowledgeStatusMock,
  removeKnowledge: removeKnowledgeMock,
  reSyncKnowledge: reSyncKnowledgeMock,
}));

import { POST } from './route';

function req(body: unknown): NextRequest {
  return new NextRequest(
    new Request('https://grindctrl.cloud/api/shopify/store-chat/knowledge', {
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
});

describe('POST /api/shopify/store-chat/knowledge', () => {
  it('returns 401 without a valid session token', async () => {
    authenticateMock.mockReturnValue(null);
    const res = await POST(req({ op: 'add', title: 'x', content: 'y' }));
    expect(res.status).toBe(401);
  });

  it('op=add calls addManualKnowledge with the resolved site', async () => {
    addManualKnowledgeMock.mockResolvedValue({ id: 'k-1' });
    const res = await POST(req({ op: 'add', title: 'Shipping', content: 'Ships fast' }));
    expect(addManualKnowledgeMock).toHaveBeenCalledWith({
      site: { id: 'site-real' },
      actorClerkUserId: 'shop-demo.myshopify.com',
      title: 'Shipping',
      content: 'Ships fast',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, entry: { id: 'k-1' } });
  });

  it('op=addUrl calls addUrlKnowledge', async () => {
    addUrlKnowledgeMock.mockResolvedValue({ id: 'k-2' });
    await POST(req({ op: 'addUrl', url: 'https://example.com' }));
    expect(addUrlKnowledgeMock).toHaveBeenCalledWith({
      site: { id: 'site-real' },
      actorClerkUserId: 'shop-demo.myshopify.com',
      url: 'https://example.com',
    });
  });

  it('op=status calls setKnowledgeStatus', async () => {
    setKnowledgeStatusMock.mockResolvedValue(undefined);
    const res = await POST(req({ op: 'status', entryId: 'k-1', status: 'disabled' }));
    expect(setKnowledgeStatusMock).toHaveBeenCalledWith({ site: { id: 'site-real' }, entryId: 'k-1', status: 'disabled' });
    expect(await res.json()).toEqual({ ok: true });
  });

  it('op=delete calls removeKnowledge', async () => {
    removeKnowledgeMock.mockResolvedValue(undefined);
    await POST(req({ op: 'delete', entryId: 'k-1' }));
    expect(removeKnowledgeMock).toHaveBeenCalledWith({
      site: { id: 'site-real' },
      actorClerkUserId: 'shop-demo.myshopify.com',
      entryId: 'k-1',
    });
  });

  it('op=sync calls reSyncKnowledge', async () => {
    reSyncKnowledgeMock.mockResolvedValue(undefined);
    await POST(req({ op: 'sync', entryId: 'k-1' }));
    expect(reSyncKnowledgeMock).toHaveBeenCalledWith({ site: { id: 'site-real' }, entryId: 'k-1' });
  });

  it('rejects an unknown op', async () => {
    const res = await POST(req({ op: 'nope' }));
    expect(res.status).toBe(400);
  });

  it('turns a thrown error into a 400 with its message, matching the dashboard action\'s friendly-error behavior', async () => {
    addUrlKnowledgeMock.mockRejectedValue(new Error('Could not reach that page. Check the URL and try again.'));
    const res = await POST(req({ op: 'addUrl', url: 'https://dead.example' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Could not reach that page. Check the URL and try again.' });
  });

  it('genericizes an error that does not match the friendly-message pattern, never leaking raw infra text', async () => {
    addManualKnowledgeMock.mockRejectedValue(
      new Error('knowledge create failed: duplicate key value violates unique constraint "messenger_knowledge_pkey"'),
    );
    const res = await POST(req({ op: 'add', title: 'x', content: 'y' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Action failed. Please try again.' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/shopify/store-chat/knowledge/route.test.ts`
Expected: FAIL — route module does not exist.

- [ ] **Step 3: Write the route**

```ts
// apps/web-next/app/api/shopify/store-chat/knowledge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { shopProfileId } from '@/lib/messenger/shop-tenancy';
import {
  addManualKnowledge,
  addUrlKnowledge,
  removeKnowledge,
  reSyncKnowledge,
  setKnowledgeStatus,
} from '@/lib/messenger/knowledge';

type KnowledgeBody =
  | { op: 'add'; title: string; content: string }
  | { op: 'addUrl'; url: string }
  | { op: 'status'; entryId: string; status: 'active' | 'disabled' }
  | { op: 'delete'; entryId: string }
  | { op: 'sync'; entryId: string };

export async function POST(request: NextRequest) {
  const session = authenticateShopifyRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let site;
  try {
    site = await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[store-chat knowledge] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const actorClerkUserId = shopProfileId(session.shop);
  const body = (await request.json()) as KnowledgeBody;

  try {
    switch (body.op) {
      case 'add': {
        const entry = await addManualKnowledge({ site, actorClerkUserId, title: body.title, content: body.content });
        return NextResponse.json({ ok: true, entry });
      }
      case 'addUrl': {
        const entry = await addUrlKnowledge({ site, actorClerkUserId, url: body.url });
        return NextResponse.json({ ok: true, entry });
      }
      case 'status':
        await setKnowledgeStatus({ site, entryId: body.entryId, status: body.status });
        return NextResponse.json({ ok: true });
      case 'delete':
        await removeKnowledge({ site, actorClerkUserId, entryId: body.entryId });
        return NextResponse.json({ ok: true });
      case 'sync':
        await reSyncKnowledge({ site, entryId: body.entryId });
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ ok: false, error: 'Unknown operation.' }, { status: 400 });
    }
  } catch (error) {
    // Same filter actions.ts's addKnowledge/syncKnowledge apply: only the
    // fetch-a-URL failure messages are safe and useful to a merchant.
    // Anything else (a raw Postgres/Supabase error, for instance) must not
    // reach an untrusted client verbatim — genericize it instead.
    const raw = error instanceof Error ? error.message : '';
    const message = /https|URL|page|readable/i.test(raw) ? raw : 'Action failed. Please try again.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/shopify/store-chat/knowledge/route.test.ts`
Expected: PASS, 9/9.

- [ ] **Step 5: Commit**

```bash
git add app/api/shopify/store-chat/knowledge
git commit -m "feat(shopify): add embedded Store Chat knowledge CRUD route"
```

---

## Task 10: `onSave`-style `actions` prop across the five dashboard editors

**Files:**
- Create: `apps/web-next/lib/messenger/dashboard-actions-contract.ts`
- Modify: `apps/web-next/components/dashboard/messenger/appearance-editor.tsx`
- Modify: `apps/web-next/components/dashboard/messenger/behaviour-editor.tsx`
- Modify: `apps/web-next/components/dashboard/messenger/ai-knowledge-editor.tsx`
- Modify: `apps/web-next/components/dashboard/messenger/support-desk-settings.tsx`
- Modify: `apps/web-next/components/dashboard/messenger/install-card.tsx`
- Modify: `apps/web-next/components/dashboard/messenger/messenger-tabs.tsx`
- Modify: `apps/web-next/app/dashboard/messenger/page.tsx`
- Modify: `apps/web-next/components/dashboard/messenger/appearance-editor.test.tsx`

`conversations-panel.tsx` is deliberately **not** in this list — see the Scope note at the top of this plan.

- [ ] **Step 1: Write the contract**

```ts
// apps/web-next/lib/messenger/dashboard-actions-contract.ts
import type { ActionResult } from './actions-core';
import type { MessengerSection } from './config';

/** What the five host-agnostic editors need from whoever renders them. The
 *  dashboard passes the real server actions (app/dashboard/messenger/actions
 *  already matches this shape field-for-field); the embedded Shopify shell
 *  passes a fetch-backed adapter hitting /api/shopify/store-chat/* instead.
 *  Same components either way — this interface is the only seam. */
export interface MessengerHostActions {
  saveDraftSection(siteId: string, section: MessengerSection, payload: object): Promise<ActionResult>;
  setMessengerEnabled(siteId: string, enabled: boolean): Promise<ActionResult>;
  addKnowledge(formData: FormData): Promise<ActionResult>;
  updateKnowledgeStatus(siteId: string, entryId: string, status: 'active' | 'disabled'): Promise<ActionResult>;
  deleteKnowledge(siteId: string, entryId: string): Promise<ActionResult>;
  syncKnowledge(siteId: string, entryId: string): Promise<ActionResult>;
}
```

- [ ] **Step 2: Update the existing component test first (red)**

`appearance-editor.test.tsx` currently mocks the `actions.ts` module import. Once the component takes a prop instead, that mock has nothing to intercept. Replace the mock block and every render call:

Replace:

```ts
const { saveDraftSection } = vi.hoisted(() => ({ saveDraftSection: vi.fn() }));
vi.mock('@/app/dashboard/messenger/actions', () => ({ saveDraftSection }));

import { AppearanceEditor } from './appearance-editor';
```

with:

```ts
const saveDraftSection = vi.fn();

import { AppearanceEditor } from './appearance-editor';
```

Replace the `renderEditor` helper:

```ts
function renderEditor(locale: 'en' | 'ar' = 'en') {
  return render(
    <AppearanceEditor
      locale={locale}
      siteId="site-1"
      initial={APPEARANCE}
      publishedPayload={PAYLOAD}
      actions={{ saveDraftSection }}
    />,
  );
}
```

`beforeEach` already does `vi.clearAllMocks(); saveDraftSection.mockResolvedValue({ ok: true });` — unchanged, still works on the plain `vi.fn()`.

Run: `npx vitest run components/dashboard/messenger/appearance-editor.test.tsx`
Expected: FAIL — `AppearanceEditor` doesn't accept an `actions` prop yet, and its internal call is still to the (now nonexistent) mocked module import.

- [ ] **Step 3: Refactor `appearance-editor.tsx`**

Replace the import:

```ts
import { saveDraftSection } from '@/app/dashboard/messenger/actions';
```

with:

```ts
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
```

Replace the props signature:

```ts
export function AppearanceEditor({
  locale,
  siteId,
  initial,
  publishedPayload,
  actions,
}: {
  locale: MessengerLocale;
  siteId: string;
  initial: MessengerAppearance;
  publishedPayload: PublicMessengerPayload;
  actions: Pick<MessengerHostActions, 'saveDraftSection'>;
}) {
```

Replace the call site inside `save()`:

```ts
      const result = await actions.saveDraftSection(siteId, 'appearance', value);
```

- [ ] **Step 4: Refactor `behaviour-editor.tsx`** (same pattern)

Replace the import `import { saveDraftSection } from '@/app/dashboard/messenger/actions';` with `import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';`.

Add `actions: Pick<MessengerHostActions, 'saveDraftSection'>;` to the props type, and `actions` to the destructure.

Replace the call site: `const result = await actions.saveDraftSection(siteId, 'behaviour', value);`

- [ ] **Step 5: Refactor `ai-knowledge-editor.tsx`**

Replace the import block:

```ts
import {
  addKnowledge,
  deleteKnowledge,
  saveDraftSection,
  syncKnowledge,
  updateKnowledgeStatus,
} from '@/app/dashboard/messenger/actions';
```

with:

```ts
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
```

Add to the props type and destructure:

```ts
export function AiKnowledgeEditor({
  locale,
  siteId,
  ai,
  knowledge,
  publishedPayload,
  actions,
}: {
  locale: MessengerLocale;
  siteId: string;
  ai: MessengerAi;
  knowledge: KnowledgeEntry[];
  publishedPayload: PublicMessengerPayload;
  actions: Pick<
    MessengerHostActions,
    'saveDraftSection' | 'addKnowledge' | 'updateKnowledgeStatus' | 'deleteKnowledge' | 'syncKnowledge'
  >;
}) {
```

Replace the five call sites:
- `const result = await addKnowledge(formData);` → `const result = await actions.addKnowledge(formData);`
- `const result = await saveDraftSection(siteId, 'ai', value);` → `const result = await actions.saveDraftSection(siteId, 'ai', value);`
- `startForm(() => void updateKnowledgeStatus(siteId, entry.id, entry.status === 'active' ? 'disabled' : 'active').then(...))` → `startForm(() => void actions.updateKnowledgeStatus(siteId, entry.id, entry.status === 'active' ? 'disabled' : 'active').then(...))`
- `const r = await syncKnowledge(siteId, entry.id);` → `const r = await actions.syncKnowledge(siteId, entry.id);`
- `startForm(() => void deleteKnowledge(siteId, entry.id))` → `startForm(() => void actions.deleteKnowledge(siteId, entry.id))`

- [ ] **Step 6: Refactor `support-desk-settings.tsx`**

Replace the import `import { saveDraftSection } from '@/app/dashboard/messenger/actions';` with `import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';`.

Add `actions: Pick<MessengerHostActions, 'saveDraftSection'>;` to the props type and `actions` to the destructure (alongside `orderLookup`).

Replace the four calls inside `save()`'s `Promise.all([...])` — prefix each with `actions.`:

```ts
      const results = await Promise.all([
        actions.saveDraftSection(siteId, 'notifications', {
          ...notify,
          recipients: recipientsText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        }),
        actions.saveDraftSection(siteId, 'contactCapture', contact),
        actions.saveDraftSection(siteId, 'attachments', attach),
        actions.saveDraftSection(siteId, 'orderLookup', orders),
      ]);
```

- [ ] **Step 7: Refactor `install-card.tsx`**

Replace the import `import { setMessengerEnabled } from '@/app/dashboard/messenger/actions';` with `import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';`.

Add `actions: Pick<MessengerHostActions, 'setMessengerEnabled'>;` to the props type and `actions` to the destructure.

Replace the call site: `onClick={() => startTransition(() => void actions.setMessengerEnabled(siteId, true))}`

- [ ] **Step 8: Wire `actions` through `messenger-tabs.tsx`, and hide Conversations when asked**

Add to the props type (after `knowledge`):

```ts
  knowledge: KnowledgeEntry[];
  actions: MessengerHostActions;
  /** The embedded Shopify shell doesn't render Conversations yet — see
   *  Phase 2's scope note. Defaults to true so the dashboard is unaffected. */
  showConversationsTab?: boolean;
```

Add the import: `import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';`

Update the destructure and add the derived tab list right after it:

```ts
export function MessengerTabs({
  locale,
  initialTab,
  siteId,
  siteName,
  domain,
  embedKey,
  active,
  version,
  detectedAt,
  config,
  payload,
  stats,
  conversations,
  knowledge,
  actions,
  showConversationsTab = true,
}: {
  ...
}) {
  const visibleTabs = showConversationsTab ? TABS : TABS.filter((id) => id !== 'conversations');
  const [tab, setTab] = useState<MessengerTabId>(
    initialTab === 'conversations' && !showConversationsTab ? 'overview' : initialTab,
  );
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
```

Replace `{TABS.map((id) => (` with `{visibleTabs.map((id) => (` in the nav.

Pass `actions` down to the five refactored children, and guard the Conversations block:

```ts
      {tab === 'appearance' && (
        <AppearanceEditor locale={locale} siteId={siteId} initial={config.appearance} publishedPayload={payload} actions={actions} />
      )}
      {tab === 'behaviour' && (
        <div className="grid min-w-0 gap-6">
          <BehaviourEditor locale={locale} siteId={siteId} initial={config.behaviour} publishedPayload={payload} actions={actions} />
          <SupportDeskSettings
            locale={locale}
            siteId={siteId}
            shopDomain={domain && domain.endsWith('.myshopify.com') ? domain : null}
            notifications={config.notifications}
            contactCapture={config.contactCapture}
            attachments={config.attachments}
            orderLookup={config.orderLookup}
            actions={actions}
          />
        </div>
      )}
      {tab === 'ai' && (
        <AiKnowledgeEditor
          locale={locale}
          siteId={siteId}
          ai={config.ai}
          knowledge={knowledge}
          publishedPayload={payload}
          actions={actions}
        />
      )}
      {showConversationsTab && tab === 'conversations' && (
        <ConversationsPanel locale={locale} siteId={siteId} conversations={conversations} />
      )}
      {tab === 'installation' && (
        <InstallCard
          locale={locale}
          siteId={siteId}
          embedKey={embedKey}
          domain={domain}
          active={active}
          detectedAt={detectedAt}
          version={version}
          actions={actions}
        />
      )}
```

- [ ] **Step 9: Wire the dashboard's own actions into `page.tsx`**

Add the import:

```ts
import * as messengerActions from './actions';
```

Pass `actions={messengerActions}` on the `<MessengerTabs>` element (module namespace objects satisfy a narrower prop type structurally — `actions.ts` exports every method `MessengerHostActions` declares, plus more that are simply ignored).

```tsx
      <MessengerTabs
        locale={locale}
        initialTab={tab}
        siteId={selected.id}
        siteName={selected.name}
        domain={selected.domain}
        embedKey={selected.embed_key}
        active={selected.status === 'active'}
        version={selected.settings_version}
        detectedAt={storeDetectedAt}
        config={config}
        payload={payload}
        stats={stats}
        conversations={conversations.map((c) => ({
          id: c.id,
          status: c.status,
          startedAt: c.started_at,
          lastMessageAt: c.last_message_at,
          visitorEmail: c.visitor_email,
          visitorName: c.visitor_name,
          handoffReason: c.handoff_reason,
        }))}
        knowledge={knowledge}
        actions={messengerActions}
      />
```

- [ ] **Step 10: Run the full component + dashboard test suite and typecheck**

Run: `npx vitest run components/dashboard/messenger app/dashboard/messenger` && `npx tsc --noEmit`
Expected: all pass, including the rewritten `appearance-editor.test.tsx`; no type errors (Pick-typed props are structurally satisfied by both the real `actions.ts` namespace and, later, the Task 11 hook's return value).

- [ ] **Step 11: Manual dashboard smoke check**

Run: `npm run dev` (from `apps/web-next`), open `/dashboard/messenger`, edit a field in Appearance, click "Save draft", confirm "Draft saved" still appears — this refactor must be invisible to the dashboard user.

- [ ] **Step 12: Commit**

```bash
git add lib/messenger/dashboard-actions-contract.ts components/dashboard/messenger/appearance-editor.tsx components/dashboard/messenger/appearance-editor.test.tsx components/dashboard/messenger/behaviour-editor.tsx components/dashboard/messenger/ai-knowledge-editor.tsx components/dashboard/messenger/support-desk-settings.tsx components/dashboard/messenger/install-card.tsx components/dashboard/messenger/messenger-tabs.tsx app/dashboard/messenger/page.tsx
git commit -m "refactor(messenger): five editors take an actions prop instead of importing server actions directly"
```

---

## Task 11: Embedded `useStoreChatActions()` adapter

**Files:**
- Create: `apps/web-next/components/shopify/store-chat-actions.ts`
- Test: `apps/web-next/components/shopify/store-chat-actions.test.ts`

Implements `MessengerHostActions` by fetching the Task 5–9 routes with a fresh App Bridge session token per call. Every method ignores its `siteId` parameter — the route derives the site from the verified token, never from anything the client sends, which is the whole point.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-next/components/shopify/store-chat-actions.test.ts
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getShopifySessionTokenMock } = vi.hoisted(() => ({ getShopifySessionTokenMock: vi.fn() }));
vi.mock('@/lib/shopify/app-bridge-client', () => ({ getShopifySessionToken: getShopifySessionTokenMock }));

import { useStoreChatActions } from './store-chat-actions';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  getShopifySessionTokenMock.mockResolvedValue('tok-abc');
  fetchMock.mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useStoreChatActions', () => {
  it('saveDraftSection posts to the draft route with a Bearer token, ignoring the siteId argument', async () => {
    const { result } = renderHook(() => useStoreChatActions());
    await result.current.saveDraftSection('client-side-site-id', 'appearance', { accentColor: '#fff' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/shopify/store-chat/draft',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-abc' }),
        body: JSON.stringify({ section: 'appearance', payload: { accentColor: '#fff' } }),
      }),
    );
  });

  it('setMessengerEnabled posts to the enable route', async () => {
    const { result } = renderHook(() => useStoreChatActions());
    await result.current.setMessengerEnabled('site-id', true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/shopify/store-chat/enable',
      expect.objectContaining({ body: JSON.stringify({ enabled: true }) }),
    );
  });

  it('addKnowledge sends op=addUrl when the form carries a url, op=add otherwise', async () => {
    const { result } = renderHook(() => useStoreChatActions());

    const withUrl = new FormData();
    withUrl.set('url', 'https://example.com');
    await result.current.addKnowledge(withUrl);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/shopify/store-chat/knowledge',
      expect.objectContaining({ body: JSON.stringify({ op: 'addUrl', url: 'https://example.com' }) }),
    );

    const manual = new FormData();
    manual.set('title', 'Shipping');
    manual.set('content', 'Ships fast');
    await result.current.addKnowledge(manual);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/shopify/store-chat/knowledge',
      expect.objectContaining({ body: JSON.stringify({ op: 'add', title: 'Shipping', content: 'Ships fast' }) }),
    );
  });

  it('returns a friendly failure instead of throwing when fetch itself rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useStoreChatActions());
    await expect(result.current.setMessengerEnabled('site-id', true)).resolves.toEqual({
      ok: false,
      error: 'Action failed. Please try again.',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shopify/store-chat-actions.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the adapter**

```ts
// apps/web-next/components/shopify/store-chat-actions.ts
'use client';

import { useMemo } from 'react';
import { getShopifySessionToken } from '@/lib/shopify/app-bridge-client';
import type { ActionResult } from '@/lib/messenger/actions-core';
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
import type { MessengerSection } from '@/lib/messenger/config';

async function postJson(path: string, body: unknown): Promise<ActionResult> {
  try {
    const token = await getShopifySessionToken();
    const res = await fetch(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ActionResult;
  } catch {
    return { ok: false, error: 'Action failed. Please try again.' };
  }
}

/** Fetch-backed twin of app/dashboard/messenger/actions.ts, scoped by the
 *  embedded app's verified shop session instead of a Clerk cookie. Every
 *  method's `siteId` argument is ignored on purpose: the routes behind
 *  these calls resolve the site from the session token, never from
 *  anything a client sends — see each route's own comment for why. */
export function useStoreChatActions(): MessengerHostActions {
  return useMemo<MessengerHostActions>(
    () => ({
      saveDraftSection: (_siteId, section: MessengerSection, payload: object) =>
        postJson('/api/shopify/store-chat/draft', { section, payload }),
      setMessengerEnabled: (_siteId, enabled: boolean) =>
        postJson('/api/shopify/store-chat/enable', { enabled }),
      addKnowledge: (formData: FormData) => {
        const url = String(formData.get('url') ?? '').trim();
        const body = url
          ? { op: 'addUrl' as const, url }
          : {
              op: 'add' as const,
              title: String(formData.get('title') ?? ''),
              content: String(formData.get('content') ?? ''),
            };
        return postJson('/api/shopify/store-chat/knowledge', body);
      },
      updateKnowledgeStatus: (_siteId, entryId: string, status: 'active' | 'disabled') =>
        postJson('/api/shopify/store-chat/knowledge', { op: 'status', entryId, status }),
      deleteKnowledge: (_siteId, entryId: string) =>
        postJson('/api/shopify/store-chat/knowledge', { op: 'delete', entryId }),
      syncKnowledge: (_siteId, entryId: string) =>
        postJson('/api/shopify/store-chat/knowledge', { op: 'sync', entryId }),
    }),
    [],
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/shopify/store-chat-actions.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add components/shopify/store-chat-actions.ts components/shopify/store-chat-actions.test.ts
git commit -m "feat(shopify): add fetch-backed Store Chat actions adapter for the embedded app"
```

---

## Task 12: Embedded shell — GRINDCTRL header, Try-On | Store Chat tabs, rename

**Files:**
- Create: `apps/web-next/components/shopify/app-shell.tsx`
- Create: `apps/web-next/components/shopify/store-chat-embedded.tsx`
- Create: `apps/web-next/components/shopify/store-chat-embedded.test.tsx`
- Modify: `apps/web-next/components/shopify/admin-settings.tsx`
- Modify: `apps/web-next/app/shopify/app/[[...rest]]/page.tsx`
- Modify: `apps/grindctrl-tryon/shopify.app.toml`

- [ ] **Step 1: Strip the page-level chrome out of `ShopifyAdminSettings`**

`ShopifyAdminSettings` currently owns the whole page: a `min-h-dvh` wrapper, a header with the GRINDCTRL brand mark and a dark-mode toggle, then its settings cards. Once it's one of two tabs under a shared `ShopifyAppShell`, that header would render twice — the brand mark and the theme toggle each need to exist exactly once per page. Move them up; `ShopifyAdminSettings` keeps everything else (state, save flow, cards) unchanged.

In `apps/web-next/components/shopify/admin-settings.tsx`, remove these imports (no longer used in this file): `useTheme` from `'next-themes'`, `Moon, Sun` from `'lucide-react'`, `BrandLogo` from `'@/components/brand-logo'`.

Remove `const { resolvedTheme, setTheme } = useTheme();`.

Replace the `shell` helper and its two call sites. Replace:

```ts
  const shell = (children: React.ReactNode) => (
    <div className="min-h-dvh bg-background text-foreground">{children}</div>
  );

  if (status === 'loading') {
    return shell(<p className="p-6 text-sm text-muted-foreground">Loading settings…</p>);
  }

  if (!s) {
    return shell(
      <p className="p-6 text-sm text-destructive">
        Could not load settings. Open this page from your Shopify admin.
      </p>,
    );
  }
```

with:

```ts
  if (status === 'loading') {
    return <p className="p-6 text-sm text-muted-foreground">Loading settings…</p>;
  }

  if (!s) {
    return (
      <p className="p-6 text-sm text-destructive">
        Could not load settings. Open this page from your Shopify admin.
      </p>
    );
  }
```

Replace the final `return shell(<div className="mx-auto grid w-full max-w-3xl gap-4 p-4 sm:p-6">` … `</div>,)` — remove the `shell(...)` call and the `<header>` block it opens with (the `BrandLogo` + theme-toggle `<Button>`), keeping everything from `{plan && <MerchantPlanCard ...}` onward:

```tsx
  const deepLink = shop
    ? `https://${shop}/admin/themes/current/editor?template=product&addAppBlockId=${APP_CLIENT_ID}/tryon&target=mainSection`
    : '#';
  const catalogLink = shop
    ? `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${APP_CLIENT_ID}/tryon-catalog`
    : '#';

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 sm:p-6">
      {plan && <MerchantPlanCard plan={plan} shop={shop} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* ...unchanged product-pages / catalog-pages cards... */}
      </div>

      <Card>
        {/* ...unchanged Appearance card, including the Save button and status text... */}
      </Card>
    </div>
  );
```

(The two card blocks and the trailing `</Card>`/closing braces are unchanged — only the outer `shell(<div ...>` wrapper and the `<header>...</header>` block above it are removed.)

- [ ] **Step 2: Write the failing test for `StoreChatEmbedded`**

```tsx
// apps/web-next/components/shopify/store-chat-embedded.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/shopify/app-bridge-client', () => ({
  getShopifySessionToken: () => Promise.resolve('tok-abc'),
}));
vi.mock('@/components/shopify/store-chat-actions', () => ({
  useStoreChatActions: () => ({
    saveDraftSection: vi.fn(),
    setMessengerEnabled: vi.fn(),
    addKnowledge: vi.fn(),
    updateKnowledgeStatus: vi.fn(),
    deleteKnowledge: vi.fn(),
    syncKnowledge: vi.fn(),
  }),
}));

import { StoreChatEmbedded } from './store-chat-embedded';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const STATE_RESPONSE = {
  site: {
    id: 'site-1',
    name: 'Demo store',
    domain: 'demo.myshopify.com',
    embedKey: 'gc_demo',
    active: true,
    version: 1,
    hasDraft: false,
    detectedAt: null,
  },
  config: {
    appearance: { accentColor: '#2a2826', launcherIcon: 'chat', launcherCustomIconUrl: null, launcherLabel: { en: 'Support', ar: 'الدعم' }, launcherSizePx: 56, position: 'bottom-right', radiusStyle: 'soft', themeMode: 'auto', assistantAvatarUrl: null },
    behaviour: { welcomeTitle: { en: 'Hi', ar: 'مرحباً' }, welcomeSubtitle: { en: 'Ask us', ar: 'اسألنا' }, inputPlaceholder: { en: 'Ask…', ar: 'اكتب…' }, greetingEnabled: true, greetingDelaySeconds: 6, greeting: null, proactiveEnabled: false, proactiveDelaySeconds: 30, proactiveCapPerVisitor: 1, targetingMode: 'everywhere', excludePatterns: [], availabilityMode: 'always', availabilityTimezone: 'UTC', availabilityHours: [] },
    ai: { enabled: false, tone: 'friendly', instructions: '', languageMode: 'auto', escalationEnabled: true },
    notifications: { emailOnHandoff: true, recipients: [] },
    contactCapture: { enabled: true, askOutsideHours: true },
    attachments: { enabled: false, triageEnabled: true },
    orderLookup: { enabled: false },
  },
  payload: { v: 1, key: 'gc_demo', storeName: 'Demo store', active: true, available: true, aiEnabled: false, attachmentsEnabled: false },
  stats: null,
  conversations: [],
  knowledge: [],
};

describe('StoreChatEmbedded', () => {
  it('fetches /state with a Bearer token and renders the overview once loaded', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(STATE_RESPONSE) });

    render(<StoreChatEmbedded locale="en" />);

    expect(await screen.findByText('Demo store')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/shopify/store-chat/state',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok-abc' }) }),
    );
  });

  it('shows an error state when the state fetch fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({ ok: false, error: 'unavailable' }) });

    render(<StoreChatEmbedded locale="en" />);

    await waitFor(() => expect(screen.getByText(/could not load/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run components/shopify/store-chat-embedded.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 4: Write `StoreChatEmbedded`**

```tsx
// apps/web-next/components/shopify/store-chat-embedded.tsx
'use client';

import { useEffect, useState } from 'react';
import { getShopifySessionToken } from '@/lib/shopify/app-bridge-client';
import { useStoreChatActions } from './store-chat-actions';
import { MessengerTabs, type MessengerTabId } from '@/components/dashboard/messenger/messenger-tabs';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import type { MessengerConfig } from '@/lib/messenger/types';
import type { KnowledgeEntry } from '@/lib/messenger/knowledge';

interface StoreChatState {
  site: {
    id: string;
    name: string;
    domain: string | null;
    embedKey: string;
    active: boolean;
    version: number;
    hasDraft: boolean;
    detectedAt: string | null;
  };
  config: MessengerConfig;
  payload: PublicMessengerPayload;
  stats: unknown;
  conversations: Array<{
    id: string;
    status: string;
    startedAt: string;
    lastMessageAt: string | null;
    visitorEmail: string | null;
    visitorName: string | null;
    handoffReason: string | null;
  }>;
  knowledge: KnowledgeEntry[];
}

const COPY = {
  en: { loading: 'Loading Store Chat…', error: 'Could not load Store Chat. Reopen this app from your Shopify admin.' },
  ar: { loading: 'جارٍ تحميل دردشة المتجر…', error: 'تعذّر تحميل دردشة المتجر. أعد فتح التطبيق من لوحة تحكم شوبيفاي.' },
} as const;

export function StoreChatEmbedded({ locale }: { locale: 'en' | 'ar' }) {
  const [state, setState] = useState<StoreChatState | null>(null);
  const [failed, setFailed] = useState(false);
  const actions = useStoreChatActions();
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getShopifySessionToken();
        const res = await fetch('/api/shopify/store-chat/state', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json()) as StoreChatState & { ok?: boolean };
        if (cancelled) return;
        if (!res.ok || body.ok === false) {
          setFailed(true);
          return;
        }
        setState(body);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <p className="p-6 text-sm text-destructive">{t.error}</p>;
  if (!state) return <p className="p-6 text-sm text-muted-foreground">{t.loading}</p>;

  const initialTab: MessengerTabId = 'overview';

  return (
    <MessengerTabs
      locale={locale}
      initialTab={initialTab}
      siteId={state.site.id}
      siteName={state.site.name}
      domain={state.site.domain}
      embedKey={state.site.embedKey}
      active={state.site.active}
      version={state.site.version}
      detectedAt={state.site.detectedAt}
      config={state.config}
      payload={state.payload}
      stats={state.stats as React.ComponentProps<typeof MessengerTabs>['stats']}
      conversations={state.conversations}
      knowledge={state.knowledge}
      actions={actions}
      showConversationsTab={false}
    />
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/shopify/store-chat-embedded.test.tsx`
Expected: PASS, 2/2.

- [ ] **Step 6: Write `ShopifyAppShell`**

```tsx
// apps/web-next/components/shopify/app-shell.tsx
'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { ShopifyAdminSettings } from '@/components/shopify/admin-settings';
import { StoreChatEmbedded } from '@/components/shopify/store-chat-embedded';
import type { TryOnLocale } from '@/lib/try-on/i18n';

const COPY = {
  en: { tryOn: 'Try-On', storeChat: 'Store Chat', sections: 'GRINDCTRL sections' },
  ar: { tryOn: 'التجربة الافتراضية', storeChat: 'دردشة المتجر', sections: 'أقسام GRINDCTRL' },
} as const;

type ShellTab = 'try-on' | 'store-chat';
const SHELL_TABS: readonly ShellTab[] = ['try-on', 'store-chat'];

export function ShopifyAppShell({ locale }: { locale: TryOnLocale }) {
  const [tab, setTab] = useState<ShellTab>('try-on');
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3 px-1 pt-1">
        <BrandLogo size="sm" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label="Switch between light and dark"
          title="Switch between light and dark"
        >
          <Sun className="hidden size-4 dark:block" />
          <Moon className="size-4 dark:hidden" />
        </Button>
      </header>

      <nav aria-label={t.sections} className="min-w-0">
        <ul className="flex flex-wrap gap-1 border-b border-border pb-px">
          {SHELL_TABS.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={`inline-flex rounded-t-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                  tab === id
                    ? 'border-b-2 border-primary font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {id === 'try-on' ? t.tryOn : t.storeChat}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'try-on' ? <ShopifyAdminSettings locale={locale} /> : <StoreChatEmbedded locale={locale === 'ar' ? 'ar' : 'en'} />}
    </div>
  );
}
```

- [ ] **Step 7: Rewrite the page to mount the shell**

```tsx
// apps/web-next/app/shopify/app/[[...rest]]/page.tsx
import type { Metadata } from 'next';
import { ShopifyAppShell } from '@/components/shopify/app-shell';
import { SHOPIFY_CLIENT_ID } from '@/lib/shopify/session-token';
import { DEFAULT_TRYON_LOCALE, getDir, isTryOnLocale, type TryOnLocale } from '@/lib/try-on/i18n';

export const metadata: Metadata = {
  title: 'GRINDCTRL',
  robots: { index: false },
};

/* Embedded Shopify admin (Next.js): App Bridge script + session-token
   authenticated app shell, with Try-On and Store Chat as separate tabs
   under one GRINDCTRL header. */
export default async function ShopifyAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  /* Shopify appends ?locale=<merchant admin language> when it frames the
     app. This is the merchant's language, not the shopper's: the storefront
     widget resolves the shopper's separately. */
  const params = await searchParams;
  const base = (params.locale ?? '').toLowerCase().split('-')[0];
  const locale: TryOnLocale = isTryOnLocale(base) ? base : DEFAULT_TRYON_LOCALE;

  return (
    <>
      <meta name="shopify-api-key" content={SHOPIFY_CLIENT_ID} />
      {/* Plain sync script: executes during HTML parse, before hydration.
          next/script beforeInteractive only works in the root layout. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      <main dir={getDir(locale)} lang={locale} className="min-h-dvh bg-background text-foreground">
        <ShopifyAppShell locale={locale} />
      </main>
    </>
  );
}
```

- [ ] **Step 8: Rename in `shopify.app.toml`**

In `apps/grindctrl-tryon/shopify.app.toml`, change:

```toml
name = "GrindCTRL Try-On"
```

to:

```toml
name = "GRINDCTRL"
```

Leave every other field — `client_id`, `application_url`, `access_scopes`, `app_proxy`, `webhooks`, `auth.redirect_urls` — untouched. Per the approved design (section 8), the theme extension keeps its existing handle and block names; nothing in this step touches `apps/grindctrl-tryon/extensions/`.

- [ ] **Step 9: Run the full suite, typecheck, and build**

Run: `npx vitest run` && `npx tsc --noEmit` && `npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 10: Manual embedded smoke check**

Run: `npm run dev` (from `apps/web-next`), open `/shopify/app?locale=en` directly in a browser (App Bridge's `idToken()` will not resolve outside a real Shopify iframe, so both tabs will show their "could not load" / "App Bridge not ready" states — confirm the GRINDCTRL header renders, both tab buttons switch the active tab, and dark-mode toggle still works). Full end-to-end verification (a live session token) requires opening the app from an actual Shopify dev store admin, which is out of scope for this local check — flag that as the remaining manual verification step before merge.

- [ ] **Step 11: Commit**

```bash
git add components/shopify/app-shell.tsx components/shopify/store-chat-embedded.tsx components/shopify/store-chat-embedded.test.tsx components/shopify/admin-settings.tsx "app/shopify/app/[[...rest]]/page.tsx" ../grindctrl-tryon/shopify.app.toml
git commit -m "feat(shopify): embedded GRINDCTRL shell with Try-On and Store Chat tabs, app rename"
```

---

## Final integration check

After Task 12, before handing off to review:

- [ ] `npx vitest run --silent` — full suite green, note the new total test count.
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npx next lint` — no new errors beyond the four pre-existing `components/assistant/*` ones already known from Phase 1.
- [ ] `npm run build` — succeeds.
- [ ] Confirm `conversations-panel.tsx` has zero diff against `main` (`git diff main -- components/dashboard/messenger/conversations-panel.tsx` is empty) — the Scope note's boundary held.
- [ ] Confirm no route under `app/api/shopify/store-chat/*` imports `requireOwnedSite` or anything from `@clerk/nextjs/server` — every one of these routes must be reachable with a Shopify session token alone, never a Clerk cookie.
- [ ] Re-read `docs/superpowers/specs/2026-08-30-shopify-unified-app-design.md` section 6/7/10 side by side with what actually shipped, and append a "What execution changed" section to this plan file (same convention as the Phase 1 plan) recording the six-vs-five-editors and four-vs-five-routes scope decision, so a future Phase 3 implementer sees why `/thread` and `conversations-panel.tsx` weren't touched here.
