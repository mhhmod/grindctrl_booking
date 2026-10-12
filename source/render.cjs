const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
let playwright;try{playwright=require('playwright');}catch{playwright=require('/workspace/grindctrl_booking/apps/web-next/node_modules/playwright');}const {chromium}=playwright;
const root=path.resolve(__dirname,'..'),story=JSON.parse(fs.readFileSync(path.join(__dirname,'story.json')));
const fps=30,duration=story.timeline.duration;
async function open(browser,locale,exporting=true){
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await page.setContent(fs.readFileSync(path.join(root,'GRINDCTRL_Concrete_Part03_Customer360.html'),'utf8'),{waitUntil:'load'});
 await page.evaluate(async()=>{await document.fonts.ready;});
 await page.evaluate(({locale,exporting})=>{GRINDCTRL.setExportMode(exporting);GRINDCTRL.setLocale(locale);}, {locale,exporting});
 if(exporting)await page.addStyleTag({content:'html,body{width:1920px!important;height:1080px!important;overflow:hidden!important}header,.controls,#chapters,.caption-row,#caption{display:none!important}main{width:1920px!important;max-width:none!important;padding:0!important;margin:0!important}#deck{width:1920px!important;height:1080px!important;border:0!important;border-radius:0!important;overflow:hidden!important}.scene,.canvas{width:1920px!important;height:1080px!important}'});
 return page;
}
async function previews(browser){
 const review=path.join(root,'review');fs.mkdirSync(review,{recursive:true});let overflow=[];
 for(const lang of ['en','ar']){
  const p=await open(browser,lang),times=story.slides.map((s,i)=>s.static_time);
  for(let i=0;i<times.length;i++){
   await p.evaluate(t=>GRINDCTRL.renderAt(t),times[i]);
   await p.screenshot({path:path.join(review,`scene-${i+1}-${lang}.png`)});
   const bad=await p.locator('.scene:not([hidden]) .text').evaluateAll(nodes=>nodes.filter(n=>Number(getComputedStyle(n.closest('.element')).opacity)>.9&&(n.scrollHeight>n.clientHeight+2||n.scrollWidth>n.clientWidth+2)).map(n=>({text:n.textContent,width:n.clientWidth,height:n.clientHeight,scrollWidth:n.scrollWidth,scrollHeight:n.scrollHeight})));
   overflow.push(...bad.map(b=>({lang,scene:i+1,...b})));
  }
  for(const t of [30.5,36.5,47.0,61.8,65.8,73.8,97.4,105.3,115.9,138.5,142.5,157.9,166.5,169.9,172.4,175.0,179.0,181.0,189.8,193.9,202.5,210.5,215.8,218.5,229.5,238.0,251.8,269.0,285.7]){await p.evaluate(t=>GRINDCTRL.renderAt(t),t);await p.screenshot({path:path.join(review,`event-${String(t).replace('.','-')}-${lang}.png`)});}
  await p.close();
 }
 fs.writeFileSync(path.join(root,'layout-check.json'),JSON.stringify({textOverflow:overflow},null,2));console.log('Previews rendered; text overflow count:',overflow.length);
}
function stampKey(t){
 const s=story.slides.find(s=>t>=s.start&&t<s.end)||story.slides.at(-1);
 const unique=[...new Set(s.elements.map(e=>e.at).filter(v=>v>s.start+.001))];
 if((s.cameras??[]).some(c=>t>=c.start&&t<=c.end)||s.elements.some(e=>e.typing&&t>=e.typing.start&&t<=e.typing.end)||unique.some(v=>t>=v&&t<v+.35))return `anim:${t}`;
 const boundaries=[s.start,...unique,...s.elements.map(e=>e.until).filter(v=>v!==null),...(s.cameras??[]).map(c=>c.end),...s.elements.filter(e=>e.typing).map(e=>e.typing.end)];
 return s.id+':'+Math.max(...boundaries.filter(v=>v<=t));
}
async function video(browser,lang){
 const p=await open(browser,lang),out=path.join(root,`${lang==='en'?'GRINDCTRL_Concrete_Part03_Customer360.mp4':'GRINDCTRL_Concrete_Part03_Customer360_AR.mp4'}`);
 const audioFile=fs.existsSync(path.join(root,'grindctrl-part03-voiceover-ar.mp3'))?path.join(root,'grindctrl-part03-voiceover-ar.mp3'):path.join(root,'input/audio/grindctrl-part03-voiceover-ar.mp3');
 const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0','-i',audioFile,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','19','-threads','3','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','44100','-ac','1','-t',String(duration),'-movflags','+faststart',out],{stdio:['pipe','inherit','inherit']});
 let prev='',buffer=null,captures=0;
 const complete=new Promise((resolve,reject)=>{ff.on('close',code=>code===0?resolve():reject(new Error('ffmpeg '+code)));ff.on('error',reject);});
 const count=Math.ceil(duration*fps);
 for(let frame=0;frame<count;frame++){
  const t=frame/fps,key=stampKey(t);
  if(key!==prev){await p.evaluate(t=>GRINDCTRL.renderAt(t),t);buffer=await p.screenshot();prev=key;captures++;}
  if(!ff.stdin.write(buffer))await new Promise(resolve=>ff.stdin.once('drain',resolve));
  if(frame%900===0)console.log(`${lang} ${frame}/${count} frames, ${captures} rendered states`);
 }
 ff.stdin.end();await complete;await p.close();console.log(`${lang}: ${count} frames, ${captures} unique animation states, full master audio.`);
}
(async()=>{const browser=await chromium.launch({executablePath:process.env.GRINDCTRL_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{if(process.argv.includes('--video'))for(const lang of (process.argv.includes('--arabic-only')?['ar']:['en','ar']))await video(browser,lang);else await previews(browser);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
