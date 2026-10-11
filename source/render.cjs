const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
let playwright;try{playwright=require('playwright');}catch{playwright=require('/workspace/grindctrl_booking/apps/web-next/node_modules/playwright');}const {chromium}=playwright;
const root=path.resolve(__dirname,'..'),story=JSON.parse(fs.readFileSync(path.join(__dirname,'story.json')));
const fps=30,duration=story.timeline.duration;
async function open(browser,locale,exporting=true){
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await page.setContent(fs.readFileSync(path.join(root,'grindctrl-concrete-part02-animated.html'),'utf8'),{waitUntil:'load'});
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
  for(const t of [30.4,36.2,43.4,53.7,56.4,60.0,78.2,81.9,86.1,103.7,109.3,111.6,114.7,121.3,125.8,130.0,132.5,139.9,153.4,157.3,164.0,173.8,178.2,183.1,193.4]){await p.evaluate(t=>GRINDCTRL.renderAt(t),t);await p.screenshot({path:path.join(review,`event-${String(t).replace('.','-')}-${lang}.png`)});}
  await p.close();
 }
 fs.writeFileSync(path.join(root,'layout-check.json'),JSON.stringify({textOverflow:overflow},null,2));console.log('Previews rendered; text overflow count:',overflow.length);
}
function stampKey(t){
 const s=story.slides.find(s=>t>=s.start&&t<s.end)||story.slides.at(-1);
 const unique=[...new Set(s.elements.map(e=>e.at).filter(v=>v>s.start+.001))];
 if((s.cameras??[]).some(c=>t>=c.start&&t<=c.end)||unique.some(v=>t>=v&&t<v+.35))return `anim:${t}`;
 const boundaries=[s.start,...unique,...s.elements.map(e=>e.until).filter(v=>v!==null),...(s.cameras??[]).map(c=>c.end)];
 return s.id+':'+Math.max(...boundaries.filter(v=>v<=t));
}
async function video(browser,lang){
 const p=await open(browser,lang),out=path.join(root,`${lang==='en'?'grindctrl-concrete-part02-narrated.mp4':'grindctrl-concrete-part02-narrated-ar.mp4'}`);
 const audioFile=fs.existsSync(path.join(root,'grindctrl-part02-voiceover-ar.mp3'))?path.join(root,'grindctrl-part02-voiceover-ar.mp3'):path.join(root,'input/audio/grindctrl-part02-voiceover-ar.mp3');
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
