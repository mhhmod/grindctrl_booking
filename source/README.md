# Rebuild the narrated presentation

The HTML opens directly in a modern browser; no build or server is required for viewing. It embeds its audio, images and fonts and makes no API calls.

Source uses Python 3.12, Node, Playwright, system Chromium at `/usr/bin/chromium`, and FFmpeg/FFprobe. LibreOffice is optional for native-file rendering checks. Install the Python packages in `requirements.txt` and Playwright from `package.json` in this folder. On another machine, adjust the Chromium executable path in the CJS scripts as appropriate.

Run from the extracted package:

```sh
python source/story.py
python source/build-html.py
node source/render.cjs
node source/render.cjs --video
python source/prepare-fonts.py
python source/build-pptx.py
node source/verify.cjs
python source/verify-media.py
node source/review-heuristics.cjs
node source/verify-video-frames.cjs
```

`verify.cjs` also builds the static PDFs. Video uses the same `GRINDCTRL.renderAt(t)` evaluator as the HTML, rendered at 30 fps, with cached identical hold frames. The unchanged original audio is included at the package root; scripts also accept its original handoff path as a fallback.

`timeline.json` is the analyzed timing input. `story.py` is the editable bilingual storyboard and geometry; `player.js` is audio-clock playback and cue-state reconstruction. Native PowerPoint uses `build-pptx.py` and `timing.py`. `ui-fidelity-manifest.json` is disabled until approved anonymized captures are available.

Local ASR model weights are deliberately excluded. The delivered cue sheet and raw recognition make the timing method auditable without downloading a large recognition model. The recognition is normalized/reference-assisted, not certified verbatim.
