const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');let pw;try{pw=require('playwright');}catch{pw=require('/workspace/grindctrl_booking/apps/web-next/node_modules/playwright');}
const root=process.env.GRINDCTRL_OUTPUT||path.resolve(__dirname,'..'),films=JSON.parse(fs.readFileSync(path.join(root,'source/films.json'))),selected=process.argv.find(x=>/^0[123]$/.test(x));
(async()=>{const browser=await pw.chromium.launch({executablePath:process.env.GRINDCTRL_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});try{
for(const f of films.filter(f=>(!selected||f.id===selected)&&fs.existsSync(path.join(root,'review',f.id+'-render.json')))){
 const p=await browser.newPage({viewport:{width:1920,height:1080}});await p.setContent(fs.readFileSync(path.join(root,f.stem+'.html'),'utf8'),{waitUntil:'load'});await p.evaluate(async()=>{await document.fonts.ready;GRINDCTRL.setExport(true)});await p.addStyleTag({content:'html,body,main{margin:0!important;padding:0!important;width:1920px!important;height:1080px!important;overflow:hidden!important;max-width:none!important}h1,nav,p,audio{display:none!important}#deck{width:1920px!important;height:1080px!important;box-shadow:none!important}'});
 const dir=path.join(root,'encoded-review',f.id);fs.mkdirSync(dir,{recursive:true});let frames=[];
 const points=[...f.scenes.map(s=>({id:s.id,time:Math.min(s.end-.12,s.start+Math.min(2.2,(s.end-s.start)*.75))})),...f.captions.map((c,i)=>({id:f.id+'-CUE-'+String(i+1).padStart(2,'0'),time:Math.min(c.end-.05,c.start+Math.min(2,(c.end-c.start)*.75))}))];
 for(const point of points){const frame=Math.min(4499,Math.round(point.time*30)),time=frame/30,actual=path.join(dir,point.id+'-encoded.jpg'),reference=path.join(dir,point.id+'-reference.png');
  if(!fs.existsSync(actual)||!fs.existsSync(reference)){const r=spawnSync('ffmpeg',['-v','error','-threads','1','-y','-ss',String(time),'-i',path.join(root,f.stem+'.mp4'),'-frames:v','1','-q:v','2',actual]);if(r.status!==0)throw Error(r.stderr.toString());await p.evaluate(t=>GRINDCTRL.renderAt(t),time);await p.screenshot({path:reference});}
  frames.push({id:point.id,frame,time,actual:path.relative(root,actual),reference:path.relative(root,reference)});
 }
 fs.writeFileSync(path.join(root,'review',f.id+'-frame-review.json'),JSON.stringify({film:f.id,frames},null,2));console.log('ENCODED FRAMES',f.id,frames.length);await p.close();
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
