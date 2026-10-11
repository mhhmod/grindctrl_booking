# Part 02 — verification results

The full eight-scene film was rendered and inspected. The primary English-visual MP4 and alternative Arabic-visual MP4 both use the supplied final Arabic voice. HTML is self-contained and uses audio.currentTime as the sole playback clock. The master prompt was read in full.

## Actual encoded media

- H.264/AAC, **1920×1080, 30 fps, 5,820 frames, 194.000 seconds** in each MP4.
- Original MP3 container: 194.037551 seconds; decoded source: **8,555,400 mono samples at 44.1 kHz = 194.000 seconds**. The container difference is not omitted spoken content.
- Complete source audio coverage in both films. No edits, time stretching, synthesized replacement, music or overlapping narration. The original MP3 is byte-identical in HTML, both PowerPoints and the delivered source master.
- Source SHA-256: `3839fb67298c6c043b91683d20083349130500554a5978313639edc3f04ccf78`.
- Every encoded video frame decoded successfully through the end.
- PCM cross-correlation at source positions 0, 24, 47, 73, 96, 122, 145, 169, 188 and 191 seconds: **maximum best-lag 0.0 ms**, minimum zero-lag correlation **0.9998873**. This measures transfer/drift relative to the source; it does not certify exact word alignment.
- Source peak 0.333225 (-9.55 dBFS), RMS 0.028738. The supplied master is not clipped. Narration was kept at its original level.
- Both final MP4s played **unmuted** in Chromium at nine seek positions, including 193.5 seconds through ended=194. Audio decoded bytes, video frames and media readiness advanced without errors. This is software playback verification, not a human auditory quality rating.

## Synchronization and state behavior

82 actual speech intervals were segmented from source PCM pauses and checked with local Egyptian-Arabic/mixed-English ASR; additional contextual recognition clarified short fragments. Eight unequal scenes begin at 0, 22.309478, 45.488050, 70.104172, 94.097846, 117.093061, 142.326961 and 165.313265 seconds. They finish with the complete recording at 194.000.

The cue sheet includes semantic descriptions, retained raw ASR, actual phrase bounds and 76 visual state boundaries. Raw ASR segment offsets from padded analysis windows are not global film timing and are not used for animation. No estimated word timestamps or equally divided scenes are presented as measured alignment. Visual entrances use 350 ms easing, unrelated to real service latency.

96 chapter/phrase/out-of-order seek destinations reconstruct the correct scene directly from audio time. Browser tests verify playback across a scene boundary, pause/freeze, resume, replay, mute, scene jumps, phrase stepping, language continuity and reduced motion. All event/static states in both languages have zero detected text overflow and zero JavaScript errors. At 390 px, controls remain at least 42 px high, the body has no horizontal overflow, and the enlarged UI can be panned.

60 decoded MP4 frames were compared with their exact 30 fps HTML render states across all scenes, key disclosures and the final frame. Maximum mean absolute pixel difference: **1.627/255**, consistent with lossy H.264/chroma conversion. Full-resolution and contact-sheet frames from both actual encoded videos were visually inspected, including the final signoff.

## Workflow and accuracy checks

- Same synthetic caller/Contact A/T101 throughout; only the shared-number scene introduces fictional Contact B. No real records or identifiers.
- T101 status remains **Open**. **Branch review is still pending** is a separately labeled recorded note, never a status value. No refund, exchange approval or ticket mutation is shown.
- Candidate records are shown without either ticket history; history appears only after the selection/verification phrase. Phone association is never labeled identity authentication.
- Successful no matching customer and lookup unavailable/error are separate states. The call stays active. An unavailable service is not “No Tickets Found”; usual follow-up is retained and manual search is conditional on availability.
- Implementation first inspects the existing contracted URL pop-up and actual configuration. Native configuration is preferred if sufficient; a minimal approved adapter is conditional on a verified gap. Permissions and read-only first scope are explicit.
- Pilot values say **To measure**. No fabricated savings, latency, baseline, ROI, CSAT or results.
- All frames use the Part 01 light palette, supplied branding and Manrope/IBM Plex Sans Arabic. A mixed Arabic/phone-number label found during native inspection was corrected and the Arabic film re-rendered.

## Static, editable and fidelity outputs

English/Arabic PDFs each have ten pages: eight main scenes and two complementary no-match/selected-record states. The static PowerPoints contain native editable shapes/text, speaker/cue notes and the unchanged original MP3. Native bounds/audio hashes were checked; both PPTX files opened and rendered with LibreOffice using the bundled fonts. English/Arabic native renders were visually inspected. Microsoft PowerPoint audiovisual playback was not available, and the static decks are not claimed to reproduce HTML animation.

The future UI-fidelity manifest is disabled and contains no tenant captures. Its approval/anonymization guard and timed camera-layer insertion/reset were verified with a synthetic image fixture.

Thumbnail, blurred/squint, no-text and static-frame review were performed as design heuristics. The persistent call, selected source note, two candidates, warning/retry and manual-versus-context comparison remain distinct. Exact ticket status or exception meaning still needs its small label. These reviews are not an external participant study or a guaranteed comprehension threshold.

## Explicit limitations

No Concrete tenant, authorized native screenshots, API access or configuration was inspected. Official Genesys UI help was blocked; Zoho help returned shells without article content. Accessible official SDK references establish only general mechanisms. Thus the UI remains clearly illustrative and the actual display/search/permission behavior must be validated in the proposed authorized review/pilot.

No human full listen-through, certified verbatim/word alignment, external comprehension test or Microsoft PowerPoint playback test was performed. Evidence is the full-source ASR/semantic review, waveform segmentation, unmuted software media playback, decoded-signal comparison, frame inspection and the automated state/layout checks described above. These limits are not recorded as passes.
