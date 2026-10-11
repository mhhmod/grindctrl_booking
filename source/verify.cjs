const fs=require('fs'),path=require('path'),assert=require('assert');
let playwright;try{playwright=require('playwright');}catch{playwright=require('/workspace/grindctrl_booking/apps/web-next/node_modules/playwright');}const {chromium}=playwright;
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'grindctrl-narrated-presentation.html'),'utf8');
const story=JSON.parse(fs.readFileSync(path.join(__dirname,'story.json')));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});let report={checks:[],limitations:['No external participants tested.','No human full listen-through claimed.','Microsoft PowerPoint audiovisual playback is not available in this environment.']};
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1000}});let errors=[];p.on('pageerror',e=>errors.push(String(e)));await p.setContent(html,{waitUntil:'load'});await p.evaluate(()=>document.fonts.ready);
  await p.waitForFunction(()=>document.getElementById('audio').readyState>=1);
  report.audio=await p.evaluate(()=>({duration:document.getElementById('audio').duration,readyState:document.getElementById('audio').readyState}));
  const state=()=>p.evaluate(()=>GRINDCTRL.getState());
  const opacity=async text=>p.locator('.scene:not([hidden]) .element').evaluateAll((els,text)=>{const el=els.find(e=>e.textContent===text);return el?Number(el.style.opacity):null;},text);
  // Seek rebuilding must not depend on previous transition execution.
  for(const t of [0,24.1,24.99,36.9,40.5,41.4,43.8,49.0,51.0,52.1,61.9,84.9,97.8,109,121,131.5]){
   await p.evaluate(t=>GRINDCTRL.seek(t),t);await p.waitForFunction(t=>Math.abs(GRINDCTRL.getState().audioTime-t)<.01,t);const s=await state();assert(Math.abs(s.audioTime-s.time)<.015);assert.equal(s.scene,story.slides.find(s=>t>=s.start&&t<s.end).id);
  }
  report.checks.push('16 out-of-order seek destinations reconstruct the correct scene from audio time.');
  await p.evaluate(()=>GRINDCTRL.seek(37));assert.equal(await opacity('Authorized lookup of existing Desk records'),1);assert.equal(await opacity('Contact A'),0);
  await p.evaluate(()=>GRINDCTRL.seek(41.4));assert.equal(await opacity('Contact A'),1);assert.equal(await opacity('T101 · Exchange follow-up'),0);
  await p.evaluate(()=>GRINDCTRL.seek(43.8));assert.equal(await opacity('T101 · Exchange follow-up'),1);
  await p.evaluate(()=>GRINDCTRL.seek(49));assert.equal(await opacity('More than one customer record'),1);
  await p.evaluate(()=>GRINDCTRL.seek(52.1));assert.equal(await opacity('More than one customer record'),0);
  report.checks.push('Lookup → associated record → ticket context → shared-number choice → selected context states checked.');
  await p.evaluate(()=>GRINDCTRL.seek(39.6));await p.locator('#play').click();await sleep(1000);let playing=await state();assert(!playing.paused);assert(playing.audioTime>40.2&&playing.scene==='S3');assert(Math.abs(playing.time-playing.audioTime)<.08);
  await p.locator('#play').click();const paused=await state();await sleep(600);let still=await state();assert(still.paused&&Math.abs(paused.time-still.time)<.01&&Math.abs(paused.audioTime-still.audioTime)<.01);
  await p.locator('[data-action=language]').click();let switched=await state();assert.equal(switched.locale,'ar');assert(Math.abs(switched.audioTime-paused.audioTime)<.02);
  await p.locator('#play').click();await sleep(450);assert(!(await state()).paused);await p.locator('#play').click();
  await p.locator('[data-action=language]').click();await p.locator('[data-action=replay]').click();await sleep(300);const replay=await state();assert(replay.audioTime<1.2&&replay.scene==='S1');await p.locator('#play').click();
  await p.evaluate(()=>GRINDCTRL.seek(43.9));await p.locator('[data-action=step]').click();assert(Math.abs((await state()).audioTime-(48.104+.36))<.02);
  await p.evaluate(()=>GRINDCTRL.setReduced(true));await p.evaluate(()=>GRINDCTRL.seek(43.06));assert.equal(await opacity('T101 · Exchange follow-up'),1);
  report.checks.push('Real audio playback, pause freeze, resume, replay, language continuity, phrase stepping and reduced motion checked.');
  await p.setViewportSize({width:390,height:844});await p.evaluate(()=>GRINDCTRL.seek(61.9));const mobile=await p.evaluate(()=>({width:innerWidth,body:document.body.scrollWidth,controls:[...document.querySelectorAll('.controls button')].map(x=>x.getBoundingClientRect().height)}));assert(mobile.body<=mobile.width+1);assert(mobile.controls.every(h=>h>=42));await p.locator('[data-action=zoom]').click();assert((await p.locator('#deck').evaluate(e=>e.scrollWidth))>390);report.mobile=mobile;
  report.checks.push('390px mobile controls fit without body overflow; enlarged scene can be panned.');
  await p.close();
  // Print exposes complete, static states, not the partial playback moment.
  for(const lang of ['en','ar']){
   const q=await browser.newPage({viewport:{width:1280,height:720}});await q.setContent(html,{waitUntil:'load'});await q.evaluate(()=>document.fonts.ready);await q.evaluate(lang=>{GRINDCTRL.setLocale(lang);GRINDCTRL.preparePrint();},lang);await q.pdf({path:path.join(root,`grindctrl-narrated-${lang}.pdf`),preferCSSPageSize:true,printBackground:true});await q.close();
  }
  assert.equal(errors.length,0);report.pageErrors=errors;report.checks.push('Both static PDFs generated from complete synchronized scene states.');
 }finally{await browser.close();fs.writeFileSync(path.join(root,'player-validation.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exit(1);});
