from pathlib import Path
import json
R=Path(__file__).parent;T=json.loads((R.parent/'part03-cue-timeline.json').read_text());ts={c['id']:c['start'] for c in T['cues']};te={c['id']:c['end'] for c in T['cues']}
B=lambda a,b=None:dict(en=a,ar=b or a)
C=dict(bg='#F8F7F4',paper='#FFFFFF',ink='#262626',muted='#68645E',line='#E6E3DE',accent='#965318',gold='#FFBA65',green='#49654E',soft='#F4F2EE',sage='#EFF4EE',warm='#FFF2DD',shadow='#EDEAE4')
slides=[]
def tm(v):return ts[v] if isinstance(v,str) else v
def add(s,k,at=None,until=None,slot=None,**kw):
 e=dict(type=k,at=tm(at) if at is not None else s['start'],until=tm(until) if until is not None else None,slot=slot,**kw);s['elements'].append(e);return e
def txt(s,x,y,w,h,a,b=None,size=22,color=None,bold=False,align='start',ltr=False,at=None,until=None,slot=None,role='ui'):return add(s,'text',at,until,slot,x=x,y=y,w=w,h=h,text=B(a,b),size=size,color=color or C['ink'],bold=bold,align=align,ltr=ltr,role=role)
def rect(s,x,y,w,h,fill=None,line=None,r=8,at=None,until=None,slot=None):return add(s,'rect',at,until,slot,x=x,y=y,w=w,h=h,fill=fill or C['paper'],line=line or C['line'],radius=r)
def circle(s,x,y,d,fill=None,at=None,until=None,slot=None):return add(s,'ellipse',at,until,slot,x=x,y=y,w=d,h=d,fill=fill or C['soft'],line=fill or C['soft'])
def img(s,key,x,y,w,h,at=None,until=None,slot=None):return add(s,'image',at,until,slot,key=key,x=x,y=y,w=w,h=h)
def icon(s,key,x,y,d=26,at=None,until=None,slot=None):return img(s,'icon-'+key,x,y,d,d,at,until,slot)
def line(s,x,y,x2,y2,color=None,width=1,arrow=False,at=None,until=None,slot=None):return add(s,'line',at,until,slot,x=x,y=y,x2=x2,y2=y2,color=color or C['line'],width=width,arrow=arrow)
def outline(s,x,y,w,h,at,until=None,slot=None):return add(s,'outline',at,until,slot,x=x,y=y,w=w,h=h,color=C['gold'],radius=8,width=2)
def avatar(s,x,y,d=42,at=None,until=None,slot=None):circle(s,x,y,d,C['warm'],at,until,slot);icon(s,'actor',x+d*.24,y+d*.24,d*.52,at,until,slot)
def base(i,title,ar,section,sectionar,static):
 ch=T['chapters'][i];s=dict(index=i,id=ch['id'],start=ch['start'],end=ch['end'],title=B(title,ar),section=B(section,sectionar),dark=False,elements=[],slots={},cameras=[],notes=[],static_time=static,motion=dict(fade=350));slides.append(s)
 img(s,'brand',48,27,43,29);txt(s,104,29,255,31,'GRINDCTRL × Concrete',size=18,bold=True,ltr=True,role='framing')
 txt(s,660,29,572,30,'Part 03 · '+section,'الجزء ٠٣ · '+sectionar,size=16,color=C['muted'],align='end',role='framing')
 txt(s,48,94,1184,52,title,ar,size=38,bold=True,role='heading')
 line(s,48,670,1232,670);txt(s,48,683,1080,24,'Proposed experience · Synthetic records · Native UI, sources and recording behavior to validate','تجربة مقترحة · سجلات خيالية · الواجهة والمصادر وطريقة الحفظ تحتاج تحققًا',size=14,color=C['muted'],role='framing')
 txt(s,1146,683,86,25,f'{i+1:02} / 08',size=14,color=C['muted'],ltr=True,align='end',role='framing')
 s['notes']=[B('New GRINDCTRL collaboration proposal. All visible records are fictional. Customer-reported workflow has not been independently verified. No live tenant screenshots, configuration, API access, licensing or performance results were inspected.','تعاون جديد مقترح من GRINDCTRL. السجلات خيالية. طريقة العمل بحسب الإفادة ولم تُختبر مستقلًا. لم يتم فحص واجهات العميل الفعلية أو الإعدادات أو API أو التراخيص أو نتائج الأداء.'),B('This illustrative interaction workspace does not guarantee a native embedded sidebar. Inspect the contracted CRM URL pop up integration (November 2023 PDF p.4), actual supported display and permission-equivalent lookup before implementation. Number association is not identity verification.','الشكل المنفصل للمكالمة والمعلومات توضيحي ولا يضمن شريطًا مدمجًا. نفحص بند CRM URL pop up integration في عقد نوفمبر ٢٠٢٣ صفحة ٤ وشكل العرض والصلاحيات قبل التنفيذ. مطابقة الرقم لا تثبت الهوية.')]
 return s

F=json.loads((R/'fixtures.json').read_text());P=F['customer'];CALLS=F['calls'];NEW=F['newNote']
def stage(s,until=None,at=None):
 rect(s,48,172,1184,478,fill=C['shadow'],line=C['shadow'],r=12,at=at,until=until);rect(s,48,168,1184,478,r=12,at=at,until=until)
 img(s,'genesys',70,185,128,30,at,until);txt(s,228,188,228,30,'Interaction workspace','مساحة المكالمة',size=18,color=C['muted'],at=at,until=until)
 txt(s,734,188,474,31,'Customer 360° · Illustrative','Customer 360° · نموذج توضيحي',size=20,bold=True,align='end',at=at,until=until)
 line(s,48,230,1232,230,at=at,until=until);line(s,312,230,312,646,at=at,until=until)
 s['slots']['genesys.call']=dict(x=48,y=230,w=264,h=416,anchors=dict(caller_number=[.08,.31,.86,.14],interaction=[.08,.59,.85,.12]))
 s['slots']['customer.context']=dict(x=332,y=242,w=888,h=392,anchors={})
def rail(s,at=None,until=None,state='active',later=False):
 slot='genesys.call';circle(s,70,264,65,C['sage'],at,until,slot);icon(s,'call',89,283,27,at,until,slot)
 txt(s,70,345,222,29,'Caller number','رقم المتصل',size=18,color=C['muted'],at=at,until=until,slot=slot)
 txt(s,70,383,224,41,P['phone'],size=22,bold=True,ltr=True,at=at,until=until,slot=slot)
 txt(s,70,438,224,31,'Later call (DEMO)' if later else 'After call (DEMO)' if state=='after_call' else 'Call active','مكالمة لاحقة (DEMO)' if later else 'بعد المكالمة (DEMO)' if state=='after_call' else 'مكالمة جارية',size=21,bold=True,color=C['green'] if state=='active' else C['muted'],at=at,until=until,slot=slot)
 txt(s,70,476,224,29,'Agent E' if later else 'Agent D','الموظف E' if later else 'الموظف D',size=19,at=at,until=until,slot=slot)
 txt(s,70,509,224,25,'DEMO-1015' if later else 'DEMO-1012',size=18,color=C['muted'],ltr=True,at=at,until=until,slot=slot)
 txt(s,70,540,224,22,'15 Oct · 09:10' if later else '12 Oct · 10:24',size=15,color=C['muted'],ltr=True,at=at,until=until,slot=slot)
 for j,key in enumerate(['mic','pause','end']):circle(s,70+j*64,565,42,at=at,until=until,slot=slot);icon(s,key,81+j*64,576,20,at,until,slot)
 txt(s,70,621,224,20,'Fictional interaction','مكالمة خيالية',size=14,color=C['muted'],at=at,until=until,slot=slot)
def profile(s,name=None,phone=None,segment=None,email=None,until=None,missing=False):
 slot='customer.context';avatar(s,338,250,46,name,until,slot)
 txt(s,402,248,473,40,P['name'],size=27,bold=True,ltr=True,at=name,until=until,slot=slot)
 icon(s,'call',404,304,22,phone,until,slot);txt(s,443,300,331,34,P['phone'],size=21,ltr=True,at=phone,until=until,slot=slot)
 if segment is not False:txt(s,941,248,259,28,'Concrete Icons Club',size=16,color=C['muted'],at=segment,until=until,slot=slot)
 if segment is not False:txt(s,941,284,259,36,'Segment not available' if missing else 'ELITE (Illustrative)','الفئة غير متاحة' if missing else 'ELITE (Illustrative)',size=21,bold=True,color=C['muted'] if missing else C['accent'],ltr=not missing,at=segment,until=until,slot=slot)
 if email is not False:icon(s,'mail',786,341,21,email,until,slot);txt(s,826,337,370,28,'Not available' if missing else P['email'],'غير متاح' if missing else P['email'],size=19,color=C['muted'] if missing else C['ink'],ltr=not missing,at=email,until=until,slot=slot)
 txt(s,402,340,367,25,'Associated record · Not identity proof','سجل مرتبط · لا يثبت هوية المتصل',size=16,color=C['muted'],at=name,until=until,slot=slot)
 line(s,338,375,1209,375,at=name,until=until,slot=slot)
def history(s,at=None,dates=None,agents=None,notes=None,until=None):
 slot='customer.context';txt(s,338,387,456,31,'Call activity','سجل المكالمات',size=23,bold=True,at=at,until=until,slot=slot)
 txt(s,814,391,395,28,'Retained · Linked · Permitted','محفوظة · مرتبطة · مسموحة',size=16,color=C['muted'],align='end',at=at,until=until,slot=slot)
 for i,c in enumerate(CALLS[:3]):
  y=433+i*66
  rect(s,338,y-4,871,61,fill=C['soft'] if i==0 else C['paper'],line=C['line'],r=5,at=at,until=until,slot=slot)
  txt(s,354,y+4,145,28,c['dateLabel'],size=18,bold=True,ltr=True,at=dates or at,until=until,slot=slot)
  txt(s,354,y+34,146,22,c['timeLabel']+' · Inbound',size=15,color=C['muted'],ltr=True,at=dates or at,until=until,slot=slot)
  txt(s,515,y+4,157,28,c['agent'],size=19,bold=True,ltr=True,at=agents or at,until=until,slot=slot)
  txt(s,515,y+34,157,22,c['id'],size=15,color=C['muted'],ltr=True,at=dates or at,until=until,slot=slot)
  icon(s,'pen',682,y+5,22,notes or at,until,slot)
  txt(s,721,y+3,469,53,c['notes'][0]['text'],size=19,ltr=True,at=notes or at,until=until,slot=slot)
def condensed(s,at=None,until=None,future=False):
 slot='customer.context';calls=([CALLS[3]]+CALLS[:3]) if future else CALLS[:3]
 txt(s,338,389,248,29,'Previous calls','المكالمات السابقة',size=21,bold=True,at=at,until=until,slot=slot)
 for i,c in enumerate(calls):
  y=430+i*(48 if future else 63)
  rect(s,336,y,249,42 if future else 55,fill=C['soft'] if i==0 else C['paper'],line=C['gold'] if i==0 else C['line'],r=5,at=at,until=until,slot=slot)
  txt(s,352,y+6,107,26,c['dateLabel'][:6],size=19,bold=True,ltr=True,at=at,until=until,slot=slot)
  txt(s,466,y+8,103,25,c['agent'],size=17,color=C['muted'],ltr=True,at=at,until=until,slot=slot)
  if not future:txt(s,352,y+33,215,20,c['id'],size=14,color=C['muted'],ltr=True,at=at,until=until,slot=slot)
 line(s,601,390,601,628,at=at,until=until,slot=slot)
def selected_note(s,at=None,until=None,current=False,caption=None):
 c=CALLS[3] if current else CALLS[0];note=NEW if current else c['notes'][0]['text'];slot='customer.context'
 txt(s,627,390,578,31,c['dateLabel']+' · '+c['timeLabel']+' · Inbound',size=20,bold=True,ltr=True,at=at,until=until,slot=slot)
 txt(s,627,428,321,29,c['agent']+' · '+c['id'],size=18,color=C['muted'],ltr=True,at=at,until=until,slot=slot)
 txt(s,961,432,244,24,'Note: 12 Oct · 10:29' if current else 'Note: 08 Oct · 14:36',size=15,color=C['muted'],ltr=True,at=at,until=until,slot=slot)
 rect(s,626,472,580,119,fill=C['warm'],line=C['warm'],r=6,at=at,until=until,slot=slot)
 icon(s,'pen',645,491,25,at,until,slot);txt(s,688,487,488,30,'Agent-written note','ملاحظة كتبها الموظف',size=18,color=C['accent'],at=at,until=until,slot=slot)
 txt(s,645,529,540,56,note,size=23,bold=True,ltr=True,at=at,until=until,slot=slot)
 txt(s,627,607,578,23,caption or 'Source: this interaction only · Synthetic record','المصدر: هذه المكالمة فقط · سجل خيالي',size=15,color=C['muted'],at=at,until=until,slot=slot)
def result(s,title,ar,kind='search',at=None,until=None,detail=None,detailar=None):
 icon(s,kind,361,287,43,at,until);txt(s,430,287,730,52,title,ar,size=30,bold=True,at=at,until=until)
 if detail:txt(s,361,365,821,78,detail,detailar,size=22,color=C['muted'],at=at,until=until)
def note_editor(s,at,until):
 slot='customer.context';txt(s,338,389,863,32,'Current call note · Human Agent D','ملاحظة المكالمة الحالية · الموظف D',size=24,bold=True,at=at,until=until,slot=slot)
 txt(s,338,429,863,26,'12 Oct 2026 · 10:24 · DEMO-1012',size=18,color=C['muted'],ltr=True,at=at,until=until,slot=slot)
 rect(s,338,470,870,102,fill=C['paper'],line=C['gold'],r=6,at=at,until=until,slot=slot)
 e=txt(s,357,488,829,72,NEW,size=25,ltr=True,at='C071',until=until,slot=slot);e['typing']=dict(start=ts['C071'],end=te['C073']);e['note_interaction_id']='DEMO-1012';e['human_author']='Agent D'
 rect(s,1012,590,196,43,fill=C['warm'],line=C['warm'],r=5,at=at,until=until,slot=slot);txt(s,1029,599,162,29,'Save note','حفظ الملاحظة',size=20,bold=True,align='center',at=at,until=until,slot=slot)
 txt(s,338,595,658,28,'Draft · Proposed recording step','مسودة · خطوة تسجيل مقترحة',size=18,color=C['muted'],at=at,until=te['C075'],slot=slot)
 txt(s,338,595,658,28,'Recorded (DEMO) · Same interaction: DEMO-1012','Recorded (DEMO) · Same interaction: DEMO-1012',size=18,color=C['green'],at=te['C075'],until=until,slot=slot)
 icon(s,'pointer',1159,611,33,'C075',te['C075'])

s=base(0,'The call becomes a customer conversation.','المكالمة تبقى بداية لفهم العميل.','Customer recognition','معرفة العميل',37.0)
stage(s);rail(s);profile(s,'C002','C002','C014','C014');history(s,'C015',dates='C015',agents='C015',notes='C016')
outline(s,65,373,233,57,'C012','C014');outline(s,333,246,880,118,'C014','C015');outline(s,677,433,522,53,'C016','C017')
s['cameras']=[dict(start=ts['C012'],end=te['C014'],scale0=1,scale1=1.015,x=640,y=420)]

s=base(1,'Start with the caller number. Resolve a record.','نبدأ برقم المتصل. ونحدد السجل المناسب.','Identity and contact','الهوية وبيانات التواصل',61.8)
stage(s);rail(s)
result(s,'Available caller number → lookup','رقم المتصل المتاح ← البحث',at='C021',until='C022',detail='Permitted customer-record lookup; source and linking to validate.',detailar='بحث بصلاحيات الموظف؛ المصدر والربط يحتاجان تحققًا.')
icon(s,'search',355,451,25,'C021','C022');txt(s,403,444,775,42,P['phone'],size=28,bold=True,ltr=True,at='C021',until='C022')
result(s,'Permitted record association (DEMO)','ربط بالسجل المسموح (DEMO)',at='C022',until='C025',detail='The number is a lookup key, not identity verification.',detailar='الرقم مفتاح بحث، وليس إثباتًا للهوية.')
profile(s,name='C027',phone='C026',segment=False,email=False)
outline(s,65,373,233,57,'C021','C022');outline(s,335,245,548,126,'C027')

s=base(2,'Name, number, membership and email.','الاسم والرقم والعضوية والبريد الإلكتروني.','Icons Club in context','فئة العضوية في مكانها',81.7)
stage(s);rail(s);profile(s,segment='C031',email='C033')
txt(s,338,398,870,33,'Concrete Icons Club','Concrete Icons Club',size=23,bold=True,ltr=True,at='C029')
rect(s,338,452,870,63,fill=C['soft'],r=6,at='C030')
for i,name in enumerate(['LIFESTYLE','PRESTIGE','ELITE']):
 x=360+i*288;txt(s,x,471,248,34,name,size=22,bold=name=='ELITE',align='center',ltr=True,at='C030')
 if i<2:line(s,x+259,465,x+259,502,at='C030')
outline(s,914,453,273,61,'C031');icon(s,'link',344,553,27,'C031');txt(s,391,552,802,58,'Approved membership source required.\nNo tier inferred from the phone number.','مطلوب مصدر عضوية موثوق.\nلا نستنتج الفئة من رقم التليفون.',size=21,color=C['muted'],at='C031')
outline(s,781,331,425,39,'C033','C034');s['cameras']=[dict(start=ts['C034'],end=te['C034'],scale0=1,scale1=1.018,x=779,y=385)]

s=base(3,'Each call keeps its own human-written notes.','كل مكالمة ليها الملاحظات اللي كتبها الموظف.','Individual call activity','سجل كل مكالمة',115.9)
stage(s);rail(s);profile(s);history(s,'C041',dates='C043',agents='C044',notes='C046')
txt(s,338,403,866,78,'Call activity, not a customer-global summary.','سجل مكالمات، وليس ملخصًا عامًا للعميل.',size=26,color=C['muted'],at='C039',until='C041')
outline(s,679,429,526,61,'C047','C048');outline(s,679,495,526,61,'C048','C049');outline(s,679,561,526,61,'C049')

s=base(4,'Open the earlier call. Read the original note.','نفتح المكالمة السابقة. ونقرأ الملاحظة الأصلية.','The 08 Oct follow-up','متابعة مكالمة ٨ أكتوبر',157.9)
stage(s);rail(s);profile(s);history(s,until='C058');condensed(s,'C058');selected_note(s,'C059')
outline(s,335,429,876,61,'C053','C055');outline(s,935,280,271,37,'C051','C052')
icon(s,'pointer',551,455,31,'C058','C059');outline(s,623,469,587,125,'C060','C063')
# Additional source qualifier appears only when the narrator distinguishes request from completion.
rect(s,622,596,590,35,fill=C['paper'],line=C['paper'],r=0,at='C068');txt(s,627,601,577,29,'Recorded request · Completion is not confirmed','طلب مسجل · التنفيذ غير مؤكد',size=18,bold=True,color=C['accent'],at='C068')

s=base(5,'Write it for this call. Retrieve it from this call.','نكتبها للمكالمة دي. ونرجع لها من نفس المكالمة.','Current note → later retrieval','ملاحظة جديدة ثم الرجوع لها',193.9)
stage(s);rail(s,until='C074');rail(s,'C074','C077',state='after_call');rail(s,'C077',later=True);profile(s)
note_editor(s,'C070','C077');condensed(s,'C077',future=True);selected_note(s,'C079',current=True,caption='Original author: Agent D · Source: DEMO-1012')
outline(s,65,503,232,32,'C075','C077');outline(s,623,424,586,37,'C080','C081');outline(s,623,469,588,124,'C082','C083')
# Explicit later chronology preserves the source note's identity and author.
txt(s,627,389,578,29,'Later interaction (DEMO) · 15 Oct 2026 · Agent E','مكالمة لاحقة (DEMO) · ١٥ أكتوبر ٢٠٢٦ · الموظف E',size=19,color=C['green'],at='C077',until='C079')

s=base(6,'Show the truth. Keep the call moving.','نوضح الحقيقة. والمكالمة تستمر.','Safe exception states','التعامل مع الحالات المختلفة',210.5)
stage(s);rail(s);profile(s,until='C086');history(s,until='C086')
result(s,'No matching record','لا يوجد سجل مطابق',at='C086',until='C088',detail='Continue with the existing manual-search procedure.',detailar='نكمل باستخدام إجراء البحث اليدوي الحالي.')
rect(s,360,478,332,59,fill=C['soft'],r=5,at='C087',until='C088');icon(s,'search',379,497,24,'C087','C088');txt(s,425,493,245,35,'Manual search','بحث يدوي',size=23,bold=True,at='C087',until='C088')
result(s,'More than one possible customer','أكثر من عميل محتمل',at='C088',until='C090')
for i,name in enumerate([P['name'],'Customer B (DEMO)']):
 y=389+i*78;rect(s,360,y,832,61,fill=C['soft'],r=5,at='C088',until='C090');avatar(s,376,y+11,39,'C088','C090');txt(s,435,y+14,380,33,name,size=23,bold=True,ltr=True,at='C088',until='C090');txt(s,859,y+14,314,33,P['phone'],size=21,ltr=True,at='C088',until='C090')
icon(s,'lock',365,572,26,'C089','C090');txt(s,411,571,781,43,'Agreed verification first. No candidate history disclosed.','التحقق المتفق عليه أولًا. تاريخ المرشحين لا يظهر.',size=21,color=C['muted'],at='C089',until='C090')
outline(s,359,388,834,62,te['C089'],'C090');icon(s,'pointer',1140,420,31,te['C089'],'C090')
profile(s,'C090','C090','C090','C090',until='C092',missing=True)
icon(s,'lock',343,414,28,'C091','C092');txt(s,391,413,803,76,'Unavailable or unlinked data is not guessed.\nHistory and note permissions still apply.','لا نخمن البيانات غير المتاحة أو غير المرتبطة.\nتظل صلاحيات السجل والملاحظات مطلوبة.',size=23,color=C['muted'],at='C091',until='C092')
result(s,'Lookup unavailable','البحث غير متاح',kind='warning',at='C092',detail='Availability error · Not an empty call history.\nThe active call continues.',detailar='خطأ إتاحة · وليس سجل مكالمات فارغًا.\nالمكالمة الجارية تستمر.')
outline(s,65,432,231,40,'C092')

s=base(7,'Validate the sources. Then test the experience.','نتحقق من المصادر. وبعدها نختبر التجربة.','Native capability and a pilot','الإمكانيات الحالية والتجربة الأولية',284.2)
# The only architecture view comes after the employee behavior is fully demonstrated.
rect(s,48,168,1184,478,r=11,until='C107');txt(s,74,191,1131,37,'Inspect existing sources and supported presentation','نفحص المصادر الحالية وطريقة العرض المدعومة',size=26,bold=True,until='C107')
for i,(logo,name,en,ar,ev) in enumerate([('genesys','Genesys','Interaction → its agent notes','المكالمة ← ملاحظات الموظف الخاصة بها','C094'),('zoho','Zoho Desk','Customer / call activities, if supported','العميل وسجل المكالمات، لو مدعومين','C095'),(None,'Concrete Icons Club','Membership source: identify and validate','مصدر العضوية: نحدده ونتحقق منه','C097')]):
 y=257+i*82
 if logo:img(s,logo,76,y,129 if logo=='genesys' else 71,28,ev,'C107')
 txt(s,232,y-1,362,35,name,size=21,bold=True,ltr=True,at=ev,until='C107');txt(s,614,y-1,582,39,en,ar,size=22,at=ev,until='C107');line(s,74,y+57,1206,y+57,at=ev,until='C107')
# Native first is a conditional decision, not a claimed enabled feature.
icon(s,'settings',76,514,30,'C099','C107');txt(s,128,512,519,43,'Use existing native features if sufficient','نستخدم الإمكانيات الأصلية لو كافية',size=22,bold=True,at='C099',until='C107')
icon(s,'link',76,565,30,'C100','C107');txt(s,128,563,519,43,'Smallest supported bridge only for a gap','أبسط ربط مدعوم فقط لسد فجوة',size=22,color=C['muted'],at='C100',until='C107')
rect(s,697,512,508,113,fill=C['soft'],r=7,at='C102',until='C107');txt(s,718,525,467,28,'Authorized pilot · To validate','تجربة مصرح بها · نحتاج تحققًا',size=19,bold=True,at='C102',until='C107')
for y,en,ar,ev in [(563,'Profile and membership source','مصدر الملف والعضوية','C103'),(590,'Call ↔ own note ↔ permitted agent','المكالمة وملاحظتها والموظف المصرح له','C104')]:txt(s,718,y,467,31,en,ar,size=19,color=C['muted'],at=ev,until='C107')
stage(s,at='C107');rail(s,at='C107',later=True);profile(s,'C107','C107','C107','C107');condensed(s,'C107',future=True);selected_note(s,'C107',current=True,caption='Agent D wrote this for DEMO-1012, not DEMO-1015.')
outline(s,397,244,491,48,'C109','C110');outline(s,935,280,271,39,'C110','C111');outline(s,333,427,256,46,'C111','C112');outline(s,623,469,588,124,'C112','C113');outline(s,623,469,588,124,'C118')
# Meaningful title change ends on the employee experience rather than a logo wall.
for e in s['elements']:
 if e.get('role')=='heading':e['until']=ts['C107']
txt(s,48,94,1184,52,'Start from the last recorded interaction.','نبدأ من آخر تواصل مسجل مع العميل.',size=38,bold=True,role='heading',at='C107')

for s in slides:
 s['notes'].append(B('Part 03 focuses on source-linked human call notes, not ticket history, customer-global notes, recordings, transcripts or AI summaries. All dates, times and actors are fictional. The current note belongs to DEMO-1012; the later active call is DEMO-1015 and only reads the former note. Native save/storage/retention/permissions remain unverified.','الجزء ٠٣ عن ملاحظات بشرية مرتبطة بمكالماتها، وليس التذاكر أو الملاحظات العامة أو التسجيلات أو ملخصات AI. التواريخ والأوقات والموظفون خياليون. الملاحظة الجديدة للمكالمة DEMO-1012 وتقرأها المكالمة اللاحقة DEMO-1015 دون تغيير مصدرها. حفظ البيانات والصلاحيات والاحتفاظ الفعلي تحتاج تحققًا.'))
 for c in T['cues']:
  if c['scene_id']==s['id']:s['notes'].append(B(f"{c['id']} · {c['start']:.3f}–{c['end']:.3f}s · {c['spoken_phrase']}"))
 for e in s['elements']:
  if e['type']=='text':
   for call in CALLS[:3]:
    if e['text']['en']==call['notes'][0]['text']:e['note_interaction_id']=call['id'];e['human_author']=call['agent']
   if e['text']['en']==NEW:e['note_interaction_id']='DEMO-1012';e['human_author']='Agent D'
  assert e['at']>=s['start']-.001,(s['id'],e)
  if e['type']=='rect':assert min(int(e['fill'][i:i+2],16) for i in (1,3,5))>=220
story=dict(title=B('GRINDCTRL × Concrete — Part 03: Customer 360° call experience','GRINDCTRL × كونكريت — الجزء ٠٣: تجربة العميل والمكالمات'),colors=C,slides=slides,timeline=T,sources=[dict(file='Part 03 Sales Manager requirement, reported by the user',pages=[],supports=B('Name, phone, membership, optional email, per-call history and human notes; not an independently verified tenant workflow.')),dict(file='Concrete contract (29-11-2023).pdf',pages=[4],supports=B('CRM URL pop up integration scope; not evidence of operation or linked notes.'))],fixtures=F,ui_fidelity=dict(status='illustrative',concrete_screenshots_verified=False,native_layout_verified=False,display_model='Proposed interaction workspace. Actual supported display and native note behavior to inspect.'),print_appendices=[dict(index=5,time=172.4,title=B('A human note for the current interaction.','ملاحظة بشرية للمكالمة الحالية.')),dict(index=6,time=203.0,title=B('No matching record: manual procedure.','لا يوجد سجل مطابق: الإجراء اليدوي.')),dict(index=6,time=215.8,title=B('Missing email and membership stay unavailable.','البريد والفئة غير المتاحين يظلان كذلك.')),dict(index=6,time=218.5,title=B('Lookup unavailable; the call continues.','البحث غير متاح؛ والمكالمة تستمر.'))])
(R/'story.json').write_text(json.dumps(story,ensure_ascii=False,indent=2));print('Eight actual-audio scenes; source-linked call notes and new note / future retrieval.')
