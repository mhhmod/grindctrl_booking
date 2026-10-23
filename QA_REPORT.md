# Premium V2 — final QA

Completed 2026-10-23T10:46:44.952534+00:00. These results describe the actual delivered files, not just source previews. Media, playback, finishing and parity reports are bound to each final MP4 SHA256.

## Technical results

| Film | Video, audio and container duration | Frames | Picture | Codecs | LUFS-I | True peak dBTP |
|---|---|---|---|---|---|---|
| 01 | 150.000 s | 4500 | 1920×1080 / 30 fps | H.264 / AAC | -16.07 | -1.41 |
| 02 | 150.000 s | 4500 | 1920×1080 / 30 fps | H.264 / AAC | -16.23 | -1.45 |
| 03 | 150.000 s | 4500 | 1920×1080 / 30 fps | H.264 / AAC | -16.12 | -1.45 |

All three files decoded completely through FFmpeg with no decode errors and no detected full-black sequences. The final mux copies H.264 unchanged and encodes the authoritative mix to an exact 150.000-second endpoint. An initial playback check caught 150.016 s of AAC terminal padding; that failed intermediate is not delivered.

- Film 01: 108 encoded/HTML frame pairs; maximum mean pixel error 1.265/255. Original-voice correlation minimum 0.99493; maximum sampled alignment lag 0 samples at 44.1 kHz. Full browser playback reached 150.000s; dropped frames 0.
- Film 02: 98 encoded/HTML frame pairs; maximum mean pixel error 1.207/255. Original-voice correlation minimum 0.99324; maximum sampled alignment lag 0 samples at 44.1 kHz. Full browser playback reached 150.000s; dropped frames 0.
- Film 03: 99 encoded/HTML frame pairs; maximum mean pixel error 1.641/255. Original-voice correlation minimum 0.99495; maximum sampled alignment lag 0 samples at 44.1 kHz. Full browser playback reached 150.000s; dropped frames 0.

The standalone previews were checked at 60 seek states per film, with zero detected text clipping, no JavaScript errors, no horizontal page overflow at 390 px, and usable external controls. 28 semantic state guards passed: permission/matching gates, call continuity on lookup failure, original call-note ownership, distinct record types, conditional read-only order context, correct brand spelling and a paused reduced-motion startup. Explicit playback enables motion; reduced-motion mode is not represented as eliminating all animation while playing.

Actual encoded frame samples cover every scene boundary, scene centers, critical spoken-event cues, beginning, middle and final 30 seconds. Full natural-rate unmuted Chromium playback exercised each entire 150-second file. Initial simultaneous-render browser runs reported 9 dropped display frames for Film02 and 1 for Film03 despite complete 4500-frame encoded files. Those runs are retained as PLAYBACK_UNDER_RENDER_LOAD.json; a final playback was repeated after rendering/parity extraction stopped. The final counters above report that run without hiding the earlier measurements. Software playback is not a claim that a separate human listened to all seven-and-a-half minutes.

## Audio and subtitles

Original supplied MP3 bytes and decoded-sample inventories are preserved. Local waveform CTC forced alignment was reconciled to the approved scripts; confidence scores and actual word times are included. No new narration, speed or pitch change was made. Film01 retains 147.760 s of decoded narration; Film02 retains 144.880 s; Film03 retains 138.880 s in order. The user explicitly authorized Film03’s 11.12 s of distributed purposeful visual time, including three 2-second intervals at semantic pauses; no words were removed or reordered.

Subtitles and important UI events use the measured audio. Caption timelines are monotonic, non-overlapping and within the150-second edit. Film02 preserves the spoken article in “or a completed action.” Proper English names remain GRINDCTRL, Genesys and Zoho Desk. Timing is machine aligned with assistant transcript review, not independently human-certified pronunciation or subtitle accuracy.

## Creative inspection, separate from technical passes

Assistant visual inspection covered full-resolution style/proof frames, all 36 scene-center compositions, final encoded contact sheets, selected full-size encoded scenes, critical interaction sequences and matching before/after frames. Observed corrections include a face-preserving Try-On reveal, larger contextual UI, constrained activity expansion, explicit original-note authorship, compact handoff composition, removal of a chat-input annotation overlap, and speech-driven system/context focus in Film01. See reviews/FORENSIC_AND_CREATIVE_REVIEW.md for the specific changes.

Film01 uses manual copy/search, permitted lookup, ticket focus and fallback states. Film02 uses profile → independent call timeline → selected original note → current-call writing → later retrieval. Film03 changes to editorial garment/portrait composition, product-page interaction, photo upload, authored visual reveal, meaningful merchant-content answer and human shared-inbox handoff. This is a new Remotion production, not the prior cached SVG/JPEG-state engine. Readable record holds are intentional; motion sampling is descriptive and is not used to award a perfect creative score.

## Limits and evidence

No external user comprehension study, independent creative panel, complete human audition or Concrete tenant test occurred. The customer/call/order/product records are fictional. Genesys/Zoho UI is a vendor-informed proposed context experience, not verified tenant UI. Call-note storage, original-author retention, membership source, permissions and existing contracted URL-pop configuration still require authorized discovery. The Try-On imagery is synthetic artwork, not proof of exact fit or measured live engine output. No savings, merchant stock or operational integration is invented.

Requested websites that were blocked and Zoho's article-less application shell are explicitly recorded in research/access.json. Accessible official repository documentation and authorized local application source are distinguished in the evidence ledger. Remotion licensing and font rights are recorded in STACK_DECISION.md and the included original license texts.

The HTML embeds its image, font and audio assets. Direct file:// navigation was blocked by this managed Chromium administrator policy and was not bypassed. A local-server test allowed only the initial document request and blocked subsequent HTTP(S) assets, verifying self-contained playback; direct file opening on the recipient’s browser remains unverified here. If a browser blocks local HTML, serve the downloaded folder with `python -m http.server`.

Raw parity frame pairs remain in the working workspace to avoid an excessive archive; JSON measurements, full-resolution representative final frames, final contact sheets and before/after comparisons are included. All production sources and assets required to reproduce the films are included; node_modules, model weights, virtual environments, compiled builds, private contracts and unrelated application files are excluded.
