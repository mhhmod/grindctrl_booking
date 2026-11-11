# G17 shopper retention review

Manual port from `88dc284`, reconciled against current main. No commit, push,
branch change, deployment or live database operation was performed.

## Owner migration and rollback

Hand the owner **`supabase/20261112_lead_retention_paste_privacy.sql`**. Apply
only after review and the existing migrations through November 11. Applying
the file does not delete data: deletion statements are confined to function
bodies. It is transactional and idempotent; PGlite executes the real file
twice, including over populated data with an existing disconnect deadline.
All nine functions explicitly revoke PUBLIC/anon/authenticated execution and
grant execution only to service_role. Existing RLS and Storage buckets remain.

Explicit owner disconnect schedules removal 30 days later. Repeated disconnect
does not extend that deadline. Reconnect of the same website or Shopify paste
site clears it through the trigger, including while Shopify proof is pending.
Displacement by another install does not start an owner deletion timer. There
is no retrospective timer backfill for sites disconnected before this migration.
The existing Woo plugin uninstall grace remains unchanged.

Rollback: stop the retention schedule, restore the previous application, and
restore the five replaced function definitions from the base files below.
Detach `paste_privacy_schedule` and revoke service_role execution on the four
new functions, including the private trigger function. Keep the additive
columns and durable Storage queue until pending removal work is reviewed or
drained. Completed erasure cannot be reversed by reverting code or SQL;
restoring deleted data requires a separately approved backup recovery.

## Function provenance

All `supabase/*.sql` definitions were searched. These are the latest definitions
on main, not assumptions about the hold branch's older base.

| Function | Base in current tree | G17 change |
| --- | --- | --- |
| `shopify_chat_retention_finish` | `supabase/20261101_privacy_fulfilment.sql:451` | Delete linked leads and their scoped audit before conversation FK links disappear; preserve Storage claim checks. |
| `shopify_chat_retention_visitors` | `supabase/20261101_privacy_fulfilment.sql:481` | Bounded twelve-month lead/audit sweep alongside the existing inactive visitor sweep. Leads expire by creation date even when their chat is active. |
| `woo_privacy_matches` | `supabase/20261105_woo_privacy.sql:54` | Include addresses captured only on a lead; keep exact site scoping. |
| `woo_privacy_export` | `supabase/20261105_woo_privacy.sql:72` | Admit stored paste installs; export inbox timestamps, shopper metadata, events, conversation and lead audit (including detached leads), plus associated leads/visitors. |
| `woo_privacy_erase` | `supabase/20261105_woo_privacy.sql:152` | Admit stored paste installs; remove lead audit and both conversation audit key styles. Preserve a lead-only email match until its last linked conversation batch is removed. |
| `grindctrl_paste_private.privacy_schedule` | New; no previous definition | Schedule explicit disconnect for 30 days; cancel on reconnect. |
| `disconnect_paste_site` | New; no previous definition | Atomically disable site/tenant and schedule removal; record authenticated actor using main's best-effort audit convention. |
| `paste_site_redact` | New; algorithm adapted from latest `woo_site_redact` in `supabase/20261105_woo_privacy.sql:232` | Exact paste identity, lifecycle lock and due check, bounded deletion, scoped shopper audit cleanup, durable Storage queue. |
| `paste_sites_due_for_redaction` | New; pattern from `woo_sites_due_for_redaction` in `supabase/20261105_woo_privacy.sql:313` | List only explicitly scheduled, disconnected, not-yet-redacted paste sites, at most 25. |

The retention/export/erase definitions were reviewed against those current
base files before applying G17. The additional matching function was rebuilt
from the current Woo migration. No refund,
grant, entitlement or plan function was redefined.

## Table and November 11 column review

No new shopper table was introduced by the November 11 inbox/products/health
migrations. The inbox fields belong to existing conversation rows.

| Table / fields | Shopper data? | Handling |
| --- | --- | --- |
| `widget_leads` | Yes: contact details and linked shopper identifiers | Email/linked export and erase; twelve-month bounded sweep; all site leads removed at due paste redaction. Audit references removed first. |
| `widget_visitors` | Yes: contact, metadata, anonymous ID | Matching/associated visitor export; erase when its conversations are gone; inactive twelve-month sweep; all site visitors removed on redaction. |
| `widget_conversations`, including `inbox_updated_at`, `inbox_handoff_at`, identity/cart/tags in metadata | Yes | Inbox timestamps and metadata exported; the entire row is erased/redacted/retained out with all columns. No separate inbox copy exists. |
| `widget_messages` | Yes, including internal notes and metadata | Exported with the conversation, including message details in the WordPress serializer; rows removed by all conversation deletion paths. |
| `widget_events` | Yes: linked event payloads can contain contact details | Linked events exported/erased with conversation; all remaining site events removed at final paste redaction. |
| `messenger_attachments` | Yes: uploaded images and triage | Attachment metadata exported; erase/redaction durably queues private Storage paths before row deletion. Scheduled chat retention retains its existing claimed-manifest/Storage-first sequence. |
| `messenger_feedback` | Yes: shopper comments | Exported and deleted with matching conversation; site sweep at paste redaction. |
| `messenger_unanswered` | Shopper-derived question text; common identifiers are redacted by current writer | Exported and removed with its conversation; final site sweep. Existing 90-day write-time pruning is unchanged. |
| `messenger_audit` | Mixed: contact, attachment, internal-note and conversation references can be shopper data | Conversation and contact activity exported, including detached lead audit; erase handles snake/camel conversation and lead keys; retention removes related/expired orphan references; paste site sweep removes shopper actions/references. Merchant security audit stays. |
| `messenger_question_groups` | Reusable redacted question/answer drafts; current app has no grouping writer or shopper-identity relation | Kept as merchant knowledge; individual samples live in `messenger_unanswered` and are deleted there. No new raw shopper store added on main. |
| `messenger_knowledge.product_data` | No: store catalogue data | Preserved and excluded from shopper export. Test verifies preservation after erase/redaction. |
| `messenger_canned_replies`, `widget_intents` | No: merchant-authored reusable configuration | Preserved. |
| `widget_sites.products_sync_attempted_at`, `products_synced_at`, health leases/check timestamps | No: store configuration and operational state | Preserved; site disabled at disconnect. |
| `widget_domains`, `widget_domain_audit` | No: domain ownership and merchant administration | Preserved. |
| `store_health_signals` | No: aggregate counts and bounded host/placement dimensions, without shopper IDs/URLs | Preserved; tested alongside erase/redaction. |
| `store_health_alerts`, including `code_spot_missing` enum extension | No: site problem keys, delivery attempts, leases and timestamps | Preserved; tested alongside erase/redaction. |
| `profiles.dashboard_locale` | Merchant preference | Preserved; unrelated to shopper matching. |
| `tryon_jobs.product_title`, `product_image_url` | Store-owned product metadata; job also has a shopper session/result | Existing hold-G17 behavior preserved: site-tenant result objects queued; jobs without credit-ledger references deleted. Ledger-linked job rows remain as accounting evidence. No G19 refund/grant changes. Per-email chat privacy does not invent an email-to-Try-On-session mapping. |
| `tryon_settings` placement fields from `20261111_tryon_pick_spot.sql` | No: merchant button placement | Preserved. |
| `paste_site_connections`, `woo_site_connections` | Merchant lifecycle/configuration | Paste gets additive scheduling columns; Woo schedule untouched. |
| `woo_privacy_storage_queue` | Temporary private object paths | Kept until the Storage API confirms removal; failures remain retryable. |
| `shopify_chat_retention_tasks` | Temporary conversation/path deletion manifests | Existing claim validation preserved; task cascades when its conversation is deleted. |

## Files ported and adapted

Paths below `apps/web-next` are relative to that application.

| File and line | Change |
| --- | --- |
| `supabase/20261112_lead_retention_paste_privacy.sql:1` | Renamed, reconciled G17 migration; owner decisions and rollback comment. |
| `lib/paste/privacy.ts:9`, `lib/paste/privacy.test.ts:18` | Owner-authorized paste export/erase/disconnect helpers and hold-G17 tests. |
| `app/dashboard/store-chat/paste-actions.ts:149` | Privacy and explicit disconnect actions using existing store capability/rate guard. |
| `app/dashboard/store-chat/actions.ts:212`, `actions.test.ts:517` | Existing disconnect UI reaches paste retention before legacy unclaim. |
| `lib/woo/privacy.ts:244`, `privacy.test.ts:44` | Shared bounded paste/Woo worker; expanded export serialization at `privacy.ts:85`. |
| `app/api/internal/shopify/retention/route.ts:25`, `route.test.ts:17` | Independent paste job on existing schedule; failures do not skip other jobs. |
| `lib/paste/types.ts:10`, `store.ts:59`, `status.ts:157` | Invalid-request code, stored deadline read, fail-closed schema handling and disconnected read model. |
| `lib/dashboard/paste-install-copy.ts:181` and `:308` | Exact EN/AR owner-approved copy. |
| `lib/dashboard/paste-retention-date.ts:5`, its test `:6` | Gregorian calendar, locale month name, Latin digits; UTC avoids server/client day drift. |
| `components/dashboard/v16/store-chat/v16-chat-studio.tsx:328`, its test `:62` | Existing confirmation and status area; existing fluid wrappers/styles. Paste copy replaces the Shopify dashboard-only promise that data stays in place, in both the row and confirmation. |
| `components/dashboard/v16/store-chat/paste-install.tsx:211`, its test `:56` | Disconnected date on Store setup; reconnect hides the notice. |
| `app/dashboard/store-chat/store-chat-page.tsx:304`, `page.test.tsx:128` | Pass stored paste retention to ChatStudio, including a regression test for domainless sites. |
| `lib/adapters/paste-actions.test.ts:35`, `lib/dashboard/paste-status.test.ts:28` | Authorization and deadline propagation tests. |
| `lib/paste/connection-privacy.test.ts:9` | Missing retention columns fail closed instead of bypassing paste disconnect. |
| `lib/paste/privacy-database.test.ts:88` | Real migrations/PGlite: idempotency, 30-day boundary, reconnect, isolation, new columns, multi-batch lead-only matching, detached lead audit, Storage queue and grants. |
| `scripts/security-data-hygiene-source.test.ts:8` | Port only G17 assertions; retain current G15/G16/G18 contracts and exclude dropped G19. |

Left unchanged: `lib/messenger/conversations.ts` and `lib/messenger/audit.test.ts`
already contain the hold branch's best-effort audit changes from shipped G16.
`supabase/20261110_active_grant_refunds.sql`, its app changes and source test
were deliberately not ported. The hold Woo PHP changes concern the shipped
visitor limiter (G18), not G17, so plugin version, PHP, zip and
`woo-plugin-source.test.ts` remain unchanged.

## UI discovery

Reused ChatStudio's existing Modal, `confirmText`, `muted`, wrapping rows and
fluid grid, and PasteInstall's `Stack`, `Text` and `min-width: 0` root.
The former uses logical padding and the 48em layout breakpoint; the latter
uses an auto-fit grid with `min(100%, 12rem)` and logical step placement.
No new visual, spacing, motion or breakpoint pattern was introduced. Exact
EN/AR copy comes from the existing paste install copy module. Dates use the
dashboard language, Gregorian calendar, Latin digits and UTC to avoid
server/client calendar-day disagreement.

## Verification

Commands run from `apps/web-next` (Windows uses `npx.cmd`):

```text
npx vitest run --configLoader runner lib/paste lib/woo lib/messenger lib/adapters lib/dashboard app/dashboard app/api/internal scripts
npx vitest run --configLoader runner lib/paste lib/woo lib/messenger lib/adapters lib/dashboard app/dashboard app/api/internal scripts components/dashboard/v16/store-chat components/dashboard/v16/store-setup app/api/messenger app/api/store/signals app/api/try-on app/api/woo lib/shopify lib/store-health lib/try-on --maxWorkers=2
npx tsc --noEmit -p .
npx eslint <26 changed TS/TSX files>
```

- Initial requested suite: **154 files, 2,146 tests passed**.
- Final expanded suite, including importers: **286 files, 3,661 tests passed**
  in 1,010.97 seconds. `security-data-hygiene-source.test.ts` is included and
  green. The PGlite suite executes the migration twice against the actual
  current inbox/product/health declarations and exercises it over populated
  data without apply-time deletion or deadline movement.
- Focused SQL and affected UI checks: **3 files, 46 tests passed**.
- Final page-fixture and security-source recheck: **2 files, 15 tests passed**.
- TypeScript: **exit 0**, after correcting the test fixture's required
  `hasDraft` field and the temporary browser fixture's Woo pairing result.
  Passed again after fixture removal and regeneration of current route types
  (`next typegen --webpack`); `next-env.d.ts` is unchanged from main.
- ESLint: **26 changed TS/TSX files passed**, with the corrected page fixture
  checked again after its final edit.
- Playwright/Chrome: **4 tests passed, exit 0, 37.5 seconds**. EN/AR and
  light/dark each exercised 320/390/768/1440px (16 combinations), the
  localized deletion date and disconnect confirmation, and page/dialog
  horizontal overflow checks. All four 390px modal screenshots were visually
  inspected for wrapping, readable copy and unclipped actions. Local evidence
  is under `apps/web-next/output/playwright/g17-*.png` (ignored artifacts).
  Turbopack could not resolve this worktree's Next package, so the check used
  `next dev --webpack` without changing application configuration.

No test assertion timed out in these passing runs. An earlier unbounded
expanded attempt, run alongside Next compilation, exhausted Windows/Node
memory. Its worker-termination timeouts named
`lib/shopify/app-pricing-database.test.ts` and
`lib/store-health/signals-sql.test.ts`; both are included in the passing
two-worker run. These were process termination failures under load, not
evidence of failing retention assertions. No test checks were loosened.

Tests use PGlite and mocked providers only. The temporary browser fixture
renders shipping components with inert local actions and blocks API/external
requests; it does not prove authenticated merchant flows.
The temporary route, its Playwright spec and generated `AGENTS.md` were removed
after verification; the shipping unit/database regressions remain. Stray
`.g17-*.json` result files were removed as requested.
Temporary `.g17-*.log` files were also removed after recording their results.

Not verified: a real elapsed 30-day scheduled run, hosted database/schema/RLS,
live Storage removal, deployment/cron execution, or an authenticated dashboard
disconnect/reconnect against production. No live database was contacted.
