/* Premium 2026-10-22 production: new scenes, one continuous workstation/journey. */
const $=id=>document.getElementById(id),sat=v=>Math.max(0,Math.min(1,v)),ease=v=>1-Math.pow(1-sat(v),3);
const C={bg:'#F8F7F4',white:'#FFFFFF',ink:'#252A28',muted:'#6C736E',line:'#E4E6E0',soft:'#F2F4EF',bronze:'#A17A45',warm:'#F4EBDD',green:'#35634E',sage:'#EAF2EC',red:'#B45D51'};
let time=0,exporting=false,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const R=(x,y,w,h,fill=C.white,r=9,stroke='none',sw=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const T=(text,x,y,size=20,color=C.ink,weight=450,extra='')=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" ${extra}>${esc(text)}</text>`;
const L=(x,y,x2,y2,color=C.line,width=1)=>`<path d="M${x} ${y}L${x2} ${y2}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round"/>`;
const lines=(a,x,y,size=20,color=C.ink,weight=450,gap=1.42)=>a.map((v,i)=>T(v,x,y+i*size*gap,size,color,weight)).join('');
const G=(content,p=1,dy=0)=>`<g opacity="${sat(p)}" transform="translate(0 ${dy})">${content}</g>`;
const wrap=(text,limit=42)=>{let result=[],row='';for(const word of text.split(/\s+/)){if((row+' '+word).trim().length>limit){result.push(row);row=word;}else row=(row+' '+word).trim();}if(row)result.push(row);return result;};
const icon=(type,x,y,size=24,color=C.ink)=>{let d={call:'M5 2l4 5-3 3c2 4 4 6 8 8l3-3 5 4-2 4C10 24 0 14 1 5l4-3z',check:'M3 12l6 6L22 4',search:'M14 14l7 7M3 9a6 6 0 1 0 12 0a6 6 0 1 0-12 0',person:'M8 6a4 4 0 1 0 8 0a4 4 0 1 0-8 0M3 23c0-9 18-9 18 0',copy:'M8 3h13v17H8zM3 7v17h13',lock:'M5 10h14v12H5zM8 10V6a4 4 0 0 1 8 0v4',note:'M4 2h16v20H4zM8 7h8M8 11h8M8 15h6',chat:'M3 3h18v13H9l-6 5V3z',photo:'M3 3h18v18H3zM3 17l6-6 5 5 3-3 4 4M16 7h1',upload:'M12 17V2m-5 5 5-5 5 5M3 15v7h18v-7',arrow:'M3 12h17m-6-6 6 6-6 6',clock:'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 6v6l4 3',retry:'M4 9a8 8 0 1 1 0 7M4 3v6h6',mic:'M9 3a3 3 0 0 1 6 0v9a3 3 0 0 1-6 0V3M5 10v2a7 7 0 0 0 14 0v-2M12 19v4',end:'M2 14c5-8 15-8 20 0v5h-5v-4H7v4H2v-5z',save:'M3 3h15l3 3v16H3zM7 3v7h10V3M7 16h10v6',warn:'M12 2l11 20H1L12 2zM12 8v6m0 3v1',mail:'M2 4h20v16H2zM2 4l10 9L22 4',close:'M4 4l16 16M20 4 4 20'}[type]||'M3 3h18v18H3z';return `<g transform="translate(${x} ${y}) scale(${size/24})" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>`;};
const pill=(label,x,y,w=180,fill=C.soft,color=C.muted)=>R(x,y,w,28,fill,5)+T(label,x+12,y+19,14,color,650);
const button=(label,x,y,w=230,fill=C.ink,color='#FFF',kind='arrow')=>R(x,y,w,41,fill,6)+icon(kind,x+13,y+10,20,color)+T(label,x+43,y+27,16,color,650);
const photo=(key,x,y,w,h)=>{const c={before:[0,0],after:[768,0],garment:[0,512],macro:[768,512]}[key];return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${c[0]} ${c[1]} 768 512" preserveAspectRatio="xMidYMid slice" overflow="hidden"><use href="#fashion"/></svg>`;};
const brand=(x=64,y=31,scale=1)=>`<g transform="translate(${x} ${y}) scale(${scale})"><use href="#mark" width="39" height="26"/>${T('GRINDCTRL',52,21,21,C.ink,750,'letter-spacing="2"')}</g>`;
const vendor=(key,x,y,w,h)=>`<use href="#${key}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const cursor=(x,y,p=1)=>G(`<path d="M${x} ${y}v23l6-6 5 11 5-2-5-10 8-1z" fill="${C.ink}" stroke="#FFF" stroke-width="1.7"/>`,p);
function qtime(term,fallback=0){return film.captions.find(q=>q.text.toLowerCase().includes(term.toLowerCase()))?.start??fallback;}
function active(term,t){return t>=qtime(term,999);}
function typing(text,t,start,duration=1.45){return reduced?text:text.slice(0,Math.max(0,Math.floor(text.length*sat((t-start)/duration))));}
function words(a,x,y,size=14){return T(a.toUpperCase(),x,y,size,C.bronze,650,'letter-spacing="1.4"');}
function headline(s){const h={arrival:'The call arrives. The context is missing.',manual:'The history exists. The agent has to find it.',lookup:'An authorized lookup. Context beside the call.',ticket:'Continue from the last recorded update.',fallback:'Handle uncertainty. Keep the call moving.',value:'Same customer. A clearer starting point.',pilot:'Inspect the setup. Prove the experience.',ready:'When the conversation begins, context is ready.',profile:'A repeat caller. The right customer context.',membership:'Membership comes from a trusted record.',timeline:'Each call keeps its own story.',callnote:'Open the call. Read its original human note.',write:'A new note belongs to this call.',future:'Next time, retrieve the original call note.',product:'One garment. A personal way to explore.',upload:'Choose the garment. Add your photo.',preview:'The same person. The same selected garment.',chat:'Ask without leaving the product.',handoff:'The thread continues with a person.',order:'Order information, within a read-only boundary.',journey:'One journey. Visuals, answers and human help.',brand:'Explore the product. Discuss your store.',close:film.id==='03'?'Let shoppers see it. Let them ask.':'A proposed experience for Concrete.'};return h[s.kind]||h.profile;}
function frame(s){return R(0,0,1280,720,C.bg,0)+brand()+T(film.id==='03'?'SHOPIFY FASHION / PRODUCT DEMONSTRATION':'CONCRETE / PROPOSED EXPERIENCE',1216,50,13,C.muted,600,'text-anchor="end" letter-spacing="1.1"')+T(headline(s),64,126,35,C.ink,570);}
function chrome(x,y,w,h,title,subtitle='ILLUSTRATIVE'){
 return R(x+4,y+7,w,h,'#EBEBE4',12)+R(x,y,w,h,C.white,12,C.line)+R(x,y,w,32,'#F0F2EC',12)+R(x,y+16,w,16,'#F0F2EC',0)+[0,1,2].map(i=>`<circle cx="${x+17+i*12}" cy="${y+16}" r="2.7" fill="#C6CBC1"/>`).join('')+T(title,x+67,y+21,12,C.muted)+T(subtitle,x+w-16,y+21,10,C.bronze,650,'text-anchor="end"');
}
function callRail(t,s,mode='normal'){
 const future=film.id==='02'&&s.kind==='future',incoming=(film.id==='01'&&t<qtime('agent answers',4))||(film.id==='02'&&t<3),phoneFocus=s.kind==='manual'||s.kind==='lookup'||(s.kind==='profile'&&active('number initiates',t)&&!active('reliable match',t));
 let a=R(64,176,270,416,C.white,12,C.line)+vendor('genesys',85,196,116,24)+L(84,237,314,237)+pill(incoming?'Incoming call':'Voice call active',85,253,228,C.sage,C.green);
 a+=`<circle cx="109" cy="318" r="23" fill="${C.sage}"/>`+icon('call',96,305,25,C.green)+T('Concrete support',145,311,16,C.muted,550)+T(future?'Next interaction':'Inbound customer',145,335,15,C.ink,600);
 if(incoming&&!reduced)a+=`<circle cx="109" cy="318" r="${26+5*Math.sin(t*4)}" fill="none" stroke="${C.green}" opacity=".3"/>`;
 a+=T('+20 10 •••• 4821',85,391,23,C.ink,650);
 if(phoneFocus)a+=R(79,361,240,47,'none',6,C.bronze,2);
 const caption=future?'CALL-103 · 29 Oct · Demo':film.id==='02'?'CALL-102 · Current · Demo':'Demo caller number';a+=T(caption,85,420,14,C.muted);
 if(s.kind==='manual')a+=button('Copy number',85,447,228,C.soft,C.ink,'copy')+cursor(272,467,ease((t-s.start-2.6)/.35));
 else a+=lines(['A phone match is not','identity verification.'],85,456,15,C.muted,450,1.4);
 ['mic','clock','end'].forEach((k,i)=>{a+=R(85+i*79,507,68,42,k==='end'?'#F8E9E5':C.soft,6)+icon(k,107+i*79,518,23,k==='end'?C.red:C.muted);});
 a+=T(future?'Agent Youssef · Demo':'Agent Salma · Demo',85,576,14,C.muted);return a;
}
function deskSearch(t,s){
 const search=active('Search Zoho Desk manually',t)||active('search Soho Desk manually',t)||s.kind==='manual'&&t>=s.start+6,opened=active("Open the customer's previous tickets",t)&&s.kind==='manual';
 let a=chrome(360,176,856,416,'Zoho Desk / reported manual workflow')+vendor('zoho',383,218,69,30)+T('Desk',460,241,20,C.ink,650)+R(563,215,627,45,C.soft,6,C.line)+icon('search',578,227,20,C.muted)+T(search?typing('+20 10 •••• 4821',t,qtime('Search Zoho Desk manually',s.start+5)): 'Search tickets by caller phone',611,244,19,search?C.ink:C.muted);
 if(opened)return a+ticketBody(386,280,802,t,'manual');
 if(search){a+=G(R(386,289,802,112,C.white,8,C.line)+T('Ahmed M. · Demo contact',405,325,24,C.ink,600)+T('DESK-2048 / Exchange follow-up',405,363,19,C.muted)+pill('Pending branch review',935,329,228,C.warm,C.bronze),ease((t-qtime('Search Zoho Desk manually',s.start+5)-.85)/.45))+cursor(775,361,ease((t-qtime('Search Zoho Desk manually',s.start+5)-1.6)/.4));}
 else {
  a+=icon('search',732,332,40,C.line)+T('Customer history is available.',788,365,24,C.muted,550,'text-anchor="middle"')+T('Search is still a separate action.',788,407,19,C.muted,450,'text-anchor="middle"');
  if(s.kind==='arrival'&&t<qtime('agent answers',4)+.4){const p=1-ease((t-qtime('agent answers',4))/.4);a+=G(R(515,281,541,229,C.white,12,C.line)+vendor('genesys',539,303,120,24)+pill('Incoming call',853,302,177,C.sage,C.green)+T('+20 10 •••• 4821',540,383,34,C.ink,650)+T('Concrete customer service · Fictional caller',540,419,17,C.muted)+button('Answer call',541,448,486,C.green,'#FFF','call'),p);}
  else if(s.kind==='arrival'&&active('caller is following up',t))a+=G(R(389,453,799,91,C.warm,8)+words('Fictional caller scenario',407,480,11)+T('Following up on last week’s exchange request.',407,516,24,C.ink,600),ease((t-qtime('caller is following up'))/.5));
 }
 return a;
}
function ticketBody(x,y,w,t,mode='pop'){
 let a=T('Exchange follow-up',x+18,y+32,27,C.ink,620)+T('DESK-2048 · Ahmed M. · Demo',x+18,y+63,17,C.muted)+pill('Pending branch review',x+w-246,y+8,228,C.warm,C.bronze)+L(x+18,y+83,x+w-18,y+83);
 a+=R(x+17,y+106,w-34,137,C.warm,9)+words('Latest recorded ticket update',x+36,y+134,12)+T('Awaiting branch review.',x+36,y+175,29,C.ink,600)+T('20 Oct 2026 · 14:05 · Fictional ticket record',x+36,y+210,16,C.muted);
 a+=icon('clock',x+20,y+262,19,C.bronze)+T('Recorded status — review is not marked complete.',x+49,y+279,16,C.muted);return a;
}
function contextPop(t,s){
 const ready=s.kind!=='lookup'||active('screen pop opens',t),matched=active('one reliable match',t)||s.kind==='ticket'||s.kind==='ready';
 let a=chrome(360,176,856,416,'Customer context / proposed URL screen-pop target','PROPOSED / DEMO');
 if(!ready){
  a+=T('Permissioned customer lookup',389,259,26,C.ink,600)+R(390,289,792,69,C.soft,8)+T('+20 10 •••• 4821',413,331,25,C.ink,600)+pill(matched?'1 candidate record':'Looking up…',956,309,203,matched?C.sage:C.warm,matched?C.green:C.bronze);
  if(active('caller number starts',t)){const p=ease((t-qtime('caller number starts'))/.7);a+=`<path d="M318 386C350 386 346 325 389 325" fill="none" stroke="${C.bronze}" stroke-width="2" stroke-dasharray="${140*p} 200"/>`;}
  return a+icon('lock',391,420,25,C.green)+lines(['Only permitted records are requested.','A matching number does not authenticate the caller.'],429,437,20,C.muted,450,1.7);
 }
 const showContact=s.kind!=='lookup'||active('contact record',t),showTickets=s.kind!=='lookup'||active('Previous Support Tickets',t),showNote=s.kind!=='lookup'||active('latest recorded update',t);
 a+=G(T('Ahmed M.',390,263,29,C.ink,650)+T('+20 10 •••• 4821 · Demo contact',390,296,18,C.muted)+pill('Matched record',1020,236,168,C.sage,C.green),showContact?ease((t-qtime('contact record',s.start))/.4):0);
 a+=G(R(388,322,800,75,C.soft,8)+T('DESK-2048',406,349,17,C.muted,650)+T('Exchange follow-up',406,380,24,C.ink,600)+pill('Pending branch review',940,346,228,C.warm,C.bronze),showTickets?ease((t-qtime('Previous Support Tickets',s.start))/.4):0);
 a+=G(R(388,415,800,110,C.warm,8)+words('Latest recorded ticket update',407,444,12)+T('Awaiting branch review.',407,485,28,C.ink,600)+T('20 Oct · 14:05 · Demo',949,507,14,C.muted),showNote?ease((t-qtime('latest recorded update',s.start))/.4):0);
 return a+T('Proposed external context window. Verify caller identity before disclosure.',391,564,15,C.muted);
}
function contactRow(x,y,name,sub,selected=false){return R(x,y,776,73,selected?C.sage:C.white,7,C.line)+icon('person',x+18,y+20,26,selected?C.green:C.muted)+T(name,x+60,y+31,23,C.ink,600)+T(sub,x+60,y+56,15,C.muted)+(selected?icon('check',x+730,y+22,23,C.green):'');}
function fallback(t,s){
 let a=chrome(360,176,856,416,'Customer context / fallback demonstration','PROPOSED / DEMO'),kind='multiple';
 if(film.id==='01')kind=active('phone number alone',t)?'identity':active('lookup service fails',t)?'down':active("there's no match",t)?'none':'multiple';
 else kind=active('Look up temporarily down',t)||active('Lookup temporarily down',t)?'down':active('Missing membership data',t)?'tier':active('Multiple matches',t)?'multiple':active('No matching contact',t)?'none':'none';
 a+=words('Fallback example',390,247,12);
 if(kind==='multiple'){
  const selected=film.id==='01'?active('employee chooses',t):active('select the right record',t);
  a+=T('More than one contact matches.',389,286,27,C.ink,600)+contactRow(389,311,'A. M. · Demo candidate','Verify identity before opening history',selected)+contactRow(389,400,'M. H. · Demo candidate','History remains hidden until selection',false)+T('Choose the correct record after the required checks.',391,536,18,C.muted);
  if(selected)a+=cursor(1048,348,ease((t-qtime(film.id==='01'?'employee chooses':'select the right record'))/.4));
 }else if(kind==='none')a+=icon('search',390,278,38,C.muted)+T('No matching contact',447,311,29,C.ink,600)+T('Continue the call and search manually.',390,371,22,C.muted)+button('Manual search',390,422,313,C.soft,C.ink,'search');
 else if(kind==='down')a+=R(388,273,800,91,'#F8ECE6',8)+icon('warn',409,300,27,C.red)+T('Lookup temporarily unavailable',455,314,28,C.ink,600)+T('No history returned is not the same as no history exists.',409,348,17,C.muted)+button('Use manual fallback',390,405,330,C.soft,C.ink,'retry')+pill('Voice call continues',390,488,260,C.sage,C.green);
 else if(kind==='tier')a+=T('Ahmed M. · Demo contact',391,306,29,C.ink,600)+T('Icons Club membership',391,366,18,C.muted)+R(389,388,798,70,C.soft,7)+T('Unavailable',411,434,26,C.muted,600)+T('Do not infer a tier from the phone number.',391,515,20,C.muted);
 else a+=icon('lock',391,294,40,C.bronze)+lines(['A phone number is a lookup key.','It is not proof of identity.'],449,319,29,C.ink,600,1.55)+T('Follow the organization’s identity and access controls.',391,473,20,C.muted);
 return a;
}
function compare(t,s){
 let a=chrome(64,176,552,416,'Reported current workflow')+chrome(640,176,576,416,'Proposed experience','PROPOSAL / DEMO');
 a+=pill('Same caller · Same ticket',86,224,254,C.soft,C.muted)+pill('Same caller · Same ticket',662,224,254,C.soft,C.muted);
 a+=R(86,280,508,49,C.soft,6)+icon('search',99,293,21,C.muted)+T('+20 10 •••• 4821',136,312,20,C.ink,550)+cursor(479,309,1)+T('Search, then open the history.',87,377,24,C.muted,550)+R(86,408,508,113,C.warm,7)+T('DESK-2048',103,438,16,C.muted)+T('Awaiting branch review.',103,483,25,C.ink,600);
 a+=icon('call',666,284,27,C.green)+T('+20 10 •••• 4821',707,307,22,C.ink,600)+R(663,333,530,185,C.warm,7)+T('Ahmed M. · Demo',682,368,25,C.ink,600)+T('DESK-2048 / Exchange follow-up',682,407,18,C.muted)+T('Awaiting branch review.',682,462,27,C.ink,600)+T('Latest recorded update beside the call.',682,496,16,C.muted);
 a+=T('Expected benefits — validate in an authorized pilot.',640,578,15,C.muted,'550','text-anchor="middle"');
 if(active('Fewer manual searches',t))a+=L(665,322,1191,322,C.bronze,2);
 if(active('easier follow-up',t))a+=R(675,428,508,54,'none',5,C.bronze,2);
 return a;
}
function pilot(t,s){
 const f2=film.id==='02',test=active('test with authorized',t)||active('test the experience',t);
 let a=chrome(360,176,856,416,'Scoped discovery and pilot / not a deployed integration','PROPOSED');
 const rows=f2?[['Call activities and notes','Locate actual source and per-call keys'],['Permissions and retention','Verify who may read and write'],['Native integration options','Validate supported mechanisms']]:[['Existing Genesys screen-pop','Inspect current configuration'],['Zoho Desk access','Validate permitted record access'],['Supported integration options','Check native capability first']];
 rows.forEach((row,i)=>{a+=L(390,228+i*88,1184,228+i*88)+T(row[0],391,259+i*88,23,C.ink,600)+T(row[1],391,291+i*88,18,C.muted)+pill('To verify',1053,250+i*88,132,C.warm,C.bronze);});
 if(test)a+=G(R(389,505,796,62,C.sage,7)+icon('call',406,524,24,C.green)+T('Authorized fictional test calls → inspect the result',445,546,21,C.green,600),ease((t-qtime(f2?'test with authorized':'test the experience'))/.5));
 else a+=T(f2?'Call notes, ticket notes and AI summaries remain distinct.':'Contracted “CRM URL pop up integration” requires inspection.',391,557,16,C.muted);
 return a;
}
function profileWindow(t,s){
 const target=t<qtime('number initiates',26),match=target||active('After a reliable match',t),name=target||active("customer's name",t),email=target||active('including email',t),missing=active('Missing information',t);
 let a=chrome(360,176,856,416,'Customer profile / proposed authorized Zoho context','PROPOSED / DEMO');
 a+=words(target?'Target view / after authorized matching':match?'Matched contact record':'Caller context requested',390,245,12)+R(390,269,798,89,C.soft,8)+icon('person',409,294,33,match?C.green:C.muted)+T(name?'Ahmed M.':'Contact match required',461,309,30,C.ink,600)+T(name?'Fictional customer record':'No history disclosed before the required checks',461,339,17,C.muted);
 a+=T('Phone',391,402,16,C.muted)+T('+20 10 •••• 4821',391,440,26,C.ink,600)+T('Email',804,402,16,C.muted)+T(email?'ahmed@example.com':'Not yet shown',804,440,24,email?C.ink:C.muted,550);
 if(missing)a+=pill('Missing field → Unavailable',803,460,381,C.soft,C.muted);
 if(!match&&active('number initiates',t))a+=R(389,494,799,53,C.warm,7)+T('Permissioned lookup in progress…',408,528,22,C.bronze,600);
 else if(target&&active('notes attached to previous calls',t))a+=R(389,493,799,64,C.warm,6)+T('CALL-101 / 15 Oct / Maya / Human note available',407,532,22,C.ink,550);
 else a+=T('Phone match ≠ identity verification. Field permissions apply.',390,552,17,C.muted);
 return a;
}
function membership(t,s){
 const trusted=active('trusted, updated source',t);
 let a=chrome(360,176,856,416,'Customer profile / membership provenance','PROPOSED / DEMO')+T('Ahmed M. · Demo',391,263,30,C.ink,600)+T('+20 10 •••• 4821   /   ahmed@example.com',391,297,19,C.muted)+L(390,319,1185,319)+words('Concrete Icons Club',390,356,13);
 a+=R(390,379,798,91,trusted?C.warm:C.soft,8)+T(trusted?'Elite · Demo record':'Trusted membership source required',412,427,trusted?32:25,C.ink,600)+T('Program tiers: Lifestyle / Prestige / Elite',391,509,19,C.muted);
 if(trusted)a+=G(icon('lock',390,545,20,C.green)+T('Source, freshness and permission must be validated.',421,563,16,C.green,550),ease((t-qtime('trusted, updated source'))/.5));
 else a+=T('Do not infer membership or benefits from a phone number.',391,563,17,C.muted);
 return a;
}
const oldNote='Customer requested an exchange. Branch review pending.';
const newNote='Customer followed up; awaiting a confirmed branch update.';
function activityRow(x,y,id,date,agent,selected=false){return R(x,y,259,92,selected?C.warm:C.soft,7)+T(id,x+15,y+25,17,C.ink,700)+T(date,x+15,y+52,17,C.muted)+T(agent,x+15,y+77,16,C.muted);}
function activityView(t,s){
 const write=s.kind==='write',future=s.kind==='future',timeline=s.kind==='timeline',selected=!timeline||active('notes for that specific',t),call=write||future?'CALL-102':'CALL-101',author=write||future?'Salma':'Maya',date=write||future?'22 Oct · 14:39':'15 Oct · 11:12';
 let a=chrome(360,176,856,416,'Per-call activity / original authorship preserved','PROPOSED / DEMO')+T('Ahmed M.',390,250,26,C.ink,650)+T('Call Activities',390,280,16,C.muted);
 if(write||future)a+=activityRow(390,300,'CALL-102','22 Oct · 14:32','Salma · Human agent',true)+activityRow(390,404,'CALL-101','15 Oct · 11:08','Maya · Human agent');
 else a+=activityRow(390,300,'CALL-101','15 Oct · 11:08','Maya · Human agent',selected)+activityRow(390,404,'CALL-100','08 Oct · 09:22','Omar · Human agent');
 a+=R(674,300,514,244,C.white,8,C.line)+R(688,314,157,33,C.warm,5)+T('Call note',706,338,17,C.ink,650)+T('Ticket update',866,338,17,C.muted)+T('AI summary',1032,338,16,C.muted)+L(690,359,1171,359);
 a+=`<g data-note-call="${call}" data-note-author="${author}">`+T(call+' / '+author,693,390,23,C.ink,650)+T(date+' · Human-authored',693,422,18,C.muted);
 if(timeline&&!selected)a+=T('Select a call to read its own note.',693,474,20,C.muted);
 else if(write){
  const at=qtime('agent records a new note',s.start+1.5),text=typing(newNote,t,at,1.8),parts=wrap(text,43);
  const linked=active('Notes should belong',t);
  a+=R(689,441,481,69,C.soft,6)+lines(parts,703,465,18,C.ink,450,1.4)+button(linked?'Demo linked to CALL-102':'Save call note · Proposed',693,530,478,linked?C.green:C.ink,'#FFF',linked?'check':'save');
  if(!linked)a+=cursor(1100,550,ease((t-at-1.7)/.3));
 }else a+=R(689,441,481,82,C.warm,6)+lines(wrap(future?newNote:oldNote,42),703,468,20,C.ink,550,1.45);
 a+='</g>';
 if(s.kind==='callnote'&&active('ticket comment',t))a+=pill('Ticket update ≠ call note',771,550,415,C.soft,C.muted);
 if(write)a+=T('Proposed persistence; storage and permissions require validation.',391,583,14,C.muted);
 else if(future)a+=T('CALL-103 reads CALL-102 / Salma’s original note. No authorship reassignment.',391,583,14,C.muted);
 else a+=T('Each note stays attached to its original call, agent and timestamp.',391,583,15,C.muted);
 if(selected)a+=`<path d="M648 346L673 346" stroke="${C.bronze}" stroke-width="2"/>`;
 return a;
}
function concreteScene(s,t){
 if(s.kind==='value')return compare(t,s);
 let a=callRail(t,s);
 if(['arrival','manual'].includes(s.kind))return a+deskSearch(t,s);
 if(['lookup','ticket','ready'].includes(s.kind))return a+contextPop(t,s);
 if(s.kind==='fallback')return a+fallback(t,s);
 if(s.kind==='pilot')return a+pilot(t,s);
 if(s.kind==='profile')return a+profileWindow(t,s);
 if(s.kind==='membership')return a+membership(t,s);
 return a+activityView(t,s);
}

function shopBase(t,s){
 let a=chrome(64,176,1152,416,'Shopify fashion storefront / illustrative product page','DEMO')+T('DEMO FASHION',89,243,18,C.ink,650,'letter-spacing="1.8"')+T('Collection    Size guide    Store information',821,242,15,C.muted)+L(87,258,1192,258)+photo('garment',86,274,570,295)+words('Selected product / demo',705,294,12)+T('Navy linen overshirt',705,336,30,C.ink,600)+T('Explore the material, details and style.',705,373,18,C.muted)+T('Size guide supplied by the merchant',705,409,16,C.muted)+button('Try it on with AI',705,435,462,C.ink,'#FFF','photo')+button('Ask Store Chat',705,490,462,C.soft,C.ink,'chat');
 if(active('one question remains',t)&&s.kind==='product')a+=G(R(115,453,495,71,C.white,7,C.line)+T('What could this look like on me?',136,495,24,C.ink,550),ease((t-qtime('one question remains'))/.5));
 return a;
}
function upload(t,s){
 let a=shopBase(t,s)+R(64,210,1152,382,'#FFFFFFD9',0)+R(228,226,823,344,C.white,11,C.line)+T('Create your personal preview',255,272,29,C.ink,600)+photo('garment',253,292,209,208)+T('Selected garment',253,529,16,C.muted)+R(488,294,533,207,C.soft,8,C.line);
 const added=active('upload',t)||s.visual_only;
 if(added)a+=G(photo('before',495,301,216,193)+T('Your photo',733,354,24,C.ink,600)+T('Synthetic demo adult',733,388,16,C.muted),ease((t-qtime('upload',s.start))/.5));
 else a+=icon('upload',718,327,43,C.muted)+T('Choose your photo',754,407,23,C.muted,550,'text-anchor="middle"');
 a+=button(added?'Request preview':'Upload photo',741,518,280,C.ink,'#FFF',added?'photo':'upload')+T('Use a photo you have permission to upload.',255,557,15,C.muted);
 return a;
}
function preview(t,s){
 const generated=active('system generates',t),limit=active("isn't an exact measurement",t)||active('fit guarantee',t);
 let a=chrome(64,176,1152,416,'AI Virtual Try-On / authored illustrative preview','DEMO')+photo('before',89,230,425,297)+photo('garment',545,291,181,177);
 if(s.visual_only&&!generated){const p=ease((t-s.start)/1.5);a+=R(756,230,435,297,C.soft,7)+icon('photo',943,280,47,C.bronze)+T('Photo + selected garment',973,376,24,C.ink,600,'text-anchor="middle"')+T('Preview request ready',973,419,20,C.muted,450,'text-anchor="middle"')+`<path d="M730 380H${730+24*p}" stroke="${C.bronze}" stroke-width="3"/>`+G(icon('check',960,454,28,C.green),p);}
 a+=G(photo('after',756,230,435,297),generated?ease((t-qtime('system generates',s.start))/.75):0)+T('Your photo',89,558,23,C.ink,600)+T(s.visual_only&&!generated?'Prepare the preview request':'Same person / selected garment',756,558,23,C.ink,600)+icon('arrow',609,481,30,C.bronze);
 if(limit)a+=R(276,600,729,29,C.warm,4)+T('Visual preview — not a measurement or exact-fit guarantee.',640,620,16,C.ink,600,'text-anchor="middle"');
 else a+=T('Synthetic demonstration assets. Processing time is not represented.',88,620,15,C.muted);
 return a;
}
function shopChat(t,s){
 const response=active('Store Chat answers',t)||s.visual_only||s.kind==='journey';
 let a=chrome(64,176,1152,416,'Selected product / Store Chat on the same page','ILLUSTRATIVE')+photo('garment',88,230,515,325)+R(636,227,555,335,C.white,9,C.line)+R(636,227,555,49,C.soft,9)+icon('chat',653,240,24,C.green)+T('Store Chat',691,258,22,C.ink,650)+T('English / Arabic',1035,255,13,C.muted);
 if(s.visual_only){a+=R(654,299,512,70,C.soft,7)+T(typing('Ask about this garment…',t,s.start,.9),673,341,23,C.muted)+G(pill('Size guide',654,401,147,C.warm,C.ink)+pill('Care',818,401,132,C.soft,C.muted)+pill('Delivery',968,401,197,C.soft,C.muted),ease((t-s.start-.4)/.5))+cursor(764,417,ease((t-s.start-1)/.3));return a;}
 a+=R(737,298,430,57,C.warm,7)+T(typing('Does this shirt run oversized?',t,qtime('Does the shirt',s.start),1.1),755,332,20,C.ink,550);
 a+=G(R(654,378,511,111,C.soft,7)+lines(['Please check the merchant’s size guide','for this garment. A visual preview','does not confirm physical fit.'],674,407,19,C.ink,450,1.45)+T('Source: example merchant size guidance',675,525,14,C.green,600),response?ease((t-qtime('Store Chat answers',s.start))/.5):0);
 return a;
}
function shopInbox(t,s){
 const inbox=active('shared inbox',t)||s.visual_only||s.kind==='journey',note=active('private note',t)||active('private node',t)||s.kind==='journey',assigned=active('Assigns it',t)||s.kind==='journey';
 let a=chrome(64,176,1152,416,inbox?'GRINDCTRL / shared inbox — illustrative':'Store Chat / human handoff','DEMO');
 if(!inbox)return a+photo('garment',88,231,357,318)+R(473,230,715,321,C.soft,9)+T('A person can continue from here.',501,282,30,C.ink,600)+T('Handoff reason',501,345,16,C.muted)+lines(['Shopper requested personal sizing help.','The selected shirt and conversation go with it.'],501,388,23,C.ink,450,1.55)+button('Continue with the team',502,478,651,C.ink,'#FFF','person');
 a+=R(85,225,229,332,C.soft,7)+T('Team Inbox',101,260,23,C.ink,650)+R(96,287,207,91,C.warm,6)+T('Alex · Demo shopper',110,318,18,C.ink,650)+T('Sizing / navy overshirt',110,350,14,C.muted)+T('Conversation retained',101,532,14,C.green,600)+T('Selected shirt / sizing question',340,258,25,C.ink,600);
 if(assigned)a+=pill('Assigned: Lina · Demo',944,233,244,C.sage,C.green);
 a+=R(617,293,571,59,C.warm,7)+T('Could a person help me read the size guide?',637,329,20,C.ink);
 a+=T('Handoff reason: personal sizing help requested.',341,391,17,C.muted);
 if(note)a+=G(R(340,413,848,63,'#FCF1D9',7)+words('Private note / Lina',356,437,11)+T('Keep the selected shirt and sizing question in context.',356,462,18,C.ink),ease((t-qtime('private note',qtime('private node',s.start)))/.45));
 if(active('replies in context',t)||s.kind==='journey')a+=G(R(340,493,848,63,C.sage,7)+T('Lina: I can help you read the guide for this garment.',357,530,20,C.ink),ease((t-qtime('replies in context',s.start))/.4));
 return a;
}
function order(t,s){
 const verified=s.visual_only||active('Read-only order',t),result=verified&&!s.visual_only;
 let a=chrome(64,176,1152,416,'Optional order assistance / read-only example','CONFIGURATION REQUIRED')+R(87,230,473,327,C.soft,8)+icon('lock',108,251,28,C.green)+T('Verify the shopper details',151,276,25,C.ink,600)+T('Order number',110,322,15,C.muted)+R(109,334,428,45,C.white,5,C.line)+T('#DEMO-1001',126,364,21,C.ink,600)+T('Email associated with the order',110,413,15,C.muted)+R(109,427,428,45,C.white,5,C.line)+T('alex@example.com',126,457,21,C.ink)+pill('Configured read-only access',110,506,426,C.sage,C.green);
 a+=R(591,230,599,327,C.white,8,C.line)+T(result?'Illustrative order status':'Verify access before lookup',614,281,28,C.ink,600);
 if(result)a+=T('Preparing order · Demo',615,340,25,C.ink,550);
 else a+=T('No production connection is asserted.',615,340,20,C.muted);
 a+=R(614,397,553,115,C.warm,7)+icon('lock',632,420,26,C.bronze)+lines(['Read only.','No order changes or refund promises.'],674,438,22,C.ink,600,1.5);
 if(s.visual_only){const second=t-s.start>.9;a+=R(104,second?422:329,438,55,'none',5,C.bronze,2)+cursor(493,second?454:362,1);}
 return a;
}
function journey(t,s){
 if(active('If the question needs judgment',t)&&!active('For a fashion brand',t))return shopInbox(t,s);
 if(active('asks about the size',t)&&!active('If the question needs judgment',t))return shopChat(t,s);
 if(active('Store Chat helps',t)&&!active("merchant's team stays",t))return shopChat(t,s);
 if(active("merchant's team stays",t))return shopInbox(t,s);
 if(active('previews it on',t)||active('Virtual Try-On helps',t))return preview(t,s);
 return shopBase(t,s);
}
function brandScene(t,s){
 let a=chrome(64,176,1152,416,'Explore the GRINDCTRL product experience','ILLUSTRATIVE')+photo('after',88,229,424,331)+brand(566,262,1.35)+lines(['Virtual Try-On. Store Chat.','The human team, in context.'],567,369,29,C.ink,550,1.5)+button('grindctrl.cloud',567,478,600,C.ink,'#FFF','arrow');return a;
}
function closing(t,s){
 if(film.id==='03')return brandScene(t,s);
 return R(64,176,1152,416,C.white,12,C.line)+brand(108,235,1.7)+T('×',525,274,40,C.bronze,400)+T('Concrete',590,274,42,C.ink,550)+T(film.id==='01'?'The call arrives. The context appears.':'Every call has its own story.',108,391,42,C.ink,550)+T('Proposed experience · Inspect the setup · Authorized pilot',108,463,22,C.muted)+L(108,507,1168,507)+T('GRINDCTRL proposal / illustrative workflows / no deployed integration claimed',108,551,16,C.muted);
}
function currentScene(t){return film.scenes.find(s=>t>=s.start&&t<s.end)||film.scenes.at(-1);}
function draw(s,t){if(s.kind==='close')return closing(t,s);if(film.id!=='03')return concreteScene(s,t);return ({product:shopBase,upload,preview,chat:shopChat,handoff:shopInbox,order,journey,brand:brandScene}[s.kind]||shopBase)(t,s);}
function captionAt(t){return film.captions.find(q=>t>=q.start&&t<q.end);}
function captionSvg(t){const q=captionAt(t);if(!q||!captions)return '';const rows=[];let row='';for(const word of q.text.split(/\s+/)){if((row+' '+word).trim().length>77){rows.push(row);row=word;}else row=(row+' '+word).trim();}if(row)rows.push(row);let h=rows.length*28+15,w=Math.min(1152,Math.max(460,Math.max(...rows.map(s=>s.length))*10.3+38));return R((1280-w)/2,698-h,w,h,'#252D27',6)+lines(rows,640,698-h+29,20,'#FFF',500,1.4).replaceAll('font-size="20"','font-size="20" text-anchor="middle"');}
let captions=true;
function renderAt(t){time=Math.max(0,Math.min(149.999,t));const s=currentScene(time),index=film.scenes.indexOf(s),p=reduced?1:ease((time-s.start)/.45);let art=draw(s,time);if(index&&p<1){const prev=film.scenes[index-1];art=G(draw(prev,prev.end-.001),1-p)+G(art,p,(1-p)*5);}
 $('frame').innerHTML=frame(s)+art+captionSvg(time)+T(film.id==='03'?'ILLUSTRATIVE PRODUCT DEMO · SYNTHETIC PHOTO':'CONCRETE PROPOSAL · FICTIONAL RECORDS · NOT A LIVE TENANT SCREEN',64,716,9,C.muted,600,'letter-spacing="1.05"');
 if(!exporting){$('seek').value=time;$('clock').textContent=fmt(time)+' / 2:30';$('play').textContent=$('audio').paused?'Play':'Pause';}return {scene:s.id,kind:s.kind,time,caption:captionAt(time)?.text,visualOnly:s.visual_only};
}
function keyAt(t){const s=currentScene(t),cue=captionAt(t),local=t-s.start;const moving=local<2.5||s.visual_only||s.kind==='arrival'&&t<4||(cue&&t-cue.start<1.9);return s.id+'|'+(cue?.start??'none')+'|'+(moving?t.toFixed(5):'hold');}
function fmt(t){return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');}
async function play(){if(!$('audio').paused){$('audio').pause();return;}if($('audio').ended)$('audio').currentTime=0;await $('audio').play();}
function tick(){if(!exporting&&!$('audio').paused)renderAt($('audio').currentTime);requestAnimationFrame(tick);}
$('play').onclick=play;$('replay').onclick=()=>{$('audio').currentTime=0;renderAt(0);$('audio').play();};$('next').onclick=()=>{$('audio').pause();$('audio').currentTime=film.scenes.find(s=>s.start>$('audio').currentTime+.1)?.start??149.8;renderAt($('audio').currentTime);};$('motion').onclick=()=>{reduced=!reduced;$('motion').textContent=reduced?'Motion off':'Motion on';renderAt(time);};$('captions').onclick=()=>{captions=!captions;renderAt(time);};$('seek').oninput=e=>{$('audio').currentTime=+e.target.value;renderAt(+e.target.value);};$('audio').onseeked=()=>renderAt($('audio').currentTime);$('audio').onended=()=>renderAt(149.99);
window.GRINDCTRL={renderAt,keyAt,setExport:on=>{exporting=on;$('audio').pause();},setReduced:on=>{reduced=on;renderAt(time);},getState:()=>({time,scene:currentScene(time).id,paused:$('audio').paused})};document.fonts.ready.then(()=>renderAt(0));requestAnimationFrame(tick);
