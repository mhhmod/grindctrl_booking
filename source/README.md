# Editable GRINDCTRL three-film project

`films.json` and the three per-film timeline JSON files contain measured source-to-target narration segments, exact pauses, visual shots and captions. `player.js` contains editable vector UI, typography, motion and art direction. Synthetic photography is in `assets/`. This is an editable code/timeline project, not a proprietary NLE file or an operational commerce backend.

Requires Python3, Node.js, FFmpeg/FFprobe and Chromium. Use a suitable installed Chromium path in GRINDCTRL_CHROMIUM_PATH. Install dependencies in this source folder without changing your application repository.

```bash
python -m pip install -r source/requirements.txt
npm install --prefix source
python source/build-html.py
node source/render.cjs --video 01
node source/render.cjs --video 02
node source/render.cjs --video 03
node source/qa-html.cjs
python source/qa-media.py
node source/qa-video.cjs
```

To rebuild the original music/voice mix, run `python source/rebuild-audio.py` before building HTML. It checks the three approved MP3 hashes, reconstructs all original speech samples at the documented natural-pause insertions, composes the original procedural score, and applies whole-mix loudness/true-peak control. The supplied MP3s remain unchanged. Temporary float WAV staging avoids pre-limiter clipping. No voice generation, pitch or time stretching occurs.

Set GRINDCTRL_OUTPUT to another complete project directory when needed. Re-align only when a newly approved source recording changes. Caption text was context-reconciled from actual English ASR and measured pause intervals, with brand spelling normalized; not a certified human verbatim transcript.

The synchronized HTML embeds all assets and its own complete 150-second mix. Its one audio clock drives the visuals. Final MP4s have burned-in English captions; matching SRT files are also supplied. Reduced-motion, pause/replay, seeking and shot stepping are available in HTML.
