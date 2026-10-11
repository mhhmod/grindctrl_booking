from pathlib import Path
import json
ROOT=Path(__file__).parent;T=json.loads((ROOT.parent/'timeline.json').read_text());times={c['id']:c['start'] for c in T['cues']+T['subphrase_cues']};ends={c['id']:c['end'] for c in T['cues']+T['subphrase_cues']}
B=lambda en,ar:dict(en=en,ar=ar)
C=dict(bg='#F8F7F4',paper='#FFFFFF',ink='#262626',muted='#68645E',line='#E6E3DE',accent='#965318',gold='#FFBA65',green='#49654E',soft='#F4F2EE',sage='#EFF4EE',warm='#FFF2DD',shadow='#EDEAE4')
slides=[]
def when(v):return times[v] if isinstance(v,str) else v
def add(s,k,event=None,until=None,slot=None,**kw):
 e=dict(type=k,at=when(event) if event is not None else s['start'],until=when(until) if until is not None else None,slot=slot,**kw);s['elements'].append(e);return e
def txt(s,x,y,w,h,en,ar=None,size=24,color=None,bold=False,align='start',ltr=False,event=None,until=None,slot=None,role='ui'):
 return add(s,'text',event,until,slot,x=x,y=y,w=w,h=h,text=B(en,ar or en),size=size,color=color or C['ink'],bold=bold,align=align,ltr=ltr,role=role)
def rect(s,x,y,w,h,fill=None,line=None,radius=8,event=None,until=None,slot=None):return add(s,'rect',event,until,slot,x=x,y=y,w=w,h=h,fill=fill or C['paper'],line=line or C['line'],radius=radius)
def circle(s,x,y,d,fill=None,event=None,until=None,slot=None):return add(s,'ellipse',event,until,slot,x=x,y=y,w=d,h=d,fill=fill or C['soft'],line=fill or C['soft'])
def img(s,key,x,y,w,h,event=None,until=None,slot=None):return add(s,'image',event,until,slot,key=key,x=x,y=y,w=w,h=h)
def line(s,x,y,x2,y2,color=None,width=1,arrow=False,event=None,until=None,slot=None):return add(s,'line',event,until,slot,x=x,y=y,x2=x2,y2=y2,color=color or C['line'],width=width,arrow=arrow)
def icon(s,key,x,y,d=28,event=None,until=None,slot=None):img(s,'icon-'+key,x,y,d,d,event,until,slot)
def outline(s,x,y,w,h,event,until=None,slot=None):return add(s,'outline',event,until,slot,x=x,y=y,w=w,h=h,color=C['gold'],radius=8,width=2)
def window(s,x,y,w,h,vendor,label,labelar,slot=None):
 rect(s,x,y+5,w,h,fill=C['shadow'],line=C['shadow'],radius=12,slot=slot);rect(s,x,y,w,h,radius=12,slot=slot)
 img(s,vendor,x+24,y+19,138 if vendor=='genesys' else 76,32,slot=slot)
 if vendor=='zoho':txt(s,x+117,y+19,w-150,39,'Zoho '+label,'Zoho '+labelar,size=21,bold=True,slot=slot)
 else:txt(s,x+180,y+22,w-204,32,label,labelar,size=18,color=C['muted'],align='end',slot=slot)
 line(s,x,y+72,x+w,y+72,slot=slot)
def avatar(s,x,y,d=48,event=None,slot=None):circle(s,x,y,d,C['warm'],event,slot=slot);icon(s,'actor',x+d*.22,y+d*.22,d*.56,event,slot=slot)
def state(s,x,y,w,en,ar,event=None,slot=None):
 icon(s,'clock',x,y+2,22,event,slot=slot);txt(s,x+34,y,w-34,35,en,ar,size=21,color=C['accent'],event=event,slot=slot)
def base(i,en,ar,section,sectionar):
 chapter=T['chapters'][i];s=dict(index=i,id=chapter['id'],start=chapter['start'],end=chapter['end'],title=B(en,ar),section=B(section,sectionar),dark=False,elements=[],notes=[],motion=dict(steps=1,interval=1000,fade=350),slots={});slides.append(s)
 img(s,'brand',48,27,43,29);txt(s,104,29,220,31,'GRINDCTRL',size=18,bold=True,ltr=True,role='framing')
 txt(s,690,29,542,30,section,sectionar,size=16,color=C['muted'],align='end',role='framing')
 txt(s,48,91,1184,65,en,ar,size=42,bold=True,role='heading')
 line(s,48,670,1232,670);txt(s,48,683,1080,24,'Concrete · Proposed collaboration · Illustrative UI and fictional records','كونكريت · تعاون مقترح · واجهات توضيحية وسجلات خيالية',size=15,color=C['muted'],role='framing')
 txt(s,1150,683,82,25,f'{i+1:02d} / 07',size=15,color=C['muted'],ltr=True,align='end',role='framing')
 s['notes']=[B('New GRINDCTRL proposal; no existing Concrete/Centro relationship or implemented integration. The customer workflow is reported, not independently tested. Native product edition, screen-pop target, permissions and actual screen geometry are unverified. All visible data and interfaces are illustrative.','مقترح جديد لـGRINDCTRL؛ لا يوجد تنفيذ سابق أو علاقة حالية بكونكريت أو Centro. طريقة العمل بحسب إفادة المستخدم ولم تُختبر مستقلًا. النسخة والواجهة والـpop-up والصلاحيات وشكل الشاشات الفعلية غير متحقق منها. كل البيانات والواجهات توضيحية.'),B('Caller-number association is not authentication. Existing verification and permissions apply. No AI, ticket write, refund decision, live connector or measured savings are shown. The first technical step is inspecting the existing contracted CRM URL pop up integration (November 2023, PDF page 4).','ربط رقم المتصل لا يثبت هويته. تظل إجراءات التحقق والصلاحيات مطلوبة. لا يوجد AI أو تعديل تذكرة أو قرار استرداد أو ربط حي أو نتائج توفير مقاسة. البداية التقنية فحص بند CRM URL pop up integration في عقد نوفمبر ٢٠٢٣، صفحة PDF رقم ٤.')]
 return s

def call(s,event=None,x=48,y=176,w=322,h=472,slot='genesys.call'):
 window(s,x,y,w,h,'genesys','Call','المكالمة',slot)
 circle(s,x+26,y+104,82,C['sage'],event,slot=slot);icon(s,'call',x+48,y+126,38,event,slot=slot)
 txt(s,x+26,y+211,w-52,43,'Incoming caller','متصل وارد',size=25,bold=True,event=event,slot=slot)
 txt(s,x+26,y+267,w-52,43,'+20 ••• 410',size=29,bold=True,ltr=True,event=event,slot=slot)
 txt(s,x+26,y+317,w-52,32,'Call active','مكالمة جارية',size=20,color=C['green'],event=event,slot=slot)
 for j,key in enumerate(['mic','pause','end']):circle(s,x+26+j*66,y+386,46,event=event,slot=slot);icon(s,key,x+38+j*66,y+398,22,event,slot=slot)
 s['slots'][slot]=dict(x=x,y=y,w=w,h=h,anchors=dict(caller_number=[.08,.56,.84,.11],call_state=[.08,.67,.84,.08]))

def desk(s,contact=None,tickets=None,note=None,x=400,y=176,w=832,h=472,slot='desk.context',frame=True):
 if frame:window(s,x,y,w,h,'zoho','Desk · Customer context','Desk · معلومات العميل',slot)
 avatar(s,x+24,y+96,47,contact,slot)
 txt(s,x+88,y+95,w-132,40,'Contact A','العميل A',size=27,bold=True,event=contact,slot=slot)
 txt(s,x+88,y+143,225,32,'Associated record','سجل مرتبط',size=19,color=C['muted'],event=contact,slot=slot)
 txt(s,x+332,y+142,265,33,'+20 ••• 410',size=20,color=C['muted'],ltr=True,event=contact,slot=slot)
 line(s,x+24,y+187,x+w-24,y+187,event=contact,slot=slot)
 txt(s,x+24,y+207,243,36,'Previous tickets','التذاكر السابقة',size=21,bold=True,event=tickets,slot=slot)
 rect(s,x+16,y+252,263,121,fill=C['soft'],line=C['gold'],event=tickets,slot=slot)
 icon(s,'case',x+30,y+270,27,tickets,slot=slot);txt(s,x+73,y+268,184,34,'T101 · Exchange','T101 · استبدال',size=21,bold=True,event=tickets,slot=slot)
 txt(s,x+30,y+315,228,53,'Branch review\npending','بانتظار\nمراجعة الفرع',size=20,color=C['accent'],event=tickets,slot=slot)
 icon(s,'case',x+30,y+403,25,tickets,slot=slot);txt(s,x+73,y+396,190,35,'T098 · Size query','T098 · سؤال مقاس',size=18,event=tickets,slot=slot)
 txt(s,x+73,y+431,188,28,'Closed','مغلقة',size=17,color=C['muted'],event=tickets,slot=slot)
 line(s,x+302,y+214,x+302,y+303,event=tickets,slot=slot);line(s,x+302,y+336,x+302,y+446,event=tickets,slot=slot)
 line(s,x+287,y+320,x+319,y+320,color=C['accent'],width=1.7,arrow=True,event=tickets,slot=slot)
 txt(s,x+328,y+205,w-354,40,'T101 · Exchange follow-up','T101 · متابعة استبدال',size=23,bold=True,event=tickets,slot=slot)
 state(s,x+328,y+258,w-351,'Waiting on the branch','بانتظار الفرع',tickets,slot)
 rect(s,x+324,y+312,w-348,132,fill=C['warm'],line=C['warm'],event=note,slot=slot)
 icon(s,'file',x+344,y+329,25,note,slot=slot);txt(s,x+382,y+327,w-406,33,'Latest recorded note','آخر ملاحظة مسجلة',size=20,color=C['accent'],event=note,slot=slot)
 txt(s,x+344,y+374,w-392,66,'Branch review\nis still pending.','مراجعة الفرع\nلسه مطلوبة.',size=27,bold=True,event=note,slot=slot)
 s['slots'][slot]=dict(x=x,y=y,w=w,h=h,anchors=dict(customer=[.1,.20,.64,.15],ticket=[.02,.53,.32,.27],latest_note=[.39,.66,.58,.28]))

def chooser(s,event,select):
 before=len(s['elements'])
 rect(s,401,249,830,398,fill=C['soft'],line=C['soft'],radius=0,event=event)
 x,y,w=424,270,784
 rect(s,416,256,808,376,fill=C['shadow'],line=C['shadow'],radius=12,event=event)
 rect(s,x,y,w,352,radius=12,event=event)
 txt(s,x+24,y+20,w-48,41,'More than one customer record','أكثر من سجل عميل',size=27,bold=True,event=event)
 txt(s,x+24,y+75,w-48,33,'Employee chooses the appropriate record','الموظف يختار السجل المناسب',size=21,color=C['muted'],event=event)
 for i,name in enumerate(['A','B']):
  yy=y+130+i*74
  rect(s,x+24,yy,w-48,62,fill=C['soft'],line=C['line'],event=event)
  avatar(s,x+38,yy+9,39,event)
  txt(s,x+94,yy+15,311,37,'Contact '+name,'العميل '+name,size=24,bold=True,event=event)
  txt(s,x+424,yy+15,294,37,'+20 ••• 410',size=23,ltr=True,event=event)
 outline(s,x+24,y+130,w-48,62,select);icon(s,'pointer',x+w-75,y+158,39,select)
 txt(s,x+24,y+278,w-48,32,'Number association does not verify identity','مطابقة الرقم لا تثبت الهوية',size=19,color=C['muted'],event=event)
 for e in s['elements'][before:]:e['until']=ends[select];e['native_appendix']='record-choice'

# 1: result-first product view; speech directs attention without introducing decorative entrances.
s=base(0,'The call, with its history.','المكالمة ومعاها تاريخ الخدمة.','The imagined employee experience','التجربة المقترحة للموظف')
call(s);desk(s)
outline(s,66,270,286,322,'C02','C03');outline(s,416,426,263,121,'C04','C05');outline(s,725,423,482,59,'C05','C05-note');outline(s,724,488,484,132,'C05-note','C06')
# 2: one actual manual interaction, not four descriptive cards.
s=base(1,'The history exists. The employee searches for it.','التاريخ موجود. الموظف بيدور عليه.','Reported current workflow','طريقة العمل الحالية بحسب الإفادة')
call(s);window(s,400,208,832,404,'zoho','Desk · Ticket search','Desk · بحث التذاكر','desk.search')
outline(s,66,270,286,322,'C08','C09');outline(s,423,299,786,71,'C09','C10')
rect(s,424,300,784,69,line=C['gold'],slot='desk.search');icon(s,'search',444,321,28,slot='desk.search')
txt(s,490,320,461,43,'Search by phone number','بحث برقم التليفون',size=24,color=C['muted'],until='C10',slot='desk.search')
txt(s,490,317,443,44,'+20 ••• 410',size=28,bold=True,ltr=True,event='C10',slot='desk.search')
rect(s,1032,310,161,49,fill=C['warm'],line=C['warm'],event='C10',slot='desk.search');txt(s,1045,318,134,34,'Search','بحث',size=23,bold=True,align='center',event='C10',slot='desk.search');icon(s,'pointer',1156,345,41,'C10',slot='desk.search')
line(s,340,464,383,464,color=C['accent'],width=2,event='C10');line(s,383,464,383,335,color=C['accent'],width=2,event='C10');line(s,383,335,418,335,color=C['accent'],width=2,arrow=True,event='C10')
txt(s,424,394,746,36,'Contact A · Existing ticket','العميل A · تذكرة موجودة',size=23,bold=True,event='C11',slot='desk.search')
rect(s,424,447,784,135,fill=C['warm'],line=C['warm'],event='C11',slot='desk.search');icon(s,'case',444,464,28,'C11',slot='desk.search');txt(s,487,458,679,42,'T101 · Exchange follow-up','T101 · متابعة استبدال',size=26,bold=True,event='C11',slot='desk.search')
state(s,444,507,724,'Branch review pending','بانتظار مراجعة الفرع','C11','desk.search');txt(s,444,549,724,33,'Latest note: Branch review is still pending.','آخر ملاحظة: مراجعة الفرع لسه مطلوبة.',size=21,event='C12',slot='desk.search')
s['slots']['desk.search']=dict(x=400,y=208,w=832,h=404,anchors=dict(search=[.03,.23,.94,.17],ticket=[.03,.59,.94,.33]))
# 3: fixed call, authorized lookup, context, then a genuine employee-selection branch.
s=base(2,'The call stays in view. The context appears beside it.','المكالمة ظاهرة. ومعلومات العميل بتظهر جنبها.','Proposed lookup and record choice','البحث المقترح واختيار السجل')
call(s,event='C14');desk(s,'C16','C17','C17')
outline(s,67,433,284,68,'C15','C16');line(s,354,464,392,464,color=C['accent'],width=2,arrow=True,event='C15')
txt(s,424,301,748,52,'Authorized lookup of existing Desk records','بحث في سجلات Desk بصلاحيات الموظف',size=25,color=C['muted'],event='C15',until='C16')
chooser(s,'C18','C19')
# 4: a distinct zoomed ticket scene. One large source note drives the conversation.
s=base(3,'Continue from the latest recorded update.','نكمل من آخر تحديث مسجل.','Fictional exchange follow-up','مثال خيالي لمتابعة استبدال')
window(s,48,176,1184,350,'zoho','Desk · Exchange follow-up','Desk · متابعة استبدال','desk.case')
icon(s,'call',78,278,49,'C21');txt(s,155,280,300,40,'Contact A','العميل A',size=28,bold=True,event='C21');txt(s,78,354,340,42,'+20 ••• 410',size=28,ltr=True,event='C21')
line(s,452,273,452,502)
icon(s,'case',484,276,30,'C21');txt(s,530,269,650,42,'T101 · Exchange request','T101 · طلب استبدال',size=27,bold=True,event='C21')
state(s,484,323,708,'Waiting on the branch','بانتظار الفرع','C22','desk.case')
rect(s,482,382,719,112,fill=C['warm'],line=C['warm'],event='C23',slot='desk.case');icon(s,'file',504,402,29,'C23',slot='desk.case');txt(s,548,398,625,31,'Latest recorded note','آخر ملاحظة مسجلة',size=20,color=C['accent'],event='C23',slot='desk.case');txt(s,504,444,666,41,'Branch review is still pending.','مراجعة الفرع لسه مطلوبة.',size=29,bold=True,event='C23',slot='desk.case')
avatar(s,68,566,58,'C25');icon(s,'speech',144,574,35,'C25');txt(s,201,559,1000,44,'Continue the conversation from this note.','نكمل الحديث من الملاحظة دي.',size=28,bold=True,event='C25');txt(s,201,609,1000,30,'Employee reads existing context; the ticket is unchanged.','الموظف بيقرأ المعلومات الموجودة؛ التذكرة لم تتغير.',size=20,color=C['muted'],event='C25')
s['slots']['desk.case']=dict(x=48,y=176,w=1184,h=350,anchors=dict(ticket=[.36,.25,.6,.15],latest_note=[.37,.58,.61,.32]))
# 5: same-case side-by-side; the change is window grouping and lookup, not new data.
s=base(4,'Same customer. Same ticket. A clearer start.','نفس العميل. نفس التذكرة. وبداية أوضح.','Current and proposed, side by side','الحالي والمقترح جنب بعض')
for right,x in [(False,48),(True,672)]:
 txt(s,x,178,560,41,'Proposed' if right else 'Current','المقترح' if right else 'الحالي',size=26,bold=True,color=C['green'] if right else C['muted'])
 rect(s,x,240,560,379,radius=12);img(s,'genesys',x+22,260,127,31);icon(s,'call',x+22,327,36);txt(s,x+81,330,440,42,'+20 ••• 410',size=27,bold=True,ltr=True)
 if right:
  line(s,x+22,398,x+538,398);img(s,'zoho',x+22,417,72,26,'C31');txt(s,x+111,413,427,37,'T101 · Exchange follow-up','T101 · متابعة استبدال',size=22,bold=True,event='C31')
  rect(s,x+22,472,516,117,fill=C['warm'],line=C['warm'],event='C31');icon(s,'file',x+41,489,26,'C31');txt(s,x+83,486,407,32,'Latest recorded note','آخر ملاحظة مسجلة',size=20,color=C['accent'],event='C31');txt(s,x+41,535,469,38,'Branch review still pending.','بانتظار مراجعة الفرع.',size=25,bold=True,event='C31')
 else:
  rect(s,x+74,396,466,204,radius=10);img(s,'zoho',x+93,412,71,26);rect(s,x+93,453,428,56,line=C['gold'],event='C29');icon(s,'search',x+108,468,24,'C29');txt(s,x+150,463,313,38,'+20 ••• 410',size=26,ltr=True,event='C29');icon(s,'pointer',x+462,486,36,'C29');txt(s,x+93,527,420,34,'T101 · Exchange follow-up','T101 · متابعة استبدال',size=22,bold=True,event='C29');txt(s,x+93,567,420,28,'Note: Branch review pending.','ملاحظة: بانتظار مراجعة الفرع.',size=20,color=C['accent'],event='C29')
outline(s,48,240,560,379,'C28','C30');outline(s,672,240,560,379,'C30','C32')
outline(s,693,471,518,119,'C34')
txt(s,48,635,1184,31,'Existing records, available during the call.','السجلات الموجودة، متاحة وقت المكالمة.',size=22,color=C['accent'],event='C32')
# 6: benefits attached to the same usable workspace crop.
s=base(5,'Less searching. More attention to the customer.','بحث أقل. وتركيز أكبر مع العميل.','Expected benefits to validate','فوائد متوقعة نحتاج نختبرها')
rect(s,48,178,876,452,radius=12);img(s,'genesys',72,199,138,32);icon(s,'call',236,205,29);txt(s,286,200,540,44,'+20 ••• 410',size=28,bold=True,ltr=True);line(s,48,262,924,262)
avatar(s,72,291,49);txt(s,141,292,548,40,'Contact A','العميل A',size=28,bold=True);img(s,'zoho',800,295,80,29);txt(s,141,342,703,32,'Associated record · Existing ticket history','سجل مرتبط · تاريخ التذاكر الموجود',size=22,color=C['muted']);line(s,72,395,900,395)
icon(s,'case',73,414,28);txt(s,118,409,735,44,'T101 · Exchange follow-up','T101 · متابعة استبدال',size=27,bold=True);state(s,73,468,700,'Waiting on the branch','بانتظار الفرع')
rect(s,72,525,828,81,fill=C['warm'],line=C['warm']);icon(s,'file',92,548,29);txt(s,142,544,735,42,'Branch review is still pending.','مراجعة الفرع لسه مطلوبة.',size=29,bold=True)
for yy,target,en,ar in [(300,318,'Fewer manual\nsearch steps','خطوات بحث يدوي\nأقل'),(421,433,'Clearer\nfollow-up','متابعة\nأوضح'),(539,566,'More informed\nconversations','محادثات بمعلومات\nأوضح')]:
 ev='C35' if yy==300 else 'C35-followup'
 line(s,930,target,956,target,color=C['accent'],width=2,event=ev);circle(s,921,target-4,8,C['accent'],ev);txt(s,978,yy,246,79,en,ar,size=24,bold=True,event=ev)
txt(s,48,640,1100,27,'Expected benefits · Measure in an authorized pilot','فوائد متوقعة · نقيسها في تجربة أولية مصرح بها',size=18,color=C['accent'],event='C37')
outline(s,68,521,836,89,'C36','C37')
# 7: existing contractual scope and a proposed test workspace, ending on the goal.
s=base(6,'Inspect the existing setup. Then test the experience.','نفحص الإعدادات الحالية. وبعدها نختبر التجربة.','A practical first collaboration','خطوة عملية لأول تعاون')
rect(s,48,190,369,394,radius=12);icon(s,'file',75,214,38);txt(s,132,215,252,40,'2023 contract','عقد ٢٠٢٣',size=25,bold=True)
for yy,ww in [(285,284),(307,252),(329,268)]:rect(s,76,yy,ww,4,fill=C['line'],line=C['line'],radius=0)
rect(s,70,365,325,124,fill=C['warm'],line=C['warm'],event='C41');txt(s,90,384,285,89,'“CRM URL pop up\nintegration”',size=27,bold=True,ltr=True,event='C41');txt(s,76,529,304,34,'November 2023 · p. 4','نوفمبر ٢٠٢٣ · ص. ٤',size=20,color=C['muted'])
txt(s,76,497,304,30,'Current operation unverified.','التشغيل الحالي غير متحقق منه.',size=18,color=C['muted'],event='C41')
icon(s,'settings',467,256,44,'C41');txt(s,467,318,273,81,'Inspect the\nconfiguration','نفحص\nالإعدادات',size=27,bold=True,event='C41');txt(s,467,425,273,83,'Smallest supported\nimprovement','أبسط تحسين\nتدعمه الأنظمة',size=23,color=C['muted'],event='C43');line(s,420,399,451,399,color=C['accent'],width=2,arrow=True,event='C41')
rect(s,790,243,442,345,radius=12,event='C43');icon(s,'call',814,266,29,'C43');txt(s,859,263,334,41,'Authorized test call','مكالمة اختبار مصرح بها',size=23,bold=True,event='C43');line(s,790,325,1232,325,event='C43');txt(s,814,347,387,41,'+20 ••• 410',size=27,bold=True,ltr=True,event='C43');img(s,'zoho',814,408,73,26,'C46');txt(s,908,405,293,38,'T101 · Exchange','T101 · استبدال',size=23,bold=True,event='C46');rect(s,812,461,399,100,fill=C['warm'],line=C['warm'],event='C46');icon(s,'file',832,479,25,'C46');txt(s,872,476,312,33,'Latest recorded note','آخر ملاحظة مسجلة',size=18,color=C['accent'],event='C46');txt(s,832,520,349,35,'Branch review pending.','بانتظار مراجعة الفرع.',size=24,bold=True,event='C46')
line(s,744,399,780,399,color=C['accent'],width=2,arrow=True,event='C43');txt(s,467,616,746,35,'Start the call with existing customer context.','نبدأ المكالمة بمعلومات العميل الموجودة.',size=24,bold=True,event='C45')

# Stable replacement regions for later authorized interface crops/composites.
for i,key,x,y,w,h,anchors in [
 (4,'comparison.current',48,240,560,379,{'caller_number':[.14,.23,.79,.12],'manual_search':[.16,.56,.77,.15]}),
 (4,'comparison.proposed',672,240,560,379,{'caller_number':[.14,.23,.79,.12],'latest_note':[.04,.61,.92,.31]}),
 (5,'workspace.benefits',48,178,876,452,{'caller_number':[.27,.05,.62,.11],'ticket':[.08,.51,.84,.11],'latest_note':[.03,.77,.95,.18]}),
 (6,'workspace.test',790,243,442,345,{'caller_number':[.05,.30,.87,.12],'latest_note':[.05,.63,.9,.29]})]:
 sc=slides[i];sc['slots'][key]=dict(x=x,y=y,w=w,h=h,anchors=anchors)
 for e in sc['elements']:
  ex=e['x'];ey=e['y'];ew=e.get('w',abs(e.get('x2',ex)-ex));eh=e.get('h',abs(e.get('y2',ey)-ey))
  if x<=ex and ex+ew<=x+w+1 and y<=ey and ey+eh<=y+h+1:e['slot']=key

for s in slides:
 s['notes'] += [B('Narration cues for this scene:','توقيتات التعليق الصوتي للمشهد:')]
 for cue in T['cues']:
  if cue['scene_id']==s['id']:s['notes'].append(B(f"{cue['id']} · {cue['start']:.3f}–{cue['end']:.3f}s · {cue['spoken_phrase']} · {cue['visual_event']}",f"{cue['id']} · {cue['start']:.3f}–{cue['end']:.3f} ثانية · {cue['spoken_phrase']}"))
 for e in s['elements']:
  assert e['at']>=s['start']-.001
  if e['type']=='rect':assert min(int(e['fill'][i:i+2],16) for i in [1,3,5])>=220
story=dict(title=B('GRINDCTRL × Concrete · Narrated product demonstration','GRINDCTRL × كونكريت · عرض المنتج بالتعليق الصوتي'),colors=C,slides=slides,timeline=T,sources=[dict(file='User report in this session',pages=[],supports=B('Manual phone search works; automatic call context reportedly absent. Not independently tested.','البحث اليدوي بالرقم يعمل، والمعلومات لا تظهر تلقائيًا بحسب الإفادة. لم يُختبر مستقلًا.')),dict(file='Concrete contract (29-11-2023).pdf',pages=[4],supports=B('Exact scope: CRM URL pop up integration. Current operation unverified.','البند: CRM URL pop up integration. التشغيل الحالي غير متحقق منه.'))],fixtures={'fictional':True},ui_fidelity={'status':'conceptual','concrete_screenshots_verified':False,'native_layout_verified':False,'display_model':'separate illustrative context window; actual target to validate'})
(ROOT/'story.json').write_text(json.dumps(story,ensure_ascii=False,indent=2));print('Seven narration-led product scenes, independent of the old deck; actual audio-time events.')
