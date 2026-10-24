# Shopify privacy fulfillment procedure — candidate for independent approval

Applies to new installation events and the legacy `shopify_privacy_requests` backlog. This procedure is checked against the repository schemas and [Shopify's mandatory compliance requirements](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance). It has **not** been approved by the owner's privacy/legal reviewer or exercised on a hosted database. Those approvals, named operators and a synthetic rehearsal are release blockers. No production deletion or SQL is authorized by this document.

Recording, an HTTP 200, notification, assigning an operator and recording an approval are not fulfillment. The new casework RPC records completion only after two-person scope approval and execution/verification evidence are supplied. It does not execute or independently prove erasure. Operators must supply truthful evidence from the execution below.

## Ownership and deadlines

Before any pilot the owner records actual people and authenticated operator IDs for: privacy lead (accountable for all cases), backup/on-call operator (daily queue), data engineer (executes approved scope), independent reviewer (different person), and legal reviewer (specific retention decisions). The SMTP From mailbox currently receives alerts; its named on-call owner must monitor it. Delivery failure returns 503 and leaves the durable request pending. Database queue inspection remains mandatory even when mail works or Shopify stops retries. No owner is presumed assigned just because SMTP is configured.

Run the restricted work-queue query daily, including weekends, and after an alert. Assign new cases within one day; establish scope within seven days; execute by day 21 and independently verify/deliver by day 25. Escalate unresolved scope, failed execution or retention questions immediately to the privacy lead and legal reviewer; day 28 is an incident requiring daily lead attention. Overdue cases escalate immediately. These are internal targets within Shopify's 30-day completion requirement. A specific legal duty to retain data needs documented legal review; it does not justify silently closing or ignoring the case. `shop/redact` normally arrives 48 hours after uninstall; that is not a retention permission.

```sql
-- Read only, restricted approved database tooling. View contains no payload.
select case_source,id,app_client_id,shop_domain,topic,reviewed_status,
       received_at,due_at,overdue,assigned_owner
from public.shopify_privacy_work_queue
where reviewed_status <> 'completed'
order by due_at,id;
```

The view includes `completion_unverified` legacy rows: an old completed flag alone is not evidence that an earlier export/deletion succeeded. Reconstruct original evidence or reopen the operational investigation. New and legacy rows are separate cases even when IDs/domains overlap. Link duplicates to the same approved scope and execution evidence without executing the deletion twice. Preserve the original receipt date; do not reset deadlines on a retry/import.

## Establish the request and exact scope

1. Open a restricted case ticket keyed by `(case_source, case_id)`, not only shop domain. Record receipt/deadline, verified signing app where known, request/customer/order IDs from the restricted payload, and the responsible operator. Check original Shopify delivery/request records or the verified merchant's request. HMAC authenticates the body, not delivery topic/ID/timestamp headers: do not approve deletion based solely on those headers. If authenticity or purpose is ambiguous, escalate and verify independently before destructive work.
2. For legacy rows, do not guess an app from the current configuration or shop name. Find independent historical installation/authorization/merchant evidence and link it as `provenance_ref`. If unavailable, record the ambiguity, contact the verified merchant through approved support channels and escalate. No automated attribution or blanket deletion is permitted.
3. Build a versioned scope manifest containing explicit table primary keys, tenant/workspace/site ownership joins, installation/customer/order relationships, Storage object paths, approved action per record, row/object counts, in-flight job handling, cross-installation impact and negative checks. Hash its canonical bytes with SHA-256. Keep payloads and manifests in restricted storage; store only references/hashes in audit evidence, never customer data in logs/PRs.
4. Snapshot current schema, foreign keys, triggers, cascades and target identity through approved tooling. Repository schemas are a starting point, not proof of hosted schema. Verify every selected child belongs to the approved tenant/site/conversation/job. A SQL filter by shop domain alone is insufficient authority. Lock/recheck the approved identities immediately before execution; abort on drift, changed counts or scope expansion. Deletion of a parent is forbidden until all cascades are enumerated and approved.
5. Independently review the manifest. Another active app does not automatically exempt shared personal data from deletion. Conversely, its presence does not authorize erasing unrelated merchant data. Decide applicable shared records individually; unresolved ownership remains blocked and escalated, not completed. Legal must approve each retained category, purpose, authority, minimal fields, expiry/review date and access restriction. Credit/accounting history has no blanket exemption. Record `none` explicitly if no records may be retained.

| Data category | Repository ownership / action requiring scope review |
|---|---|
| Installation credentials and audit | `shopify_installations` UUID + app client ID; `shopify_credential_audit.installation_id`. Only the requesting installation's applicable material. Recheck current generation; no other app's token. Audit FK is non-cascading. Retain minimal evidence only with an approved basis. |
| Merchant/site mappings and settings | `tryon_shops`, `shopify_shops`, `widget_sites`, workspace/team ownership, `tryon_settings`. Shared business identities; never delete the entire site/workspace because A uninstalled. Scope personal fields and applicable shared records with the independent reviewer. |
| Customers/conversations | `widget_visitors`, `widget_conversations`, `widget_messages`, feedback, handoff/contact data and `messenger_audit` through explicit `widget_site_id`, visitor/conversation IDs and verified customer/order metadata. A site-wide delete is not a customer redaction. Enumerate attachment/contact child records and cascades from actual schema. |
| Storage | `messenger-attachments` and private `tryon-results`; select only manifest-owned paths after verifying their owning rows. Delete using Storage API first; verify each result, then delete owning rows. On failure leave the case open with failed paths; never erase the mapping needed for retry. Source Try-On photos are transient, but generated results are personal data. |
| Try-On jobs and credits | Explicit `tryon_jobs.id`, `shop`, session/request keys, result pointers; reservation/subscription/ledger child relationships. Reconcile already-reserved jobs exactly once before ordinary transition cleanup; do not create new AI calls, duplicate refunds or zero out unknown provider spend. If a legal deletion deadline conflicts with reconciliation, privacy lead/data engineer approve targeted cleanup and an evidence-preserving accounting plan. Keep financial history only to the extent legally justified, minimizing/pseudonymizing personal fields where approved. |
| Exports/events/backups/subprocessors | New and legacy privacy payloads, event receipts, logs/error sinks, restricted exports, backups, email/AI/storage vendors. Enumerate actual recipients/configuration. Expire exports after delivery verification under approved retention; restrict backup copies and document expiry plus mandatory reapplication of deletions before any restore becomes accessible. Verify vendor deletion requests/results where applicable. |

## Execute, verify and record fulfillment

6. Obtain the separate production/change authorization required by the owner for the exact manifest/environment. In a synthetic rehearsal, use disposable tenant data and mocked AI. The code change, this document and a `scoped` action do not grant permission to execute production SQL or delete real records.
7. For `customers/data_request`, compile only the approved customer's applicable records/orders, including shared applicable data. Verify recipient ownership independently. Deliver through a restricted authenticated channel to the merchant, not a public URL or plaintext payload in logs. Keep delivery/receipt evidence. SMTP acceptance alone is insufficient. Track export retention/expiry and subprocessors.
8. For redaction, perform the approved object-first/row-second operations using the manifest's explicit IDs and tenant joins. Use bounded transactions where possible; Storage/vendor operations are not atomic with PostgreSQL. Log counts and operation IDs into restricted evidence, without customer data. On partial failure record successes/failures, preserve remaining mappings and retry only outstanding operations. A zero-row result requires verification of already-deleted state; it is not automatically success. Unrelated app/site/customer sentinel records must remain unchanged.
9. A different reviewer verifies missing objects/rows or approved minimization, negative ownership checks, pending-job settlement, vendor results and each specifically justified retained record. Record exact query/object verification references, counts, retained-record manifest (or explicit `none`), timestamp and scope hash. A new scope hash requires another scope approval. If retained personal data remains under a legal hold, keep the case unresolved with the legal basis and review date; do not mark fulfillment to hide it.
10. Record `fulfilled` only after steps 7–9 actually succeeded. Close the operational ticket only after database evidence agrees. Preserve the minimal completion evidence under the separately approved evidence retention schedule; do not preserve the original full payload indefinitely. Recheck the queue afterward and ensure duplicates/retries link to the same evidence.

## Restricted casework interface

Apply manual deltas in order: legacy privacy schema (if missing and separately reviewed), installation-isolation delta, review-remediation delta, then `supabase/20261024_shopify_privacy_casework.sql`. The last delta adds an append-only service-role audit table, a due-date/legacy queue and one RPC. Browser roles have no access. It changes no data ownership and executes no deletion. Ordinary schema rollback cannot reverse erasure.

Approved operator tooling uses authenticated operator identity and the approved platform-operator allowlist; merchant ownership alone is insufficient. Do not expose this service-role RPC as a browser API. The database trusts the restricted tooling's supplied actor identity; it cannot authenticate a human from an arbitrary string. Preserve the tool/session identity in the ticket. Supply a different authenticated reviewer. Direct service-role writes can bypass the procedure and must be restricted/audited operationally.

```sql
-- Parameterized operator-tool contract; examples are NOT execution authorization.
select public.record_shopify_privacy_case_action(
  :case_source, :case_id, :authenticated_operator_id, :action, :evidence_jsonb
);
```

Allowed actions: `assigned`, `scoped`, `escalated`, `retention_hold`, `fulfilled`. Every action needs `ticket_ref`. `scoped` needs `scope_ref`, `scope_sha256`, `approval_ref` and a different `reviewer`; legacy scope/completion additionally require `provenance_ref`. A hold requires `legal_basis_ref` and `review_at`; release requires a new reviewed scope, not a completed flag.

`fulfilled` must match the latest approved scope hash and supply `execution_ref`, `verification_ref`, `verification_passed: true`, `approval_ref` and a different `reviewer`. Data requests require `delivery_ref`; redactions require `deletion_ref` and `retained_records_ref`. Open legal holds cannot be completed. The transaction appends the evidence and marks the source request completed together; duplicate completion is rejected. The RPC validates evidence structure, not the external truth of its references. Independent verification is an operating responsibility.

## Acceptance and residual blockers

Local SQL tests cover new/legacy deadlines, unverified historical completion, absent scope/evidence, independent reviewer, legacy provenance, retention holds, delivery/deletion evidence and restricted append-only access. Required synthetic rehearsal: partial Storage failure followed by retry, two overlapping apps with unrelated sentinel data, in-flight job reconciliation, export receipt, backup-restore deletion replay and overdue escalation. None has been exercised against the hosted environment. Named operators, approved legal ownership/retention rules, actual schema/vendor inventory, tooling access enforcement and rehearsal evidence remain **NO-GO for real merchant rollout**. The procedure is now concrete and auditable; its organizational approval and execution are not claimed complete.
