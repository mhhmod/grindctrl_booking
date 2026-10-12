# GRINDCTRL × Concrete — PART 03: CUSTOMER 360° CALL EXPERIENCE

**FULL EXECUTION PROMPT — For the AI production agent**

You are now the Product Design Director, Genesys + Zoho Solution Architect, Motion Design Director, and QA owner of a new GRINDCTRL × Concrete executive product demo.

**Assignment:** produce a new Part 03 video explaining the Concrete Sales Manager's requested customer-calls experience. Your job is to build the **complete visual production** after the audio is provided, using the approved Part 01 video as the reference for quality and style. Produce a silent cue-ready preview while awaiting the ElevenLabs audio if it has not yet been supplied. Never claim to have created a narrated video without actual narration audio.

## Core customer requirement — MUST appear visibly, not just in narration

When a Concrete customer calls, the human service Agent should see, where available and authorized:

1. The **customer phone number**.
2. The **customer name**.
3. Their **Concrete Icons Club segment: LIFESTYLE, PRESTIGE, or ELITE**.
4. Their **customer email, if recorded**.
5. **Per-call activity history**: each past identifiable, retained and permitted call should show its own date/time, agent (if available), and notes actually written by a human customer service representative during or after THAT call.
6. During the current call, demonstrate how an agent records a **new note tied to the correct interaction**, and how a subsequent Agent could read it when the record is linked and visible.

Crucial: per-call notes are different from global customer notes, ticket notes, call transcripts, or generic AI summaries. Do not conflate them. Preserve the real source system and unique call-to-note relationship.

## Reference artifacts (inspect, do not blindly imitate)

- The approved `grindctrl-narrated-en.mp4` Part 01, and its actual source HTML/PPTX where available; maintain motion tempo, natural continuity, light warm-white visual treatment, compact GRINDCTRL branding, readable Genesys + Zoho UI.
- The existing Part 02 storyboard and implementation notes where available, but do not make this a third video about Ticket History.
- `01_ELEVENLABS_SPEECH_EGYPTIAN_AR.txt` — final intended narration text; user will supply the synthesized ElevenLabs MP3 separately if not yet available.
- `02_STORYBOARD.md` — eight-scene narrative.
- `03_RESEARCH_EVIDENCE.md` — source and validation map.
- All accessible Concrete contracts, annexes, UI references, project files and previous demos. Do not treat a contract feature as proof it is active in production.

## Critical PRE-PRODUCTION investigation — must do

### A. Inspect Concrete evidence

Find existing contracts, scope documents, annexes, technical specs, screenshots and brand assets already accessible to you. Distinguish:
- Claimed existing capability (contract scope)
- Tenant configuration actually observed or independently verified
- Vendor-native capability from official documentation
- Proposed integration behavior
- Unknown pending inspection

Create an **Evidence Matrix** covering each on-screen field and each video claim. Keep uncertainty visible in the internal production documentation.

### B. Research brand specificity, not generic luxury

Read Concrete's official https://concrete.store/ and its Icons Club page https://concrete.store/iconclubinfo/ . All three official tier names are `LIFESTYLE`, `PRESTIGE`, `ELITE` (in the UI style use their true capitalization). Do NOT make up tier names, member numbers, exclusive perks or actual member eligibility for fictional people.

Study recognizable typography, logo treatment, white/cream surfaces, editorial restraint, imagery, whitespace and small brand accents from Concrete's own current site / assets. Prioritize accurate customer-facing brand cues. Avoid gold-black VIP-card clichés imported from unrelated loyalty brands. Keep every VIDEO SLIDE light, no dark scenes.

**Important separation:** the overall presentation shell can be GRINDCTRL-branded and Concrete-aware, but the Genesys/Zoho agent workspace should resemble verified vendor/tenant UI; do not reskin native operational surfaces to the point the Sales Manager no longer recognizes them.

### C. Research exact product capabilities and limitations

Genesys official:
- https://help.genesys.cloud/articles/enter-notes-for-an-interaction/
- https://help.genesys.cloud/articles/view-interaction-history-contact/
- https://help.genesys.cloud/articles/work-external-contact-interaction/
- https://help.mypurecloud.com/articles/limit-interaction-history-for-external-contacts-and-organization-to-365-days/

Zoho official:
- https://help.zoho.com/portal/en/kb/desk/customization/modules/articles/standard-modules-and-fields-zoho-desk
- https://help.zoho.com/portal/en/kb/desk/contacts-and-accounts/articles/customer-module-the-contacts-and-accounts-detail-page
- https://help.zoho.com/portal/en/kb/desk/activities/articles/adding-editing-and-deleting-calls
- https://help.zoho.com/portal/en/kb/desk/customization/layouts-and-fields/articles/working-with-custom-fields

Genesys supports interaction notes and interaction history when contact association, licensing/permissions and retention permit. Zoho Desk has call activity records. They are not automatically a synchronized unified call-history system in Concrete. **Check where notes currently live and what native view can already do before proposing a new backend or UI.**

### D. Trace field-level ownership

For each user-required field (phone, name, segment, email, previous calls, individual call notes) document:
- Source of truth
- Lookup/linking key
- Actual permission requirements
- Freshness and coverage
- If no value is present, what the employee sees
- What is native vs what needs a bridge

The segment might live in a Concrete retail/loyalty database, ERP, CRM, or existing custom field. Do NOT assert a source without evidence. The public Icons Club page proves the tier vocabulary, not the database field's location. If data integrations require credentials you do not have, use a synthetic visual fixture and mark integration 'to validate'.

## Design philosophy — immediately self-explanatory

Create a visual workflow demo that makes a Concrete Sales Manager say 'Yes, that's the information I want my agents to see.' The hero is the **human Agent's familiar interaction screen**, not generic flowchart boxes. Explicit eye path:

**Incoming Call -> Customer Name + Phone -> Icons Club Segment + optional Email -> Previous Calls -> A specific Agent Note -> New Note added to THIS call -> Visible to next Agent (when authorized).**

Use a realistic, large operational screen, not a grid of cards with labels. Prefer consistent screen frame across the 8 scenes. Show exactly what changes and why. Link visual transitions to spoken phrases. Use 16:9 1920x1080 light theme only, generous whitespace, balanced alignment, modest headlines, refined strokes, subtle animation and no dark UI backgrounds. Match the pacing and light palette of Part 01, not necessarily its exact card layout.

## Mandatory storyboard — execute all 8 scenes

**01 — The call becomes a customer**
Open exactly as a seamless continuation of Part 01: Genesys incoming call, familiar call controls, a customer context area. Let the viewer immediately understand the human problem and the new profile outcome. Tiny discreet `Proposed experience` note.

**02 — Identity fields in one glance**
Caller's number is visible. Lookup provides an identified candidate; reveal NAME, PHONE, optional EMAIL. If number withheld or multiple matches, wait for employee selection/verification. Explicit source/match state where helpful. No magical instant identity confirmation.

**03 — Segment that means something to Concrete**
Place a compact `Icons Club: ELITE` marker in the same customer-profile header, not in a giant unrealistic luxury card. Briefly reveal the authentic three tier names LIFESTYLE, PRESTIGE, ELITE as illustrative membership examples. Do not create favoritism rules or automatic queue prioritization. If a segment is not verified, show `Segment not available`.

**04 — Individual Call Activity history**
Reveal a real-looking chronological timeline or table of *past calls*. Each row shows its own exact event timestamp, direction if available, assigned/handling agent if known, and a note preview. Choose one row visually. Be explicit that records shown are historical retained/linked accessible interactions; do not claim 'all calls' if history coverage is unknown. Make this look like a native Genesys history view or supported Zoho calls activity, whichever best fits verified environment.

**05 — Open the selected earlier call**
Expand the `08 Oct` inbound call and display the note attached to it: `Followed up on the exchange. Branch review requested.` Make this a distinguishable quoted historical note (source, date, handling agent), not an inferred result or AI-generated summary. Highlight that the request does not prove the branch completed the review.

**06 — Agent enters a note in the current call**
Return to an active call. Human Agent types `Customer called again; awaiting a confirmed branch update.` Demonstrate the appropriate save/ACW interaction. If native Genesys automatic note-save can be verified in the proposed design, depict it accurately; if not, keep it generic and caption as proposed. Then show a *later* call and the note visible under the original interaction's detail, given correct linking and permissions. Do NOT imply Zoho automatically receives it absent verified sync.

**07 — Edge cases are carefully managed**
Use a concise interface-state montage: multiple customers sharing one number; no match; missing email/segment; call history unavailable or partially unlinked. Explicitly distinguish `No matching record` from `Service unavailable`. Human confirmation where appropriate. The active phone call continues when lookup fails. Show access control, never leak one person's history to another just because their phone numbers match.

**08 — Technical truth, practical pilot**
Show the highest-level verified connection architecture: Genesys interaction + interaction notes / contact linking; optional Zoho Desk customer/call activity; Concrete loyalty segment's actual source only after verification; minimal supported presentation mechanism; authorized test call and checks. Explain what is already native and what still requires tenant validation. Finish on the **employee profile + per-call notes** hero screen, not a marketing logo wall. No unverified quantified savings.

## Required synthetic fixture (keep identical across every scene)

Name: `Ahmed M. (DEMO)`; phone `+20 10 •••• 4821`; email `ahmed@example.com` (synthetic); displayed segment `ELITE (Illustrative)`. Historic call rows:
- 08 Oct, Inbound, Agent A — Note: `Followed up on the exchange. Branch review requested.`
- 03 Oct, Inbound, Agent B — Note: `Customer requested a size exchange.`
- 26 Sep, Inbound, Agent C — Note: `Customer asked about product availability.`
Current call note: `Customer called again; awaiting a confirmed branch update.`

Keep ticket status separate from call note, and source histories traceable. Do not imply a call recording exists or present invented call audio.

## Voice-over workflow

Voice-over must be produced in **natural Egyptian Business Arabic**, with normal English work terms (`Call`, `Agent`, `Customer Segment`, `Email`, `Call Activity`, `Previous Call`, `Notes`, `Follow-up`, `Lookup`, `Manual Search`, `After Call Work`). This is scripted in `01_ELEVENLABS_SPEECH_EGYPTIAN_AR.txt`. The exact spoken MP3, once the user supplies it, becomes the authoritative timing. Do not add an AI voice automatically unless the user asks.

If the final MP3 is attached:
1. Inspect its real duration and intelligibility; never reuse Part 01/Part 02 audio.
2. Transcribe/align the actual audio to speech (best-supported speech timing/forced alignment) and identify the eight story paragraphs by phrase.
3. Build cue-level animation timestamps off the recording, including pauses and pronunciation variability.
4. Use original audio unchanged; do not change the message, tempo artificially, cut phrases, or synthesize another narrator.
5. Verify the final MP4 A/V sync by inspecting every scene and especially customer info, segment, call activity notes and current-call note entry.

If final MP3 is NOT attached: prepare the complete HTML visual demo, source and storyboard and optional silent preview with clearly named insertion/animation cues; state plainly that voiced render awaits audio. Do NOT claim complete narrated MP4.

## Technical production and QA constraints

- 1920×1080 Full HD, 16:9, light-theme only.
- Editable HTML/CSS/JS source and narration cue map; replay/pause/step navigation where practical.
- Actual renderable MP4 (narrated if audio provided; otherwise silence explicitly labeled) with no off-screen content, no timing jumps, no cut-off frames.
- Optional editable PPTX and PDF when feasible, with fidelity measured honestly.
- Correct logo usage and licenses, proper Arabic/English typesetting; preserve source assets without exposing restricted font files.
- Cross-check real rendered frames (all eight scenes); compare Part 01 for continuity; perform no-text first-glance and squint-test.
- Test no-match, shared-number, unavailable email/tier, unavailable history, empty note, permission denied and transfer cases in the underlying UI simulation if interactive.
- Use on-screen footnotes/source legend minimally. A separate report must detail vendor facts, verified Concrete data, assumptions and open questions.
- Do not expose real customer PII, unapproved recordings or confidential contract terms in public MP4. Use redacted UI reference screenshots only with permission.
- No fabricated runtime/API calls, no false assertion of 'production ready' or verified 100% support.

## Final deliverables

1. `GRINDCTRL_Concrete_Part03_Customer360.mp4` — full narrated video **when the actual supplied Part 03 ElevenLabs audio is available**.
2. `GRINDCTRL_Concrete_Part03_Customer360.html` — animated, controllable preview with UI scenes and cues.
3. Source project/assets, master cue timeline, transcript/caption file (SRT when audio is supplied).
4. Rendered slide/frame contact sheet and QA report.
5. `EVIDENCE_MATRIX.md` — field/source mapping, verified Concrete tenant observations versus contract versus vendor docs, limitations, and permissions.
6. If supported, PPTX/PDF matching the finished visual flow; do not fake animation support in static exports.

## FINAL ACCEPTANCE STANDARD

The Sales Manager should recognize the business need visually without reading paragraphs:
- Who is calling?
- What is the customer's phone and email?
- Are they Lifestyle, Prestige, or Elite? (from a genuine approved source)
- What did the Agent write during **each previous call**?
- What note was written for the current call, and how is it retrieved later?

This is about **customer recognition and call continuity**, not generic ticket integration, speculative AI or a luxury-themed visual exercise. The result must feel Concrete-native, human, accurate, technically feasible and premium.

Execute the production and do not stop at a plan, except where actual audio or genuine system access is missing; state blockers precisely without pretending completion.
