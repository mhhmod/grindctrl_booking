# Part 03 — Customer 360° Call Experience: Storyboard

**Relationship:** Follows the approved GRINDCTRL × Concrete Part 01/Part 02 presentation language. The customer identity, segment, and per-call notes are the new focus. This is a *proposed* employee experience, not a claim that the integration is live.

**Format:** 1920×1080, light theme only, ~3–4 minutes; actual timings MUST be derived from the ElevenLabs MP3 once supplied. Avoid fixed precomputed timestamps. Narration segments are 8 paragraphs in `01_ELEVENLABS_SPEECH_EGYPTIAN_AR.txt`.

| Scene | Narration opening | Primary visual / event | Must not imply |
|---|---|---|---|
| 01 — Recognize the caller | تخيلوا أول ما الـCall توصل | Existing Part 01-style Genesys call appears; the customer profile panel is initially empty and progressively gains context | This is an already-live GRINDCTRL–Concrete integration |
| 02 — Identity & contact | أول ما المكالمة تدخل | Number becomes a search key; customer name resolves only after candidate match. Phone and optional email visible in one profile header | Caller ID proves identity, or unknown name can be inferred |
| 03 — Icons Club segment | وفي نفس الـCustomer Profile | Zoom to the real-world tiers Lifestyle / Prestige / Elite; in sample, an ELITE label appears next to the fictional contact name; show source/freshness subtly if supported | Membership is guessed or every contact has a tier |
| 04 — Per-call activity | بس الأهم من بيانات العميل | Expand customer Call Activity timeline. Three fictional entries ordered newest-first; each one has date/time, direction if supported, agent if available, and its OWN note | Every historical call is retained, logged, linked and accessible forever |
| 05 — The earlier note | خلينا ناخد مثال | Select a specific previous exchange follow-up call; open the full note; highlight `Branch review requested` as a recorded agent note, not a completed action | The branch actually reviewed the request without evidence |
| 06 — Current-call note | وخلال الـCurrent Call | In the current interaction's notes area, agent writes a new note; show proper relationship to interaction ID and save state only if supported; next-call view shows that note linked to its source call | Automatic cross-system syncing, generated transcripts, or automatic ticket updates |
| 07 — Safe exceptions | طيب لو حصل No Match؟ | Compact four-state demo: one candidate, multiple candidates, no candidate, lookup unavailable; handle missing email or tier as not available | Wrong-customer leakage or turning service outage into `No calls` |
| 08 — Feasible approach & pilot | علشان ننفّذ الفكرة صح | Existing Genesys/Zoho screen references and Icons Club source -> evaluate native capabilities -> smallest supported integration -> permitted test calls -> QA of records and notes | A committed vendor API, integration license, customer access or measured ROI |

## The hero employee UI (conceptual, refine from real screenshots)

- **Call rail:** Genesys ongoing voice interaction, number and call controls consistent with verified tenant edition.
- **Customer identity region:** Name; mobile/phone; customer segment from identified Concrete Icons Club data source; email if available; clear record-match confirmation state.
- **Call Activity timeline:** Chronological call events with exact association to source interaction, time, source system, agent where known, and note text or note indicator. Expand/collapse an individual call.
- **Current interaction note area:** Agent-typed notes during/after call. Show whether it is draft/saved/read-only honestly, based on verified capability.
- **Safe fallbacks:** Permission guard; missing email; missing tier; multiple matches; caller ID withheld; history unavailable; unlinked legacy calls.

## Design brief for the Sales Manager

The visualization should feel like a **familiar Concrete employee screen**, not a generic futuristic dashboard. Use a brand-level Concrete frame (premium editorial minimalism, generous white/warm-ivory, charcoal, understated accents), while keeping the operational Genesys/Zoho surfaces and their navigation recognizable. Do not invent a proprietary Concrete UI. Inspect actual screenshots if authorized. If screenshots are unavailable, use vendor-grounded illustrative UI and label it. Do not borrow competitors' unrelated loyalty-card visuals.

- Physical human eye path: active call -> customer name + membership -> recent call timeline -> individual call note -> new note.
- Each animation has a causal trigger tied to the actual audio phrase.
- No giant headlines / no chain of abstract icons / no four equal cards / no invented real customer data.
- Keep the customer profile header visible across scenes 02–06 to preserve continuity.
- UI should not show a ticket unless a ticket-related call is explicitly selected; per-call notes are the core.

## Sample synthetic customer fixture

- Name: Ahmed M. (DEMO); number: +20 10 •••• 4821; email: ahmed@example.com; segment: ELITE (illustrative).
- Historical interaction A: `08 Oct` — Inbound, Agent A; Note: `Followed up on the exchange. Branch review requested.`
- Historical interaction B: `03 Oct` — Inbound, Agent B; Note: `Customer requested a size exchange.`
- Historical interaction C: `26 Sep` — Inbound, Agent C; Note: `Customer asked about product availability.`
- New interaction D: current date in the demonstration, not falsely assigned a real production time; Note: `Customer called again; awaiting a confirmed branch update.`
- Same interaction identifiers/note contents must be consistent whenever shown.

## Success checks

A non-technical Concrete Sales Manager should be able to see these without narration: (1) caller recognized conditionally; (2) phone, name, membership tier and optional email grouped; (3) individual calls each have their own associated note; (4) a new note is added to the current call; (5) a later agent can inspect that recorded note, subject to linking and permissions. Create a no-text and squint-test storyboard before production.
