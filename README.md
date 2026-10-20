# GRINDCTRL × Concrete — Part 04: AI opportunities across the business

**The complete primary deliverable is `GRINDCTRL_Concrete_Part04_AI_Opportunities.mp4`: 1920×1080 / 30 fps, 4:45.920 of continuous narration (4:46 rounded).**

## One narration contract

Exactly one supplied MP3 is the narration authority: `Part04_FINAL_VOICEOVER.mp3`. It is the unchanged attached ElevenLabs recording. One locked audio input starts at 00:00 and runs through all nine visual scenes. No external scene MP3s, regeneration, cuts, tempo changes, inserted silence, normalization or music. The renderer maps this one voice input directly into the complete MP4. HTML contains one audio element; PowerPoint contains one embedded master.

## Finished files

- `GRINDCTRL_Concrete_Part04_AI_Opportunities.mp4` — full narrated film.
- `GRINDCTRL_Concrete_Part04_AI_Opportunities.html` — download/open in a browser; fully embedded images, fonts and audio. Play, pause, replay, next phrase, chapter seeking, mute, enlarge, reduced motion, RTL layout, Arabic captions and evidence notes. Downloadable preview, not a claimed hosted live service.
- `GRINDCTRL_Concrete_Part04_AI_Opportunities_en.pptx` — editable native text/shapes and cropped images, with the single original audio attached. Static reference, manual advance. Native Microsoft PowerPoint playback/choreography was not tested.
- `_en.pdf` / `_ar.pdf` — 13 static pages: nine principal scenes + four complementary workflow states. `_ar` is an optional RTL layout; system/brand labels remain English.
- `Part04_Narration_AR.srt` — script-matched, ASR-assisted Arabic subtitles timed against the single recording. Vendor spelling normalized. No subtitles burned into the primary film; enable them in HTML or use the sidecar. Human verbatim/pronunciation certification is not claimed.
- `actual_audio_cues.json` — nine measured scene boundaries, 124 phrase intervals and 82 animation triggers. No invented or equal-time chapter allocation.
- `narration-to-animation.csv`, `STORYBOARD.md` — measured phrase-to-visual map and layered scene structure.
- `contact-sheet.jpg`, `ending.jpg`, `review/` — actual rendered/encoded frame inspection.
- `BRAND_EVIDENCE_AND_FIDELITY.md`, `QA_REPORT.md`, `qa/`, `research/access.json` — evidence, mandatory storyboard corrections, performed checks and limitations.

## The nine demonstrations

Broader retail vision → personal stylist → e-commerce discovery/size/stock guidance → contact-center AI drafts for human review → consented Icons Club clienteling → SKU/size/branch stock proposal → creative studio and editorial approval → source-linked executive brief → discovery, scoped pilot, measurement and expansion.

The stylist visibly changes the shirt to a demo knit following customer refinement. Copilot keeps the original human note separate from its AI-generated DRAFT summary. Operations show a proposed movement from candidate Branch B to requesting Branch A and a manager decision gate; no inventory transfer occurs. Marketing shows three distinct editable campaign layouts with sample copy, not published campaigns. Executive screens contain no fabricated quantitative KPI results.

## Evidence and brand accuracy

The original nine PNGs were art-direction references, not live screens or factual brand evidence. Critical UI was rebuilt into independent animatable layers. Photo/product viewports exclude their original prices, UAE geography, Gold/VIP labels, promises, founding date and dashboard figures. No use of +32%, current prices, delivery promises or invented loyalty benefits in the production UI.

All records and imagery are clearly illustrative. No authorized Concrete native captures, official logo/current collection assets, catalogue/stock connection, membership source, native AI licence/configuration or deployed version was verified. Official Concrete/vendor sites were attempted where appropriate; blocked sources are logged. Existing contracted scope and accessible vendor API documentation are distinguished from operational proof. No contracts, signatures, confidential fees or credentials are included.

The final narration is preserved exactly. Script matching and recognition support measured phrase timing; a human full listen-through, phonetic audit or certified individual-word alignment was not available and is not claimed. No external user comprehension test, real pilot or business uplift was measured.

## Editable production source and reproduction

`source/story.py` defines nine layered scenes, text, image viewports, event boundaries, typing, highlights and reference exports. `source/player.js` uses the one audio clock and restrained visual-only dissolves. `source/render.cjs` streams 30 fps frames to FFmpeg and maps ONE unchanged MP3. Source image files are original generative reference material: never present them uncropped as finished business slides.

Tools used: Python 3, Node.js, FFmpeg/FFprobe, Chromium; LibreOffice only for native-export review. Dependencies listed in `source/requirements.txt` and `source/package.json`. Bundled Manrope / IBM Plex Sans Arabic include font licences. Set `GRINDCTRL_CHROMIUM_PATH` for your installed Chromium; Linux default `/usr/bin/chromium`.

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
python source/compare-frames.py
```

The cue map is already measured for this master. Replace/re-align it only when a new single master is authorized. No vendor API writes or live connections occur in the source. The main application repository and its existing user changes were preserved.
