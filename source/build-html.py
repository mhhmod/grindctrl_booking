from pathlib import Path
import json,base64,shutil
from PIL import Image
S=Path(__file__).resolve().parent;D=S.parent;R=S

def data(p,mime):return 'data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()
for film in json.loads((S/'films.json').read_text()):
    defs=[]
    for name,key in [('fashion-board.png','board0'),('details-board.png','board1'),('brand.png','mark'),('brand-white.png','mark-white')]:
        p=S/'assets'/name;w,h=Image.open(p).size
        if key.startswith('mark'):defs.append(f'<symbol id="{key}" viewBox="0 0 {w} {h}"><image width="{w}" height="{h}" href="{data(p,"image/png")}"/></symbol>')
        else:defs.append(f'<image id="{key}" width="{w}" height="{h}" href="{data(p,"image/png")}"/>')
    html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GRINDCTRL — '''+film['title']+'''</title><style>
@font-face{font-family:Manrope;src:url('''+data(S/'assets/manrope.woff2','font/woff2')+''')}*{box-sizing:border-box}body{margin:0;background:#EAECE7;color:#20211f;font-family:Manrope,Arial,sans-serif}main{max-width:1440px;margin:auto;padding:24px}h1{font-size:20px;font-weight:600}.label{font-family:Manrope,Arial,sans-serif}#deck{aspect-ratio:16/9;width:100%;display:block;background:#F7F6F2;box-shadow:0 15px 60px #20252012}nav{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:16px 0}button{min-height:44px;padding:8px 16px;border:1px solid #ced2c7;border-radius:6px;background:#fff;color:#20211f;font:inherit;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #af8b56}#seek{flex:1;min-width:160px;accent-color:#3f6555}p{font-size:13px;line-height:1.6;color:#61675f}a{color:#3f6555}@media(max-width:600px){main{padding:8px}button{padding:7px 12px}h1{font-size:17px}#seek{flex-basis:100%}}
</style><main><h1>GRINDCTRL — '''+film['title']+'''</h1><svg id="deck" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" role="img" aria-label="Synchronized GRINDCTRL product demonstration"><defs>'''+''.join(defs)+'''</defs><g id="frame"></g></svg><nav><button id="play">Play</button><button id="replay">Replay</button><button id="next">Next shot</button><button id="motion">Motion on</button><input id="seek" aria-label="Seek video" type="range" min="0" max="149.99" step="0.01" value="0"><span id="clock">0:00 / 2:30</span></nav><p>Illustrative interfaces and synthetic fashion assets. The supplied narration is preserved at its original speed, with five documented pauses for visual demonstrations. All examples are fictional. Official website/demo access was unavailable during production. <a href="https://grindctrl.cloud">Explore GRINDCTRL</a></p><audio id="audio" preload="auto" src="'''+data(D/(film['stem']+'.m4a'),'audio/mp4')+'''"></audio></main><script>const film='''+json.dumps(film)+''';</script><script>'''+(S/'player.js').read_text()+'''</script></html>'''
    (D/(film['stem']+'.html')).write_text(html)
print('Built 3 synchronized standalone HTML films')
