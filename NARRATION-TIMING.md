# Recording and cue methodology

The continuous uploaded `grindctrl_voiceover_ar.mp3` is the timing source. It is never replaced, cut, stretched or reordered. Its SHA-256 is `6eb97961a8a1f7adb87e8726d20fc3c1046f6bcf81e8471b6260958b6ad56623`.

The MP3 container reports 137.090612 seconds. Its decoded audible stream, and the browser audio element, report **137.040 seconds**: 6,043,464 samples at 44.1 kHz. This small difference comes from MP3 padding/container metadata. Video contains 4,113 frames at 30 fps (137.100 seconds), with the final frame holding the closing state. All source audio is included once. The MP4 uses AAC for compatibility; HTML and PPTX embed the original MP3 byte for byte.

## How the alignment was derived

1. Decode the original recording for analysis, without changing the delivered master.
2. Detect its real silence gaps with FFmpeg, threshold −35 dB and a minimum gap of 150 ms. This yields 47 pause-bounded speech intervals.
3. Run local Whisper-small through sherpa-onnx on every interval. Code-switched English names are imperfectly recognized, so the supplied Arabic reference is used to normalize spelling. Raw recognition is retained in the JSON/CSV for audit.
4. Diagnose a decoder truncation issue: its token budget was too small for the Arabic/English mix. Append eight seconds of digital silence **only to temporary ASR inputs**, allowing all phrases to decode; no silence is added to the presentation recording.
5. Use native ASR segment boundaries only where a finer boundary is supported: C05-note (10.260 s) and C35-followup (97.323 s). The latter groups follow-up and informed-conversation wording together; separate word-level timestamps are not invented.
6. Align chapter changes, entries, focus cues, manual lookup and record selection to those observed audio intervals. The chooser closes at the measured end of C19, 51.957 s.

These are **ASR-assisted, normalized phrase cues**, not a certified verbatim transcript or word-perfect forced alignment. Estimated phrase-boundary tolerance is 150 ms; finer ASR boundaries use 200 ms. These tolerances describe the method, not a measured human-rating result. Human listening/transcription review was not available in this execution environment.

## Actual chapter boundaries

| Chapter | Audio interval | Visual event |
|---|---:|---|
| 1 | 0.000–16.395 | Complete imagined outcome; speech directs focus to call, tickets, status and note |
| 2 | 16.395–33.780 | Reported manual search in a separate Desk window |
| 3 | 33.780–52.546 | Call → authorized lookup → associated contact → history → employee record choice |
| 4 | 52.546–73.020 | Fictional exchange case; pending branch-review note informs the conversation |
| 5 | 73.020–94.163 | Same call/ticket, compared current and proposed |
| 6 | 94.163–113.196 | Expected benefits tied to visible UI; pilot qualification |
| 7 | 113.196–137.040 audible end | Inspect contracted pop-up scope, choose supported improvement, test calls |

`timeline.csv` is readable in Excel and uses UTF-8 with BOM. `timeline.json` retains raw ASR, timing methodology and confidence notes. `source/story.json` gives exact element entry/exit timestamps. A 350 ms eased reveal is presentation choreography, never a claim about live lookup latency.

## Runtime and export

HTML reads `audio.currentTime`; its animation loop only renders that time. Seek reconstructs the state without replaying prior transitions. Pausing freezes both narration and animation. Reduced motion removes travel/fade while preserving timed state changes. English/Arabic switches keep audio position.

MP4 frames use the same state evaluator at `frame / 30`. Repeated hold frames are cached; animated intervals are rendered separately. Audio is muxed once from the full original. PCM correlation checks at eight positions show zero-sample lag in both exports; see `qa/media-validation.json` for the actual values. This verifies absence of export drift, separately from the semantic phrase-boundary uncertainty.
