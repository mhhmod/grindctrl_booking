# Part 03 — Customer 360° source

The complete MP4/HTML are the audiovisual masters. `../grindctrl-part03-voiceover-ar.mp3` is the unchanged new recording; the English/Arabic variants switch visual language only.

`story.py` creates the eight scenes from `../part03-cue-timeline.json` and `fixtures.json`. `player.js` reconstructs every visual state directly from audio time, including typing. `simulation.js` provides the offline source/interaction-keyed note model; `sandbox.js` exposes its synthetic cases. There are no vendor credentials, endpoints or live connectors. The fidelity manifest is disabled until authorized anonymized captures are available.

The recording expands the original intended script. Its 286.16 decoded seconds, actual pauses and semantic phrases govern the film. The Arabic SRT/transcript are ASR-assisted and normalized, not certified verbatim or word-level alignment; human caption review remains recommended. Raw recognition is retained for audit.

Rebuild from this source directory:

```sh
python story.py
python build-html.py
python prepare-fonts.py
python build-pptx.py
node test-simulation.cjs
node render.cjs
node render.cjs --video
node verify.cjs
python verify-media.py
node verify-video-frames.cjs
node verify-encoded-playback.cjs
```

Requirements: Python and `requirements.txt`, Node/Playwright (`npm install` here), FFmpeg/FFprobe and Chromium. `GRINDCTRL_CHROMIUM_PATH` overrides `/usr/bin/chromium`; a workspace dependency fallback is retained for this cloud environment. LibreOffice is optional for native static layout checks. Font preparation regenerates local Fontconfig paths rather than relying on another machine’s paths.

The authoring canvas is 1280×720; the video viewport is 1920×1080 at 30 fps. `--arabic-only` re-renders only the Arabic visual variant. Film rendering is deterministic and contains the full original narration without stretching/cuts/music. Master-clock entrance easing is 350 ms; this is not real lookup latency.

Edit `fixtures.json` and regenerate `story.json` for visual data updates. When changing interaction IDs, actor labels or sample timestamps, update the corresponding explicit labels in `story.py` and the expected-value assertions too. Interaction IDs, customer links, human authors and note timestamps must remain consistent. The compound source-system/interaction key is fundamental; do not turn call notes into a contact-global list or attach an older note to a future call. Production identity, storage, permissions, contact association, retention, transfer and native save behavior still require tenant validation.

PowerPoint/PDF are static twelve-page references, not substitutes for synchronized HTML/MP4. Speaker notes include actual cues and limitations. Both font OFL licenses and supplied brand/icon assets are included. Original handoff documents are archived under `handoff/`; their old “audio not yet supplied” status and shorter intended script are historical. The new actual recording and final evidence report govern this production.
