# Editable premium GRINDCTRL / Concrete project

This is a new three-film set: Concrete screen-pop proposal, Concrete per-call Customer360 proposal, and GRINDCTRL Try-On/Store Chat. Old rejected generic marketing films and narration are not production masters.

`player.js` contains the new vector interface components, geography, state changes, cursor motion and transitions. `films.json` / per-film JSON contain actual narration phrase intervals, source-to-target audio mapping and visual beats. Photography/font/logo assets are in `assets/`. This is an editable code/timeline project, not an operational tenant integration or a proprietary NLE/PPT file.

Requires Python3, Node.js, FFmpeg/FFprobe and Chromium. Select an installed browser with GRINDCTRL_CHROMIUM_PATH if needed. Run from the project root:

```bash
python -m pip install -r source/requirements.txt
npm install --prefix source
python source/build-html.py
node source/render.cjs --video 01
node source/render.cjs --video 02
node source/render.cjs --video 03
node source/qa-html.cjs
python source/qa-media.py
node source/qa-frames.cjs
node source/qa-playback.cjs
```

`python source/rebuild-audio.py` rebuilds the approved audio placement and newly composed procedural score. It verifies the original MP3 hashes and all source interval hashes before mixing. It never synthesizes speech or changes voice speed/pitch. Films01/02 preserve one continuous original narration interval; Film03 uses the explicitly approved short-source exception with three2-second inserts at measured pauses. Whole-mix loudness/true-peak control uses float staging before AAC encoding.

Set GRINDCTRL_OUTPUT to another complete project root where supported. Re-align only if the user supplies a newly approved narration. The shipped ASR/cue data is already measured for the supplied files. Source reconstruction was executed in a fresh directory; all three mixed audio files and all three HTML previews reproduced byte-for-byte.

HTML embeds its own complete150-second mixed audio and assets. Play/pause/replay, seeking, beat stepping, captions and reduced motion are included. Primary MP4s have English captions; sidecar SRTs are also supplied.

Contracted scope, vendor documentation, proposed Concrete behavior and illustrative UI must stay distinct. Call-note association and original authorship are explicit in named UI functions and data attributes. Actual note storage, record IDs, roles, retention and membership source require authorized discovery before implementation.
