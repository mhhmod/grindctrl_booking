# Part 03 rebuild — concise evidence-based QA log

## Delivered media

- Freshly rendered English-label / Arabic-narrated MP4: **1920×1080, 30 fps, 8,609 frames, 286.966667 seconds**.
- Whole replacement narration: **286.96 seconds / 12,654,936 decoded samples at 44.1 kHz**. MP3 container duration includes encoder padding and is 287.007347s.
- Audio source SHA-256: `167b0508b8f6f53bdfa4a4fc0b240a841c9436c10fd3484bbb6b8e768de5e1ad`. User explicitly confirmed the new attachment is authoritative. Rejected old audio is excluded.
- Self-contained synchronized HTML; editable PowerPoint and static PDF, 14 reference pages each (8 principal scenes + 6 complementary states), plus source, cue map, storyboard, draft SRT and evidence ledger.

## Checks performed and passed

| Check | Actual result |
|---|---|
| Audio preservation | Original MP3 bytes match the source, HTML and both PPTX embeddings. No word edits, replacement speech, speed changes, gain changes, music or effects. MP4 uses standard AAC encoding. |
| Full duration and decoding | Every frame decoded successfully through the final frame. Encoded audio covers the entire source, including the final sentence. |
| Audio timing | **19** decoded PCM window comparisons, including 257, 263, 269, 275, 281 and 284 seconds. All best lags **0 samples**; minimum correlation **0.9998771**. No detected source-to-MP4 timing drift. |
| Source clipping | Source peak 0.336905; 0 near-full-scale clipped samples. This is signal evidence, not a perceptual quality certification. |
| Visual timing | **120** measured source phrase intervals; **59** visual-change boundaries at measured phrase onsets/ends. Eight unequal chapter durations. Not a claimed certified individual-word alignment. |
| Actual encoded pictures | **108** MP4 frame comparisons against HTML at identical frame/30 time. Maximum mean pixel difference **1.925/255**, consistent with H264 encoding. All eight scenes, note typing, selection, fallback and ending sampled. |
| Browser playback | Unmuted encoded MP4 played at **13** sampled positions and reached its real ending without media errors. Video and audio decode counters checked. No human hearing/listening claim. |
| HTML runtime | **378** English/RTL seek states; **0** text-overflow findings. Narration clock, pause freeze, replay, step controls and reduced-motion note rendering passed. |
| Ownership | Six explicit rendered source/author/current-call checks. Historical calls 1008/A and 1003/B remain separate. New note belongs to 1012/D. Later active call 1015/E reads original 1012/D note. No global merge or rewritten author. |
| Safe states | No match, shared phone, missing fields and lookup unavailability retain active call/manual path. Shared-phone state discloses no candidate call notes. Permissions are conditional, not a claimed tenant configuration. |
| Offline demo model | Seven scenario groups passed: source-scoped ownership, match/disclosure guards, permission/retention cases, valid/invalid writes, original author, future retrieval and synthetic transfer behavior. No live vendor backend tested. |
| Static references | Browser PDFs and native PPTX references exported; fonts and representative rendered native pages inspected. Primary scene states + current-note, exception, source-inspection and pilot appendices. Main film has no burned subtitles; the separate SRT is draft. |
| Responsive controls | 390px English/RTL body width stays 390px; visible buttons at least 42px. Enlarge supports detailed scene viewing. |
| Later UI fidelity | Unapproved fixture refused; explicitly approved/anonymized synthetic replacement installed in its timed camera region and reset correctly. No actual tenant screenshots supplied. |

## Rendered inspection

Reviewed approved Part 01/02 actual reference frames, eight major new scenes, note-entry and original-note selection frames, failure/shared-number states, implementation source inspection and the last 30 seconds. Correct GRINDCTRL artwork and spelling, light theme throughout, readable profile fields, original call ID/agent ownership and a full employee-workspace ending. No title-only outro, fabricated performance metrics or live connector claim.

Thumbnail, blur/squint and text-hidden captures were generated as internal composition heuristics. They show a persistent call/profile relation, distinguish the history list from selected note, and separate candidate states. Exact values and source ownership still require UI labels. This is not an external user-comprehension test or scientific pass threshold.

## Limitations kept explicit

- No human full listen-through, Arabic-English pronunciation audit, ElevenLabs voice/model confirmation or individual scene approval records were available. Context ASR recognizes a form of “Grind Control” in the ending; that is **not** a pronunciation signoff. The full new source is preserved as the user requested.
- The new recording follows the earlier expanded wording, not the corrected TTS chapter wording in the ZIP. The discrepancy was disclosed and the user chose this exact MP3. Only one master was supplied; separate corrected S01–S08 audio files are not fabricated.
- Captions/transcript are **ASR-assisted draft**, with raw recognition/context retained. Mixed-language terms and the current-call phrase remain candidates for human review. There is no certified verbatim or individual-word forced alignment.
- No authorized Concrete screens, operational access, source data, membership mapping, real note schema, retention or role configuration verified. Vendor help articles were blocked/unusable; accessible official SDK references establish only documented API/UI scopes.
- No native PowerPoint playback/choreography test in Microsoft PowerPoint was performed. Native files are editable static references with original audio attached; HTML/MP4 are the checked synchronized masters.
- No pilot, real user test, measured savings or real system writes took place.

Source reports: `qa/media-validation.json`, `qa/html-validation.json`, `qa/video-validation.json`, `qa/frame-comparison.json`, `qa/pdf-validation.json` and `EVIDENCE_AND_UI_FIDELITY.md`.
