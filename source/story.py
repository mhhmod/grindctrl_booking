"""Part 04: independently layered retail scenes, measured continuous-narration cues."""
from pathlib import Path
import json,csv
R=Path(__file__).parent;T=json.loads((R.parent/'actual_audio_cues.json').read_text());TS={c['id']:c['start'] for c in T['cues']};TE={c['id']:c['end'] for c in T['cues']}
C=dict(bg='#F8F7F4',paper='#FFFFFF',ink='#262626',muted='#68645E',line='#E6E3DE',accent='#965318',gold='#FFBA65',green='#49654E',soft='#F4F2EE',sage='#EFF4EE',warm='#FFF2DD',shadow='#EDEAE4')
B=lambda a,b=None:dict(en=a,ar=b or a)
slides=[]
def tm(v):return TS[v] if isinstance(v,str) else v
def add(s,k,at=None,until=None,**kw):
 e=dict(type=k,at=tm(at) if at is not None else s['start'],until=tm(until) if until is not None else None,slot=None,**kw);s['elements'].append(e);return e
def text(s,x,y,w,h,a,size=22,bold=False,color=None,at=None,until=None,align='start',role='ui',ltr=False):return add(s,'text',at,until,x=x,y=y,w=w,h=h,text=B(a),size=size,bold=bold,color=color or C['ink'],align=align,role=role,ltr=ltr)
def box(s,x,y,w,h,fill=None,line=None,r=7,at=None,until=None):return add(s,'rect',at,until,x=x,y=y,w=w,h=h,fill=fill or C['paper'],line=line or C['line'],radius=r)
def img(s,key,x,y,w,h,at=None,until=None):return add(s,'image',at,until,key=key,x=x,y=y,w=w,h=h)
def icon(s,key,x,y,d=24,at=None,until=None):return img(s,'icon-'+key,x,y,d,d,at,until)
def line(s,x,y,x2,y2,at=None,until=None,color=None,width=1,arrow=False):return add(s,'line',at,until,x=x,y=y,x2=x2,y2=y2,color=color or C['line'],width=width,arrow=arrow)
def circle(s,x,y,d,fill=None,at=None,until=None):return add(s,'ellipse',at,until,x=x,y=y,w=d,h=d,fill=fill or C['soft'],line=fill or C['soft'])
def focus(s,x,y,w,h,at,until=None):return add(s,'outline',at,until,x=x,y=y,w=w,h=h,color=C['gold'],radius=6,width=2)
def crop(s,key,x,y,w,h,bounds,at=None,until=None):return add(s,'crop',at,until,key=key,x=x,y=y,w=w,h=h,crop=dict(zip(['x','y','w','h'],bounds)),source_w=1672,source_h=941)
PRODUCTS=[('Blazer',(971,360,124,172)),('Shirt',(1116,355,134,175)),('Trousers',(1292,354,133,176)),('Shoes',(1461,410,140,123))]
def product(s,i,x,y,w,h,at=None,until=None,label=True,variant=False):
 n,b=PRODUCTS[i] if not variant else ('Knit',(246,544,73,76));box(s,x,y,w,h,fill=C['soft'],line=C['soft'],r=5,at=at,until=until)
 # Native scene viewport contains only the garment photo, not original generated labels.
 ph=h-53 if label else h;cw,ch=b[2:];scale=min((w-22)/cw,(ph-12)/ch);pw,hh=cw*scale,ch*scale
 crop(s,'S05_storyboard' if variant else 'S02_storyboard',x+(w-pw)/2,y+(ph-hh)/2,pw,hh,b,at,until)
 if label:text(s,x+12,y+h-41,w-24,30,n,size=21,bold=True,at=at,until=until)
def button(s,x,y,w,label,at=None,until=None,k=None):
 box(s,x,y,w,42,fill=C['warm'],line=C['warm'],r=5,at=at,until=until)
 if k:icon(s,k,x+13,y+11,19,at,until)
 text(s,x+(43 if k else 10),y+10,w-(55 if k else 20),28,label,size=18,bold=True,align='center',at=at,until=until)
def base(i,title,section,static):
 ch=T['chapters'][i];s=dict(index=i,id=ch['id'],start=ch['start'],end=ch['end'],title=B(title),section=B(section),elements=[],dark=False,cameras=[],slots={},motion=dict(fade=350),static_time=static,notes=[]);slides.append(s)
 img(s,'brand',48,27,43,29);text(s,104,29,375,31,'GRINDCTRL × Concrete',size=18,bold=True,ltr=True,role='framing');text(s,663,29,569,30,'Part 04 · '+section,size=16,color=C['muted'],align='end',role='framing')
 text(s,48,94,1184,52,title,size=38,bold=True,role='heading');line(s,48,670,1232,670)
 text(s,48,683,1080,24,'Proposed experience · Illustrative imagery / UI · Demo records · Sources and permissions to validate',size=14,color=C['muted'],role='framing');text(s,1146,683,86,24,f'{i+1:02} / 09',size=14,align='end',ltr=True,role='framing')
 s['notes']=[B('This is a new GRINDCTRL collaboration proposal, not deployed products or a live integration. Imagery is generative art direction supplied by the user, selectively displayed through native cropped scene viewports. It is not verified Concrete store/product imagery. Generated captions, signage/date, currencies, benefits, promises and metrics are excluded. UI text is editable and rebuilt.'),B('One supplied final MP3, locked continuously from 00:00, unchanged across all nine scenes. Scene divisions affect video only. No speech synthesis, separate narration clips, speed changes, normalization, music or inserted silences.'),B('Native Genesys/Zoho AI capabilities, source systems/versions, WooCommerce inventory and product variation mappings, Retail Pro 9/Prism interfaces, Icons Club source, permissions, consent and integration access must be audited. No operational evidence or authorized native screenshots were supplied. Contracts do not prove live operation.')]
 return s

def frame(s,title,at=None,until=None,x=48,y=168,w=1184,h=478):
 box(s,x,y+4,w,h,fill=C['shadow'],line=C['shadow'],r=10,at=at,until=until);box(s,x,y,w,h,r=10,at=at,until=until);text(s,x+22,y+18,w-44,31,title,size=20,bold=True,at=at,until=until);line(s,x,y+63,x+w,y+63,at,until)

def policy(s,title,at=None,until=None,y=396):
 icon(s,'lock',671,y+3,24,at,until);text(s,713,y,471,30,title,size=21,bold=True,at=at,until=until)

# 01: service recap becomes a retail-wide experience; reference composition is reconstructed.
s=base(0,'Customer service is the beginning.','The broader opportunity',26.6)
frame(s,'Genesys + Zoho Desk · Illustrative service context',until='C004');img(s,'genesys',77,260,130,31,until='C004');img(s,'zoho',1086,261,90,31,until='C004');icon(s,'call',81,332,42,until='C004');text(s,149,327,425,47,'Call → customer context',size=30,bold=True,until='C004');text(s,149,389,425,38,'+20 10 •••• 4821 · Ahmed M. (DEMO)',size=20,ltr=True,until='C004');box(s,632,317,552,176,fill=C['warm'],line=C['warm'],until='C004');text(s,657,342,504,35,'Original human call note',size=23,bold=True,until='C004');text(s,657,395,504,77,'Branch review was requested.\nCompletion is not confirmed.',size=25,until='C004');text(s,149,554,1037,43,'One continuous customer conversation.',size=24,color=C['muted'],until='C004')
crop(s,'S05_storyboard',48,168,500,425,(480,247,680,578),'C004');box(s,48,595,500,51,fill=C['paper'],r=0,at='C004');text(s,69,609,459,27,'Customer → associate · Illustrative concept',size=17,color=C['muted'],at='C004')
box(s,571,168,661,478,r=10,at='C004');text(s,593,193,616,44,'Across the Concrete experience',size=28,bold=True,at='C005');product(s,0,600,309,137,218,'C006');product(s,1,756,309,137,218,'C006');text(s,923,310,284,38,'Outfit proposal',size=24,bold=True,at='C006');text(s,923,365,284,77,'Occasion and\npreferences in view.',size=22,at='C007');icon(s,'file',924,466,25,'C008');text(s,963,462,244,55,'Human review\nacross teams',size=20,bold=True,at='C008')
for x,k,n,ev in [(600,'case','Online store','C006'),(807,'actor','Stores','C007'),(1014,'settings','Teams','C008')]:icon(s,k,x,252,20,ev);text(s,x+31,248,147,29,n,size=18,bold=True,at=ev)
text(s,598,583,607,38,'Marketing · Operations · Management',size=21,color=C['muted'],at='C008');focus(s,588,186,629,443,'C010','C011')

# 02: customer request -> individually appearing eligible demo outfit items -> refinement / optional visit.
s=base(1,'A complete look starts with a simple request.','AI personal stylist',57.3)
crop(s,'S02_storyboard',48,168,403,478,(478,307,430,510));frame(s,'AI personal stylist · Demo catalog',x=475,w=757)
icon(s,'speech',496,254,28,'C016');e=text(s,538,250,669,61,'“An evening occasion. Neutral tones.\nA complete smart-casual look.”',size=23,at='C016',until='C025');e['typing']=dict(start=TS['C016'],end=TE['C018'])
text(s,498,325,702,30,'Outfit proposal · Eligible demo items',size=19,color=C['muted'],at='C019')
for i,ev in enumerate(['C020','C021','C022','C023']):product(s,i,498+i*181,368,165,198,ev,'C025' if i==1 else None)
product(s,1,679,368,165,198,'C025',variant=True);box(s,495,248,712,65,fill=C['soft'],line=C['soft'],at='C025');icon(s,'speech',509,264,26,'C025');text(s,551,261,632,45,'Refine the look: “Make it less formal.”',size=24,bold=True,at='C025');focus(s,673,362,173,207,'C025','C026')
button(s,498,587,478,'Request store visit · If service supported','C026',k='actor');text(s,994,595,211,31,'No booking made',size=16,color=C['muted'],at='C026')

# 03: discovery, size guidance, and an honest stock-source state. No geography/prices.
s=base(2,'Discover the product. Check the source.','AI e-commerce assistant',87.4);frame(s,'Concrete · Proposed online-store assistant')
box(s,76,251,1128,61,fill=C['soft'],line=C['soft'],at='C029');icon(s,'search',94,271,24,'C029');e=text(s,139,267,1039,38,'A shirt for a smart-casual evening.',size=25,at='C029');e['typing']=dict(start=TS['C029'],end=TE['C029'])
text(s,76,331,702,29,'Catalog options · Fictional demo records',size=19,color=C['muted'],at='C032',until='C033');product(s,1,76,381,246,231,'C032','C033');product(s,0,356,381,246,231,'C032','C033');product(s,2,636,381,246,231,'C032','C033')
# The chart has unknown measurements rather than an invented fit recommendation.
product(s,1,76,352,217,271,'C033');text(s,326,349,554,34,'Size-chart guidance',size=26,bold=True,at='C033');text(s,326,398,553,29,'Compare the product’s measurements.',size=21,at='C033');line(s,326,439,879,439,'C033')
for y,lab,k in [(463,'Chest measurement','link'),(508,'Garment length','quality')]:icon(s,k,326,y+3,22,'C033');text(s,366,y,345,31,lab,size=21,at='C033');text(s,726,y,153,31,'Source required',size=17,color=C['muted'],at='C033',align='end')
text(s,326,579,553,39,'No fit certainty from incomplete data.',size=19,color=C['muted'],at='C040')
line(s,919,339,919,627,'C034');text(s,946,349,258,34,'Availability',size=25,bold=True,at='C034');icon(s,'link',947,407,27,'C034');text(s,946,453,258,76,'Current stock\nsource required',size=23,bold=True,at='C034',until='C036');text(s,946,453,258,72,'Not available\nin this demo',size=23,bold=True,color=C['muted'],at='C036');text(s,946,547,258,59,'No stock connection\nor delivery promise.',size=18,color=C['muted'],at='C037')

# 04: AI guidance and summary are visibly distinct from a human's original call note.
s=base(3,'AI drafts. The human agent decides.','Contact center copilot',116.8);frame(s,'Genesys · Proposed copilot experience');img(s,'genesys',1000,183,132,31)
crop(s,'S04_storyboard',73,251,245,231,(444,235,343,323));text(s,73,508,245,31,'Incoming call',size=22,bold=True,at='C042');text(s,73,552,245,37,'+20 10 •••• 4821',size=21,bold=True,ltr=True,at='C042');text(s,73,605,245,25,'Human Agent D · DEMO',size=16,color=C['muted'])
line(s,340,249,340,623);text(s,364,251,271,36,'Customer context',size=23,bold=True,at='C043');text(s,364,304,271,39,'Ahmed M. (DEMO)',size=23,bold=True,ltr=True,at='C043');text(s,364,352,271,31,'Icons Club · ELITE',size=20,color=C['accent'],at='C043');text(s,364,405,271,33,'Prior human note',size=21,bold=True,at='C043');text(s,364,451,271,93,'Branch review\nrequested. Completion\nnot confirmed.',size=22,at='C043');text(s,364,573,271,51,'Source: DEMO-1008\nAgent A · Original note',size=16,color=C['muted'],ltr=True,at='C043')
line(s,650,249,650,623);text(s,675,251,530,36,'AI guidance · Draft',size=25,bold=True,at='C044',until='C046');box(s,675,308,530,213,fill=C['warm'],line=C['warm'],at='C045',until='C046');text(s,697,329,486,100,'Check the original case.\nExplain the recorded review status.\nConfirm the next authorized step.',size=23,bold=True,at='C045',until='C046');icon(s,'file',697,474,21,'C045','C046');text(s,736,470,447,40,'Source: DEMO policy excerpt',size=18,color=C['accent'],at='C045',until='C046');text(s,675,570,530,47,'Approved company policy source required.',size=18,color=C['muted'],at='C044',until='C046')
text(s,675,251,530,36,'AI call summary · DRAFT',size=25,bold=True,at='C046');box(s,675,310,530,208,fill=C['warm'],line=C['warm'],at='C046');e=text(s,697,332,486,153,'Customer requested an exchange update.\nBranch review is recorded as requested.\nCompletion remains unconfirmed.',size=24,bold=True,at='C046');e['typing']=dict(start=TS['C046'],end=TE['C046'])
button(s,675,545,228,'Human edit / review','C047',k='pen');button(s,926,545,279,'Approve before saving','C047',k='check');text(s,675,603,530,28,'Demo draft · No automatic commitment or decision',size=16,color=C['muted'],at='C048');focus(s,673,542,534,50,'C047','C050')

# 05: consent first; supported tier vocabulary; no invented program benefits.
s=base(4,'Personalization starts with permission.','Loyalty and clienteling',152.0)
crop(s,'S05_storyboard',48,168,436,371,(485,245,682,580));box(s,48,541,436,105,fill=C['paper'],r=0);text(s,70,551,392,60,'The associate keeps\nthe customer conversation.',size=24,bold=True);text(s,70,617,392,24,'Illustrative store / people',size=15,color=C['muted'])
frame(s,'Icons Club · Proposed associate view',x=507,w=725)
icon(s,'lock',531,255,26,'C054');text(s,576,253,631,33,'Consent recorded (DEMO)',size=22,bold=True,color=C['green'],at='C054');text(s,532,305,650,37,'Ahmed M. · Neutral tailoring',size=25,bold=True,ltr=True,at='C055');text(s,532,352,650,31,'Preference / purchase sources require permission.',size=18,color=C['muted'],at='C055')
for i,(n,ev) in enumerate([('LIFESTYLE','C057'),('PRESTIGE','C058'),('ELITE','C059')]):
 x=532+i*227;text(s,x,410,214,35,n,size=21,bold=i==2,color=C['accent'] if i==2 else C['muted'],ltr=True,align='center',at=ev)
focus(s,980,398,228,52,'C059','C061');text(s,532,392,650,21,'Trusted membership source required · Illustrative tier',size=14,color=C['muted'],at='C056')
product(s,0,532,479,127,145,'C061');product(s,1,680,479,127,145,'C061');text(s,831,476,370,65,'Suggested pieces\nfor this preference',size=23,bold=True,at='C061',until='C063');text(s,831,477,370,89,'Benefits must be\nvalidated against\nprogram rules.',size=23,bold=True,color=C['accent'],at='C063');text(s,831,576,370,55,'No entitlement inferred.\nCatalog and role checks apply.',size=17,color=C['muted'],at='C064')

# 06: SKU/size/branch source signals -> proposal -> accountable manager. No fake quantities/KPIs.
s=base(5,'A stock signal becomes a reviewable proposal.','Retail operations',181.0);frame(s,'Retail operations · Synthetic SKU / branch scenario')
product(s,0,77,267,170,243);text(s,76,547,172,31,'DEMO-BLAZER',size=17,bold=True,ltr=True);text(s,76,587,172,36,'Size M',size=25,bold=True)
line(s,277,253,277,624);text(s,309,258,406,35,'Branch A · Demo',size=25,bold=True,at='C068');box(s,309,325,407,83,fill=C['soft'],at='C068');text(s,330,342,365,61,'Size requested\nAvailability unresolved',size=23,bold=True,at='C068')
text(s,788,258,420,35,'Branch B · Demo',size=25,bold=True,at='C069');box(s,788,325,420,83,fill=C['soft'],at='C069');text(s,809,342,377,61,'Candidate surplus\nSource record to confirm',size=23,bold=True,at='C069');line(s,771,365,733,365,'C071',color=C['accent'],width=2,arrow=True)
icon(s,'link',311,448,25,'C070');text(s,359,442,840,36,'Compare SKU, size, branch, timing and allowed stock.',size=22,color=C['muted'],at='C070',until='C074')
box(s,307,430,901,91,fill=C['warm'],line=C['warm'],at='C074');text(s,329,446,855,60,'Proposed reallocation · Manager review required\nReason: a size request and a possible source at another branch.',size=22,bold=True,at='C074')
button(s,309,549,310,'Review proposal','C075',k='actor');button(s,640,549,204,'Approve','C075',k='check');button(s,865,549,204,'Reject','C075',k='end');focus(s,306,546,767,49,'C075','C077');icon(s,'pointer',797,571,27,'C075','C076');text(s,309,608,899,28,'No transfer executed · Data quality and backtesting required',size=17,color=C['muted'],at='C077')

# 07: brief -> three genuinely layered creative concepts -> editorial gate. Imagery is demo only.
s=base(6,'From a brief to three directions for review.','AI marketing studio',216.0);frame(s,'AI marketing studio · Draft concepts only')
crop(s,'S07_storyboard',73,251,291,372,(670,405,323,413));text(s,387,251,815,37,'Brief: seasonal tailoring in neutral tones',size=25,bold=True,at='C081');text(s,387,298,815,28,'DEMO collection · Production assets and rights must be approved',size=18,color=C['muted'],at='C083')
for i,(label,copy,pi) in enumerate([('Modern occasion','Tailoring for your next occasion.',0),('City layers','A considered look for the everyday.',1),('Everyday refinement','Simple pieces. Thoughtful combinations.',2)]):
 x=387+i*281;box(s,x,346,258,225,fill=C['soft'],line=C['soft'],at='C082')
 if i==0:
  product(s,0,x+130,371,112,141,'C082',label=False);text(s,x+14,366,105,69,'Your next\noccasion',size=22,bold=True,at='C082');line(s,x+15,460,x+103,460,'C082',color=C['accent'])
 elif i==1:
  product(s,1,x+30,387,107,128,'C082',label=False);text(s,x+141,366,102,66,'Style in\nmotion',size=22,bold=True,at='C082');line(s,x+146,463,x+231,463,'C082',color=C['accent'])
 else:
  product(s,0,x+18,376,87,115,'C082',label=False);product(s,2,x+144,378,90,114,'C082',label=False);text(s,x+14,352,230,30,'Thoughtful combinations',size=18,bold=True,at='C082')
 text(s,x+14,487,230,19,'DRAFT · Demo creative',size=13,color=C['muted'],at='C082');text(s,x+14,518,230,31,label,size=20,bold=True,at='C082');text(s,x+14,557,230,64,copy,size=18,at='C082')
focus(s,382,343,830,253,'C086','C087')
box(s,384,622,827,18,fill=C['paper'],line=C['paper'],r=0,at='C087');text(s,387,612,817,29,'Human brand review → approval before publication',size=19,bold=True,color=C['accent'],at='C087');focus(s,382,606,830,36,'C088')

# 08: source-backed executive brief, not a fabricated performance dashboard.
s=base(7,'A concise insight. A visible path to its sources.','Executive AI intelligence',246.9);frame(s,'Executive brief · ILLUSTRATIVE DEMO — NOT CONCRETE RESULTS')
text(s,76,254,362,35,'Permitted source signals',size=24,bold=True)
for i,(lab,k,ev) in enumerate([('Sales','invoice','C093'),('Inventory','case','C094'),('Customer service','call','C095'),('Customer permissions','lock','C096')]):
 y=321+i*63;icon(s,k,77,y+5,25,ev);text(s,125,y+1,307,36,lab,size=24,bold=True,at=ev);line(s,76,y+48,428,y+48,ev)
line(s,461,251,461,624);text(s,491,254,714,35,'Executive brief · Demo',size=26,bold=True,at='C098');box(s,490,316,715,182,fill=C['warm'],line=C['warm'],at='C099');text(s,513,337,668,112,'A size request needs follow-up.\nCheck branch stock and the last\nrecorded service interaction.',size=28,bold=True,at='C100')
icon(s,'link',492,534,27,'C101');text(s,536,527,663,62,'DEMO-STOCK-A-M · DEMO-CALL-1008\nOpen source records before acting.',size=20,color=C['muted'],ltr=True,at='C101');focus(s,484,523,725,78,'C101','C103');text(s,492,608,704,29,'Next question: would an authorized transfer help?',size=20,bold=True,color=C['accent'],at='C105');focus(s,487,312,722,190,'C107')

# 09: connected employee/customer/team story, then an actual scoped roadmap—not a percentage monitor.
s=base(8,'One connected vision. A practical first step.','Roadmap',283.0)
crop(s,'S05_storyboard',48,168,450,383,(486,247,678,578));box(s,48,552,450,94,fill=C['paper'],r=0);text(s,72,569,403,67,'Customer experience\nwith people in control.',size=25,bold=True)
box(s,521,168,711,478,r=10);text(s,547,194,658,41,'Discover → pilot → measure → expand',size=27,bold=True)
for i,(lab,k,ev) in enumerate([('Customer','actor','C110'),('Teams','speech','C111'),('Management','settings','C112')]):
 x=549+i*221;icon(s,k,x,264,27,ev);text(s,x+42,259,160,35,lab,size=21,bold=True,at=ev)
line(s,548,313,1207,313,'C113');text(s,548,346,657,67,'Inspect existing systems\nand native capabilities first.',size=25,bold=True,at='C114',until='C118');text(s,548,427,657,53,'Prioritize by value and feasibility.',size=23,color=C['muted'],at='C115',until='C118')
for i,(y,n,ev) in enumerate([(354,'Authorized, scoped pilot','C118'),(424,'Measure the actual result','C119'),(494,'Expand from evidence','C120')]):
 circle(s,550,y+5,26,C['warm'],ev);icon(s,'check' if i==1 else 'link' if i==2 else 'quality',555,y+10,16,ev);text(s,596,y,609,37,n,size=26,bold=True,at=ev)
text(s,549,582,653,42,'GRINDCTRL × Concrete · Proposed collaboration',size=22,bold=True,color=C['accent'],ltr=True,at='C121');focus(s,542,341,667,201,'C122')

for s in slides:
 for cue in T['cues']:
  if cue['scene_id']==s['id']:s['notes'].append(B(f"{cue['id']} · {cue['start']:.3f}–{cue['end']:.3f}s · {cue['spoken_phrase']}"))
 for e in s['elements']:
  assert e['at']>=s['start']-.001,(s['id'],e)
  if e['type']=='rect':assert min(int(e['fill'][i:i+2],16) for i in (1,3,5))>=220
  if e['type']=='crop':
   b=e['crop'];assert min(b['x'],b['y'])>=0 and b['x']+b['w']<=1672 and b['y']+b['h']<=941

events=[]
for s in slides:
 for a in sorted(set(e['at'] for e in s['elements'] if e['at']>s['start']+.001)):
  d,c,k=min([(abs(c[k]-a),c,k) for c in T['cues'] for k in ['start','end']],key=lambda x:x[0]);events.append(dict(scene=s['id'],at=a,cue_id=c['id'],speech_anchor=k,anchor_difference_seconds=round(d,6),phrase_trigger=c['spoken_phrase'],objects=[e.get('text',{}).get('en',e.get('key',e['type'])) for e in s['elements'] if e['at']==a]))
T['visual_events']=events
story=dict(title=B('GRINDCTRL × Concrete — Part 04: AI opportunities across the business'),colors=C,slides=slides,timeline=T,ui_fidelity=dict(status='illustrative',actual_screens_verified=False,actual_catalog_verified=False),sources=[dict(file='Concrete contract (29-11-2023).pdf',pages=[4,5],supports=B('Contracted screen-pop scope and Prism integration migration; not proof of live operation or current AI entitlements.')),dict(file='Part 04 supplied storyboards and narration',pages=[],supports=B('Art direction and business concepts. Generated UI, facts and metrics corrected.'))],print_appendices=[dict(index=2,time=75.8,title=B('Size guidance requires a valid product source.')),dict(index=3,time=105.8,title=B('Ground AI guidance in an approved policy.')),dict(index=4,time=143.6,title=B('Consented preferences inform an outfit suggestion.')),dict(index=5,time=178.1,title=B('A human manager reviews the stock proposal.'))])
(R/'story.json').write_text(json.dumps(story,ensure_ascii=False,indent=2));(R.parent/'actual_audio_cues.json').write_text(json.dumps(T,ensure_ascii=False,indent=2))
with (R.parent/'narration-to-animation.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['scene','seconds','cue','speech_anchor','spoken_phrase','visual_change']);w.writerows([e['scene'],e['at'],e['cue_id'],e['speech_anchor'],e['phrase_trigger'],' / '.join(e['objects'])] for e in events)
(R.parent/'STORYBOARD.md').write_text('# Part 04 — layered production storyboard\n\nOne continuous audio track. All photographs/product records and screens are illustrative. Source PNG concepts rebuilt as animatable native UI, never rendered as nine flat plates.\n\n'+'\n\n'.join(f"## {s['id']} · {s['start']:.3f}–{s['end']:.3f}s\n\n{s['title']['en']}\n\n"+'\n'.join(f"- {e['at']:.3f}s · {e['cue_id']}: "+' / '.join(e['objects']) for e in events if e['scene']==s['id']) for s in slides))
print('Nine fresh layered scenes;',len(events),'speech-anchored events; ONE locked narration.')
