from pathlib import Path
import json
R=Path(__file__).parent;T=json.loads((R.parent/'part02-cue-timeline.json').read_text());ts={c['id']:c['start'] for c in T['cues']};te={c['id']:c['end'] for c in T['cues']}
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
 txt(s,660,29,572,30,'Part 02 · '+section,'الجزء ٠٢ · '+sectionar,size=16,color=C['muted'],align='end',role='framing')
 txt(s,48,94,1184,52,title,ar,size=38,bold=True,role='heading')
 line(s,48,670,1232,670);txt(s,48,683,1080,24,'Illustrative proposed workflow · Fictional records · Display surface subject to validation','تجربة مقترحة توضيحية · سجلات خيالية · شكل العرض يحتاج تحققًا',size=14,color=C['muted'],role='framing')
 txt(s,1146,683,86,25,f'{i+1:02} / 08',size=14,color=C['muted'],ltr=True,align='end',role='framing')
 s['notes']=[B('New GRINDCTRL collaboration proposal. All visible records are fictional. Customer-reported workflow has not been independently verified. No live tenant screenshots, configuration, API access, licensing or performance results were inspected.','تعاون جديد مقترح من GRINDCTRL. السجلات خيالية. طريقة العمل بحسب الإفادة ولم تُختبر مستقلًا. لم يتم فحص واجهات العميل الفعلية أو الإعدادات أو API أو التراخيص أو نتائج الأداء.'),B('This separate illustrative call/context composition does not guarantee a native embedded sidebar. Inspect the contracted CRM URL pop up integration (November 2023 PDF p.4), actual supported display and permission-equivalent lookup before implementation. Number association is not identity verification.','الشكل المنفصل للمكالمة والمعلومات توضيحي ولا يضمن شريطًا مدمجًا. نفحص بند CRM URL pop up integration في عقد نوفمبر ٢٠٢٣ صفحة ٤ وشكل العرض والصلاحيات قبل التنفيذ. مطابقة الرقم لا تثبت الهوية.')]
 return s

def window(s,x,y,w,h,vendor,label,slot,at=None,until=None):
 rect(s,x,y+4,w,h,fill=C['shadow'],line=C['shadow'],r=10,at=at,until=until,slot=slot);rect(s,x,y,w,h,r=10,at=at,until=until,slot=slot)
 img(s,vendor,x+20,y+17,118 if vendor=='genesys' else 65,28,at,until,slot)
 if vendor=='zoho':txt(s,x+104,y+17,190,32,'Zoho Desk',size=21,bold=True,at=at,until=until,slot=slot)
 txt(s,x+165 if vendor=='genesys' else x+302,y+19,w-(190 if vendor=='genesys' else 327),30,label,size=17,color=C['muted'],align='end',at=at,until=until,slot=slot)
 line(s,x,y+62,x+w,y+62,at=at,until=until,slot=slot)
 s['slots'][slot]=dict(x=x,y=y,w=w,h=h,anchors={})
def call(s,at=None,x=48,y=168,w=278,h=478):
 slot='genesys.call';window(s,x,y,w,h,'genesys','Voice',slot)
 circle(s,x+22,y+92,70,C['sage'],at,slot=slot);icon(s,'call',x+41,y+111,32,at,slot=slot)
 txt(s,x+22,y+188,w-44,36,'Incoming caller','متصل وارد',size=23,bold=True,at=at,slot=slot)
 txt(s,x+22,y+234,w-44,28,'Caller number','رقم المتصل',size=18,color=C['muted'],at=at,slot=slot)
 txt(s,x+22,y+273,w-44,39,'+20 ••• 410',size=27,bold=True,ltr=True,at=at,slot=slot)
 circle(s,x+23,y+336,9,C['green'],at,slot=slot);txt(s,x+43,y+327,w-65,34,'Call active','مكالمة جارية',size=22,color=C['green'],at=at,slot=slot)
 txt(s,x+22,y+369,w-44,28,'Assigned to an agent','موزعة على الموظف',size=18,color=C['muted'],at=at,slot=slot)
 for j,key in enumerate(['mic','pause','end']):circle(s,x+22+j*61,y+419,42,at=at,slot=slot);icon(s,key,x+33+j*61,y+430,20,at,slot=slot)
 s['slots'][slot]['anchors']=dict(caller_number=[.07,.56,.85,.1],call_state=[.07,.68,.8,.08])
def deskframe(s,label='Customer context',x=350,y=168,w=882,h=478,slot='desk.context'):
 window(s,x,y,w,h,'zoho',label,slot);return x,y,w,h,slot

def contact(s,at=None,x=350,y=168,w=882,until=None,slot='desk.context'):
 avatar(s,x+22,y+83,43,at,until,slot);txt(s,x+83,y+81,w-132,36,'Contact A','العميل A',size=27,bold=True,at=at,until=until,slot=slot)
 txt(s,x+83,y+124,290,29,'Associated customer record','سجل عميل مرتبط',size=17,color=C['muted'],at=at,until=until,slot=slot)
 txt(s,x+423,y+123,350,30,'+20 ••• 410',size=20,color=C['muted'],ltr=True,at=at,until=until,slot=slot)
 line(s,x+22,y+171,x+w-22,y+171,at=at,until=until,slot=slot)
def ticketlist(s,at=None,statusat=None,ownerat=None,until=None,x=350,y=168,slot='desk.context'):
 txt(s,x+22,y+187,310,32,'Previous tickets','التذاكر السابقة',size=21,bold=True,at=at,until=until,slot=slot)
 for j,(id,title,status,owner) in enumerate([('T101','Exchange follow-up','Open','Agent B'),('T098','Size query','Closed','Agent C')]):
  yy=y+229+j*105
  rect(s,x+16,yy,311,94,fill=C['soft'] if j==0 else C['paper'],line=C['gold'] if j==0 else C['line'],r=6,at=at,until=until,slot=slot)
  icon(s,'case',x+30,yy+15,24,at,until,slot);txt(s,x+68,yy+12,240,33,id+' · '+title,id+' · '+('متابعة استبدال' if j==0 else 'سؤال مقاس'),size=19,bold=j==0,at=at,until=until,slot=slot)
  txt(s,x+30,yy+56,114,28,status,'مفتوحة' if j==0 else 'مغلقة',size=19,color=C['green'] if j==0 else C['muted'],at=statusat or at,until=until,slot=slot)
  txt(s,x+177,yy+56,126,28,owner,'الموظف '+('B' if j==0 else 'C'),size=18,color=C['muted'],at=ownerat or at,until=until,slot=slot)
 line(s,x+347,y+187,x+347,y+452,at=at,until=until,slot=slot)
def ticketdetail(s,at=None,noteat=None,notetextat=None,until=None,x=350,y=168,slot='desk.context'):
 xx=x+373
 txt(s,xx,y+188,477,37,'T101 · Exchange follow-up','T101 · متابعة استبدال',size=23,bold=True,at=at,until=until,slot=slot)
 txt(s,xx,y+234,100,27,'Status','الحالة',size=17,color=C['muted'],at=at,until=until,slot=slot);txt(s,xx,y+265,160,32,'Open','مفتوحة',size=22,color=C['green'],bold=True,at=at,until=until,slot=slot)
 txt(s,xx+206,y+234,248,27,'Assigned agent','الموظف المسؤول',size=17,color=C['muted'],at=at,until=until,slot=slot);txt(s,xx+206,y+265,248,32,'Agent B','الموظف B',size=22,at=at,until=until,slot=slot)
 rect(s,xx-2,y+320,477,133,fill=C['warm'],line=C['warm'],r=7,at=noteat or at,until=until,slot=slot)
 icon(s,'file',xx+16,y+338,24,noteat or at,until,slot);txt(s,xx+54,y+336,392,31,'Latest recorded note','آخر ملاحظة مسجلة',size=19,color=C['accent'],at=noteat or at,until=until,slot=slot)
 txt(s,xx+16,y+379,434,68,'Branch review is still pending.','مراجعة الفرع لسه مطلوبة.',size=26,bold=True,at=notetextat or noteat or at,until=until,slot=slot)

s=base(0,'Inside the workflow. One call, in detail.','داخل طريقة العمل. مكالمة واحدة بالتفصيل.','The deep dive','داخل التجربة',20.5)
call(s);deskframe(s);contact(s);ticketlist(s);ticketdetail(s)
outline(s,63,253,246,313,'C03','C04');outline(s,720,479,481,135,'C04','C05')
outline(s,363,393,316,96,'C08','C10');outline(s,720,479,481,135,'C09','C10')
s['cameras']=[dict(start=ts['C06'],end=te['C06'],scale0=1,scale1=1.035,x=640,y=407)]
# Restore at scene boundary; framing stays fixed and canvas clips to the workspace.

s=base(1,'The caller number starts a lookup.','رقم المتصل يبدأ البحث.', 'Caller number → lookup','رقم المتصل والبحث',44.3)
call(s,at='C12');deskframe(s,'Lookup · Proposed')
icon(s,'search',378,270,30,'C13');txt(s,426,267,753,38,'Use the available call information','نستخدم معلومات المكالمة المتاحة',size=23,bold=True,at='C13',until='C15')
txt(s,378,321,760,45,'Caller number, if available in this setup','رقم المتصل، لو متاح في الإعدادات',size=21,color=C['muted'],at='C14',until='C15')
outline(s,64,428,247,64,'C14','C17')
line(s,326,465,343,465,color=C['accent'],width=2,arrow=True,at='C15',until='C17')
rect(s,374,270,834,80,line=C['gold'],at='C15');icon(s,'search',395,294,28,'C15');txt(s,442,288,426,39,'+20 ••• 410',size=28,ltr=True,bold=True,at='C15')
txt(s,872,294,307,32,'Lookup key','مفتاح بحث',size=21,color=C['accent'],align='end',at='C15')
txt(s,378,371,786,33,'Existing Zoho Desk customer records','سجلات العملاء الموجودة في Zoho Desk',size=23,bold=True,at='C15')
# Display masked format examples only after the narrator introduces formatting.
rect(s,376,422,366,72,fill=C['soft'],at='C17');rect(s,818,422,388,72,fill=C['soft'],at='C17')
txt(s,396,444,326,34,'0••• 410',size=27,ltr=True,at='C17');txt(s,838,444,348,34,'+20 ••• 410',size=27,ltr=True,at='C17')
line(s,755,458,804,458,color=C['accent'],width=2,arrow=True,at='C18')
txt(s,378,511,814,29,'Illustrative equivalent formats · Matching rules to validate','أمثلة صيغ توضيحية · قواعد المطابقة تحتاج تحققًا',size=18,color=C['muted'],at='C18')
icon(s,'lock',378,575,27,'C20');txt(s,424,573,765,39,'A number association does not verify identity.','مطابقة الرقم لا تثبت هوية المتصل.',size=22,bold=True,at='C21')
s['cameras']=[dict(start=ts['C14'],end=te['C14'],scale0=1,scale1=1.025,x=326,y=455),dict(start=ts['C17'],end=te['C17'],scale0=1.025,scale1=1,x=326,y=455)]

s=base(2,'The relevant context, beside the call.','المعلومات المناسبة، جنب المكالمة.','What the employee sees','الموظف هيشوف إيه',68.9)
call(s);deskframe(s);contact(s,'C22')
icon(s,'lock',1055,255,22,'C23');txt(s,1086,251,113,56,'Permitted\naccess','الصلاحيات\nالمسموحة',size=16,color=C['muted'],at='C23')
# History is disclosed at its spoken cue; owner and recorded update arrive subsequently.
ticketlist(s,'C25',statusat=te['C25'],ownerat='C26')
ticketdetail(s,'C27',noteat=te['C26'],notetextat=te['C26'])
# Cover detail header until the agent chooses, while the recorded note remains visibly sourced.
outline(s,364,396,314,94,'C27','C29');icon(s,'pointer',640,450,34,'C27','C28')
outline(s,720,479,481,136,'C30','C31')
s['slots']['desk.context']['anchors']=dict(contact=[.09,.17,.75,.17],previous_tickets=[.02,.4,.37,.48],latest_note=[.42,.67,.54,.28])

s=base(3,'T101: read the note, keep the status clear.','T101: نقرأ الملاحظة، ونفرّقها عن الحالة.','Exchange follow-up','متابعة الاستبدال',92.9)
call(s);deskframe(s,'Ticket T101 · Read-only')
# This is a closeup of the SAME ticket, not a new record or an action screen.
icon(s,'case',378,267,28,'C33');txt(s,423,261,757,40,'T101 · Exchange request','T101 · طلب استبدال',size=29,bold=True,at='C33')
txt(s,378,312,791,32,'Contact A · Existing exchange follow-up','العميل A · متابعة طلب الاستبدال الموجود',size=20,color=C['muted'],at='C33')
line(s,376,359,1205,359,at='C34')
txt(s,378,379,266,28,'Ticket status','حالة التذكرة',size=18,color=C['muted'],at='C34');txt(s,378,414,266,36,'Open','مفتوحة',size=27,bold=True,color=C['green'],at='C34')
txt(s,716,379,446,28,'Assigned agent','الموظف المسؤول',size=18,color=C['muted'],at='C34');txt(s,716,414,446,36,'Agent B','الموظف B',size=27,at='C34')
rect(s,376,480,830,135,fill=C['warm'],line=C['warm'],at='C35');icon(s,'file',397,500,25,'C35');txt(s,442,497,729,33,'Latest recorded note','آخر ملاحظة مسجلة',size=21,color=C['accent'],at='C35')
txt(s,397,548,774,47,'Branch review is still pending.','مراجعة الفرع لسه مطلوبة.',size=30,bold=True,at='C37')
outline(s,369,372,284,84,'C40','C41');outline(s,371,475,839,145,'C39','C40')
# A reading cue, without changing a ticket or suggesting an operational decision.
icon(s,'speech',274,268,32,'C42');line(s,305,283,340,283,color=C['accent'],width=2,arrow=True,at='C42')
s['cameras']=[dict(start=ts['C34'],end=te['C34'],scale0=1,scale1=1.022,x=850,y=422)]
s['slots']['desk.context']['anchors']=dict(ticket_status=[.03,.44,.30,.17],assigned_agent=[.41,.44,.5,.17],latest_note=[.03,.66,.94,.28])

s=base(4,'One number. Two possible records.','رقم واحد. سجلان محتملان.','Ambiguity and human control','المطابقة غير المؤكدة ودور الموظف',109.4)
call(s);deskframe(s,'Record choice · Proposed')
txt(s,378,265,814,39,'More than one possible customer','أكثر من عميل محتمل',size=28,bold=True,at='C43',until=111.872925)
icon(s,'lock',378,332,26,'C44',111.872925);txt(s,423,329,758,40,'Ticket history stays hidden until selection.','تاريخ التذاكر لا يظهر قبل الاختيار.',size=21,color=C['muted'],at='C44',until=111.872925)
for j,name in enumerate(['A','B']):
 yy=390+j*82
 rect(s,376,yy,829,68,fill=C['soft'],r=6,at='C45',until=111.872925);avatar(s,393,yy+14,40,'C45',111.872925);txt(s,450,yy+16,332,37,'Contact '+name,'العميل '+name,size=24,bold=True,at='C45',until=111.872925);txt(s,840,yy+20,316,34,'+20 ••• 410',size=23,ltr=True,at='C45',until=111.872925)
icon(s,'lock',380,580,24,'C46',te['C47']);txt(s,421,578,770,36,'Use the agreed verification steps before choosing.','نطبق خطوات التحقق المتفق عليها قبل الاختيار.',size=20,color=C['accent'],at='C47',until=111.872925)
outline(s,375,389,831,69,te['C47'],111.872925);icon(s,'pointer',1133,425,35,te['C47'],111.872925)
contact(s,at=111.872925);ticketlist(s,at=111.872925);ticketdetail(s,at=111.872925)
s['notes'].append(B('History is hidden during C43–C47. After the selection/verification phrase ends, the illustrative permitted Contact A history is disclosed. No automatic candidate selection or identity-authentication badge.','التاريخ مخفي خلال عرض المرشحين. يظهر سجل A بعد اكتمال جملة التحقق والاختيار. لا اختيار تلقائي ولا علامة توثيق هوية.'))

s=base(5,'Different results. The call continues.','نتائج مختلفة. والمكالمة مستمرة.','No match ≠ lookup failure','عدم وجود تطابق ليس فشل البحث',139.9)
call(s);deskframe(s,'Lookup result · Proposed')
txt(s,378,265,808,39,'Lookup result for +20 ••• 410','نتيجة البحث عن المتصل',size=26,bold=True,at='C49')
line(s,376,326,1206,326,at='C49')
icon(s,'search',394,366,43,'C51','C55');txt(s,460,360,711,35,'Lookup completed','البحث اكتمل',size=22,color=C['green'],at='C51',until='C55')
txt(s,394,427,796,46,'No matching customer','لا يوجد سجل عميل مطابق',size=32,bold=True,at='C52',until='C55')
txt(s,394,487,796,38,'Use the existing manual-search procedure.','نستخدم إجراء البحث اليدوي الحالي.',size=21,color=C['muted'],at='C53',until='C55')
rect(s,394,550,278,55,fill=C['soft'],r=5,at='C53',until='C55');icon(s,'search',411,565,23,'C53','C55');txt(s,452,562,207,35,'Manual search','بحث يدوي',size=21,bold=True,at='C53',until='C55')
# Unavailable service is never relabeled as an empty or no-ticket response.
icon(s,'warning',394,366,43,'C55');txt(s,460,360,711,35,'Lookup could not complete','البحث لم يكتمل',size=22,color=C['accent'],at='C55')
txt(s,394,427,796,46,'Lookup unavailable','البحث غير متاح',size=32,bold=True,at='C56')
txt(s,394,487,796,38,'An availability error. Not an empty ticket list.','خطأ إتاحة، وليس قائمة تذاكر فارغة.',size=21,color=C['muted'],at='C57')
rect(s,394,550,200,55,fill=C['warm'],line=C['warm'],r=5,at='C56');icon(s,'retry',410,565,23,'C56');txt(s,450,562,126,34,'Retry','إعادة المحاولة',size=21,bold=True,at='C56')
txt(s,626,552,565,58,'Keep the usual follow-up route.\nManual search when available.','نحافظ على طريقة المتابعة المعتادة.\nالبحث اليدوي عند إتاحته.',size=18,color=C['muted'],at='C60')
outline(s,63,485,248,61,'C59');s['notes'].append(B('No-match successful lookup and unavailable/error are distinct. During an actual Desk outage, manual Desk search is not guaranteed; the call and agreed usual follow-up procedure continue. Retry is illustrated, not performed or promised successful.','عدم التطابق بعد بحث ناجح مختلف عن خطأ الإتاحة. أثناء توقف Desk لا نضمن البحث اليدوي؛ تستمر المكالمة وطريقة المتابعة المتفق عليها. زر إعادة المحاولة توضيحي دون تشغيل أو ضمان نجاح.'))

s=base(6,'Inspect first. Use the smallest supported change.','نفحص أولًا. ونختار أبسط تغيير تدعمه الأنظمة.','Implementation decision','اختيار طريقة التنفيذ',164.0)
# The first architecture view appears only after six scenes of employee behavior.
rect(s,48,176,353,426,r=10);img(s,'genesys',73,202,131,30);img(s,'zoho',285,204,77,28)
icon(s,'settings',75,267,38,'C62');txt(s,75,322,300,78,'Inspect the\nexisting setup','نفحص\nالإعدادات الحالية',size=29,bold=True,at='C62')
rect(s,69,425,309,124,fill=C['warm'],line=C['warm'],at='C62');txt(s,89,443,268,79,'“CRM URL pop up\nintegration”',size=23,bold=True,ltr=True,at='C62')
txt(s,75,561,302,31,'2023 contract · p.4','عقد ٢٠٢٣ · صفحة ٤',size=18,color=C['muted'],at='C62')
line(s,402,389,442,389,color=C['accent'],width=2,at='C63');line(s,442,281,442,487,color=C['accent'],width=2,at='C64')
line(s,442,281,477,281,color=C['accent'],width=2,arrow=True,at='C64');line(s,442,487,477,487,color=C['accent'],width=2,arrow=True,at='C66')
rect(s,485,209,429,156,r=9,at='C64');icon(s,'settings',507,230,32,'C64');txt(s,558,230,331,41,'Native configuration','الإعدادات الأصلية',size=25,bold=True,at='C64');txt(s,508,290,379,56,'Use it if it supports\nthe required experience.','نستخدمها لو بتدعم\nالتجربة المطلوبة.',size=22,color=C['muted'],at='C65')
rect(s,485,414,429,156,r=9,at='C66');icon(s,'link',507,435,32,'C67');txt(s,558,435,331,41,'Minimal approved adapter','أبسط طبقة ربط معتمدة',size=23,bold=True,at='C67');txt(s,508,495,379,56,'Only for a verified gap.\nSupported mechanisms only.','فقط لسد فجوة مؤكدة.\nبآليات تدعمها الأنظمة.',size=21,color=C['muted'],at='C67')
# A conservative first scope, rather than a fictitious production integration.
rect(s,958,209,274,361,r=9,at='C68');icon(s,'lock',981,232,31,'C69');txt(s,981,285,226,67,'Permissions\npreserved','الصلاحيات\nمحفوظة',size=25,bold=True,at='C69')
line(s,981,375,1209,375,at='C70');icon(s,'case',981,399,26,'C70');txt(s,1024,395,181,36,'T101','T101',size=24,bold=True,at='C70');txt(s,981,446,226,31,'Status stays Open','الحالة تظل مفتوحة',size=21,color=C['green'],at='C70');txt(s,981,495,226,54,'Call arrival does\nnot write to tickets.','وصول المكالمة\nلا يغيّر التذكرة.',size=20,color=C['muted'],at='C70')
txt(s,48,625,1184,34,'Read-only first scope · Actual display and configuration to validate','نطاق أولي للقراءة فقط · شكل العرض والإعدادات تحتاج تحققًا',size=20,color=C['accent'],at='C68')

s=base(7,'Prove the value with authorized test calls.','نثبت القيمة بمكالمات اختبار مصرح بها.','Pilot validation','تقييم التجربة الأولية',186.5)
for right,x in [(False,48),(True,666)]:
 txt(s,x,174,565,34,'Proposed caller context' if right else 'Current manual search','معلومات المتصل المقترحة' if right else 'البحث اليدوي الحالي',size=24,bold=True,color=C['green'] if right else C['muted'],at='C74')
 rect(s,x,221,566,224,r=9,at='C74');img(s,'genesys',x+18,238,106,25,'C74');icon(s,'call',x+151,240,24,'C74');txt(s,x+195,237,349,34,'+20 ••• 410',size=23,ltr=True,bold=True,at='C74');line(s,x,286,x+566,286,at='C74')
 img(s,'zoho',x+18,305,59,24,'C74')
 if right:
  txt(s,x+96,304,447,34,'T101 · Exchange follow-up','T101 · متابعة استبدال',size=21,bold=True,at='C74')
  rect(s,x+18,356,530,70,fill=C['warm'],line=C['warm'],r=5,at='C74');icon(s,'file',x+31,375,23,'C74');txt(s,x+71,371,450,44,'Branch review is still pending.','مراجعة الفرع لسه مطلوبة.',size=22,bold=True,at='C74')
 else:
  rect(s,x+96,300,448,57,line=C['gold'],r=5,at='C74');icon(s,'search',x+111,316,24,'C74');txt(s,x+152,311,341,37,'+20 ••• 410',size=24,ltr=True,at='C74');icon(s,'pointer',x+511,338,30,'C74')
  txt(s,x+96,379,447,35,'Find Contact A → Open T101','نبحث عن A ← نفتح T101',size=21,at='C74')
# Measurements share a table, rather than competing equal benefit cards.
rect(s,48,458,1184,185,r=8,at='C73',until='C80')
txt(s,72,470,809,33,'Pilot observation sheet','ورقة ملاحظات التجربة',size=22,bold=True,at='C73',until='C80');txt(s,907,473,300,31,'To measure during pilot','تُقاس خلال التجربة',size=18,color=C['accent'],align='end',at='C73',until='C80')
line(s,72,514,1207,514,at='C75',until='C80')
for yy,a,b,ev in [(530,'Manual interactions · Time to correct context','الخطوات اليدوية · الوقت للمعلومات الصحيحة','C75'),(568,'Correct matching','دقة المطابقة','C76'),(606,'Shared / unknown numbers · Permissions · Errors','الأرقام المشتركة وغير المعروفة · الصلاحيات · الأخطاء','C77')]:
 icon(s,'clock' if yy==530 else 'quality',74,yy+1,23,ev,'C80');txt(s,116,yy,824,36,a,b,size=21,at=ev,until='C80');txt(s,998,yy,206,34,'To measure','يُقاس',size=20,color=C['muted'],align='end',at=ev,until='C80')
outline(s,663,218,572,230,'C79','C80')
rect(s,48,472,1184,171,fill=C['paper'],r=8,at='C80');img(s,'brand',74,501,78,56,'C80');txt(s,180,493,1014,48,'GRINDCTRL × Concrete','GRINDCTRL × كونكريت',size=32,bold=True,at='C80')
icon(s,'settings',182,563,29,'C81');txt(s,229,560,500,40,'Authorized configuration review','مراجعة إعدادات مصرح بها',size=23,bold=True,at='C81');line(s,760,579,802,579,color=C['accent'],width=2,arrow=True,at='C82');icon(s,'call',830,565,25,'C82');txt(s,876,560,317,40,'Test calls','مكالمات اختبار',size=24,bold=True,at='C82')
s['notes'].append(B('The observation sheet contains measurement methods only: interactions, time to accurate usable context, matching, permissions and exception handling. No measured savings, percentages or fabricated baseline/results. Validate permissions as well as shared/unknown numbers and availability before valuing the proposal.','ورقة التقييم تعرض طرق القياس فقط: الخطوات والوقت للمعلومة الصحيحة والمطابقة والصلاحيات والاستثناءات. لا نسب أو توفير أو نتائج مصطنعة. نختبر الصلاحيات والأرقام المشتركة وغير المعروفة والإتاحة قبل تحديد القيمة.'))

# Add replacement boundaries for the matched comparison views.
for key,x in [('comparison.current',48),('comparison.proposed',666)]:
 sc=slides[7];sc['slots'][key]=dict(x=x,y=221,w=566,h=224,anchors=dict(caller_number=[.34,.06,.61,.17],ticket_context=[.03,.34,.93,.58]))
 for e in sc['elements']:
  ex=e['x'];ey=e['y'];ew=e.get('w',abs(e.get('x2',ex)-ex));eh=e.get('h',abs(e.get('y2',ey)-ey))
  if x<=ex and ex+ew<=x+566+1 and 221<=ey and ey+eh<=446:e['slot']=key

# Stable regions for authorized, anonymized later replacements. Every source surface
# remains explicitly illustrative until a fidelity manifest is approved.
for s in slides:
 for c in T['cues']:
  if c['scene_id']==s['id']:s['notes'].append(B(f"{c['id']} · {c['start']:.3f}–{c['end']:.3f}s · {c['spoken_phrase']}",f"{c['id']} · {c['start']:.3f}–{c['end']:.3f} ثانية · {c['spoken_phrase']}"))
 for e in s['elements']:
  assert e['at']>=s['start']-.001,(s['id'],e)
  if e['type']=='rect':assert min(int(e['fill'][i:i+2],16) for i in (1,3,5))>=220
story=dict(title=B('GRINDCTRL × Concrete — Part 02: Inside the workflow','GRINDCTRL × كونكريت — الجزء ٠٢: داخل طريقة العمل'),colors=C,slides=slides,timeline=T,sources=[dict(file='Customer report in this conversation',pages=[],supports=B('Manual phone search retrieves prior tickets; automatic call context reportedly absent. Not independently verified.')),dict(file='Concrete contract (29-11-2023).pdf',pages=[4],supports=B('CRM URL pop up integration. Contracted scope is not evidence of live operation.'))],fixtures=dict(fictional=True,contact='Contact A',second_candidate='Contact B',phone='+20 ••• 410',ticket='T101',ticket_status='Open',assigned_agent='Agent B',latest_note='Branch review is still pending.'),ui_fidelity=dict(status='illustrative',concrete_screenshots_verified=False,native_layout_verified=False,display_model='Separate illustrative call/context windows. Actual URL pop-up, tab, script or other supported surface must be inspected.'))
(R/'story.json').write_text(json.dumps(story,ensure_ascii=False,indent=2));print('Eight actual-audio scenes; same fictional call/T101; conservative proposed behavior.')
