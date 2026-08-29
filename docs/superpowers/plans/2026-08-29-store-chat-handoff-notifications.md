# Store Chat — Handoff Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Store Chat hands a conversation to a human, the merchant finds out — by throttled email and a dashboard badge — instead of the conversation sitting unseen.

**Architecture:** `requestHandoff()` stays a pure data function; a new `escalateAndNotify()` wrapper calls it and, only when it wins the status transition, triggers `notifyHandoff()`. Notification claims the right to send with a guarded `handoff_notified_at` update, so concurrent transitions cannot double-send. Recipients come from workspace members with a real email address. The badge is a single indexed count resolved in the dashboard layout.

**Tech Stack:** Next.js 15 App Router (server components + route handlers), Clerk, Supabase via service-role client, nodemailer over the existing Gmail SMTP account, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-store-chat-support-desk-design.md` §4. This plan is rollout step 1 of 4.

**Deviation from spec §8:** the spec described one migration for all four features. This plan ships its own migration file, because appending DDL to an already-applied file is not safe. Steps 2–4 get their own files the same way.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/messenger_handoff_notifications.sql` | NEW — `handoff_notified_at` column, audit action values |
| `lib/messenger/types.ts` | MODIFY — `notifications` config, `handoff_notified_at` on `ConversationRecord` |
| `lib/messenger/config.ts` | MODIFY — resolve/sanitise notification settings |
| `lib/messenger/provisioning.ts` | MODIFY — store a real merchant email, never downgrade one |
| `lib/email/transport.ts` | NEW — the app's single SMTP transport |
| `lib/email/handoff-notification.ts` | NEW — subject/html/text for the alert (pure, no I/O) |
| `lib/email/handoff-notification-sender.ts` | NEW — sends it |
| `lib/messenger/notify.ts` | NEW — recipients, throttle, claim, send, event |
| `lib/messenger/escalate.ts` | NEW — `escalateAndNotify()` wrapper |
| `lib/messenger/conversations.ts` | MODIFY — `markHandoffNotified()`, `countAwaitingHandoff()` |
| `lib/dashboard/nav-config.ts` | MODIFY — optional `badgeCount` on nav items |
| `components/dashboard/nav-link.tsx` | MODIFY — render the badge |
| `app/dashboard/layout.tsx` | MODIFY — resolve the count |
| `app/api/messenger/send/route.ts` | MODIFY — call `escalateAndNotify` |
| `app/dashboard/messenger/page.tsx` | MODIFY — pass the Clerk email into provisioning |

---

### Task 1: Migration — notification bookkeeping

**Files:**
- Create: `supabase/messenger_handoff_notifications.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Migration: messenger_handoff_notifications
-- Date: 2026-08-29
-- Purpose: Rollout step 1 of the support-desk spec — bookkeeping so a
--   handoff notification is sent exactly once per conversation even when
--   two requests transition it concurrently.
-- ============================================================

begin;

alter table public.widget_conversations
  add column if not exists handoff_notified_at timestamptz;

-- Partial index: the notifier only ever asks for un-notified conversations.
create index if not exists idx_widget_conversations_awaiting_notify
  on public.widget_conversations(widget_site_id)
  where status = 'handoff_requested' and handoff_notified_at is null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'messenger_audit_action_check'
      and conrelid = 'public.messenger_audit'::regclass
  ) then
    alter table public.messenger_audit drop constraint messenger_audit_action_check;
  end if;

  alter table public.messenger_audit
    add constraint messenger_audit_action_check check (
      action in (
        'messenger_enabled', 'messenger_disabled',
        'config_published', 'draft_discarded',
        'ai_capability_changed',
        'knowledge_added', 'knowledge_updated', 'knowledge_removed',
        'conversation_taken_over', 'conversation_returned_to_ai',
        'conversation_closed',
        'handoff_notified', 'handoff_notify_failed'
      )
    );
end $$;

commit;

-- Rollback:
-- begin;
-- drop index if exists public.idx_widget_conversations_awaiting_notify;
-- alter table public.widget_conversations drop column if exists handoff_notified_at;
-- commit;
```

- [ ] **Step 2: Apply it to the project**

Apply with the `supabase-grindctrl2` MCP server (`apply_migration`, name `messenger_handoff_notifications`), pasting the SQL body **without** the `begin;`/`commit;` lines — the tool wraps it in its own transaction.

- [ ] **Step 3: Verify the column and index exist**

Run this via `execute_sql`:

```sql
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='widget_conversations'
      and column_name='handoff_notified_at') as col,
  (select count(*) from pg_indexes
    where schemaname='public' and indexname='idx_widget_conversations_awaiting_notify') as idx;
```

Expected: `col = 1`, `idx = 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/messenger_handoff_notifications.sql
git commit -m "feat(messenger): migration for handoff notification bookkeeping"
```

---

### Task 2: Notification settings in the config resolver

**Files:**
- Modify: `lib/messenger/types.ts`
- Modify: `lib/messenger/config.ts`
- Test: `lib/messenger/config.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/messenger/config.test.ts`:

```ts
describe('notification settings', () => {
  it('defaults to emailing on handoff with no explicit recipients', () => {
    const config = resolveMessengerConfig({});
    expect(config.notifications.emailOnHandoff).toBe(true);
    expect(config.notifications.recipients).toEqual([]);
  });

  it('keeps only well-formed recipient addresses, capped at five', () => {
    const config = resolveMessengerConfig({
      messenger_notifications: {
        emailOnHandoff: false,
        recipients: [
          '  Owner@Example.com ',
          'not-an-email',
          '',
          'a@b.co',
          'c@d.co',
          'e@f.co',
          'g@h.co',
          'i@j.co',
        ],
      },
    });
    expect(config.notifications.emailOnHandoff).toBe(false);
    // Trimmed, lowercased, junk dropped, capped.
    expect(config.notifications.recipients).toEqual([
      'owner@example.com',
      'a@b.co',
      'c@d.co',
      'e@f.co',
      'g@h.co',
    ]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/messenger/config.test.ts`
Expected: FAIL — `config.notifications` is undefined.

- [ ] **Step 3: Add the type**

In `lib/messenger/types.ts`, add the interface and reference it from `MessengerConfig`:

```ts
export interface MessengerNotifications {
  emailOnHandoff: boolean;
  /** Overrides the workspace-member recipients when non-empty. */
  recipients: string[];
}
```

Add `notifications: MessengerNotifications;` to the `MessengerConfig` interface, and add `handoff_notified_at: string | null;` to `ConversationRecord`.

- [ ] **Step 4: Resolve it**

In `lib/messenger/config.ts`, add above `resolveMessengerConfig`:

```ts
const RECIPIENT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_RECIPIENTS = 5;

function resolveNotifications(raw: unknown): MessengerNotifications {
  const source = (raw ?? {}) as Record<string, unknown>;
  const recipients = Array.isArray(source.recipients) ? source.recipients : [];
  return {
    emailOnHandoff: source.emailOnHandoff !== false,
    recipients: recipients
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length <= 200 && RECIPIENT_RE.test(entry))
      .slice(0, MAX_RECIPIENTS),
  };
}
```

Inside `resolveMessengerConfig`, add to the returned object:

```ts
    notifications: resolveNotifications((settings as Record<string, unknown>).messenger_notifications),
```

Import `MessengerNotifications` from `./types`.

- [ ] **Step 5: Add `handoff_notified_at` to the row mapper**

In `lib/messenger/conversations.ts`, inside `mapConversation`, after the `handoff_summary` line:

```ts
    handoff_notified_at: isoOrNull(row.handoff_notified_at),
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run lib/messenger && npx tsc --noEmit`
Expected: all pass, `tsc` exit 0.

- [ ] **Step 7: Commit**

```bash
git add lib/messenger/types.ts lib/messenger/config.ts lib/messenger/config.test.ts lib/messenger/conversations.ts
git commit -m "feat(messenger): notification settings in the config resolver"
```

---

### Task 3: Store a real merchant email

Provisioning currently writes `user_xxx@users.noreply.clerk.dev` for everyone, so there is nowhere to send. Fix the store, then feed it a real address.

**Files:**
- Modify: `lib/messenger/provisioning.ts`
- Modify: `app/dashboard/messenger/page.tsx`
- Test: `lib/messenger/provisioning.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('provisioning', …)` in `lib/messenger/provisioning.test.ts`:

```ts
  it('upgrades a placeholder email once a real one is known', async () => {
    const { client, tables } = stubClient({
      profiles: {
        rows: [
          { id: 'p-1', clerk_user_id: 'user_1', email: 'user_1@users.noreply.clerk.dev' },
        ],
      },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    await listMessengerSites('user_1', 'owner@store.com');

    expect(tables.profiles.rows[0].email).toBe('owner@store.com');
  });

  it('never downgrades a real email back to the placeholder', async () => {
    const { client, tables } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'owner@store.com' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    await listMessengerSites('user_1', null);

    expect(tables.profiles.rows[0].email).toBe('owner@store.com');
  });
```

The stub's builder needs an `update` verb. Add to the `api` object in `stubClient`, next to `insert`:

```ts
      update: (patch: Row) => {
        calls.push(`${table}.update`);
        for (const row of state.rows) {
          if (filters.every(([c, v]) => row[c] === v)) Object.assign(row, patch);
        }
        filters = [];
        return Promise.resolve({ data: null, error: null });
      },
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/messenger/provisioning.test.ts`
Expected: FAIL — first test shows the placeholder unchanged.

- [ ] **Step 3: Implement the upgrade**

In `lib/messenger/provisioning.ts`, replace the early return inside `ensureProfile`:

```ts
  if (existing.error) throw new Error(`profile lookup failed: ${existing.error.message}`);
  if (existing.data) {
    const row = existing.data as ProfileRow;
    /* Provisioning ran before any real address was available, so the row
       holds a placeholder nobody can receive mail at. Upgrade it the first
       time a real one arrives — and never the other way round, or a later
       visit would wipe a working address. */
    if (email && isPlaceholderEmail(row.email) && email !== row.email) {
      await supabase.from('profiles').update({ email }).eq('id', row.id);
      return { ...row, email };
    }
    return row;
  }
```

Add above `ensureProfile`:

```ts
const PLACEHOLDER_EMAIL_SUFFIX = '@users.noreply.clerk.dev';

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !email || email.endsWith(PLACEHOLDER_EMAIL_SUFFIX);
}
```

Change the placeholder literal in the insert to use the same suffix constant:

```ts
      { clerk_user_id: clerkUserId, email: email ?? `${clerkUserId}${PLACEHOLDER_EMAIL_SUFFIX}` },
```

- [ ] **Step 4: Feed it the real address**

In `app/dashboard/messenger/page.tsx`, add the import:

```ts
import { currentUser } from '@clerk/nextjs/server';
```

Replace the `listMessengerSites(userId)` call:

```ts
  /* Clerk holds the address the merchant actually reads; the profiles row
     is only a mirror. Notifications are unsendable without this. */
  const clerkUser = await currentUser();
  const merchantEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? null;

  let sites = await listMessengerSites(userId, merchantEmail);
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run lib/messenger/provisioning.test.ts && npx tsc --noEmit`
Expected: PASS, `tsc` exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/messenger/provisioning.ts lib/messenger/provisioning.test.ts app/dashboard/messenger/page.tsx
git commit -m "fix(messenger): store the merchant's real email, not the Clerk placeholder"
```

---

### Task 4: The notification email content

Pure function, no I/O — so the wording is testable without SMTP.

**Files:**
- Create: `lib/email/handoff-notification.ts`
- Test: `lib/email/handoff-notification.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildHandoffNotification } from './handoff-notification';

const INPUT = {
  storeName: 'Sara’s Store',
  siteId: 'site-1',
  locale: 'en' as const,
  shopperLabel: 'sara@example.com',
  reason: 'shopper_requested_human',
  summary: 'Shopper asked for a person. Last message: "is my parcel lost?"',
  recentMessages: [
    { role: 'user' as const, content: 'hello?' },
    { role: 'assistant' as const, content: 'Hi! How can I help?' },
    { role: 'user' as const, content: 'is my parcel lost?' },
  ],
};

describe('buildHandoffNotification', () => {
  it('names the store in the subject so a multi-store owner can triage', () => {
    expect(buildHandoffNotification(INPUT).subject).toBe('A shopper needs you — Sara’s Store');
  });

  it('includes the summary, the recent messages and a deep link', () => {
    const { html, text } = buildHandoffNotification(INPUT);
    for (const body of [html, text]) {
      expect(body).toContain('is my parcel lost?');
      expect(body).toContain('sara@example.com');
      expect(body).toContain('https://grindctrl.cloud/dashboard/messenger?site=site-1&tab=conversations');
    }
  });

  it('escapes shopper content so a message cannot inject markup', () => {
    const { html } = buildHandoffNotification({
      ...INPUT,
      recentMessages: [{ role: 'user', content: '<img src=x onerror=alert(1)>' }],
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('writes Arabic when the site locale is ar', () => {
    const { subject } = buildHandoffNotification({ ...INPUT, locale: 'ar' });
    expect(subject).toContain('عميل ينتظر');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/email/handoff-notification.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

```ts
import type { MessengerLocale } from '@/lib/messenger/types';

/* Plain-string template rather than the react-email path used by the
   Try-On campaign: this is a short internal alert, not a designed campaign,
   and a pure function keeps the wording under test without a renderer. */

export interface HandoffNotificationInput {
  storeName: string;
  siteId: string;
  locale: MessengerLocale;
  /** Email, name, or a generic "anonymous shopper" label. */
  shopperLabel: string;
  reason: string;
  summary: string;
  recentMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

const COPY = {
  en: {
    subject: (store: string) => `A shopper needs you — ${store}`,
    heading: 'A shopper is waiting for a human',
    shopper: 'Shopper',
    why: 'Why it escalated',
    recent: 'Last few messages',
    cta: 'Open the conversation',
    footer: 'You are receiving this because Store Chat handed a conversation to your team.',
  },
  ar: {
    subject: (store: string) => `عميل ينتظر ردك — ${store}`,
    heading: 'عميل ينتظر التحدث مع شخص من فريقك',
    shopper: 'العميل',
    why: 'سبب التحويل',
    recent: 'آخر الرسائل',
    cta: 'افتح المحادثة',
    footer: 'تصلك هذه الرسالة لأن دردشة المتجر حوّلت محادثة إلى فريقك.',
  },
} as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function speaker(role: 'user' | 'assistant' | 'system', locale: MessengerLocale): string {
  if (role === 'user') return locale === 'ar' ? 'العميل' : 'Shopper';
  if (role === 'assistant') return locale === 'ar' ? 'المساعد' : 'Assistant';
  return locale === 'ar' ? 'النظام' : 'System';
}

export function buildHandoffNotification(input: HandoffNotificationInput): {
  subject: string;
  html: string;
  text: string;
} {
  const t = COPY[input.locale === 'ar' ? 'ar' : 'en'];
  const dir = input.locale === 'ar' ? 'rtl' : 'ltr';
  const link = `https://grindctrl.cloud/dashboard/messenger?site=${encodeURIComponent(input.siteId)}&tab=conversations`;
  const messages = input.recentMessages.slice(-3);

  const text = [
    t.heading,
    '',
    `${t.shopper}: ${input.shopperLabel}`,
    `${t.why}: ${input.summary || input.reason}`,
    '',
    t.recent,
    ...messages.map((m) => `- ${speaker(m.role, input.locale)}: ${m.content}`),
    '',
    `${t.cta}: ${link}`,
    '',
    t.footer,
  ].join('\n');

  const html = `<!doctype html><html dir="${dir}"><body style="font-family:-apple-system,Segoe UI,sans-serif;color:#1c1917;line-height:1.5">
<h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(t.heading)}</h2>
<p style="margin:0 0 4px"><strong>${escapeHtml(t.shopper)}:</strong> ${escapeHtml(input.shopperLabel)}</p>
<p style="margin:0 0 16px"><strong>${escapeHtml(t.why)}:</strong> ${escapeHtml(input.summary || input.reason)}</p>
<p style="margin:0 0 6px;font-weight:600">${escapeHtml(t.recent)}</p>
<ul style="margin:0 0 20px;padding-inline-start:18px">
${messages.map((m) => `<li><strong>${escapeHtml(speaker(m.role, input.locale))}:</strong> ${escapeHtml(m.content)}</li>`).join('\n')}
</ul>
<p style="margin:0 0 20px"><a href="${link}" style="background:#2a2826;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">${escapeHtml(t.cta)}</a></p>
<p style="margin:0;font-size:12px;color:#78716c">${escapeHtml(t.footer)}</p>
</body></html>`;

  return { subject: t.subject(input.storeName), html, text };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/email/handoff-notification.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/email/handoff-notification.ts lib/email/handoff-notification.test.ts
git commit -m "feat(email): handoff notification template"
```

---

### Task 5: SMTP transport and sender

**Files:**
- Create: `lib/email/transport.ts`
- Create: `lib/email/handoff-notification-sender.ts`
- Test: `lib/email/handoff-notification-sender.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMail = vi.hoisted(() => vi.fn(async () => ({ messageId: 'mid-1' })));
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}));

import { sendHandoffNotification } from './handoff-notification-sender';

const INPUT = {
  to: ['owner@store.com'],
  storeName: 'Sara’s Store',
  siteId: 'site-1',
  locale: 'en' as const,
  shopperLabel: 'anonymous shopper',
  reason: 'assistant_escalated',
  summary: 'AI could not answer a returns question',
  recentMessages: [{ role: 'user' as const, content: 'can I return this?' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TRYON_EMAIL_SMTP_USER = 'bot@grindctrl.cloud';
  process.env.TRYON_EMAIL_SMTP_APP_PASSWORD = 'app-password';
});
afterEach(() => {
  delete process.env.TRYON_EMAIL_SMTP_USER;
  delete process.env.TRYON_EMAIL_SMTP_APP_PASSWORD;
});

describe('sendHandoffNotification', () => {
  it('sends one message addressed to every recipient', async () => {
    await sendHandoffNotification(INPUT);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const message = sendMail.mock.calls[0][0];
    expect(message.to).toEqual(['owner@store.com']);
    expect(message.subject).toContain('Sara’s Store');
    expect(message.html).toContain('can I return this?');
  });

  it('reports failure instead of throwing, so a send never breaks a handoff', async () => {
    sendMail.mockRejectedValueOnce(new Error('smtp down'));
    await expect(sendHandoffNotification(INPUT)).resolves.toEqual({ sent: false });
  });

  it('does nothing when the SMTP account is not configured', async () => {
    delete process.env.TRYON_EMAIL_SMTP_USER;
    await expect(sendHandoffNotification(INPUT)).resolves.toEqual({ sent: false });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/email/handoff-notification-sender.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the transport**

`lib/email/transport.ts`:

```ts
import 'server-only';
import nodemailer from 'nodemailer';

/* One sending account for the whole app. The env vars carry the TRYON_
   prefix for historical reasons — the Try-On campaign was the first thing
   to send mail — but this is the app's mailbox, not that feature's. */
export function getSmtpTransport(): nodemailer.Transporter | null {
  const user = process.env.TRYON_EMAIL_SMTP_USER?.trim();
  const pass = process.env.TRYON_EMAIL_SMTP_APP_PASSWORD?.trim();
  if (!user || !pass) return null;

  const port = Number(process.env.TRYON_EMAIL_SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.TRYON_EMAIL_SMTP_HOST?.trim() || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function getSmtpFrom(): { name: string; address: string } | null {
  const address = process.env.TRYON_EMAIL_SMTP_USER?.trim();
  if (!address) return null;
  return { name: process.env.STORE_CHAT_EMAIL_FROM_NAME?.trim() || 'GRINDCTRL Store Chat', address };
}
```

- [ ] **Step 4: Write the sender**

`lib/email/handoff-notification-sender.ts`:

```ts
import 'server-only';
import { buildHandoffNotification, type HandoffNotificationInput } from './handoff-notification';
import { getSmtpFrom, getSmtpTransport } from './transport';

/* Never throws. A notification is a courtesy on top of a conversation that
   has already been escalated — losing the email must not lose the handoff. */
export async function sendHandoffNotification(
  input: HandoffNotificationInput & { to: string[] },
): Promise<{ sent: boolean }> {
  if (input.to.length === 0) return { sent: false };
  const transport = getSmtpTransport();
  const from = getSmtpFrom();
  if (!transport || !from) return { sent: false };

  const { subject, html, text } = buildHandoffNotification(input);
  try {
    await transport.sendMail({
      from,
      to: input.to,
      subject,
      html,
      text,
      textEncoding: 'base64',
      headers: { 'X-GrindCTRL-Notification': 'store-chat-handoff' },
    });
    return { sent: true };
  } catch (error) {
    console.error('[messenger] handoff email failed:', error instanceof Error ? error.message : error);
    return { sent: false };
  }
}
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run lib/email/handoff-notification-sender.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/email/transport.ts lib/email/handoff-notification-sender.ts lib/email/handoff-notification-sender.test.ts
git commit -m "feat(email): shared SMTP transport and handoff notification sender"
```

---

### Task 6: The notifier — recipients, claim, throttle

**Files:**
- Modify: `lib/messenger/conversations.ts`
- Create: `lib/messenger/notify.ts`
- Test: `lib/messenger/notify.test.ts`

- [ ] **Step 1: Add the atomic claim to `conversations.ts`**

Add after `requestHandoff`:

```ts
/** Claims the right to notify about this handoff. Returns false if someone
 *  already claimed it — the guard is the WHERE clause, so two concurrent
 *  transitions cannot both send an email. */
export async function claimHandoffNotification(conversationId: string): Promise<boolean> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('widget_conversations')
    .update({ handoff_notified_at: new Date().toISOString() })
    .eq('id', conversationId)
    .is('handoff_notified_at', null)
    .select('id');
  if (res.error) throw new Error(`notification claim failed: ${res.error.message}`);
  return (res.data ?? []).length > 0;
}

/** Conversations waiting on a human, for the sidebar badge. */
export async function countAwaitingHandoff(siteIds: string[]): Promise<number> {
  if (siteIds.length === 0) return 0;
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('widget_conversations')
    .select('id', { count: 'exact', head: true })
    .in('widget_site_id', siteIds)
    .eq('status', 'handoff_requested');
  if (res.error) return 0; // A badge must never take the dashboard down.
  return res.count ?? 0;
}
```

- [ ] **Step 2: Write the failing test for the notifier**

`lib/messenger/notify.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  claimHandoffNotification: vi.fn(async () => true),
  recordEvent: vi.fn(async () => {}),
  listMessages: vi.fn(async () => [] as Array<Record<string, unknown>>),
  sendHandoffNotification: vi.fn(async () => ({ sent: true })),
  result: { current: { data: [] as unknown[], error: null as unknown } },
}));

vi.mock('@/lib/messenger/conversations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/messenger/conversations')>();
  return {
    ...actual,
    claimHandoffNotification: mocks.claimHandoffNotification,
    recordEvent: mocks.recordEvent,
    listMessages: mocks.listMessages,
  };
});
vi.mock('@/lib/email/handoff-notification-sender', () => ({
  sendHandoffNotification: mocks.sendHandoffNotification,
}));
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        gte: () => builder,
        limit: () => builder,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(mocks.result.current).then(resolve),
      };
      return builder;
    },
  }),
}));

import { notifyHandoff } from './notify';

const SITE = {
  id: 'site-1',
  name: 'Sara’s Store',
  workspace_id: 'ws-1',
  locale: 'en' as const,
  notifications: { emailOnHandoff: true, recipients: [] as string[] },
};

const CONVERSATION = {
  id: 'conv-1',
  handoff_reason: 'shopper_requested_human',
  handoff_summary: 'Shopper asked for a person.',
  metadata: {} as Record<string, unknown>,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claimHandoffNotification.mockResolvedValue(true);
  mocks.sendHandoffNotification.mockResolvedValue({ sent: true });
  mocks.listMessages.mockResolvedValue([]);
  mocks.result.current = { data: [], error: null };
});

describe('notifyHandoff', () => {
  it('does nothing when the merchant turned handoff email off', async () => {
    await notifyHandoff({
      site: { ...SITE, notifications: { emailOnHandoff: false, recipients: [] } },
      conversation: CONVERSATION,
    });
    expect(mocks.claimHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.sendHandoffNotification).not.toHaveBeenCalled();
  });

  it('sends to the configured recipients when the claim succeeds', async () => {
    await notifyHandoff({
      site: { ...SITE, notifications: { emailOnHandoff: true, recipients: ['owner@store.com'] } },
      conversation: CONVERSATION,
    });
    expect(mocks.sendHandoffNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendHandoffNotification.mock.calls[0][0].to).toEqual(['owner@store.com']);
    expect(mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'handoff_notified' }),
    );
  });

  it('sends nothing when another request already claimed the notification', async () => {
    mocks.claimHandoffNotification.mockResolvedValue(false);
    await notifyHandoff({
      site: { ...SITE, notifications: { emailOnHandoff: true, recipients: ['owner@store.com'] } },
      conversation: CONVERSATION,
    });
    expect(mocks.sendHandoffNotification).not.toHaveBeenCalled();
  });

  it('skips the send when the site is over its hourly cap', async () => {
    // 10 prior handoff_notified events in the window.
    mocks.result.current = { data: new Array(10).fill({ id: 'e' }), error: null };
    await notifyHandoff({
      site: { ...SITE, notifications: { emailOnHandoff: true, recipients: ['owner@store.com'] } },
      conversation: CONVERSATION,
    });
    expect(mocks.sendHandoffNotification).not.toHaveBeenCalled();
    expect(mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'handoff_notify_throttled' }),
    );
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run lib/messenger/notify.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the notifier**

`lib/messenger/notify.ts`:

```ts
import 'server-only';

import { getMessengerServiceClient } from './db';
import { claimHandoffNotification, listMessages, recordEvent } from './conversations';
import { sendHandoffNotification } from '@/lib/email/handoff-notification-sender';
import { isPlaceholderEmail } from './provisioning';
import type { MessengerLocale, MessengerNotifications } from './types';

const HOURLY_SITE_CAP = 10;

export interface NotifyHandoffInput {
  site: {
    id: string;
    name: string;
    workspace_id: string;
    locale: MessengerLocale;
    notifications: MessengerNotifications;
  };
  conversation: {
    id: string;
    handoff_reason: string | null;
    handoff_summary: string | null;
    metadata: Record<string, unknown>;
  };
}

/** Workspace owners and admins whose stored address can actually receive
 *  mail. A placeholder is worse than nothing — it bounces silently. */
async function resolveRecipients(workspaceId: string): Promise<string[]> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('workspace_members')
    .select('role, profiles!inner(email)')
    .eq('workspace_id', workspaceId)
    .in('role', ['owner', 'admin']);
  if (res.error) return [];
  return ((res.data ?? []) as Array<{ profiles?: { email?: string } }>)
    .map((row) => row.profiles?.email ?? '')
    .filter((email) => email && !isPlaceholderEmail(email))
    .slice(0, 5);
}

async function overHourlyCap(siteId: string): Promise<boolean> {
  const supabase = getMessengerServiceClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const res = await supabase
    .from('widget_events')
    .select('id')
    .eq('widget_site_id', siteId)
    .eq('event_name', 'handoff_notified')
    .gte('created_at', since)
    .limit(HOURLY_SITE_CAP + 1);
  if (res.error) return false; // Fail open: better a duplicate than silence.
  return (res.data ?? []).length >= HOURLY_SITE_CAP;
}

/** Fire-and-forget from the caller's point of view: this never throws. */
export async function notifyHandoff(input: NotifyHandoffInput): Promise<void> {
  try {
    const { site, conversation } = input;
    if (!site.notifications.emailOnHandoff) return;

    const recipients = site.notifications.recipients.length
      ? site.notifications.recipients
      : await resolveRecipients(site.workspace_id);
    if (recipients.length === 0) {
      await recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'handoff_notify_skipped',
        payload: { reason: 'no_recipient' },
      });
      return;
    }

    if (await overHourlyCap(site.id)) {
      await recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'handoff_notify_throttled',
        payload: { cap: HOURLY_SITE_CAP },
      });
      return;
    }

    // Claim last, so a throttled or recipient-less run can still notify later.
    if (!(await claimHandoffNotification(conversation.id))) return;

    const identity = conversation.metadata.identity as { email?: string; name?: string } | undefined;
    const shopperLabel =
      identity?.name || identity?.email || (site.locale === 'ar' ? 'عميل زائر' : 'anonymous shopper');

    const recent = (await listMessages(conversation.id, { limit: 6 })).slice(-3).map((message) => ({
      role: message.role as 'user' | 'assistant' | 'system',
      content: message.content.slice(0, 400),
    }));

    const { sent } = await sendHandoffNotification({
      to: recipients,
      storeName: site.name,
      siteId: site.id,
      locale: site.locale,
      shopperLabel,
      reason: conversation.handoff_reason ?? 'escalated',
      summary: conversation.handoff_summary ?? '',
      recentMessages: recent,
    });

    await recordEvent({
      siteId: site.id,
      conversationId: conversation.id,
      eventName: sent ? 'handoff_notified' : 'handoff_notify_failed',
      payload: { recipients: recipients.length },
    });
  } catch (error) {
    console.error('[messenger] notifyHandoff failed:', error instanceof Error ? error.message : error);
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run lib/messenger/notify.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/messenger/notify.ts lib/messenger/notify.test.ts lib/messenger/conversations.ts
git commit -m "feat(messenger): handoff notifier with atomic claim and hourly cap"
```

---

### Task 7: Wire it into escalation

**Files:**
- Create: `lib/messenger/escalate.ts`
- Modify: `app/api/messenger/send/route.ts:143` and `:227`
- Test: `app/api/messenger/send/route.test.ts`

- [ ] **Step 1: Write the wrapper**

`lib/messenger/escalate.ts`:

```ts
import 'server-only';

import { requestHandoff } from './conversations';
import { notifyHandoff, type NotifyHandoffInput } from './notify';
import type { ConversationRecord } from './types';

/* requestHandoff stays a pure data function; the notification hangs off the
   one place that knows the transition was actually won. A null return means
   somebody else already moved the conversation — no transition, no email. */
export async function escalateAndNotify(
  conversation: ConversationRecord,
  reason: string,
  summary: string,
  site: NotifyHandoffInput['site'],
): Promise<ConversationRecord | null> {
  const transitioned = await requestHandoff(conversation.id, reason, summary);
  if (!transitioned) return null;

  void notifyHandoff({
    site,
    conversation: {
      id: transitioned.id,
      handoff_reason: transitioned.handoff_reason,
      handoff_summary: transitioned.handoff_summary,
      metadata: transitioned.metadata as Record<string, unknown>,
    },
  });

  return transitioned;
}
```

- [ ] **Step 2: Add the failing route test**

Append to `app/api/messenger/send/route.test.ts`, and add `escalateAndNotify: vi.fn()` to the hoisted `mocks` object plus a `vi.mock('@/lib/messenger/escalate', () => ({ escalateAndNotify: mocks.escalateAndNotify }))` block:

```ts
  it('escalates through the notifying wrapper, not requestHandoff directly', async () => {
    mocks.detectExplicitHandoffRequest.mockReturnValue(true);
    mocks.escalateAndNotify.mockResolvedValue({ ...CONVERSATION, status: 'handoff_requested' });
    mocks.appendMessage.mockResolvedValue({
      message: { id: 'u5', role: 'user', content: 'get me a human', created_at: new Date().toISOString(), metadata: {} },
      replayed: false,
    });

    const res = await POST(makeRequest({ ...validBody, text: 'get me a human' }));
    const data = await res.json();

    expect(data.status).toBe('handoff_requested');
    expect(mocks.escalateAndNotify).toHaveBeenCalledTimes(1);
    expect(mocks.requestHandoff).not.toHaveBeenCalled();
  });
```

Add to `beforeEach`: `mocks.escalateAndNotify.mockResolvedValue(null);`

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run app/api/messenger/send/route.test.ts -t "notifying wrapper"`
Expected: FAIL — `escalateAndNotify` never called.

- [ ] **Step 4: Swap both call sites**

In `app/api/messenger/send/route.ts`, replace the `requestHandoff` import with `escalateAndNotify` from `@/lib/messenger/escalate`, and build the site argument once after `loadPublicSite`:

```ts
    const notifySite = {
      id: site.id,
      name: site.name,
      workspace_id: (site as unknown as { workspace_id: string }).workspace_id,
      locale: (localeHint ?? 'en') as MessengerLocale,
      notifications: site.config.notifications,
    };
```

Replace the explicit-request call site:

```ts
      const transitioned = site.config.ai.escalationEnabled
        ? await escalateAndNotify(conversation, 'shopper_requested_human', summary, notifySite)
        : null;
```

And the AI-escalation call site:

```ts
      const transitioned = await escalateAndNotify(
        conversation,
        'assistant_escalated',
        `Conversation handed off after shopper message: "${text.slice(0, 160)}"`,
        notifySite,
      );
```

`loadPublicSite` must also return `workspace_id`: add it to the `select` in `lib/messenger/public-api.ts` (`'id, workspace_id, name, embed_key, status, settings_json, settings_version'`) and to the `ResolvedPublicSite` interface and its returned object.

- [ ] **Step 5: Run the route tests**

Run: `npx vitest run app/api/messenger/send`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/messenger/escalate.ts lib/messenger/public-api.ts app/api/messenger/send/route.ts app/api/messenger/send/route.test.ts
git commit -m "feat(messenger): notify the merchant when a conversation escalates"
```

---

### Task 8: The dashboard badge

**Files:**
- Modify: `lib/dashboard/nav-config.ts`
- Modify: `components/dashboard/nav-link.tsx`
- Modify: `app/dashboard/layout.tsx`
- Test: `lib/dashboard/nav-config.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/dashboard/nav-config.test.ts`:

```ts
  it('puts a waiting-conversation count on Store Chat only', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
      badges: { '/dashboard/messenger': 3 },
    });
    const storeChat = items.find((item) => item.href === '/dashboard/messenger');
    expect(storeChat?.badgeCount).toBe(3);
    expect(items.find((item) => item.href === '/dashboard/overview')?.badgeCount).toBeUndefined();
  });

  it('drops a zero badge rather than rendering a 0', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
      badges: { '/dashboard/messenger': 0 },
    });
    expect(items.find((item) => item.href === '/dashboard/messenger')?.badgeCount).toBeUndefined();
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/dashboard/nav-config.test.ts`
Expected: FAIL — `badges` is not a parameter.

- [ ] **Step 3: Implement it**

In `lib/dashboard/nav-config.ts`, extend the resolved type and the resolver:

```ts
export type DashboardResolvedNavItem = DashboardNavItem & {
  isActive: boolean;
  /** Omitted entirely at zero — a "0" badge is noise, not information. */
  badgeCount?: number;
};
```

```ts
export function resolveDashboardNavItems({
  pathname,
  permissions,
  locale = DEFAULT_SITE_LOCALE,
  badges = {},
}: {
  pathname: string;
  permissions: DashboardPermissionSet;
  locale?: SiteLocale;
  badges?: Record<string, number>;
}): DashboardResolvedNavItem[] {
```

and inside the `.map`:

```ts
    badgeCount: badges[item.href] && badges[item.href] > 0 ? badges[item.href] : undefined,
```

- [ ] **Step 4: Render it**

In `components/dashboard/nav-link.tsx`, replace the `<span>{item.label}</span>` line:

```tsx
                  <span>{item.label}</span>
                  {item.badgeCount ? (
                    <span
                      className="ms-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground"
                      aria-label={`${item.badgeCount} waiting`}
                    >
                      {item.badgeCount > 9 ? '9+' : item.badgeCount}
                    </span>
                  ) : null}
```

- [ ] **Step 5: Feed the count in the layout**

In `app/dashboard/layout.tsx`, add imports and resolve the count before `resolveDashboardNavItems`:

```ts
import { countAwaitingHandoff } from '@/lib/messenger/conversations';
import { listMessengerSites } from '@/lib/messenger/provisioning';
```

```ts
  /* Cheap indexed count; a failure must never take the shell down, so both
     calls are wrapped and fall back to no badge. */
  let awaitingHandoff = 0;
  try {
    const sites = await listMessengerSites(clerkUserId);
    awaitingHandoff = await countAwaitingHandoff(sites.map((site) => site.id));
  } catch {
    awaitingHandoff = 0;
  }

  const navItems = resolveDashboardNavItems({
    pathname,
    permissions,
    locale,
    badges: { '/dashboard/messenger': awaitingHandoff },
  });
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run lib/dashboard components/dashboard && npx tsc --noEmit`
Expected: PASS, `tsc` exit 0.

- [ ] **Step 7: Commit**

```bash
git add lib/dashboard/nav-config.ts lib/dashboard/nav-config.test.ts components/dashboard/nav-link.tsx app/dashboard/layout.tsx
git commit -m "feat(dashboard): badge Store Chat with conversations awaiting a human"
```

---

### Task 9: Verify and ship

- [ ] **Step 1: Full local verification**

Run each, all must pass:

```bash
npx tsc --noEmit
npm test
npm run build
```

Expected: `tsc` exit 0; every test file passing; `✓ Compiled successfully`. Lint still reports the 6 pre-existing `components/assistant/*` errors — that is the known baseline, not a regression.

- [ ] **Step 2: Prove the notification end to end against the real database**

With `npm run dev` running, and using the E2E fixture site (`embed_key = gc_e2e_key`):

1. Temporarily set a recipient so nothing depends on profile emails:
   `update public.widget_sites set settings_json = jsonb_set(settings_json, '{messenger_notifications}', '{"emailOnHandoff":true,"recipients":["<your address>"]}') where embed_key = 'gc_e2e_key';`
2. `POST /api/messenger/bootstrap`, then `POST /api/messenger/send` with text `get me a human`.
3. Expect: response `status: "handoff_requested"`, one email received, and
   `select handoff_notified_at from widget_conversations where id = '<id>'` non-null.
4. Send again in the same conversation — expect **no second email**.
5. Reset: `update public.widget_sites set settings_json = settings_json - 'messenger_notifications' where embed_key = 'gc_e2e_key';` and delete the probe conversation/visitor/event rows.

- [ ] **Step 3: Push and watch the deploy**

```bash
gh auth switch --user mhhmod
git push origin main
gh run watch $(gh run list --workflow=deploy-next.yml --limit 1 --json databaseId -q '.[0].databaseId') --exit-status
```

Expected: build, VPS restart, smoke check and monitoring-key assertion all green.

- [ ] **Step 4: Confirm in production**

Sign in, open `/dashboard/messenger`. Expect no badge (no waiting conversations). Check Sentry for new issues in the last hour — expect none.

---

## Self-Review

**Spec coverage (§4):** 4.1 merchant email → Task 3. 4.2 trigger via a wrapper, `conversations.ts` stays pure → Task 7. 4.3 per-conversation claim + hourly cap → Tasks 1, 6. 4.4 owner/admin recipients with override → Task 6. 4.5 content, deep link, Arabic → Task 4. 4.6 badge, zero renders nothing → Task 8. 4.7 settings → Task 2.

**Deliberately deferred to step 2+:** surfacing the notification toggle in the Behaviour tab UI. The setting resolves and is honoured; editing it currently needs a settings write. Called out so it is not mistaken for done.

**Type consistency:** `MessengerNotifications` (Task 2) is the type consumed by `NotifyHandoffInput.site.notifications` (Task 6) and passed as `site.config.notifications` (Task 7). `claimHandoffNotification`/`countAwaitingHandoff` are defined in Task 6 Step 1 and used in Tasks 6 and 8. `isPlaceholderEmail` is exported in Task 3 and imported in Task 6.

**Placeholders:** none. Every code step carries its code; every run step carries its command and expected result.
