from pathlib import Path
import json,base64,shutil
from PIL import Image
S=Path(__file__).resolve().parent;D=S.parent;R=S

def data(p,mime):return 'data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()
for film in json.loads((S/'films.json').read_text()):
    definitions=[]
    for name,key in [('brand.png','mark'),('genesys.png','genesys'),('zoho.png','zoho'),('navy-linen-demo.png','fashion')]:
        p=S/'assets'/name;w,h=Image.open(p).size
        image=f'<image width="{w}" height="{h}" href="{data(p,"image/png")}"/>'
        definitions.append(f'<image id="{key}" width="{w}" height="{h}" href="{data(p,"image/png")}"/>' if key=='fashion' else f'<symbol id="{key}" viewBox="0 0 {w} {h}">{image}</symbol>')
    html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GRINDCTRL — '''+film['title']+'''</title><style>
@font-face{font-family:Manrope;src:url('''+data(S/'assets/manrope.woff2','font/woff2')+''')}*{box-sizing:border-box}body{margin:0;background:#ECEEE8;color:#252A28;font-family:Manrope,Arial,sans-serif}main{max-width:1480px;margin:auto;padding:24px}h1{font-size:21px;font-weight:600}#deck{display:block;width:100%;aspect-ratio:16/9;background:#F8F7F4;box-shadow:0 20px 65px #252A2810}svg text{font-family:Manrope,Arial,sans-serif}nav{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:16px 0}button{min-height:44px;border:1px solid #CCD2C6;background:white;border-radius:6px;padding:8px 14px;color:#252A28;font:inherit;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #A17A45}#seek{flex:1;min-width:160px;accent-color:#35634E}p{font-size:13px;line-height:1.6;color:#65705F}a{color:#35634E}@media(max-width:600px){main{padding:8px}h1{font-size:17px}#seek{flex-basis:100%}button{padding:8px 11px}}
</style><main><h1>'''+film['title']+'''</h1><svg id="deck" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" role="img" aria-label="'''+film['title']+'''"><defs>'''+''.join(definitions)+'''</defs><g id="frame"></g></svg><nav><button id="play">Play</button><button id="replay">Replay</button><button id="next">Next beat</button><button id="motion">Motion on</button><button id="captions">Captions</button><input id="seek" type="range" aria-label="Seek presentation" min="0" max="149.99" step="0.01" value="0"><span id="clock">0:00 / 2:30</span></nav><p>'''+('Proposed Concrete workflow. Fictional records and illustrative interfaces. A phone match is not identity verification. Deployment, data sources, permissions and retention remain to validate.' if film['id']!='03' else 'Illustrative Shopify product journey with a synthetic adult/photo/garment. The preview is not an exact-fit guarantee. No live merchant or order connection is asserted.')+''' Original approved narration is retained at natural speed. <a href="https://grindctrl.cloud">grindctrl.cloud</a></p><audio id="audio" preload="auto" src="'''+data(D/(film['stem']+'.m4a'),'audio/mp4')+'''"></audio></main><script>const film='''+json.dumps(film,ensure_ascii=False)+''';</script><script>'''+(S/'player.js').read_text()+'''</script></html>'''
    (D/(film['stem']+'.html')).write_text(html)
print('Built three new premium synchronized HTML films')
