# Part 03 rebuild: evidence and UI fidelity

This film proposes a new GRINDCTRL collaboration. It does not show an installed integration, verified Concrete employee screens or a completed GRINDCTRL implementation. All names, masked numbers, emails, times, call IDs and agent letters are synthetic. The reserved `example.com` email is illustrative.

## Evidence ledger

| Item | Classification | Evidence and practical limit |
|---|---|---|
| Genesys “CRM URL pop up integration” | `contracted` | Concrete November 2023 contract, PDF page 4, re-inspected visually. Inspect the existing configuration before prescribing additional infrastructure. Contract ≠ proof of operation. |
| Prism integration migration with Desk/Creator | `contracted` | November 2023 PDF page 5 and prior supplied contract reading. Does not establish membership-field mapping or call-note storage. |
| Customer search through a phone number, without automatic call context | `unknown` operational status | Reported by the user; manual Zoho Desk phone search reportedly works. No independent operational test, screenshots or configuration supplied. |
| Concrete live screen layout, native sidebar placement, actual source records | `unknown` | No authorized tenant capture or tenant access was available. Approved films contain illustrative layouts, not live evidence. |
| Third-party UI embedded as a Genesys client app | `supported by vendor docs but unverified here` | Official Genesys Client Apps SDK README was retrieved and read. Requires HTTPS/iframe compatibility and tenant configuration. UI SDK is separate from data APIs. Group visibility alone is not authorization. It does not verify Concrete’s display surface, license or data access. |
| Contact-level Genesys notes | `supported by vendor docs but unverified here` | Official JavaScript SDK ExternalContactsApi documents `/externalcontacts/contacts/{contactId}/notes`. Contact-scoped notes must not be presented as an original per-call record without an explicit, validated relationship. |
| Conversation/participant/communication wrap-up APIs | `supported by vendor docs but unverified here` | Official ConversationsApi documents GET/POST wrap-up scoped to conversationId, participantId and communicationId. POST lists `conversation:participant:wrapup`. This verifies the documented scope, not Concrete’s native note schema, UI availability, retention or access rights. No API was called against a tenant. |
| Name, phone, segment and optional email together with the call | `proposed` | Sales Manager requirement relayed by the user; the film’s demonstrative record association and disclosure conditions are synthetic. Caller ID alone is not identity proof. |
| LIFESTYLE / PRESTIGE / ELITE vocabulary | `proposed` display using supplied vocabulary | Exact user/handoff labels preserved. Concrete Icons Club official site was attempted but proxy-denied, so its current brand design and rules were not independently reviewed. No perks or tier inference invented. |
| Membership source, update policy and validity | `unknown` | Could be a separate approved source. Do not assume the field exists in Genesys, Zoho Desk or Prism. |
| Individual historical call notes / save and later retrieval | `proposed` | Offline fixtures demonstrate the required ownership contract. Real call-note location, source identity and approved write mechanism remain unknown. |
| Native call notes vs Zoho Calls vs ticket/global notes | `unknown` at Concrete | Inspect the actual entities and parent IDs before implementing. Vendor contact-note endpoints are not evidence of an already unified per-call history. |
| Retention, read/write permissions, identity checks, licensing and API access | `unknown` | No tenant settings or access provided. Do not use a documented retention limit as Concrete’s configured policy. |
| Verified authorized operational evidence | `verified from authorized operational evidence` | **No items qualified for this classification.** |
| Pilot outcomes or savings | `unknown` | No pilot was performed. The film shows proposed validation, not measurements or guaranteed benefits. |

## What was inspected

- Actual approved Part 01 MP4 at 12, 56 and 106 seconds; actual approved Part 02 MP4 at 12, 56 and 106 seconds. Reference frame montage retained for internal QA. Fresh scene geometry follows their warm light palette, thin borders, Manrope, restrained highlights and stationary call/context relationship.
- Voice-fix handoff README, lexicon, all eight chapter texts, storyboard, video-agent prompt, QA instructions and manifest. ElevenLabs synthesis instructions are reference only; no new narration was generated and no voice/model access was claimed.
- Five supplied contracts’ existing full reading notes, including the 2023 screen-pop page directly re-inspected. Renewal/license terms do not demonstrate API availability or deployed features. No confidential contracts are distributed with this package.
- Official Genesys SDK README and API references listed in `research/access.json`. Article URLs for Genesys help were proxy-denied. Zoho help URLs returned an application shell, not usable article text. No claim that their native employee screens were inspected.
- No authorized screenshots, tenant configuration exports, deployed-system recordings or live credentials were available.

## UI fidelity status

The primary film uses a **vendor-informed illustrative companion workspace**, continuing the approved films’ interaction/contact separation. It is deliberately labelled “Proposed workspace” and “Illustrative UI”. It is not a pixel-accurate Genesys or Zoho screenshot and does not promise a particular sidebar or screen-pop implementation.

Customer profile fields remain adjacent to the ongoing call. Historical calls display their own ID/date/time/agent, and selected notes display their original author and original call ID. Membership has an explicit demo value and source-validation treatment. Missing fields show “Not available”, not a fabricated classification. Multiple candidates reveal no candidate call notes until the agreed process permits disclosure. Service failure is distinguished from an empty history. Active-call continuity and manual fallback remain visible.

## Call-note ownership and integration contract

In the demonstrative fixture, `demo_interactions` is a synthetic source, not Genesys or Zoho. Identify each call by the compound `(sourceSystem, interactionId)` key. The current new note belongs to **DEMO-1012**, authored by **Agent D**, at its own recorded time. A later call **DEMO-1015** handled by **Agent E** retrieves the original **DEMO-1012 / Agent D** note. It does not copy it into the later call or change its author. Human-authored call notes are separate from ticket notes, global notes, recordings, transcripts and AI summaries.

For real sources, retain conversation/participant/communication identifiers where relevant, not just a phone number or a display row ID. Map them to the authoritative note entity and stable customer record only after authorized verification. Transfers may involve multiple participants or legs; the offline simulation’s simple ownership invariant is not proof of vendor transfer behavior.

Before writing or displaying real notes, confirm source entity/schema, parent ID, historical read availability, author and timestamp fields, source retention, deletion behavior, access divisions/roles, record association, write lifecycle and approved authentication. A successful native save and permission-equivalent future retrieval must be demonstrated on authorized test calls. A generic POST contact note is insufficient to establish per-call storage.

## Least-change path and pilot

1. Inspect the contracted screen-pop configuration and current Genesys/Zoho Desk workflow. Establish actual supported display and record association.
2. Identify membership, contact and call-note authoritative sources. Check read/write access and retention; document unknown or absent fields explicitly.
3. If native features meet the requirement, use them. Add only the smallest supported bridge for a verified gap. The film does not select or claim an already enabled API/connector.
4. Pilot with authorized synthetic or anonymized test records. Check single/shared/unknown caller numbers, missing fields, service errors and withheld permissions. Validate field accuracy, call-to-note ownership, after-call write/read behavior and future retrieval; test transfer mapping separately.
5. Observe employee searching and follow-up continuity against the existing procedure. Report actual observations before claiming time or quality gains.

## Later authorized UI pass

`part03-ui-fidelity-manifest.json` is disabled and contains no screenshots. `genesys.call` and `customer.context` are explicit state-specific replacement regions. A future capture must be approved and anonymized before the player enables it. Keep contact data, historical call IDs and original note ownership consistent across all states. Re-measure highlights, text, layouts and source timing; rerun exports and QA. The hook was tested only with a synthetic white fixture, never with a live Concrete screenshot.
