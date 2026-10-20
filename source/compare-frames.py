from pathlib import Path
import json,numpy as np
from PIL import Image,ImageDraw
R=Path(__file__).parent.parent;V=json.loads((R/'qa/video-validation.json').read_text());checks=[]
for c in V['frames']:
 a=np.asarray(Image.open(R/'review'/f'{c["name"]}-actual.png').convert('RGB'),dtype='float32');e=np.asarray(Image.open(R/'review'/f'{c["name"]}-expected.png').convert('RGB'),dtype='float32');v=float(np.mean(np.abs(a-e)));assert v<4,(c,v);checks.append(dict(frame=c['frame'],time=c['time'],mean_absolute_pixel_error=v))
(R/'qa/frame-comparison.json').write_text(json.dumps(dict(comparisons=checks,max_mae=max(c['mean_absolute_pixel_error'] for c in checks),method='Actual encoded MP4 versus HTML at identical frame/30 time; transition, event, typing and static states. H264 lossy tolerance 4/255.'),indent=2))
S=json.loads((R/'source/story.json').read_text())
for name,times in [('contact-sheet',[s['static_time'] for s in S['slides']]),('ending',[254,263,269,273,278,282,285.8])]:
 columns=3 if name=='contact-sheet' else 2;w=640 if columns==3 else 768;h=round(w*9/16);out=Image.new('RGB',(columns*w,(h+24)*((len(times)+columns-1)//columns)),'white')
 for i,t in enumerate(times):
  c=min(V['frames'],key=lambda c:abs(c['time']-t));out.paste(Image.open(R/'review'/f'{c["name"]}-actual.png').resize((w,h)),((i%columns)*w,(i//columns)*(h+24)));ImageDraw.Draw(out).text(((i%columns)*w+12,(i//columns)*(h+24)+h+4),f'{c["time"]:.3f}s · actual MP4',fill='black')
 out.save(R/(name+'.jpg'),quality=92)
print(len(checks),'actual encoded frame comparisons passed, max MAE:',max(c['mean_absolute_pixel_error'] for c in checks))
