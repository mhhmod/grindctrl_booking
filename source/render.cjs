const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
let pw;try{pw=require('playwright');}catch{pw=require('/workspace/grindctrl_booking/apps/web-next/node_modules/playwright');}
const root=process.env.GRINDCTRL_OUTPUT||path.resolve(__dirname,'..');
const films=JSON.parse(fs.readFileSync(path.join(root,'source/films.json')));
async function open(browser,film){
 const p=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await p.setContent(fs.readFileSync(path.join(root,film.stem+'.html'),'utf8'),{waitUntil:'load'});
 await p.evaluate(async()=>{await document.fonts.ready;GRINDCTRL.setExport(true);});
 await p.addStyleTag({content:'html,body,main{margin:0!important;padding:0!important;width:1920px!important;height:1080px!important;overflow:hidden!important;max-width:none!important}h1,nav,p,audio{display:none!important}#deck{width:1920px!important;height:1080px!important;box-shadow:none!important}'});
 return p;
}
async function preview(browser,film){
 const p=await open(browser,film),review=path.join(root,'review',film.id);fs.mkdirSync(review,{recursive:true});let bounds=[],states=[];
 for(const s of film.scenes){
  const time=Math.min(s.end-.12,s.start+Math.min(3.2,(s.end-s.start)*.75));
  states.push(await p.evaluate(t=>GRINDCTRL.renderAt(t),time));
  await p.screenshot({path:path.join(review,s.id+'.jpg'),type:'jpeg',quality:91});
  const bad=await p.locator('#frame text').evaluateAll(nodes=>{const root=document.getElementById('deck').getBoundingClientRect();return nodes.filter(n=>Number(getComputedStyle(n).opacity)>.01).map(n=>({text:n.textContent,b:n.getBoundingClientRect()})).map(o=>({text:o.text,x:(o.b.x-root.x)/1.5,y:(o.b.y-root.y)/1.5,w:o.b.width/1.5,h:o.b.height/1.5})).filter(o=>o.x<-.5||o.x+o.w>1280.5||o.y<-.5||o.y+o.h>720.5);});
  bounds.push(...bad.map(x=>({scene:s.id,...x})));
 }
 fs.writeFileSync(path.join(root,'review',film.id+'-layout.json'),JSON.stringify({states,overflow:bounds},null,2));
 console.log(film.id,'previews',states.length,'overflow',bounds.length);await p.close();
}
async function render(browser,film){
 const p=await open(browser,film),out=path.join(root,film.stem+'.mp4');
 const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','30','-vcodec','mjpeg','-i','pipe:0','-i',path.join(root,film.stem+'.m4a'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','18','-threads','2','-pix_fmt','yuv420p','-c:a','copy','-frames:v','4500','-t','150','-movflags','+faststart',out],{stdio:['pipe','inherit','inherit']});
 const completed=new Promise((resolve,reject)=>{ff.on('close',c=>c===0?resolve():reject(Error('FFmpeg '+c)));ff.on('error',reject);});
 let key='',buffer,captures=0;
 for(let frame=0;frame<4500;frame++){
  const time=frame/30,k=await p.evaluate(t=>GRINDCTRL.keyAt(t),time);
  if(k!==key){await p.evaluate(t=>GRINDCTRL.renderAt(t),time);buffer=await p.screenshot({type:'jpeg',quality:96});key=k;captures++;}
  if(!ff.stdin.write(buffer))await new Promise(resolve=>ff.stdin.once('drain',resolve));
  if(frame%450===0)console.log(film.id,frame+'/4500',captures,'states',new Date().toISOString());
 }
 ff.stdin.end();await completed;await p.close();
 fs.writeFileSync(path.join(root,'review',film.id+'-render.json'),JSON.stringify({frames:4500,fps:30,width:1920,height:1080,sourceStates:captures,complete:true}));console.log('COMPLETE',film.id,out);
}
(async()=>{const browser=await pw.chromium.launch({executablePath:process.env.GRINDCTRL_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});try{let selected=process.argv.find(x=>/^0[123]$/.test(x));for(const film of films.filter(f=>!selected||f.id===selected)){if(process.argv.includes('--video'))await render(browser,film);else await preview(browser,film);}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
