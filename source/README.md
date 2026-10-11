# GRINDCTRL × Concrete — Part 02 source

The MP4 and HTML are the synchronized masters. The unchanged Arabic MP3 is the audio source; English and Arabic are visual language choices.

Edit `story.py` for geometry, components and timed states. Edit `../part02-cue-timeline.json` for timing after verifying the actual recording. `player.js` renders a pure state from audio time. `player.css` contains presentation/player styles. Assets and font licenses are bundled. The fidelity manifest is intentionally disabled until authorized anonymized UI captures are available.

Typical rebuild from this directory:

```sh
python story.py
python build-html.py
python prepare-fonts.py
python build-pptx.py
node render.cjs
node render.cjs --video
node verify.cjs
python verify-media.py
node verify-video-frames.cjs
```

Requirements: Python 3, the listed Python dependencies, Node, Playwright, Chromium, FFmpeg/FFprobe; LibreOffice is optional for native layout inspection. Run `npm install` here if Playwright is not installed. Rendering defaults to `/usr/bin/chromium`; set `GRINDCTRL_CHROMIUM_PATH` for a different local browser executable. The workspace dependency fallback exists solely for the provided cloud environment.

`render.cjs --video --arabic-only` updates only the Arabic visual MP4. Full rendering is deterministic at 30 fps using the same SVG/HTML state as the preview. The encoded video contains the entire decoded master, no music and no replacement voice. The authoring canvas is 1280×720 and the video viewport is 1920×1080.

The cue sheet contains 82 measured speech intervals, semantic English descriptions and retained raw Arabic ASR. It is not certified word-level transcription. Captions in the player are optional semantic cue descriptions, not verbatim subtitles.

PowerPoint/PDF are static editable/review references. Their ten pages include the eight film scenes plus the successful-no-match and post-verification states, without lengthening the recording. Use the HTML/MP4 for full motion and synchronization.
