const fs=require('fs'),path=require('path');let pw;try{pw=require('playwright');}catch{pw=require('/workspace/grindctrl_booking/apps/web-next/node_modules/playwright');}
const root=process.env.GRINDCTRL_OUTPUT||path.resolve(__dirname,'..');
const films=JSON.parse(fs.readFileSync(path.join(root,'source/films.json')));
(async()=>{const browser=await pw.chromium.launch({executablePath:process.env.GRINDCTRL_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const reports=[];try{
 for(const film of films){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent(fs.readFileSync(path.join(root,film.stem+'.html'),'utf8'),{waitUntil:'load'});await page.evaluate(async()=>{await document.fonts.ready;GRINDCTRL.setExport(true);});
  let overflows=[],checked=0;const times=[0,149.99,...film.scenes.flatMap(s=>[s.start+.02,Math.min(s.end-.02,s.start+3.1),s.end-.04]),...film.captions.map(c=>(c.start+c.end)/2)];
  for(const t of times){await page.evaluate(t=>GRINDCTRL.renderAt(t),t);checked++;const bad=await page.locator('#frame text').evaluateAll(ns=>{let root=document.getElementById('deck').getBoundingClientRect();return ns.filter(n=>{let e=n;while(e&&e!==document.getElementById('frame')){if(+getComputedStyle(e).opacity<.01)return false;e=e.parentNode;}return true;}).map(n=>({text:n.textContent,b:n.getBoundingClientRect()})).filter(x=>x.b.x<root.x-1||x.b.right>root.right+1||x.b.top<root.top-1||x.b.bottom>root.bottom+1).map(x=>x.text);});overflows.push(...bad.map(text=>({t,text})));}
  const model=await page.evaluate(()=>({audio:document.querySelectorAll('audio').length,duration:document.getElementById('audio').duration,source:document.getElementById('audio').currentSrc.slice(0,25)}));
  if(model.audio!==1||Math.abs(model.duration-150)>.03)throw Error('Incorrect preview audio');
  await page.evaluate(()=>{GRINDCTRL.setReduced(true);GRINDCTRL.renderAt(80);});await page.evaluate(()=>GRINDCTRL.setReduced(false));
  await page.setViewportSize({width:390,height:800});const mobile=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('button')].map(b=>({label:b.textContent,h:b.getBoundingClientRect().height}))}));
  if(mobile.width>391||mobile.buttons.some(b=>b.h<44))throw Error('Mobile overflow or short controls');
  let guards=[];
  if(film.id==='02'){
   for(const s of film.scenes.filter(s=>s.kind==='order')){
    const t=s.mode==='readonly'?s.start+.1:s.start+1;
    await page.evaluate(t=>GRINDCTRL.renderAt(t),t);const text=await page.locator('#frame').textContent();
    const expect=s.mode==='boundary';const found=text.includes('Preparing order');if(found!==expect)throw Error('Order identity gate failed');guards.push({scene:s.id,mode:s.mode,earlyStatusVisible:found});
   }
   const s=film.scenes.find(s=>s.kind==='inbox'&&s.mode==='tools');let cue=film.captions.find(c=>c.start>=s.start&&c.end<=s.end+.01&&c.text.toLowerCase().includes('private notes'));await page.evaluate(t=>GRINDCTRL.renderAt(t),Math.min(s.end-.1,cue.start+1));const txt=await page.locator('#frame').textContent();if(!txt.includes('Private note')&&!txt.includes('PRIVATE NOTE'))throw Error('No private note');guards.push({privateNote:true});
  }
  if(film.id==='03'){
   let s=film.scenes.find(s=>s.kind==='tryon'&&s.mode==='limits');await page.evaluate(t=>GRINDCTRL.renderAt(t),s.start+1);let txt=await page.locator('#frame').textContent();if(!txt.includes('not an exact physical fit guarantee'))throw Error('No fit boundary');guards.push({fitBoundary:true});
  }
  reports.push({film:film.id,seekStates:checked,overflows,errors,mobile,audio:model,guards});await page.close();
 }
 fs.writeFileSync(path.join(root,'QA_HTML.json'),JSON.stringify(reports,null,2));if(reports.some(r=>r.overflows.length||r.errors.length))throw Error('Layout/browser errors');console.log(JSON.stringify(reports.map(r=>({film:r.film,states:r.seekStates,overflow:r.overflows.length,guards:r.guards.length}))));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
