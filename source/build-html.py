"""Self-contained narration master: original audio, fonts, artwork and audio-time scene data."""
from pathlib import Path
import json,base64
R=Path(__file__).parent
assets={p.stem:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode() for p in (R/'assets').glob('*.png')}
fonts={k:base64.b64encode((R/'assets'/v).read_bytes()).decode() for k,v in [('manrope','manrope.woff2'),('arabic','arabic.woff2')]}
audio_file=R.parent/'grindctrl-part02-voiceover-ar.mp3'
if not audio_file.exists():raise FileNotFoundError('The unchanged final Part 02 MP3 must be beside the cue timeline.')
audio=base64.b64encode(audio_file.read_bytes()).decode()
story=json.loads((R/'story.json').read_text())
style=(R/'player.css').read_text().replace('MANROPE_DATA',fonts['manrope']).replace('ARABIC_DATA',fonts['arabic'])
js=(R/'player.js').read_text()
manifest_file=R.parent/'part02-ui-fidelity-manifest.json'
if manifest_file.exists():js+='\nwindow.GRINDCTRL.applyFidelity('+json.dumps(json.loads(manifest_file.read_text()),ensure_ascii=False).replace('</','<\\/')+');'

html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GRINDCTRL × Concrete — Part 02: Inside the workflow</title><style>'''+style+'''</style></head><body>
<header><div class="identity"><img id="brand" alt=""><bdi>GRINDCTRL × Concrete</bdi></div><div class="header-actions"><button data-action="language">العربية</button><button data-action="zoom" aria-pressed="false">Enlarge scene</button><button data-action="notes">Notes</button><button data-action="print">PDF</button></div></header>
<main><div id="deck" tabindex="0" aria-label="Presentation scene"></div>
<div class="controls"><button id="play" class="primary" data-action="play">Play narration</button><button data-action="replay">Replay</button><button data-action="step">Next phrase</button><button data-action="mute" aria-pressed="false">Mute</button><span id="time" class="time">0:00 / 3:14</span><label class="seek-label" for="seek">Narration position</label><input id="seek" type="range" min="0" max="194" step="0.01" value="0" aria-label="Narration position"></div>
<nav id="chapters" aria-label="Presentation chapters"></nav>
<div class="caption-row"><button id="caption-toggle" data-action="captions" aria-pressed="false">Cue descriptions</button><span>Final Arabic voice-over · Part 02 · English / Arabic visuals · Illustrative proposal</span></div><div id="caption" dir="rtl" hidden></div>
</main><audio id="audio" preload="auto" src="data:audio/mpeg;base64,'''+audio+'''"></audio>
<dialog id="notes"><div id="note-content"></div><button data-action="close">Close</button></dialog>
<div class="sr-only" id="announce" aria-live="polite"></div>
<script>const story='''+json.dumps(story,ensure_ascii=False).replace('</','<\\/')+''';const assets='''+json.dumps(assets)+''';</script><script>'''+js+'''</script></body></html>'''
(R.parent/'grindctrl-concrete-part02-animated.html').write_text(html)
print('Self-contained HTML master written; original MP3 is embedded unchanged.')
