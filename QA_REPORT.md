# GRINDCTRL — final production QA

Three separate completed English marketing films. Each is exactly 150.000 seconds, 4,500 frames, 1920×1080 at 30fps; H.264 video and AAC stereo audio.

## Measured final outputs

| Film | Source MP3 container / decoded speech (s) | Added visual-only (s) | Cold / five interludes / outro (s) | Final / frames | LUFS / dBTP | Captions |
|---|---|---|---|---|---|---|
| 01 | 122.357551 / 122.320 | 27.680 | 3.500 / 5×3.500 / 6.680 | 150.000 / 4,500 | -16.38 / -1.44 | 42 |
| 02 | 122.435918 / 122.400 | 27.600 | 3.500 / 5×3.500 / 6.600 | 150.000 / 4,500 | -16.39 / -1.40 | 44 |
| 03 | 123.715918 / 123.680 | 26.320 | 3.500 / 5×3.500 / 5.320 | 150.000 / 4,500 | -16.25 / -1.19 | 45 |

The MP3 container includes encoder padding; decoded source runtime is the correct speech-waveform length for an exact 150-second edit. No words were trimmed to reconcile this difference.

## Audio integrity and timing

- Original MP3 SHA256 values match the supplied manifest. Full decoded source sample counts are preserved. Every source segment is included exactly once and in order; six source intervals per film, with five insertions at measured natural pause midpoints. The current kit expressly authorizes these insertions. The earlier Concrete Part04 single-uncut-track rule does not describe these new films.
- Each cold open is 3.5 seconds; five distinct 3.5-second visual-only beats are distributed through the film. The remainder is a 5.32–6.68-second purposeful branded outro. All inserted intervals contain original ambient score, not silent black padding.
- PCM hashes verify all original source intervals before mixing. Eighteen voiced waveform windows per film were compared against actual MP4 audio after mixing/AAC encoding. Selected voiced windows show zero sample lag; correlation details are in QA_MEDIA.json. An initial short pause-heavy window was ambiguous under music; the final method selects a voiced interior window near each anchor.
- The narrator was not regenerated, translated, pitch-shifted or time-stretched. Whole-mix broadcast loudness/true-peak control was applied. Original files are retained unchanged; the final mixed audio is not claimed byte-identical to MP3 speech.
- Full MP4 video/audio decode passed. Browser software playback sampled the opening, middle and final eight seconds, reached the real ending unmuted and reported no media errors. This is software playback, not a human audition.

## Visual and subtitle checks

- 380 HTML seek states checked; no visible text outside the frame. Mobile390px controls stay at least44px and the page does not overflow. One150-second preview audio element per film; reduced-motion rendering checked.
- 81 actual encoded frames, one for every major visual shot, compared with HTML at identical frame times. Maximum mean pixel error 0.992/255. Encoded contact sheets and posters inspected.
- The order demonstration keeps verification before the illustrative read-only result. No order edit/refund or autonomous decision is shown. Human handoff includes the reason/thread; team assignment, private notes and saved replies are demonstrated. The try-on uses the same synthetic adult and selected camel blazer, with an explicit fit limitation.
- Matching English captions are burned into the MP4s and provided as SRT. Text comes from actual English recognition, context-reconciled against longer recognition spans, with GRINDCTRL/product spelling normalized. Silence hallucinations are excluded. Cue timing uses measured source pauses plus exact edit insertions; no captions cross visual-only gaps. Not certified word-by-word forced alignment or human verbatim review.
- Source photography contains no generated text. Critical UI labels are editable native text. No fictitious prices, sales lift, testimonials, checkout, business KPIs or claimed endorsements. Brand text and CTA are GRINDCTRL and grindctrl.cloud.

## Evidence and remaining limitations

Official grindctrl.cloud, /try-on, /pricing and the public Shopify demo were attempted and returned proxy403. Authentic live screens could not be captured. Interfaces are explicitly illustrative, claims stay within supplied narration, and no CRM sync/revenue-attribution launch claim was added. Synthetic previews are authored demonstrations, not captured try-on engine output or real user photographs. No live merchant connection, order lookup, tenant permissions or availability was independently verified. No external viewer comprehension study or full human listening/pronunciation certification was performed.

Editable source/timeline is included. Final MP4s and HTML were actually rendered and checked; native PowerPoint/NLE formats were not requested by this kit and are not claimed.

The portable audio rebuild and HTML build were executed in a separate fresh directory. All three reconstructed audio mixes and all three standalone HTML files were byte-identical to the delivered versions; see QA_PORTABLE_SOURCE.json.