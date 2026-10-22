# Premium three-film production and QA

All three primary MP4s were actually rendered at1920×1080,30fps,H.264/AAC,exactly150.000seconds and4500decoded video frames.

| Film | MP3 container / decoded narration(s) | Added visual-only(s) | Timing plan | Final | LUFS / dBTP |
|---|---|---|---|---|---|
| 01 | 147.800816 / 147.760 | 2.240 | 0.240 open + 2.000 close |150.000 /4500frames|-16.06 / -1.40|
| 02 | 144.927347 / 144.880 | 5.120 | 0.120 open + 5.000 close |150.000 /4500frames|-16.22 / -1.46|
| 03 | 138.919184 / 138.880 | 11.120 | 1.120 open + 3×2.000 demo + 4.000 close |150.000 /4500frames|-16.12 / -1.40|

MP3 container duration includes encoder padding; decoded narration runtime is used for sample-accurate placement. The entire decoded recording is included; no words were trimmed to account for the padding difference. Film03’s explicit short-source exception is recorded in TIMING_DECISION_03.md.

## Performed checks

- Source MP3 SHA256 values and each decoded source interval hash checked. All original samples occur once, in order. Films01/02 each use one uninterrupted narration interval. Film03 uses the specifically authorized three pause insertions; source words/speed/voice remain intact. Whole-mix loudness/true-peak control is applied; the final music mix is not claimed byte-identical to the MP3.
- Actual ffprobe full frame decoding counted4500frames in each file, with H.264 video and stereo AAC audio of150.000seconds. Voiced source-to-export PCM windows show at most one sample lag after mixing/encoding; individual correlations and pause-cut levels are in QA_MEDIA.json.
- Each actual final MP4 was played in full from0to150seconds at natural rate, unmuted, in Chromium. Media errors, audio decoding and ending state were inspected. This is a complete **software playback check**, not a human full audition or pronunciation certification.
- 576 HTML seek states, zero visible text outside the frame. 13 meaningful state/ownership guards passed. Mobile390px has no page overflow and controls at least44px. One150-second audio clock per preview; reduced-motion rendering checked.
- 189 actual encoded frame comparisons span every main beat and spoken phrase/UI stage. Maximum mean pixel difference 0.788/255. Encoded contact sheets and important full-resolution frames visually inspected.
- Concrete guards: history not disclosed during lookup; ambiguous history hidden; manual fallback; call remains active on service failure; missing membership unavailable; pending branch review remains pending. Historical CALL-101/Maya and current CALL-102/Salma are distinct; next CALL-103 reads the original Salma note without reassignment. Call notes are separate from ticket updates and AI summaries.
- Product guards: same synthetic adult and navy overshirt; explicit fit limitation; merchant-source example answer; reasoned human handoff; named fictional assignment/private note/reply; conditional read-only order data with no edit/refund action. Added visual-only beats show actual interface steps, not blank pauses.
- English SRT and burned-in captions are based on actual source phrase recognition/pause boundaries, with obvious brand/terminology recognition errors corrected against context. No equal-duration chapter allocation or claimed certified individual-word alignment. Raw recognition is retained. There is no human certified verbatim/pronunciation audit.
- Portable source audio and HTML builds executed in a separate fresh directory. All three audio mixes and all three synchronized previews reproduced byte-for-byte; see QA_PORTABLE_SOURCE.json.

## Evidence / limitations

Official Genesys help, Concrete public identity, GRINDCTRL public product pages and Apple HIG were attempted but blocked. Zoho help returned application shells, not article bodies. Accessible official Genesys SDK/API documentation was read only for supported UI/data patterns. No tenant configuration, native screenshots, membership source, note retention/permissions or live merchant integration was verified. Proposed and illustrative labels stay visible; no deployed Concrete integration, real pilot or savings is claimed. See EVIDENCE_AND_UI_FIDELITY.md.

The project is editable code/timelines/assets. No proprietary NLE, PowerPoint or additional unrequested film is claimed. This is the new premium set, not the rejected generic marketing set.