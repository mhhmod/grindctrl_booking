# GRINDCTRL × Concrete — Part 03: Customer 360° call experience

Complete newly rendered 1920×1080 / 30 fps film, 4:46.96 of narration (4:47 rounded). The latest uploaded MP3 is the authoritative sound source, explicitly confirmed by the user. It was preserved unchanged. The rejected prior Part 03 recording is not included or used.

## Open the finished work

- **GRINDCTRL_Concrete_Part03_Rebuilt.mp4** — primary complete narrated film; English system labels and the supplied Arabic narration.
- **GRINDCTRL_Concrete_Part03_Rebuilt.html** — download and open in a browser. Self-contained audio/fonts/artwork. Play, pause, replay, next phrase, seek, chapter selection, enlarge, reduced motion, captions draft, evidence notes and offline call-case exploration. This is a downloadable preview, not a claimed hosted live integration.
- **GRINDCTRL_Concrete_Part03_Rebuilt_en.pptx** — editable native shapes/text and the unchanged MP3 attached on slide 1. Static scene reference; manual advance. Native PowerPoint audio/choreography is not claimed tested.
- **GRINDCTRL_Concrete_Part03_Rebuilt_en.pdf** — 14 light static reference pages: eight scenes plus six complementary current-note, fallback, implementation and pilot states.
- The `_ar` PPTX/PDF files provide an optional RTL layout reference; business/system names and labels remain in English, as requested. They are not a separately translated narration.

## What the film demonstrates

Incoming call → caller number → conditional authorized record association → name, phone, membership and optional email. Call activity presents separate calls with their own dates, times, human authors and original notes. A human enters a new proposed call note, and a later employee retrieves that same source call without moving the note to the later call or changing its author. No match, multiple matches, missing fields and lookup failure preserve the active call and manual procedure. The implementation starts with inspection of the contracted screen pop and real sources, uses native capabilities if sufficient, and proposes a controlled pilot.

The workspace is illustrative. All records are synthetic. Concrete’s live UI, source entities, membership storage, retention, permissions and note-write mechanism were not available for verification. No live connector or measured savings are claimed.

## Timing, captions and evidence

- `Part03_Corrected_Master.mp3` — byte-identical copy of the new attachment; original filename and hash recorded in QA.
- `audio-cue-map.json` / `.csv` — 120 measured source phrase intervals with raw recognition and normalized draft text.
- `narration-to-animation.csv` — 59 visual-change boundaries tied to actual speech onsets/ends.
- `audio-scene-manifest.json` — eight unequal scene spans within the continuous master; no independently approved scene MP3 files were supplied.
- `Part03_Narration_AR_DRAFT.srt` and `NARRATION_TRANSCRIPT_DRAFT.md` — ASR-assisted draft; not certified verbatim. No captions burned into the primary MP4.
- `STORYBOARD.md` — fresh scene architecture and events.
- `EVIDENCE_AND_UI_FIDELITY.md`, `QA_REPORT.md`, `qa/` — actual checks, evidence classifications, source uncertainty and fidelity-pass preparation.
- `part03-ui-fidelity-manifest.json` — disabled replacement hooks for later authorized, anonymized captures.

The replacement voice follows the earlier expanded script rather than the corrected chapter wording in the ZIP. This was disclosed; the user explicitly chose to use the new MP3 exactly as supplied. No regeneration, word edits, speed changes, music or replacement voice were applied. Timing is measured at phrase boundaries, not certified individual-word alignment. Human listening/pronunciation signoff was not available and is not claimed.

## Rebuild from editable production source

Linux tools used: Python 3, Node.js, FFmpeg/FFprobe, Chromium, LibreOffice (optional native PPTX rendering). Dependencies are pinned in `source/requirements.txt` and `source/package.json`. The existing cloud machine already provided them; no application repository files were changed.

```bash
python -m pip install -r source/requirements.txt
npm install --prefix source
python source/story.py
python source/build-html.py
node source/render.cjs --video
python source/prepare-fonts.py
python source/build-pptx.py
node source/qa-html.cjs
python source/qa-media.py
node source/qa-video.cjs
node source/test-simulation.cjs
```

`GRINDCTRL_CHROMIUM_PATH` selects your installed Chromium binary; default `/usr/bin/chromium`. The renderer streams audio-clock frames to FFmpeg, with 30 fps and full master duration. HTML/PDF/PPT use the same geometry. Fonts/licenses are bundled; install Manrope and IBM Plex Sans Arabic to edit the native files accurately. The cue map is frozen from the actual supplied recording; re-align if replacing the audio.

The offline call-case model uses synthetic records in local browser memory, and performs no vendor/network writes. Its tests establish demo invariants only. Native screenshot hooks require explicit approval and anonymization; remeasure highlights and rerun all export checks after a fidelity pass.
