const fs=require('fs'),path=require('path');let pw;try{pw=require('playwright');}catch{pw=require('/workspace/grindctrl_booking/apps/web-next/node_modules/playwright');}
const root=process.env.GRINDCTRL_OUTPUT||path.resolve(__dirname,'..');const films=JSON.parse(fs.readFileSync(path.join(root,'source/films.json')));
(async()=>{const browser=await pw.chromium.launch({executablePath:process.env.GRINDCTRL_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});let reports=[];try{
 for(const film of films){
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setContent(fs.readFileSync(path.join(root,film.stem+'.html'),'utf8'),{waitUntil:'load'});await p.evaluate(async()=>{await document.fonts.ready;GRINDCTRL.setExport(true)});
  let overflow=[],states=0,guards=[];
  const times=[0,1,149.99,...film.scenes.flatMap(s=>[s.start+.02,Math.min(s.end-.02,s.start+2.4),s.end-.03]),...film.captions.flatMap(c=>[c.start+.03,(c.start+c.end)/2,c.end-.04])];
  for(const t of times){await p.evaluate(t=>GRINDCTRL.renderAt(t),t);states++;let bad=await p.locator('#frame text').evaluateAll(ns=>{const box=document.getElementById('deck').getBoundingClientRect();return ns.filter(n=>{let a=n;while(a&&a.id!=='frame'){if(+getComputedStyle(a).opacity<.01)return false;a=a.parentNode;}return true;}).map(n=>({text:n.textContent,r:n.getBoundingClientRect()})).filter(x=>x.r.left<box.left-.5||x.r.right>box.right+.5||x.r.top<box.top-.5||x.r.bottom>box.bottom+.5).map(x=>x.text);});overflow.push(...bad.map(text=>({t,text})));}
  const at=term=>film.captions.find(c=>c.text.toLowerCase().includes(term.toLowerCase()))?.start;
  async function text(t){await p.evaluate(t=>GRINDCTRL.renderAt(t),t);return await p.locator('#frame text').allTextContents();}
  if(film.id==='01'){
   let a=(await text(at('caller number starts')+.7)).join(' ');if(a.includes('Ahmed M.')||a.includes('Awaiting branch'))throw Error('History before permitted match');guards.push({historyNotShownDuringLookup:true});
   a=(await text(at('latest recorded update')+.8)).join(' ');if(!a.includes('Awaiting branch review.')||!a.includes('PROPOSED / DEMO'))throw Error('Wrong pending ticket state');guards.push({pendingReview:true});
   a=(await text(at('several contacts')+.8)).join(' ');if(!a.includes('More than one contact')||a.includes('Awaiting branch'))throw Error('Ambiguous history leak');guards.push({ambiguousHistoryHidden:true});
   a=(await text(at('lookup service fails')+.8)).join(' ');if(!a.includes('Voice call active')||!a.includes('Lookup temporarily'))throw Error('Lookup blocked call');guards.push({lookupFailureCallContinues:true});
  }
  if(film.id==='02'){
   let a=(await text(at('number initiates')+.4)).join(' ');if(a.includes('Ahmed M.'))throw Error('Identity disclosure during lookup');guards.push({lookupHidesContact:true});
   const owner=async t=>{await p.evaluate(t=>GRINDCTRL.renderAt(t),t);return p.locator('[data-note-call]').evaluate(n=>({call:n.dataset.noteCall,author:n.dataset.noteAuthor,text:[...n.querySelectorAll('text')].map(t=>t.textContent).join(' ')}));};
   let q=await owner(at('reads its actual note')+.6);if(q.call!=='CALL-101'||q.author!=='Maya'||!q.text.includes('Branch review pending.'))throw Error('Historical note lost ownership');guards.push(q);
   q=await owner(at('Notes should belong')+.5);if(q.call!=='CALL-102'||q.author!=='Salma'||!q.text.includes('confirmed branch update.'))throw Error('Current note wrong call');guards.push(q);
   q=await owner(at('outcome')+1);a=(await text(at('outcome')+1)).join(' ');if(q.call!=='CALL-102'||q.author!=='Salma'||!a.includes('CALL-103'))throw Error('Future interaction reassigned note');guards.push(q);
   a=(await text(at('Missing membership data')+1)).join(' ');if(!a.includes('Unavailable')||a.includes('Elite · Demo record'))throw Error('Membership invented');guards.push({missingTierUnavailable:true});
   a=(await text(at('Lookup temporarily down')+.6)).join(' ');if(!a.includes('Voice call active'))throw Error('Call blocked by outage');guards.push({callUnaffected:true});
  }
  if(film.id==='03'){
   let a=(await text(at('fit guarantee')+.5)).join(' ');if(!a.includes('not a measurement or exact-fit guarantee'))throw Error('Fit boundary absent');guards.push({fitLimitVisible:true});
   a=(await text(at('appropriately configured')+.5)).join(' ');if(a.includes('Preparing order'))throw Error('Order status before condition');guards.push({orderCondition:true});
   a=(await text(at('private note')+.8)).join(' ');if(!a.includes('PRIVATE NOTE / LINA'))throw Error('No human private note');guards.push({humanPrivateNote:true});
  }
  let audio=await p.evaluate(()=>({count:document.querySelectorAll('audio').length,duration:document.getElementById('audio').duration}));if(audio.count!==1||Math.abs(audio.duration-150)>.01)throw Error('Wrong preview clock');
  await p.evaluate(()=>{GRINDCTRL.setReduced(true);GRINDCTRL.renderAt(80);GRINDCTRL.setReduced(false)});
  await p.setViewportSize({width:390,height:850});const mobile=await p.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,buttonHeights:[...document.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height)}));if(mobile.width>391||mobile.buttonHeights.some(h=>h<44))throw Error('Mobile accessibility failed');
  reports.push({film:film.id,seekStates:states,overflow,errors,audio,mobile,guards});await p.close();
 }
 fs.writeFileSync(path.join(root,'QA_HTML.json'),JSON.stringify(reports,null,2));if(reports.some(r=>r.overflow.length||r.errors.length))throw Error('Browser/layout issue');console.log(JSON.stringify(reports.map(r=>({film:r.film,states:r.seekStates,overflow:r.overflow.length,guards:r.guards.length}))));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
