"""Fresh Part 03 scene architecture. Only the approved palette/artwork and player runtime are reused."""
from pathlib import Path
import json
R=Path(__file__).parent;T=json.loads((R.parent/'audio-cue-map.json').read_text());TS={c['id']:c['start'] for c in T['cues']};TE={c['id']:c['end'] for c in T['cues']}
F=json.loads((R/'fixtures.json').read_text());P=F['customer'];CALLS=F['calls'];NEW=F['newNote']
C=dict(bg='#F8F7F4',paper='#FFFFFF',ink='#262626',muted='#68645E',line='#E6E3DE',accent='#965318',gold='#FFBA65',green='#49654E',soft='#F4F2EE',sage='#EFF4EE',warm='#FFF2DD',shadow='#EDEAE4')
B=lambda en,ar=None:dict(en=en,ar=ar or en)
slides=[]
def t(v):return TS[v] if isinstance(v,str) else v
def add(s,k,at=None,until=None,slot=None,**kw):
 e=dict(type=k,at=t(at) if at is not None else s['start'],until=t(until) if until is not None else None,slot=slot,**kw);s['elements'].append(e);return e
def text(s,x,y,w,h,en,ar=None,size=22,bold=False,color=None,at=None,until=None,slot=None,align='start',role='ui',ltr=False,**meta):
 return add(s,'text',at,until,slot,x=x,y=y,w=w,h=h,text=B(en,ar),size=size,bold=bold,color=color or C['ink'],align=align,role=role,ltr=ltr,**meta)
def box(s,x,y,w,h,fill=None,r=6,line=None,at=None,until=None,slot=None):return add(s,'rect',at,until,slot,x=x,y=y,w=w,h=h,fill=fill or C['paper'],line=line or C['line'],radius=r)
def img(s,key,x,y,w,h,at=None,until=None,slot=None):return add(s,'image',at,until,slot,key=key,x=x,y=y,w=w,h=h)
def icon(s,key,x,y,d=24,at=None,until=None,slot=None):return img(s,'icon-'+key,x,y,d,d,at,until,slot)
def line(s,x,y,x2,y2,at=None,until=None,color=None,width=1,arrow=False,slot=None):return add(s,'line',at,until,slot,x=x,y=y,x2=x2,y2=y2,color=color or C['line'],width=width,arrow=arrow)
def focus(s,x,y,w,h,at,until=None):return add(s,'outline',at,until,None,x=x,y=y,w=w,h=h,color=C['gold'],radius=6,width=2)
def circle(s,x,y,d,at=None,until=None,fill=None,slot=None):return add(s,'ellipse',at,until,slot,x=x,y=y,w=d,h=d,fill=fill or C['soft'],line=fill or C['soft'])
def base(i,title,section,static):
 ch=T['chapters'][i];s=dict(index=i,id=ch['id'],start=ch['start'],end=ch['end'],title=B(title),section=B(section),dark=False,elements=[],slots={'genesys.call':dict(x=48,y=232,w=256,h=414),'customer.context':dict(x=328,y=232,w=881,h=414)},cameras=[],notes=[],static_time=static,motion=dict(fade=350));slides.append(s)
 img(s,'brand',48,27,43,29);text(s,104,29,370,31,'GRINDCTRL × Concrete',size=18,bold=True,ltr=True,role='framing')
 text(s,650,29,582,30,'Part 03 · '+section,size=16,color=C['muted'],align='end',role='framing')
 text(s,48,94,1184,52,title,size=38,bold=True,role='heading')
 line(s,48,670,1232,670);text(s,48,683,1080,24,'Proposed experience · Illustrative UI · Synthetic records · Sources and permissions to validate',size=14,color=C['muted'],role='framing');text(s,1146,683,86,24,f'{i+1:02} / 08',size=14,align='end',ltr=True,role='framing')
 s['notes']=[B('New GRINDCTRL collaboration proposal. No authorized Concrete interface captures, tenant access, production configuration or measured results were available. This is a deliberately illustrative employee workspace, not a screenshot or a running connector.'),B('The November 2023 contract, PDF p.4, scopes CRM URL pop up integration. Inspect that configuration first; the contract does not prove deployment or live operation. Concrete reported manual phone-number search in Zoho Desk. No active Zoho CRM assumption.'),B('Caller number is a search key, not verified identity. Contact association and sensitive field/history disclosure need the agreed identity process and equivalent source permissions. Membership source, native call-note storage, call-ID mapping, retention and supported display are unknown.')]
 return s

def shell(s,at=None,until=None):
 box(s,48,172,1184,478,fill=C['shadow'],line=C['shadow'],r=10,at=at,until=until);box(s,48,168,1184,478,r=10,at=at,until=until)
 img(s,'genesys',68,184,126,30,at,until);text(s,222,188,250,30,'Voice interaction',size=18,color=C['muted'],at=at,until=until)
 text(s,574,188,456,29,'Customer 360° · Proposed workspace',size=17,color=C['muted'],at=at,until=until)
 icon(s,'actor',1113,185,24,at,until);text(s,1151,189,61,25,'Agent',size=16,ltr=True,at=at,until=until)
 line(s,48,230,1232,230,at,until);line(s,303,230,303,646,at,until)

def call(s,at=None,until=None,state='active',later=False):
 slot='genesys.call';circle(s,77,261,54,at,until,C['sage'],slot);icon(s,'call',93,277,23,at,until,slot)
 text(s,147,266,136,32,'Inbound call',size=20,bold=True,at=at,until=until,slot=slot)
 text(s,76,342,203,29,'Caller number',size=16,color=C['muted'],at=at,until=until,slot=slot)
 text(s,76,375,208,56,P['phone'],size=23,bold=True,ltr=True,at=at,until=until,slot=slot)
 circle(s,78,444,8,at,until,C['green'] if state=='active' else C['accent'],slot);text(s,100,432,184,33,'Call active' if state=='active' else 'After call (demo)',size=20,bold=True,color=C['green'] if state=='active' else C['accent'],at=at,until=until,slot=slot)
 text(s,76,484,208,28,'Agent E' if later else 'Agent D',size=18,at=at,until=until,slot=slot)
 text(s,76,516,208,27,'DEMO-1015' if later else 'DEMO-1012',size=18,ltr=True,color=C['muted'],at=at,until=until,slot=slot)
 text(s,76,550,208,24,'15 Oct · 09:10' if later else '12 Oct · 10:24',size=15,ltr=True,color=C['muted'],at=at,until=until,slot=slot)
 for j,k in enumerate(['mic','pause','end']):circle(s,76+j*66,590,38,at,until,None,slot);icon(s,k,86+j*66,600,18,at,until,slot)

def profile(s,at=None,until=None,missing=False):
 slot='customer.context';text(s,328,252,416,36,'Customer profile',size=24,bold=True,at=at,until=until,slot=slot)
 text(s,788,257,421,27,'Associated record · Demo disclosure permitted',size=15,color=C['muted'],align='end',at=at,until=until,slot=slot)
 vals=[('Phone number',P['phone'],'call'),('Customer name',P['name'],'actor'),('Icons Club segment','Not available' if missing else 'ELITE · Demo','quality'),('Email','Not available' if missing else P['email'],'mail')]
 for i,(label,val,k) in enumerate(vals):
  x=328+i*223
  icon(s,k,x,302,19,at,until,slot);text(s,x+29,299,178,25,label,size=15,color=C['muted'],at=at,until=until,slot=slot)
  text(s,x,329,210,33,val,size=20 if i in (0,1,3) else 22,bold=i in (1,2),color=C['muted'] if missing and i>1 else C['accent'] if i==2 else C['ink'],ltr=True,at=at,until=until,slot=slot)
 line(s,328,376,1209,376,at,until,slot=slot)

def list_calls(s,at=None,until=None,selected=0,future=False,dates=None,agents=None):
 slot='customer.context';cs=([CALLS[3]]+CALLS[:2]) if future else CALLS[:3]
 text(s,328,391,260,29,'Call activity',size=21,bold=True,at=at,until=until,slot=slot)
 for i,c in enumerate(cs):
  y=435+i*65;box(s,328,y,270,56,fill=C['warm'] if i==selected else C['paper'],line=C['gold'] if i==selected else C['line'],r=5,at=at,until=until,slot=slot)
  icon(s,'call',340,y+11,18,at,until,slot);text(s,369,y+5,118,25,c['dateLabel'][:6],size=18,bold=True,ltr=True,at=dates or at,until=until,slot=slot);text(s,503,y+6,83,24,c['timeLabel'],size=16,ltr=True,at=dates or at,until=until,slot=slot)
  text(s,340,y+31,133,20,c['id'],size=14,color=C['muted'],ltr=True,at=dates or at,until=until,slot=slot);text(s,486,y+31,100,20,c['agent'],size=14,color=C['muted'],ltr=True,at=agents or at,until=until,slot=slot)
 line(s,621,393,621,622,at,until,slot=slot)

def detail(s,i=0,at=None,until=None,extra=None):
 slot='customer.context';c=CALLS[i];note=NEW if i==3 else c['notes'][0]['text']
 text(s,648,390,548,32,'12 Oct call · Original note' if i==3 else c['dateLabel']+' call · Original note',size=22,bold=True,ltr=True,at=at,until=until,slot=slot)
 icon(s,'actor',650,437,20,at,until,slot);text(s,681,432,273,28,c['agent']+' · '+c['id'],size=18,color=C['muted'],ltr=True,at=at,until=until,slot=slot)
 text(s,971,433,237,27,'Written 10:29' if i==3 else 'Written 14:36' if i==0 else 'Written 11:12',size=15,color=C['muted'],ltr=True,align='end',at=at,until=until,slot=slot)
 box(s,648,478,561,117,fill=C['warm'],line=C['warm'],r=5,at=at,until=until,slot=slot);icon(s,'pen',665,492,20,at,until,slot);text(s,699,490,485,25,'Human-written agent note',size=16,color=C['accent'],at=at,until=until,slot=slot)
 text(s,666,528,520,61,note,size=22,bold=True,ltr=True,at=at,until=until,slot=slot,note_interaction_id=c['id'],human_author=c['agent'])
 text(s,648,607,561,26,extra or 'Source: '+c['id']+' · No global-note merge',size=16,color=C['muted'],ltr=True,at=at,until=until,slot=slot)

def message(s,title,detail,at,until=None,k='search'):
 icon(s,k,356,292,42,at,until);text(s,421,293,747,50,title,size=29,bold=True,at=at,until=until)
 text(s,356,365,825,86,detail,size=22,color=C['muted'],at=at,until=until)

def history_overview(s,at=None,until=None,dates=None,agents=None,notes=None):
 slot='customer.context';text(s,328,394,453,31,'Call activity',size=23,bold=True,at=at,until=until,slot=slot);text(s,807,398,402,25,'Retained · Linked · Permitted',size=16,color=C['muted'],align='end',at=at,until=until,slot=slot)
 line(s,355,445,355,610,at,until,color=C['line'],width=2,slot=slot)
 for i,c in enumerate(CALLS[:3]):
  y=437+i*62;circle(s,347,y+13,16,at,until,C['warm'],slot);icon(s,'call',350,y+16,10,at,until,slot)
  text(s,386,y+1,188,27,c['dateLabel'][:6]+' · '+c['timeLabel'],size=19,bold=True,ltr=True,at=dates or at,until=until,slot=slot)
  text(s,386,y+32,188,22,c['id'],size=15,color=C['muted'],ltr=True,at=dates or at,until=until,slot=slot)
  text(s,602,y+1,126,27,c['agent'],size=19,bold=True,ltr=True,at=agents or at,until=until,slot=slot)
  icon(s,'pen',747,y+4,21,notes or at,until,slot);text(s,784,y+1,413,54,c['notes'][0]['text'],size=19,ltr=True,at=notes or at,until=until,slot=slot,note_interaction_id=c['id'],human_author=c['agent'])

# S01: recap the ACTUAL approved employee experience, then deepen the same canvas.
s=base(0,'One call. A customer you can understand.','The next layer',36.5);shell(s);call(s);profile(s)
text(s,328,395,355,31,'Previous tickets',size=22,bold=True,until='C015');box(s,328,442,270,132,fill=C['soft'],until='C015');icon(s,'file',346,460,25,until='C015');text(s,388,458,192,54,'T101 · Exchange request',size=20,bold=True,until='C015');text(s,346,526,234,45,'Branch review pending',size=19,color=C['muted'],until='C015')
img(s,'zoho',657,395,66,31,until='C015');text(s,747,399,445,29,'Zoho Desk · Ticket context',size=18,color=C['muted'],until='C015');box(s,648,452,560,124,fill=C['warm'],line=C['warm'],until='C015');text(s,671,477,514,71,'Branch review is still pending.',size=25,bold=True,until='C015');icon(s,'search',1115,594,25,'C006','C009');text(s,649,593,439,27,'Lookup and safe record selection',size=17,color=C['muted'],at='C006',until='C009')
history_overview(s,'C015',dates='C015',agents='C015',notes='C016');focus(s,70,371,216,58,'C012','C014');focus(s,324,293,888,69,'C014','C015');focus(s,738,436,469,56,'C016','C017')

# S02: number -> authorized candidate lookup -> FOUR fields together, then emphasis follows speech.
s=base(1,'An incoming call. Four useful fields.','Caller lookup',62.8);shell(s);call(s)
message(s,'Incoming caller','The call stays in Genesys while customer context is retrieved.',s['start'],'C021',k='call')
message(s,'Lookup using the caller number','Permitted record search · Source and identity process to validate.','C021','C023')
icon(s,'search',353,466,24,'C021','C023');text(s,397,460,747,45,P['phone'],size=28,bold=True,ltr=True,at='C021',until='C023');line(s,286,400,342,400,'C022','C023',color=C['accent'],width=2,arrow=True)
message(s,'A candidate record is associated','Phone association is not identity proof.\nUse the agreed checks before disclosure.','C023','C024',k='actor')
profile(s,'C024');history_overview(s,'C024');focus(s,322,293,218,69,'C026','C027');focus(s,546,293,219,69,'C028')

# S03: show all core fields and the actual vocabulary; source remains conditional.
s=base(2,'Membership comes from a record, not a guess.','Icons Club',81.0);shell(s);call(s);profile(s)
text(s,328,397,878,34,'Concrete Icons Club',size=25,bold=True,ltr=True)
box(s,328,455,881,61,fill=C['soft'],r=5)
for i,n in enumerate(['LIFESTYLE','PRESTIGE','ELITE']):
 x=346+i*289;text(s,x,473,261,32,n,size=22,bold=i==2,align='center',ltr=True,at='C031')
 if i<2:line(s,x+273,469,x+273,501)
focus(s,924,452,280,66,'C031','C034');focus(s,774,293,215,69,'C030','C033')
icon(s,'link',329,552,26,'C032');text(s,373,549,828,57,'Illustrative ELITE record · Trusted membership source to verify.\nIf no tier is available, show “Not available”.',size=21,color=C['muted'],at='C032')
focus(s,998,293,214,69,'C034','C035')

# S04: dates, authors and original notes become perceptually attached to individual calls.
s=base(3,'Every call has its own note.','Per-call history',112.9);shell(s);call(s);profile(s)
icon(s,'clock',339,438,38,until='C043');text(s,399,429,792,88,'Know what happened in the previous conversation.',size=29,bold=True,until='C043')
history_overview(s,'C043',until='C049',dates='C045',agents='C046',notes='C048');focus(s,380,436,206,183,'C045','C046');focus(s,594,436,134,183,'C046','C048');focus(s,743,435,463,185,'C048','C049')
list_calls(s,'C049',until='C050');detail(s,0,'C049','C050');list_calls(s,'C050',selected=1);detail(s,1,'C050');icon(s,'pointer',578,521,24,'C050','C051')

# S05: the original human note -> an informed continuation; no invented decision.
s=base(4,'Read where the last conversation stopped.','An exchange follow-up',158.8);shell(s);call(s);profile(s)
list_calls(s,until='C060');detail(s,0,until='C060');focus(s,774,292,216,70,'C053','C054');focus(s,645,475,567,121,'C055','C057')
box(s,648,607,561,27,fill=C['paper'],line=C['paper'],r=0,at='C057',until='C060');text(s,648,604,561,31,'Today: the customer asks for the latest update.',size=18,color=C['green'],at='C058',until='C060')
list_calls(s,'C060');detail(s,0,'C061');icon(s,'pointer',578,456,25,'C060','C061');focus(s,645,475,567,121,'C061','C068')
box(s,647,602,564,33,fill=C['paper'],line=C['paper'],r=0,at='C069');icon(s,'clock',650,607,19,'C069');text(s,681,603,527,30,'Review requested · Completion not confirmed',size=18,bold=True,color=C['accent'],at='C069')

# S06: new note authored for DEMO-1012. Future active call DEMO-1015 reads that SAME source.
s=base(5,'Write for this call. Retrieve this same call.','Note ownership',189.8);shell(s);call(s,until='C076');call(s,'C076','C079',state='after');call(s,'C079',later=True);profile(s)
text(s,328,394,850,35,'Current call note · Human Agent D',size=24,bold=True,until='C079');text(s,328,435,867,28,'Call ID: DEMO-1012 · 12 Oct 2026 · 10:24',size=18,color=C['muted'],ltr=True,until='C079')
box(s,328,478,881,94,line=C['gold'],until='C079');e=text(s,351,491,831,71,NEW,size=25,ltr=True,at='C073',until='C079',note_interaction_id='DEMO-1012',human_author='Agent D');e['typing']=dict(start=TS['C073'],end=TE['C075'])
text(s,328,593,596,29,'Draft · Proposed recording mechanism',size=18,color=C['muted'],until='C077');text(s,328,593,628,29,'Recorded in demo · Source remains DEMO-1012',size=18,color=C['green'],at='C077',until='C079')
box(s,990,589,219,42,fill=C['warm'],line=C['warm'],r=5,until='C079');text(s,1000,597,199,29,'Record note (demo)',size=17,bold=True,align='center',until='C079');icon(s,'pointer',1174,609,26,'C077','C078');focus(s,323,429,886,36,'C077','C079')
list_calls(s,'C079',future=True);text(s,648,390,561,33,'Later call · 15 Oct · Agent E',size=21,color=C['green'],at='C079',until='C081');detail(s,3,'C081',extra='Original author: Agent D · Original call: DEMO-1012');icon(s,'pointer',578,456,25,'C080','C081');focus(s,677,426,277,39,'C081','C083');focus(s,645,475,567,121,'C083')

# S07: preserve the live call rail while independent, safe fallback states change.
s=base(6,'Keep the call. Show only what is known.','Safe fallbacks',211.0);shell(s);call(s)
message(s,'Lookup temporarily unavailable','Service failure is not an empty call history.\nContinue the existing manual procedure.',s['start'],'C087',k='warning');text(s,355,539,849,52,'Illustrative failure case · The call remains active.',size=20,color=C['green'],until='C087')
message(s,'No matching record','Continue with manual search. Do not invent a customer record.','C087','C089');box(s,355,481,330,54,fill=C['soft'],at='C088',until='C089');icon(s,'search',373,498,23,'C088','C089');text(s,416,491,244,35,'Manual search',size=22,bold=True,at='C088',until='C089')
text(s,328,267,880,46,'More than one possible customer',size=28,bold=True,at='C089',until='C092')
for i,n in enumerate([P['name'],'Customer B (DEMO)']):
 y=341+i*88;box(s,328,y,881,69,fill=C['soft'],at='C089',until='C092');icon(s,'actor',349,y+22,25,'C089','C092');text(s,395,y+18,387,37,n,size=23,bold=True,ltr=True,at='C089',until='C092');text(s,835,y+20,351,32,P['phone'],size=21,ltr=True,at='C089',until='C092')
icon(s,'lock',328,541,28,'C090','C092');text(s,377,537,829,63,'Verify, then choose the correct record.\nCandidate history stays hidden until permitted.',size=22,color=C['muted'],at='C090',until='C092');focus(s,324,337,888,77,TE['C091'],'C092')
profile(s,'C092',missing=True);icon(s,'lock',335,422,26,'C092');text(s,381,419,820,58,'Missing fields stay “Not available”.\nHistory and notes remain subject to permissions.',size=22,color=C['muted'],at='C092');focus(s,774,292,438,71,'C093');text(s,328,553,870,39,'No inference from caller number, spending, or appearance.',size=19,color=C['muted'],at='C094')

# S08: inspect the existing setup, conditionally choose native/bridge, then validate on test calls.
s=base(7,'Inspect what exists. Change only what is needed.','Implementation and pilot',284.5)
box(s,48,168,1184,478,r=10,until='C108');text(s,75,191,1120,38,'Review the existing configuration',size=26,bold=True,until='C108')
img(s,'genesys',76,258,135,32,'C096','C108');text(s,244,260,409,35,'Genesys · Contracted screen pop',size=22,bold=True,ltr=True,at='C096',until='C108');text(s,687,260,517,35,'Contracted scope · Operation unverified',size=19,color=C['muted'],at='C096',until='C108')
img(s,'zoho',80,321,70,32,'C097','C108');text(s,244,321,409,35,'Zoho Desk · Records to inspect',size=22,bold=True,ltr=True,at='C097',until='C108');text(s,687,321,517,35,'Inspect records, permissions and display',size=19,color=C['muted'],at='C097',until='C108')
line(s,75,371,1207,371,'C098','C108');icon(s,'call',79,396,27,'C098','C108');text(s,123,390,374,36,'Call ID ↔ Human note',size=22,bold=True,ltr=True,at='C098',until='C108');text(s,550,392,646,58,'Locate storage, ownership, retention and access.\nKeep call notes separate from ticket/global notes.',size=20,color=C['muted'],at='C098',until='C108')
icon(s,'quality',80,469,25,'C099','C108');text(s,124,463,372,35,'Icons Club segment',size=22,bold=True,ltr=True,at='C099',until='C108');text(s,550,466,646,38,'Trusted source and update policy: to validate.',size=20,color=C['muted'],at='C099',until='C108')
box(s,76,540,1130,83,fill=C['soft'],r=5,at='C101',until='C104');icon(s,'settings',93,561,29,'C101','C104');text(s,139,552,479,59,'Existing native features\nif they meet the requirement',size=21,bold=True,at='C101',until='C104');line(s,640,549,640,615,'C102','C104');icon(s,'link',668,562,28,'C102','C104');text(s,715,552,468,58,'Smallest supported integration\nonly for a verified gap',size=21,color=C['muted'],at='C102',until='C104')
text(s,76,539,1127,30,'Authorized pilot · Observations to record, not claimed results',size=19,bold=True,at='C104',until='C108')
for i,(en,k,ev) in enumerate([('Field accuracy','actor','C105'),('Call ↔ own note','pen','C106'),('Permitted access','lock','C107')]):
 x=82+i*377;icon(s,k,x,586,25,ev,'C108');text(s,x+44,579,310,36,en,size=22,bold=True,at=ev,until='C108')
# Last 31 seconds: a full employee scene and future retrieval. No title-only outro.
shell(s,'C108');call(s,'C108',later=True);profile(s,'C108');list_calls(s,'C108',future=True);detail(s,3,'C108',extra='Agent E reads Agent D’s original DEMO-1012 note.')
for e in s['elements']:
 if e.get('role')=='heading':e['until']=TS['C108']
text(s,48,94,1184,52,'The next call starts with the last recorded note.',size=38,bold=True,at='C108',role='heading')
focus(s,546,293,219,69,'C111','C112');focus(s,774,293,219,69,'C112','C113');focus(s,324,430,277,63,'C113','C114');focus(s,645,475,567,121,'C114','C117');focus(s,645,475,567,121,'C119')

for s in slides:
 s['notes'].append(B('Call notes shown here are human-authored, source-linked synthetic records. They are distinct from ticket notes, global customer notes, transcripts, recordings and AI summaries. New note: DEMO-1012, author D. Later active call: DEMO-1015, agent E. E reads the original D note; its call ID, date and author do not change. Storage/write/retention/permissions are proposed until actual mechanisms are verified.'))
 for c in T['cues']:
  if c['scene_id']==s['id']:s['notes'].append(B(f"{c['id']} · {c['start']:.3f}–{c['end']:.3f}s · {c['spoken_phrase']}"))
 for e in s['elements']:
  assert e['at']>=s['start']-.001,(s['id'],e)
  if e['type']=='rect':assert min(int(e['fill'][i:i+2],16) for i in (1,3,5))>=220
story=dict(title=B('GRINDCTRL × Concrete — Part 03: Customer 360° call experience'),colors=C,slides=slides,timeline=T,fixtures=F,sources=[dict(file='Concrete contract (29-11-2023).pdf',pages=[4],supports=B('CRM URL pop up integration contracted. Not operational evidence.')),dict(file='User / Sales Manager requirement',pages=[],supports=B('Four profile fields and source-linked per-call notes. Reported needs, not independently verified tenant behavior.'))],ui_fidelity=dict(status='illustrative',concrete_screenshots_verified=False,native_layout_verified=False,display_model='Proposed companion interaction workspace; actual supported placement and note mechanisms remain to validate.'),print_appendices=[dict(index=5,time=172.0,title=B('Write a human note for the current call.')),dict(index=6,time=200.0,title=B('Service failure: preserve the active call.')),dict(index=6,time=204.8,title=B('No match: continue manual search.')),dict(index=6,time=219.0,title=B('Missing fields remain unavailable.')),dict(index=7,time=241.3,title=B('Inspect sources and the smallest suitable change.')),dict(index=7,time=254.3,title=B('Authorized test calls: accuracy, ownership and access.'))])
events=[]
for slide in slides:
 for at in sorted(set(e['at'] for e in slide['elements'] if e['at']>slide['start']+.001)):
  d,c,anchor=min([(abs(c[k]-at),c,k) for c in T['cues'] for k in ['start','end']],key=lambda z:z[0])
  events.append(dict(scene=slide['id'],at=at,cue_id=c['id'],spoken_phrase=c['spoken_phrase'],speech_anchor=anchor,anchor_difference_seconds=round(d,6),objects=[e.get('text',{}).get('en',e.get('key',e['type'])) for e in slide['elements'] if e['at']==at],method='Source waveform phrase '+anchor+'; not inferred individual-word time'))
story['timeline']['visual_events']=events
(R/'story.json').write_text(json.dumps(story,ensure_ascii=False,indent=2));(R.parent/'audio-cue-map.json').write_text(json.dumps(story['timeline'],ensure_ascii=False,indent=2));print('New 8-scene geometry built from 120 replacement-audio phrases.')
