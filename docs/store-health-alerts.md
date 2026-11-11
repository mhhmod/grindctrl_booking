# Store health alert emails

Apply `supabase/20261111_store_health_alerts.sql` manually before enabling the schedule. It is additive and tested twice in PGlite; no live database was used. State has RLS, no public policies, and service-role-only table/RPC grants. The existing notification settings JSON holds `store_health_notifications.emailOnFailure` (absent means on). Changing it advances `settings_version`, so concurrent Store Chat publishing cannot overwrite consent. Chat rollback preserves the current consent.

Configure `STORE_HEALTH_ALERTS_SECRET` (at least 32 characters) in the Next server environment and GitHub Actions secrets, and `STORE_HEALTH_ALERTS_URL` in Actions as `https://grindctrl.cloud/api/internal/store-health/alerts`. The existing `TRYON_EMAIL_SMTP_*` mailbox and `STORE_CHAT_EMAIL_FROM_NAME` sender are reused. The new workflow checks every 15 minutes and retries a connection timeout once. Each call leases at most 50 oldest-checked sites, with a three-minute work budget. A larger site population takes multiple scheduled batches to cover.

Detection calls `getYourStoreFacts` and `buildYourStoreView`. Only bad rows open periods; attention/waiting rows do not. An inactive plan is not an out-of-looks alert. The current model represents invisible Store Chat caused by stale code with the single code row, so it emits `code_gone`, without manufacturing a separate `store_chat_down` rule. The stable Store Chat key/template/anchor are available when that model has an independent bad chat row. Failed reads and disconnected/unsupported stores do not count as recovery evidence.

The owner is the existing workspace owner, or the canonical linked Shopify Clerk owner. The Clerk primary email lookup is shared with the existing linked-account hint. Dashboard language was cookie-only; the authenticated dashboard now remembers its resolved language on the owner's existing profile. Scheduled mail defaults to English until that owner next visits the dashboard. Admin visits update only their own language.

## At-most-once SMTP delivery

The unique partial index allows one open period per site/problem. Site leases fence concurrent/stale checks. A send claim atomically sets `alerted_at` (or `resolved_alerted_at`), increments attempts, and records a token before SMTP starts. A confirmed failure before delivery clears only that timestamp and permits up to four attempts, across later runs. Giving up and ambiguous SMTP outcomes are logged. Resolved periods with no claimed alert do not generate an orphan recovery.

SMTP has no provider idempotency key. An expired claim is marked unknown and never retried: this prevents duplicates after acceptance, including a crash before recording success. A crash before sending can therefore lose that email. Network failures after DATA are also unknown. A stable Message-ID helps diagnostics but is not treated as provider deduplication. Exactly-once guaranteed delivery would require a provider with durable idempotency support.

## Review and rollback

Open `/dev/email-preview` to review EN/AR problem and recovery messages, each problem type, and plain text. `/dev/your-store-check` includes the actual preference switch with fixture data. These routes are unavailable in production. Emails follow A7.1/A7.2 and the requested cream/charcoal palette. Existing transactional templates contain no standard legal footer line; this template uses their existing legal operator name, `Grind CTRL`, and the site address.

Rollback without removing data: disable `store-health-alerts.yml`, revoke service-role EXECUTE on the five new RPC signatures listed at the bottom of the migration, and retain all history, claims and additive columns. Restore the previous application version. Never clear claimed timestamps: the mailbox may already have accepted those emails. The migration repeats these instructions in its rollback comment.

Real SMTP delivery, recipient inbox appearance in Gmail/Apple Mail/Outlook, live Clerk/profile data, scheduler configuration, and live migration application require operator verification.
