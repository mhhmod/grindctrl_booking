# GRINDCTRL × CONCRETE — PART 02: INSIDE THE WORKFLOW
## FINAL PRODUCTION PROMPT — Build the complete narrated video now

You are the lead **Product Demo Director, Solution Architect, Genesys/Zoho integration researcher, Senior SaaS UX Designer, Motion Designer, Audio Synchronization Engineer and Video QA Lead**.

## MISSION
Produce **Part 02**, a premium, detailed, fully rendered and narrated continuation of the already approved GRINDCTRL × Concrete Part 01 video. **The FINAL ELEVENLABS MP3 IS ALREADY PROVIDED.** Do not ask for audio, synthesize a replacement voice, postpone synchronization, or produce only a plan. Inspect all assets and implement the finished video in this run.

Part 01 communicates the *idea*. Part 02 must show *how the proposed experience actually works* at employee-screen level: what the agent sees, how contact matching works, what a ticket contains, how ambiguous numbers/errors are handled, what implementation options are credible, and how a pilot would prove value.

This is a **new collaboration proposal**, not a completed GRINDCTRL deployment. The audience includes Concrete customer-service leadership, General Manager, Sales Manager, Commercial stakeholders, and IT. Make it intuitive to nontechnical people while technically defensible to IT.

## INPUT ASSETS — LOCATE AND INSPECT
- **NEW definitive narration:** The uploaded ElevenLabs Part 02 MP3, named approximately `ElevenLabs_audio_elevenlabs-v4_[calmly] في الف_2026-10-11T16_12_58.mp3`. Its measured duration is approximately **194.04 seconds (3:14)**. Locate the actual attachment instead of guessing its path. Treat the recording itself as canonical, including pauses and any deviations from written script.
- **Approved Part 01 reference video:** `grindctrl-narrated-en.mp4`, approximately **137.1 seconds, 1920×1080, 30 fps**. This is the approved LOOK AND FEEL reference, not narration to reuse.
- Part 01 HTML, PPTX, PDFs, styles, assets and any motion source code accessible in the project.
- The pre-existing Part 02 handoff package: `01_SPEECH_PART02_CONTINUOUS_AR.txt`, `speech_by_scene/S01.txt` through `S08.txt`, `02_STORYBOARD_AND_VOICE_CUES.md`, `03_EVIDENCE_AND_SAFETY.md`, `05_SCENE_MANIFEST.json`, plus prior draft `04_MASTER_AGENT_PROMPT.md`, if present. These are supporting guidance; this prompt supersedes any old instruction saying the audio has not arrived.
- Concrete/Centro Global Solutions contract PDFs, relevant briefs, and the actual authorized project/workspace assets already available to you.

Review real files before producing content. Reuse existing design components/assets where faithful. Never falsely report a file, screenshot, API, account, or real tenant configuration as inspected unless it was actually accessible and inspected.

## NON-NEGOTIABLE DELIVERY
Create the **finished, narrated Part 02 video**, not just scripts or mockups. Also deliver an editable source, browser preview, exact cue timeline, and verification report. If an output format is genuinely unsupported, deliver the other formats and explain the specific limitation. Do not defer all work because an exact tenant UI screenshot is unavailable: use a clearly illustrative, vendor-informed interface and document that limitation.

## STEP 1 — REVERSE-ENGINEER PART 01 VISUALLY
Inspect the approved MP4 at multiple moments, plus its available source files. Determine:
- Overall composition, colors, typography, GRINDCTRL branding and logos.
- Light warm-white/off-white palette, charcoal text, subtle accent and restrained enterprise styling.
- UI panel proportions, rounded corners, borders, elevation, spacing and visual focal points.
- Camera framing, transitions, motion easing, pacing and information-reveal strategy.
- Placement of disclaimers and hierarchy of title versus UI.

**Part 02 must visibly belong to the same video series.** Preserve design language and motion grammar but do NOT simply recycle 7 generic Part 01 screens or stack equal-weight cards. This installment should feel closer to an actual product walkthrough, with zoom-ins on relevant, realistic software UI.

Light theme only across every frame, including opening and closing. No flashy cinematic transitions, noisy backgrounds, black cards, huge titles, irrelevant dashboards, or abstract filler animations.

## STEP 2 — EVIDENCE-FIRST REALISM
Read the actual relevant Concrete contracts and project context carefully. Distinguish:
1. `REPORTED BY CUSTOMER`: Agents receive calls through Genesys; manual search using phone in Zoho Desk finds past tickets; the desired auto-appearing context was not visible in the reported workflow. These observations are not a verified live diagnosis.
2. `CONTRACTED`: The November 2023 contract PDF p.4 lists **"CRM URL pop up integration"**. This does NOT prove the integration is working now. Other contract scopes cannot be assumed deployed.
3. `OFFICIALLY DOCUMENTED`: Current Genesys/Zoho features available in the relevant software in principle, NOT necessarily enabled/licensed/configured for Concrete.
4. `ACTUALLY INSPECTED`: Verified tenant screens/settings ONLY if access is explicit and authorized.
5. `PROPOSED`: The future caller-context flow and its UX behavior.
6. `UNKNOWN`: Live workspace, exact screen-pop target, search/permissions, call events, number formatting, latency, licensing, branch fields, API access, performance.

Use the official Genesys Cloud CX and Zoho Desk documentation to verify modern product UI/behavior and supportable display options (screen pop, script, URL window, native interface). If authorized/anonymized Concrete screenshots exist, prioritize them over generic public UI. Do not access a tenant using inferred permission from contracts, and do not display actual PII, credentials, confidential contract prices or logs.

**Critical UX fidelity:** The actual proposal might use a separate URL pop-up/tab instead of an embedded sidebar. Do NOT fabricate a guaranteed native sidebar. Use the display style supported by inspected evidence; if still uncertain, label the UI `Illustrative proposed experience` and avoid presenting an invented panel as what Concrete already sees.

Create an internal evidence matrix before committing technical visuals. Do not clutter the film with research tables; keep detailed evidence in a separate report.

## STEP 3 — BUILD A SINGLE CONTINUOUS EIGHT-SCENE STORY
Keep one persistent fictional reference call/customer: `Contact A`, masked phone `+20 ••• 410`, exchange follow-up ticket `T101`. Use consistent ticket records across scenes. For multiple matches, introduce a second *fictional* candidate. Make all mock data synthetic.

### SCENE 01 — THE DEEP DIVE OPENS
**Spoken cue:** "في الفيديو الأول ... المرة دي، خلينا ندخل جوه الـWorkflow نفسه".
**Primary visual:** Transition elegantly from the familiar Part 01 call/context composition into a larger, realistic agent workspace. Keep the active call visible. The viewer immediately recognizes this is *inside the same proposed solution*, not a new sales pitch.
**Takeaway:** "Now we see exactly what happens." A discreet `Illustrative proposed workflow` label, no overwhelming intro card.

### SCENE 02 — GENESYS CALL / PHONE LOOKUP
**Cues:** "أول ما الـCall تتوزع"; "Lookup Key"; "Matching"; "هوية المتصل".
Show the call reaching the agent, the available caller number, and how an allowed lookup candidate is formed. If useful show two fictional equivalent phone formats merging, clearly distinguish candidate matching from identity verification. Use one intelligent camera move focused on the caller area and a visible, traceable lookup event. No fake actual API endpoint or "verified customer" badge from phone match alone.

### SCENE 03 — WHAT EXACTLY APPEARS FOR THE AGENT
**Cues:** "Customer Record واضح"; "Previous Tickets"; "Status"; "Assigned Agent"; "آخر Update"; "يختار الـTicket".
Present a polished, realistic, legible contact-and-ticket view, using the appropriate verified or illustrative surface (supported screen pop/tab/panel). Include only relevant fields: contact candidate, prior tickets, status/assignee where available, latest recorded update, selected ticket. Make relationships spatially evident. Avoid irrelevant dashboards, fabricated metrics, tiny labels, and random floating pills. Keep call and context connected.

### SCENE 04 — OPEN T101 / EXCHANGE FOLLOW-UP
**Cues:** "Exchange Request"; "بنفتح الـTicket"; "الـNote بتقول"; "مش شرط تكون اسم الـStatus نفسه".
Zoom into the selected synthetic ticket `T101`. Show the ticket's status FIELD separately from the `Latest Note: Branch review is still pending.` Illustrate the agent reading the last note and using that information for follow-up. **Do not** falsely change status to "Pending Branch Review", auto-close the ticket, approve an exchange, issue a refund, or invent an agent action.

### SCENE 05 — MULTIPLE MATCHES / SAFE SELECTION
**Cues:** "أكتر من Customer"; "Possible Matches"; "يحدد الـRecord الصحيح".
Keep the active call in view, show two candidate contact records associated with one number. Do NOT automatically reveal either candidate's private full ticket history. Show the agent selecting the permitted correct record after the client-defined verification process. Demonstrate recognition of uncertainty and human control; do not visually imply that caller ID authenticates identity.

### SCENE 06 — NO MATCH IS NOT A FAILURE
**Cues:** "أول حالة"; "Manual Search"; "تاني حالة"; "Service Unavailable"; "المكالمة نفسها تكمل".
Show two visually distinct lookup results using the *same credible agent interface*: `No matching customer` after successful lookup versus `Lookup unavailable / Retry` after timeout/error. Both preserve the active call; manual fallback remains available when supported. Do not show an outage as `No Tickets Found`. No automatic ticket creation. This should be a visually striking and instantly understandable exception-handling sequence.

### SCENE 07 — REALISTIC IMPLEMENTATION APPROACH
**Cues:** "Screen Pop"; "Configuration"; "Native Features"; "Integration Layer"; "Permissions".
Switch briefly from UI to a clean, restrained architecture/decision visual **only now**, after users understand the product experience. Show `Inspect current Genesys/Zoho setup` → `Use supported native configuration if sufficient` OR `Add minimal approved adapter only if necessary`. Illustrate the read-only first scope and permission boundaries. Present this as a proposed implementation decision, not a guaranteed already-deployed GRINDCTRL backend. The call must never auto-change ticket status merely from arriving.

### SCENE 08 — HOW THE PILOT PROVES THE VALUE
**Cues:** "Pilot"; "Manual Search"; "هنقيس عدد الخطوات"; "Matching"; "Errors"; "القيمة الفعلية".
Compare the current manual search workflow with the proposed caller-context workflow using the same synthetic example. Show **measurement methods**, not made-up measured results: number of manual interactions, time to usable accurate data, correct matching, permissions, ambiguous/unknown numbers, degraded availability/fallback. Label all values as `To measure during pilot` until measured. End with a concise, confident GRINDCTRL × Concrete signoff matching Part 01 and the next real step: authorized configuration review + test calls.

## STEP 4 — ACTUAL AUDIO IS THE MASTER TIMELINE
The uploaded Part 02 MP3 is a **single continuous, finished recording** (~194.04s). Do not regenerate it. Do not force 8 equal scene durations, do not cut mid-word/sentence, do not speed it up and do not pad the video to arbitrary length. Final runtime should track the actual recording plus at most a very short intentional intro/outro hold, if needed.

Implement:
1. Load the MP3 and inspect real duration, sample rate, channels, encoding and audible start/end.
2. Align the actual audio to the supplied Egyptian-Arabic mixed-English script using reliable word/phrase alignment, audio listening, or manual cue verification. If words differ between script and recording, **audio wins**. Do not invent exact timestamps.
3. Determine true starts/ends of scenes S01–S08 at natural speech boundaries. Create `cue_timeline.json` with scene in/out and phrase-level triggers.
4. Animate *in sync with meaning*: e.g. on "Previous Tickets" reveal list, on "Note" focus the note, on "Possible Matches" reveal two candidate cards, on "Service Unavailable" replace result with failure state. Avoid visually revealing the answer before it is narrated.
5. Keep enough hold time to read crucial details; use the actual narrator's pauses for camera moves and layout transitions.
6. Video audio must be intelligible and uninterrupted. No background music by default; no overlapping narration; no transition swoosh masking the narration.
7. Support natural Arabic TTS pronunciation and English workplace words. On-screen native enterprise UI may be English. Captions are optional but if provided, correctly handle Arabic RTL and English code-switching, align them to actual audio and never cover key UI.
8. HTML preview should have functioning play/pause, replay, mute, progress and scene jump controls. A jump seeks to the correct audio and animation state, not merely skips the graphic while audio continues. Playback should remain synchronized after pause, resume, seek, and scene change. Respect reduced motion.
9. Use a single master clock for audio and animation when possible; validate actual encoded MP4 timeline versus MP3 and check for drift throughout.

## STEP 5 — VISUAL / PSYCHOLOGICAL QUALITY STANDARD
Design around Gestalt grouping, one focal point per spoken beat, high-information visual scenes, visual hierarchy, spatial continuity, progressive disclosure and meaningful cause/effect motion. It must pass:
- **3-second glance test:** a nontechnical viewer can infer the situation or change from the scene without reading paragraphs.
- **Squint / thumbnail test:** a strong dominant focal point and clear grouping.
- **No-text test:** the central story still works when most explanatory copy is hidden.
- **Static pause test:** a single frozen frame is understandable without requiring motion.

Use light theme only. Avoid excessive whitespace that makes demos too small, or dense UI that becomes unreadable at 1080p. Prefer useful screen closeups to cartoon cards. Design continuity with Part 01 is mandatory, but Part 02 must go substantially deeper with credible agent-level UI.

## STEP 6 — NO OVERCLAIMS OR UNSAFE REAL DATA
- Contracts are not proof of live feature operation.
- Zoho Desk is the reported ticket system; do not assume Zoho CRM is active.
- Caller number match is not identity proof.
- Manual phone search in the UI does not prove a permission-equivalent supported API search.
- Only permitted data is revealed; synthetic data in all footage.
- `Ticket Status` and `Latest Note` are separate fields/concepts.
- No automatic close/open/reassign/refund/create ticket or call linking unless expressly approved; don't include these in this first-scope video.
- Do not invent response time, savings %, ROI, CSAT, contractual misconduct, active vendor licences, live performance, or a fully implemented integration.
- If tenant-specific UI is not verified, label the footage as an illustrative proposed workflow; show vendor-inspired UI rather than pretending to reproduce internal Concrete screens exactly.
- Keep the permitted solution operationally conservative, testable and technically compatible with whatever actual vendor configuration is confirmed.

## STEP 7 — DELIVER COMPLETE OUTPUTS
Primary deliverables, prioritized:
1. **`grindctrl-concrete-part02-narrated.mp4`** — FINAL playable H.264/AAC Full HD 1920×1080, ideally 30fps, with the uploaded actual narration and synchronized motion.
2. **`grindctrl-concrete-part02-animated.html`** — polished interactive, audio-synchronized preview with working controls.
3. The source project needed to update visuals and timing without redoing the entire film.
4. **`part02-cue-timeline.json`** with ACTUAL audio cue timestamps and scene boundaries.
5. **`part02-evidence-matrix.md`** distinguishing reported, contracted, vendor-documented, inspected and proposed facts, including citations/links and remaining unknowns.
6. **`part02-ui-fidelity-report.md`** with accurate statement of whether Concrete's actual user interfaces were inspected or only public vendor references were used.
7. Editable **PPTX** and static **PDF** versions where supported; clearly state if native PowerPoint animations/audio cannot faithfully match HTML video.
8. **`part02-qa.md`** documenting video/frame checks, visual continuity, Arabic/English rendering, UI field correctness, scene pacing, final audio quality, measured A/V drift, privacy, and false-claim review.

## STEP 8 — FINAL QA (REQUIRED)
Actually render, inspect and correct the video. Review representative still frames for all 8 scenes and critical animated states, and inspect the exported MP4 with audio playing. Confirm:
- 8-scene storyline and correct order.
- Final MP4 is complete, opens, has audible narration, and includes the entire user-provided audio without truncation.
- Spoken phrase triggers and screen changes align, including near the very end (no accumulated drift).
- Correct same-customer/same-ticket continuity.
- Ticket note never misrepresented as ticket status.
- Proper distinction between no match, multiple matches, and lookup failure.
- Realistic supported presentation surface, or clearly marked illustration when unverified.
- No real PII or credentials; no invented statistics, deployments or entitlements.
- No off-screen graphics, broken fonts, inaccessible audio controls, misaligned elements or dark slides.
- Overall visually and stylistically consistent with Part 01.

If any verification cannot be performed, report it precisely instead of claiming a pass. Do not stop after writing plans, audit tables or a storyboard. Execute the production and deliver the actual film to the fullest extent the available environment supports.

**SUCCESS CRITERION:** After Part 01, viewers say "I understand the idea." After Part 02, viewers say "I understand what the agent will see, what happens when records match or don't match, what the implementation depends on, and how we'll prove it works." Make the video feel like a focused, credible SaaS product walkthrough inside Concrete's familiar customer-service workflow, not a generic technical pitch.
