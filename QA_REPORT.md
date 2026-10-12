# Part 03 — production and QA results

The complete new film was rendered, corrected and inspected. The primary English-visual MP4 and Arabic-visual variant both contain the final supplied Arabic Part 03 recording. The eight scenes demonstrate customer recognition, phone/name, Icons Club/optional email, individual-call history, an original earlier note, a new human note and later retrieval, safe exceptions, then source review/pilot and the employee hero.

## Encoded media and audio preservation

- Each film: **H.264/AAC, 1920×1080, 30 fps, 8,585 frames**.
- MP4 container/video runtime: **286.166667 seconds**; audio: **286.160 seconds**. The 6.7 ms difference is 30 fps frame quantization, not an added narrative hold.
- Original MP3 container: 286.197551 seconds. Full decoded master: **12,619,656 mono samples at 44.1 kHz = 286.160 seconds**. The container/decoded difference is encoder metadata, not omitted words.
- Original source SHA-256: `0fd419e6f6bbed75c4bb2e0e3747b3fc3ab5f9b2864b577c4c95bcb95fe70d01`. The MP3 is unchanged in HTML, both PowerPoints and the delivery source. AAC is a lossy encoding of the entire decoded recording, with no replacement voice, cuts, stretching or music.
- Both encoded videos fully decoded through the ending. Audio sample coverage is the full 286.160 seconds in both.
- Source/encoded PCM cross-correlation at 0, 40, 65, 101, 141, 169, 189, 218, 249, 280 and 283 seconds: **maximum best-lag 0.0 ms**, minimum zero-lag correlation **0.9998917**. These are transfer/drift measurements, not certified word-level alignment.
- Source peak 0.328709 (-9.66 dBFS), RMS 0.027302; the source is not clipped and its level is retained.
- Both final encoded files played **unmuted** in Chromium at eleven seek positions, including 285.5 seconds through ended=286.16. Video frames and audio decoded bytes advanced with no media errors. This is software playback inspection; no human auditory quality rating is claimed.

## Actual narration and motion

The MP3 expands the handoff’s intended script, including the earlier-video recap and after-call saving. It was not forced into the handoff’s estimated duration. 119 measured speech intervals and contextual Arabic/mixed-English recognition establish the eight natural scene starts:

| Scene | In | Out |
|---|---:|---:|
| S1 — Recognize the caller | 0.000000 | 39.718526 |
| S2 — Identity/contact | 39.718526 | 62.166757 |
| S3 — Icons Club | 62.166757 | 83.109660 |
| S4 — Per-call activity | 83.109660 | 117.618322 |
| S5 — Earlier call note | 117.618322 | 160.266440 |
| S6 — Current note/later retrieval | 160.266440 | 195.552789 |
| S7 — Exceptions | 195.552789 | 219.327483 |
| S8 — Validate/pilot/employee hero | 219.327483 | 286.160000 |

The cue JSON/CSV also maps 77 visual state boundaries, note ownership and typing envelopes. Detailed events use actual measured phrase starts/ends; no invented exact word timestamps or equal scene durations. Raw ASR offsets from silence-padded analysis windows are local recognition metadata and are not global animation authority. Arabic captions/transcript are normalized ASR assistance, with human subtitle review still recommended.

Typing runs during the actual current-note explanation (165.234–172.306). After-call state follows its spoken cue; Recorded (DEMO) appears after the saving phrase. The later call begins at its actual narration cue, and the original note is retrieved with its source/author retained. The supplementary lookup-unavailable visual accompanies the general data-truth phrase, without falsely transcribing “service unavailable” as spoken there.

133 chapter/phrase/out-of-order seeks rebuild the correct audio/visual state. Real playback, pause freezing text entry, resume, replay, mute, chapter jumps, phrase stepping, visual-language continuity and reduced motion were tested. All event/static/typing states in both languages have **zero detected text overflow and zero JavaScript errors**. At 390 px, controls are at least 42 px high, body overflow is absent and the enlarged scene pans.

## Call-note ownership and exception checks

The fixture/model and interactive offline UI were exercised. Seven meaningful scenario groups cover:

1. The 08 Oct/03 Oct/26 Sep interactions retrieve only their own human notes and authors.
2. Active/after-call note saving stays under **demo_interactions::DEMO-1012 / Agent D**. The later **DEMO-1015 / Agent E** reads that original record without copying it or replacing its author. Wrong interaction, empty note and invalid timestamp writes are blocked.
3. Shared-number candidates disclose no history before agreed verification/selection. Customer B never receives customer A’s history.
4. No match, unavailable lookup and withheld number are distinct; the active call continues.
5. Missing email/tier stay unavailable. Unavailable, denied, partial/unlinked and empty retained history are distinct. Unlinked/unretained/denied notes are not returned.
6. Denied note writes are blocked; synthetic transfer retains canonical interaction and earlier authors. This is not verification of vendor transfer behavior.
7. Compound source/interaction keys prevent source collisions for reads/writes. A future new note gets its own future interaction/timestamp, while the earlier note remains unchanged.

Visible browser assertions confirm name/phone/segment/email timing, each history note’s interaction tag, original 08 Oct/Agent A note, demo Draft/Recorded states, later Agent E viewing Agent D’s note and its original note timestamp, hidden candidate histories, missing fields, distinct lookup failure and the final hero. The actual sandbox additionally checks selection, empty-note rejection, current save, future retrieval and denied/unavailable cases.

These are **offline synthetic logical/display checks**, not real tenant authorization, permissions, retention, identity verification or vendor integration tests.

## Render inspection and fidelity

**84 encoded frames** across both visual languages were compared with their exact 30 fps HTML states, including typing, save, future transition, every scene and the last frame. Maximum mean absolute pixel difference: **1.157/255**, consistent with H.264/chroma conversion. Full-resolution actual encoded frames and eight-scene contact sheets were visually inspected. A label overlap in the later-call transition was found and corrected; both movies were re-rendered and rechecked.

The original prescribed note wording, customer, masked phone, reserved email, tier label, source keys, owners and synthetic timestamps stay consistent. The branch-review request is not presented as confirmed completion. No ticket history/status, global customer note, AI summary, transcript, past-call recording, automatic Zoho sync, fabricated results or already-running deployment is represented.

All scenes use the approved Part 01 light palette, supplied mark/fonts, restrained borders and motion. Thumbnail, blurred/squint, no-text and static-frame reviews test hierarchy as heuristics; they are not an external user study or a guaranteed three-second comprehension threshold. Exact tier, date, note content and source identity necessarily use their small labels.

English/Arabic PDF and editable native PowerPoint each have **twelve static pages**: eight main scenes plus current note entry and three complementary exception states. Both PPTX files were reopened, bounds/audio hash checked, and rendered with LibreOffice/bundled fonts. Native English/Arabic layouts were visually inspected. Full native Microsoft PowerPoint animation/audio behavior is unverified and is not claimed equivalent to HTML/MP4.

The disabled later-capture manifest and its approval/anonymization/timing/camera-layer hook were tested with a synthetic image fixture. No real client capture was used.

## Evidence limitations

No authorized Concrete tenant/screens/settings, real field source, loyalty data, note storage, permissions, contact linkage or retention were inspected. Concrete and Genesys help pages were proxy-blocked; Zoho returned empty shells. The accessible official SDK establishes only general integration principles. Consequently UI/source/save behavior is explicitly illustrative, and the native-first/conditional minimal-bridge decision remains open until authorized review and pilot calls.

No human full listen-through, certified verbatim/word alignment, external participant comprehension study or Microsoft PowerPoint audiovisual playback test was performed. These limitations are not counted as passes. The documented evidence is actual source/semantic ASR, waveform boundaries, unmuted software playback, full decoding, PCM comparisons, rendered-frame inspection, static export checks and offline model/UI tests.
