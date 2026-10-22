/* Editable GRINDCTRL commercial renderer. Pure, seekable visual states. */
const $=id=>document.getElementById(id),clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>1-Math.pow(1-clamp(v),3);
const C={bg:'#F7F6F2',paper:'#FFFFFF',ink:'#20211F',muted:'#6C706A',line:'#E4E5DF',gold:'#AF8B56',pale:'#F0E9DC',green:'#3F6555',soft:'#F0F3EF',dark:'#191C1B'};
let now=0,exporting=false,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const R=(x,y,w,h,fill=C.paper,r=12,stroke='none')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
const L=(x,y,x2,y2,color=C.line,width=1)=>`<path d="M${x} ${y}L${x2} ${y2}" stroke="${color}" stroke-width="${width}" fill="none"/>`;
const T=(text,x,y,size=22,color=C.ink,weight=450,extra='')=>`<text class="label" x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${esc(text)}</text>`;
const lines=(arr,x,y,size=22,color=C.ink,weight=450,gap=1.4)=>arr.map((s,i)=>T(s,x,y+i*size*gap,size,color,weight)).join('');
const G=(s,p=1,dy=0)=>`<g opacity="${clamp(p)}" transform="translate(0 ${dy})">${s}</g>`;
const photo=(key,x,y,w,h,rx=0)=>{const map={before:[0,0,0],after:[0,768,0],garment:[0,0,512],boutique:[0,768,512],macro:[1,0,0],tablet:[1,768,0],fitting:[1,0,512],look:[1,768,512]},[board,cx,cy]=map[key];return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${cx} ${cy} 768 512" preserveAspectRatio="xMidYMid slice" overflow="hidden"><use href="#board${board}"/></svg>`;};
const icon=(kind,x,y,size=24,color=C.ink)=>{let path={chat:'M3 3h18v13H9l-6 5V3z',check:'M4 12l5 5L21 5',lock:'M6 10h12v11H6z M9 10V6a3 3 0 0 1 6 0v4',arrow:'M3 12h17m-6-6 6 6-6 6',photo:'M3 3h18v18H3z M3 17l6-6 5 5 3-3 4 4 M16 7h1',person:'M8 6a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M3 23c0-9 18-9 18 0',search:'M14 14l7 7 M3 9a6 6 0 1 0 12 0a6 6 0 1 0-12 0',upload:'M12 17V2m-5 5 5-5 5 5M3 15v7h18v-7',note:'M4 2h16v20H4zM8 7h8M8 11h8M8 15h6',shirt:'M8 3l4 2 4-2 6 5-4 4-2-2v12H8V10l-2 2-4-4z',bag:'M5 7h14l2 15H3L5 7zM8 7V5a4 4 0 0 1 8 0v2',play:'M7 3l15 9-15 9V3z',dots:'M5 12h1m6 0h1m6 0h1',close:'M5 5l14 14M19 5 5 19'}[kind]||'M3 3h18v18H3z';return `<g transform="translate(${x} ${y}) scale(${size/24})" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></g>`;};
const btn=(label,x,y,w=210,fill=C.ink,color='#FFF',ico)=>R(x,y,w,43,fill,6)+ (ico?icon(ico,x+14,y+12,19,color):'')+T(label,x+(ico?42:17),y+28,17,color,650);
function note(text,x=70,y=596){return icon('lock',x,y-14,16,C.muted)+T(text,x+24,y,14,C.muted);}
function brand(x=48,y=30,color=C.ink,scale=1){return `<g transform="translate(${x} ${y}) scale(${scale})"><use href="${color==='#FFF'?'#mark-white':'#mark'}" x="0" y="0" width="47" height="31"/>${T('GRINDCTRL',61,24,24,color,750,'letter-spacing="2.5"')}</g>`;}
function chrome(title='Illustrative storefront',x=48,y=104,w=1184,h=498){return R(x+5,y+8,w,h,'#E9E7E1',14)+R(x,y,w,h,C.paper,14,C.line)+R(x,y,w,38,'#F0F0EB',14)+R(x,y+20,w,18,'#F0F0EB',0)+[0,1,2].map(i=>`<circle cx="${x+20+i*14}" cy="${y+19}" r="3" fill="#C1C3BB"/>`).join('')+T(title,x+90,y+25,13,C.muted)+T('DEMO',x+w-60,y+25,12,C.gold,700);}
function captionAt(t){return film.captions.find(c=>t>=c.start&&t<c.end);}
function typing(s,elapsed,start=1.0,dur=1.6){return reduced?s:s.slice(0,Math.max(0,Math.floor(s.length*clamp((elapsed-start)/dur))));}
function pointer(x,y,p){return G(`<path d="M${x} ${y}v23l6-6 5 11 5-2-5-10 8-1z" fill="${C.ink}" stroke="#FFF" stroke-width="1.5"/>`,p);}
function sourceOnset(term,s,offset=0){const q=film.captions.find(c=>c.start>=s.start-.01&&c.start<s.end&&c.text.toLowerCase().includes(term));return q?q.start:s.start+offset;}
function header(s){return brand()+T(`0${Number(film.id)}  /  ${film.title.toUpperCase()}`,1230,52,13,C.muted,550,'text-anchor="end" letter-spacing="1.4"');}
function sublabel(text,x,y){return T(text.toUpperCase(),x,y,13,C.gold,700,'letter-spacing="1.8"');}

function editorial(s,t){
 const local=t-s.start,key=s.mode==='beautiful'?'macro':s.mode==='honest'?'look':s.mode==='brand'?'boutique':'after';
 let a=photo(key,48,106,714,494)+R(794,106,438,494,C.dark,0);
 let headline=s.mode==='brand'?['Beautiful is only','the beginning.']:s.mode==='beautiful'?['More than a','beautiful product.']:s.mode==='honest'?['Practical tools.','Clear boundaries.']:['The moment','before “buy”.'];
 a+=sublabel('A better fashion journey',830,161)+lines(headline,830,225,37,'#FFF',550,1.22);
 if(s.mode==='honest')a+=lines(['Visual exploration.','Merchant-supplied knowledge.','Human support when needed.'],830,389,18,'#CDD2CA',450,1.9);
 else a+=G(R(830,399,365,123,'#2A2F2B',8)+icon('bag',850,421,23,'#E0C7A3')+T('Selected, but still unsure.',886,438,18,'#FFF',550)+T('What would it look like on me?',850,483,17,'#C6CCC4'),ease(local/.55));
 return a;
}
function fitting(s,t){return photo('fitting',48,106,567,494)+R(643,106,589,494,C.paper,0)+sublabel('From fitting room to product page',677,148)+photo('garment',778,169,335,344)+G(R(680,479,505,77,C.pale,8)+T('A photo is a starting point.',705,512,23,C.ink,600)+T('Personal exploration is the next step.',705,539,17,C.muted),ease((t-s.start-.4)/.6));}
function product(s,t){
 const local=t-s.start;let a=chrome('DEMO FASHION / product page')+T('DEMO FASHION',78,179,19,C.ink,650,'letter-spacing="2"')+T('Collection    About    Store Chat',888,179,14,C.muted)+L(72,195,1208,195);
 a+=photo('garment',74,212,548,340)+sublabel('Illustrative product',664,231)+T('Tailored camel blazer',664,273,30,C.ink,600)+T('Explore the garment in a personal way.',664,306,18,C.muted);
 a+=T('Size options — demo',664,350,15,C.muted)+['S','M','L'].map((v,i)=>R(664+i*62,368,50,38,i===1?C.pale:C.paper,4,C.line)+T(v,684+i*62,393,17,C.ink,600)).join('');
 a+=btn('Try it on',664,429,249,C.ink,'#FFF','photo')+btn('Ask Store Chat',664,485,249,C.soft,C.ink,'chat');
 if(s.mode==='question')a+=G(R(266,467,305,58,'#FFFFFF',8,C.line)+T('What would it look like on me?',284,502,17,C.ink,550),ease((t-sourceOnset('what would it look like',s,1))/.6));
 if(s.mode==='select'||s.mode==='demo_beat')a+=pointer(842,450,ease((local-1.2)/.5));
 a+=note('Illustrative product and interface. No price or live availability claim.',78,579);return a;
}
function questions(s,t){
 const local=t-s.start;let a=photo('tablet',48,106,558,494)+R(638,106,594,494,C.paper,0)+sublabel('A real question deserves context',674,154);
 const qs=film.id==='02'?['Is this available in my size?','How should I care for the fabric?','Can you help me check an order?']:['Where is the size guide?','What should I know about delivery?','How does this garment look?'];
 if(film.id==='03')qs.splice(0,3,'Does this item run true to size?','What are the delivery options?','How should I care for the fabric?');
 const terms=film.id==='02'?['available','care for','check an order']:['true to size','delivery options','cared for'];
 qs.forEach((q,i)=>{const at=s.mode==='demo_beat'?i*.75:film.id==='01'?.3+i*.75:sourceOnset(terms[i],s,i*.9)-s.start;a+=G(R(674,193+i*105,513,77,i===0?C.pale:C.soft,9)+icon(i===2?'bag':'chat',696,217+i*105,24)+T(q,734,240+i*105,19,C.ink,550),ease((local-at)/.45));});
 return a+T('Store-specific questions. Clear next steps.',676,565,18,C.muted);
}
function upload(s,t){
 const local=t-s.start;let p=ease((local-1.0)/.6);return chrome('Virtual Try-On / illustrative photo upload')+photo('before',80,173,442,354)+sublabel('Your selected garment',568,185)+photo('garment',565,201,164,191)+R(775,175,410,352,C.soft,12,C.line)+icon('upload',945,205,45,C.muted)+T('Add your photo',844,287,27,C.ink,600)+T('One photo for your preview.',820,322,18,C.muted)+G(photo('before',919,339,116,112),p)+btn('Request preview',819,471,318,C.ink,'#FFF','photo')+note('Use a photo you have permission to upload. Synthetic demo model shown.',80,578)+pointer(1080,493,ease((local-2.2)/.4));
}
function tryon(s,t){
 const local=t-s.start;let p=s.mode==='generate'||s.mode==='demo_beat'?ease((local-1.1)/.65):1;
 let a=chrome('AI Virtual Try-On / illustrative preview')+photo('before',90,175,439,350)+G(photo('after',747,175,439,350),p)+R(747,175,439,350,C.soft,0)+G(photo('after',747,175,439,350),p);
 a+=T('Your photo',107,557,20,C.ink,600)+T('Selected garment preview',761,557,20,C.ink,600)+photo('garment',561,245,155,181)+icon('arrow',611,437,42,C.gold);
 if(p<1)a+=T('Creating an illustrative preview…',776,353,20,C.muted);
 if(s.mode==='limits')a+=R(275,584,730,32,C.pale,4)+T('Visual exploration — not an exact physical fit guarantee.',640,606,16,C.ink,600,'text-anchor="middle"');
 else a+=note('Same synthetic person. Same selected garment. Processing time not represented.',91,598);
 return a;
}
function chat(s,t){
 const local=t-s.start,human=['complex','natural'].includes(s.mode);let a=chrome('Store Chat / illustrative conversation')+photo('garment',73,170,481,358)+T('Selected product',93,558,18,C.ink,600)+R(596,165,591,393,C.paper,10,C.line)+R(596,165,591,58,C.soft,10)+icon('chat',617,183,23,C.green)+T('Store Chat',655,201,22,C.ink,650)+T('English / Arabic',1004,198,13,C.muted);
 const q=human?'Could I speak with someone about the size?':s.mode==='specific'?'Can you help with this garment?':'Where can I find the size and care guidance?';
 a+=R(676,245,480,65,C.pale,9)+lines(q.length>46?[q.slice(0,43),q.slice(43)]:[q],694,272,18,C.ink,450,1.2);
 const reply=human?['Of course. I can pass this conversation','to the team with your question included.']:['I can help you find this store’s guidance.','Let’s check the merchant’s size guide','and the garment’s care information.'];
 a+=G(R(617,335,512,115,C.soft,9)+lines(reply,638,367,18,C.ink,450,1.45),ease((local-.8)/.5));
 a+=T(human?'Human handoff available':'Grounded in merchant-supplied information',622,483,14,C.green,600)+R(617,507,546,35,'#FAFAF7',5,C.line)+T(typing('Ask a question about this store…',local,0,1),633,530,16,C.muted);
 return a+note('Illustrative responses. Policies and knowledge are configured by the merchant.',79,580);
}
function knowledge(s,t){
 const local=t-s.start;let a=chrome('Store knowledge / illustrative source-grounded support')+R(73,169,330,380,C.soft,8)+T('Merchant knowledge',96,207,22,C.ink,650);
 ['Product information','Size guidance','Delivery policy','Garment care'].forEach((v,i)=>{a+=R(90,235+i*65,296,52,i===3?C.pale:C.paper,6)+icon(i===3?'shirt':'note',105,250+i*65,20,C.muted)+T(v,141,270+i*65,17,C.ink,i===3?650:450);});
 a+=R(431,169,407,380,C.paper,8,C.line)+sublabel('Sample merchant document',454,204)+T('Care information',454,247,25,C.ink,600)+lines(['For the selected garment, consult','the care label and the merchant’s','current care guidance.'],454,294,19,C.muted,450,1.65)+L(454,392,812,392)+icon('check',454,416,21,C.green)+T('Source supplied by merchant',486,434,16,C.green,600);
 a+=G(R(862,218,325,287,C.dark,10)+icon('chat',885,241,25,'#D3B78E')+lines(['Use the store’s','information.'],885,302,28,'#FFF',550,1.25)+lines(['Don’t invent product details.','Escalate when a person is needed.'],885,405,15,'#C3CCC2',450,1.6),ease((local-.65)/.55));
 return a+note(s.mode==='bilingual'?'Store Chat supports English and Arabic. Editorial captions remain English.':'Example knowledge only. No claim that these are a merchant’s actual policies.',80,581);
}
function handoff(s,t){
 const local=t-s.start;let a=chrome('Human handoff / illustrative continuity')+R(77,170,647,382,C.paper,8,C.line)+icon('chat',98,190,24)+T('Conversation thread',135,211,23,C.ink,650)+R(257,242,438,58,C.pale,8)+T('Could someone help with the size?',276,278,19,C.ink)+R(100,327,538,78,C.soft,8)+lines(['I’ll connect you with the team.','Your conversation will go with you.'],119,358,19,C.ink,450,1.4)+G(R(99,434,594,87,C.pale,8)+icon('person',118,457,30,C.green)+T('Maya · Demo team member',164,466,21,C.ink,650)+T('Human continuation',164,493,16,C.muted),ease((local-.9)/.6));
 a+=R(755,171,432,382,C.soft,8)+sublabel('Context travels with the handoff',781,211)+T('Reason for handoff',781,265,23,C.ink,600)+lines(['Shopper requested a person','to help with sizing.'],781,310,20,C.muted,450,1.5)+L(781,375,1163,375)+icon('check',781,404,24,C.green)+T('Original conversation included',817,424,18,C.green,600)+T('Human judgment stays with the team.',781,494,17,C.muted);
 return a+note('Illustrative thread and team identity. No actual customer data.',80,581);
}
function inbox(s,t){
 const local=t-s.start,atNote=sourceOnset('private notes',s,1.7),atAssign=sourceOnset('assign',s,.7),atReply=sourceOnset('saved replies',s,3.0);
 let a=chrome('GRINDCTRL / shared team inbox — illustrative')+R(64,153,184,411,C.dark,4)+T('Team Inbox',86,190,21,'#FFF',650)+R(77,215,159,45,'#343B35',5)+icon('chat',88,228,18,'#D9C6A7')+T('Conversations',116,244,14,'#FFF',600)+T('Store knowledge',86,298,14,'#CBD0C8')+T('Saved replies',86,339,14,'#CBD0C8')+R(260,154,254,409,'#F8F9F5',0)+T('Conversations',281,192,20,C.ink,600)+R(273,218,227,98,C.pale,6)+T('Emma · Demo',289,249,19,C.ink,650)+T('Sizing question',289,279,16,C.muted)+T('Human requested',289,300,13,C.green,600);
 a+=T('Sizing question',542,191,24,C.ink,650)+G(R(986,162,201,38,C.soft,5)+T('Assigned: Maya (Demo)',1001,187,14,C.green,600),ease((t-atAssign)/.45))+L(537,213,1186,213)+R(757,234,429,58,C.pale,8)+T('Could I get help with the size?',776,269,18,C.ink)+T('Handoff reason: shopper requested a person.',544,325,16,C.muted);
 a+=G(R(543,347,640,75,'#FFF5DF',7)+sublabel('Private note — team only',560,371)+T(typing('Check the current size guide before replying.',t-atNote,0,1.2),560,400,17,C.ink),ease((t-atNote)/.4));
 a+=G(R(543,440,640,84,C.soft,7)+T('Saved reply → reviewed by Maya',561,466,15,C.green,600)+lines(['Hi, I’ve read your question. Let’s check','the size guide for this garment together.'],561,493,17,C.ink,450,1.3),ease((t-atReply)/.45));
 if(s.mode==='policies')a+=G(R(542,437,642,96,C.pale,8)+sublabel('Merchant policy / illustrative context',561,464)+lines(['Use the store’s current size guide.','Keep the customer’s question in view.'],561,491,18,C.ink,450,1.4),ease((t-sourceOnset('experience can be adapted',s,6))/.6));
 return a+note('Illustrative assignment, private note and response. Demo identities only.',79,583);
}
function order(s,t){
 const local=t-s.start,verified=s.mode==='boundary'||(s.mode==='readonly'&&t>=sourceOnset('assistant can look up',s,2));
 let a=chrome('Order assistance / read-only illustrative example')+R(80,172,504,383,C.soft,10)+icon('lock',108,198,30,C.green)+T('Verify shopper details',151,222,25,C.ink,600)+T('Order number',108,267,16,C.muted)+R(107,280,447,49,C.paper,5,C.line)+T('#DEMO-1001',124,313,21,C.ink,600)+T('Email associated with the order',108,363,16,C.muted)+R(107,376,447,49,C.paper,5,C.line)+T('emma@example.com',124,409,20,C.ink)+btn(verified?'Verified demo details':'Verify before lookup',108,469,445,verified?C.green:C.ink,'#FFF','lock');
 a+=R(618,172,569,383,C.paper,10,C.line)+sublabel('Configured access required',646,207)+T(verified?'Demo order status':'Identity check first',646,254,30,C.ink,600);
 if(verified)a+=G(R(646,287,512,103,C.soft,8)+icon('bag',666,313,28,C.green)+T('Preparing order',712,325,24,C.ink,600)+T('Fictional order #DEMO-1001',712,357,15,C.muted),ease((local-.5)/.5));else a+=lines(['Order information is shown only','after the required details are verified.'],646,310,22,C.muted,450,1.6);
 a+=R(645,432,511,71,C.pale,8)+icon('lock',664,450,22,C.gold)+T('Read-only: no edits or refunds',700,476,20,C.ink,600);
 return a+note('Fictional order and email. Lookup depends on configured access and verification.',80,584);
}
function pair(s,t){
 let active=-1;
 if(film.id==='03'&&s.mode==='together'){
  if(t>=sourceOnset('virtual try-on helps',s,5))active=0;
  if(t>=sourceOnset('store chat helps',s,9))active=1;
  if(t>=sourceOnset('human team',s,13))active=2;
 }
 let a=photo('after',48,106,570,494)+R(649,106,583,494,C.paper,0)+sublabel('Two complementary experiences',681,153)+T('See it. Then ask.',681,205,36,C.ink,600);
 if(active===0)a+=R(670,232,539,99,C.pale,7);
 a+=icon('photo',682,250,33,C.gold)+T('Virtual Try-On',729,277,25,C.ink,650)+T('Explore a garment visually.',729,309,19,C.muted)+L(681,342,1196,342);
 if(active===1)a+=R(670,357,539,99,C.pale,7);
 a+=icon('chat',682,375,33,C.green)+T('Store Chat',729,402,25,C.ink,650)+T('Find store-specific information.',729,435,19,C.muted)+R(680,486,518,69,active===2?C.pale:C.soft,7)+icon('person',696,507,26,C.green)+T('A route to the human team.',737,529,21,C.ink,550);
 if(active===1)a+=R(76,467,512,82,C.paper,8)+icon('chat',94,487,25,C.green)+lines(['“How should I care for it?”','Use the merchant’s care guidance.'],132,495,17,C.ink,550,1.6);
 if(active===2)a+=R(76,467,512,82,C.paper,8)+icon('person',94,487,25,C.green)+lines(['Continue with the team.','Your question stays in the thread.'],132,495,17,C.ink,550,1.6);
 return a;
}
function journey(s,t){return chrome('A connected shopper journey / illustrative')+photo('after',73,170,437,384)+R(537,169,651,384,C.soft,10)+sublabel('Connected, step by step',566,208)+T('Product → Preview → Question',566,253,29,C.ink,600)+R(566,292,590,88,C.paper,8)+icon('photo',586,316,29,C.gold)+T('A personal way to explore',633,343,23,C.ink,550)+R(566,402,590,100,C.paper,8)+icon('chat',586,428,29,C.green)+lines(['An answer grounded in this store.','A person when needed.'],633,442,21,C.ink,550,1.5)+note('Illustrative journey. No performance or conversion claims.',80,581);}
function setup(s,t){
 let a=chrome('Merchant setup / illustrative discussion')+T('Fit the store you already operate.',82,191,30,C.ink,600)+R(81,216,592,334,C.soft,10);
 [['Catalogue','Products and relevant guidance'],['Theme','A suitable storefront placement'],['Support process','Handoff and team workflow'],['Store knowledge','Merchant-approved information']].forEach((row,i)=>a+=L(102,236+i*76,648,236+i*76)+T(row[0],105,265+i*76,19,C.ink,650)+T(row[1],294,265+i*76,17,C.muted));
 a+=photo('boutique',712,218,475,331)+T('Discuss the right configuration.',712,581,19,C.ink,550);return a;
}
function demo(s,t){return chrome('grindctrl.myshopify.com / visit the public demo')+photo('garment',74,165,434,384)+R(537,166,650,383,C.soft,9)+sublabel('Explore the demonstration',566,211)+lines(['Try the product journey.','Ask a store question.'],566,270,34,C.ink,550,1.3)+btn('grindctrl.myshopify.com',566,399,579,C.ink,'#FFF','arrow')+T('Then discuss your Shopify setup with the team.',568,498,18,C.muted)+note('Illustrative walkthrough; live storefront access was not available in this render environment.',80,583);}
function reveal(s,t){return photo(s.mode==='support'?'tablet':'look',48,106,673,494)+R(751,106,481,494,C.dark,0)+brand(787,165,'#FFF',1.1)+lines(s.mode==='support'?['Helpful AI.','Human continuity.']:s.mode==='tryon'?['A personal view','of the garment.']:['Practical AI','for fashion.'],788,311,37,'#FFF',550,1.3)+T('Built around the Shopify journey.',788,510,18,'#C7D0C5');}
function cta(s,t){return photo('look',48,106,531,494)+R(611,106,621,494,C.paper,0)+sublabel('Explore GRINDCTRL',647,160)+lines(s.mode==='people'?['Help the store respond.','Know when people','should take over.']:['See the experience.','Discuss your store.'],647,236,36,C.ink,550,1.3)+btn('grindctrl.cloud',647,451,548,C.ink,'#FFF','arrow')+T('Try-On · Store Chat · Human support',647,544,19,C.muted);}
function cold(s,t){const local=t-s.start;return R(0,0,1280,720,C.dark,0)+photo(film.id==='01'?'macro':film.id==='02'?'tablet':'garment',0,0,758,720)+R(758,0,522,720,C.dark,0)+brand(804,117,'#FFF',1.1)+sublabel('GRINDCTRL / ENGLISH FILM '+film.id,805,270)+lines(film.id==='01'?['The future of','online fashion.']:film.id==='02'?['Customer support.','Connected.']:['Let shoppers see it.','Let them ask.'],805,345,37,'#FFF',550,1.3)+G(L(805,514,1190,514,'#71654E',2)+T('grindctrl.cloud',805,558,21,'#D9C5A3'),ease((local-.7)/.8));}
function closing(s,t){const local=t-s.start,title=s.kind==='outro'?'Explore the demo. Discuss your store.':film.id==='01'?'Explore with confidence.':film.id==='02'?'Helpful AI. Human continuity.':'Let shoppers see it. Let them ask.';return R(48,106,1184,494,C.dark,0)+photo(film.id==='01'?'boutique':film.id==='02'?'tablet':'after',48,106,440,494)+brand(540,174,'#FFF',1.4)+T(title,540,332,29,'#FFF',550)+G(T('grindctrl.cloud',540,413,43,'#D9C5A3',550),ease((local-.4)/.8))+G(T('Virtual Try-On   /   Store Chat   /   Human support',540,526,18,'#CFD6CB'),ease((local-1.5)/.7));}
const drawers={editorial,fitting,product,storefront:product,questions,upload,tryon,chat,knowledge,handoff,inbox,order,pair,journey,setup,demo,reveal,cta,cold,closing,outro:closing};
function sceneAt(t){return film.scenes.find(s=>t>=s.start&&t<s.end)||film.scenes.at(-1);}
function captionSvg(t){const c=captionAt(t);if(!c)return '';const words=c.text.split(/\s+/),rows=[];let line='';for(const w of words){if((line+' '+w).trim().length>76){rows.push(line);line=w;}else line=(line+' '+w).trim();}if(line)rows.push(line);const max=Math.max(...rows.map(s=>s.length));const width=Math.min(1160,Math.max(440,max*11.2+50)),h=rows.length*29+18;return R((1280-width)/2,690-h,width,h,'#202520',7)+lines(rows,640,690-h+31,21,'#FFF',500,1.38).replaceAll('font-size="21"','text-anchor="middle" font-size="21"');}
function renderAt(t){
 now=Math.max(0,Math.min(149.999,t));const s=sceneAt(now),i=film.scenes.indexOf(s),local=now-s.start,p=reduced?1:ease(local/.42);
 let art=(drawers[s.kind]||editorial)(s,now);
 if(i&&p<1){const prev=film.scenes[i-1];art=G((drawers[prev.kind]||editorial)(prev,prev.end-.001),1-p)+G(art,p,(1-p)*7);}
 $('frame').innerHTML=R(0,0,1280,720,C.bg,0)+(s.kind==='cold'?'':header(s))+art+(s.kind==='cold'?'':T('ILLUSTRATIVE INTERFACE · DEMO DATA',48,709,10,C.muted,550,'letter-spacing="1.1"'))+captionSvg(now);
 if(!exporting){$('seek').value=now;$('clock').textContent=fmt(now)+' / 2:30';$('play').textContent=$('audio').paused?'Play':'Pause';}
 return {scene:s.id,kind:s.kind,caption:captionAt(now)?.text??'',visualOnly:s.visual_only,time:now};
}
function fmt(t){return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');}
function keyAt(t){const s=sceneAt(t),local=t-s.start,c=captionAt(t),caption=c?.start??'none';const animation=local<3.35||s.visual_only||(c&&t-c.start<2);return s.id+'|'+caption+'|'+(animation?t.toFixed(5):'hold');}
async function play(){if(!$('audio').paused){$('audio').pause();return;}if($('audio').ended)$('audio').currentTime=0;await $('audio').play();}
function tick(){if(!exporting&&!$('audio').paused)renderAt($('audio').currentTime);requestAnimationFrame(tick);}
$('play').onclick=play;$('replay').onclick=()=>{$('audio').currentTime=0;renderAt(0);$('audio').play();};$('next').onclick=()=>{$('audio').pause();$('audio').currentTime=film.scenes.find(s=>s.start>$('audio').currentTime+.1)?.start??149.5;renderAt($('audio').currentTime);};$('motion').onclick=()=>{reduced=!reduced;$('motion').textContent=reduced?'Motion off':'Motion on';renderAt(now);};$('seek').oninput=e=>{$('audio').currentTime=+e.target.value;renderAt(+e.target.value);};$('audio').onseeked=()=>renderAt($('audio').currentTime);$('audio').onended=()=>renderAt(149.99);
window.GRINDCTRL={renderAt,keyAt,setExport:on=>{exporting=on;$('audio').pause();},getState:()=>({time:now,paused:$('audio').paused,scene:sceneAt(now).id}),setReduced:on=>{reduced=on;renderAt(now);}};
document.fonts.ready.then(()=>renderAt(0));requestAnimationFrame(tick);
