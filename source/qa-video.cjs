const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');let pw;try{pw=require('playwright');}catch{pw=require('/workspace/grindctrl_booking/apps/web-next/node_modules/playwright');}
const root=process.env.GRINDCTRL_OUTPUT||path.resolve(__dirname,'..');const films=JSON.parse(fs.readFileSync(path.join(root,'source/films.json')));
(async()=>{const browser=await pw.chromium.launch({executablePath:process.env.GRINDCTRL_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});let reports=[];try{
 for(const film of films){if(!fs.existsSync(path.join(root,'review',film.id+'-render.json')))continue;
  const dir=path.join(root,'encoded-review',film.id);fs.mkdirSync(dir,{recursive:true});
  const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.setContent(fs.readFileSync(path.join(root,film.stem+'.html'),'utf8'),{waitUntil:'load'});await page.evaluate(async()=>{await document.fonts.ready;GRINDCTRL.setExport(true)});await page.addStyleTag({content:'html,body,main{margin:0!important;padding:0!important;width:1920px!important;height:1080px!important;overflow:hidden!important;max-width:none!important}h1,nav,p,audio{display:none!important}#deck{width:1920px!important;height:1080px!important;box-shadow:none!important}'});
  let frames=[];
  for(const s of film.scenes){
   const frame=Math.min(4499,Math.round(Math.min(s.end-.1,s.start+Math.min(3.2,(s.end-s.start)*.75))*30)),time=frame/30;
   const actual=path.join(dir,s.id+'-encoded.jpg'),reference=path.join(dir,s.id+'-reference.png');
   if(!fs.existsSync(actual)||!fs.existsSync(reference)){
    const proc=spawnSync('ffmpeg',['-v','error','-threads','1','-y','-ss',String(time),'-i',path.join(root,film.stem+'.mp4'),'-frames:v','1','-q:v','2',actual]);if(proc.status!==0)throw Error(proc.stderr.toString());
    await page.evaluate(t=>GRINDCTRL.renderAt(t),time);await page.screenshot({path:reference});
   }
   frames.push({scene:s.id,frame,time,actual:path.relative(root,actual),reference:path.relative(root,reference)});
  }
  await page.close();
  const playback=await browser.newPage();const bytes=fs.readFileSync(path.join(root,film.stem+'.mp4')).toString('base64');await playback.setContent('<video controls width="960" src="data:video/mp4;base64,'+bytes+'"></video>');await playback.waitForFunction(()=>document.querySelector('video')?.readyState>=2);let samples=[];
  for(const t of [0,74.5,142]){
   await playback.evaluate(async t=>{const v=document.querySelector('video');v.muted=false;await new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=t;setTimeout(resolve,1500)});await v.play();},t);await playback.waitForTimeout(t===142?8300:400);
   if(t===142)await playback.waitForFunction(()=>document.querySelector('video').ended,{timeout:15000});
   samples.push(await playback.evaluate(()=>{const v=document.querySelector('video'),q=v.getVideoPlaybackQuality();return {time:v.currentTime,duration:v.duration,ended:v.ended,error:v.error?.message??null,decodedFrames:q.totalVideoFrames,dropped:q.droppedVideoFrames,muted:v.muted};}));
  }
  if(!samples.at(-1).ended||samples.some(x=>x.error||x.muted))throw Error('Actual MP4 software playback failed');await playback.close();reports.push({film:film.id,frames,samples});console.log(film.id,'encoded stage frames',frames.length,'ending playback passed');
 }
 fs.writeFileSync(path.join(root,'QA_VIDEO.json'),JSON.stringify(reports,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
