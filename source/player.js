/* The audio element is the only playback clock. Rendering is a pure function of its time. */
let locale='en',current=-1,renderTime=0,captions=false,exportMode=false;
const audio=document.getElementById('audio'),duration=story.timeline.duration;
const reducedQuery=matchMedia('(prefers-reduced-motion:reduce)');let reduced=reducedQuery.matches;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tr=v=>typeof v==='string'?v:v[locale];
const cues=[...story.timeline.cues,...story.timeline.subphrase_cues].sort((a,b)=>a.start-b.start);
const words={play:['Play narration','تشغيل التعليق'],pause:['Pause','إيقاف مؤقت'],replay:['Replay','إعادة'],step:['Next phrase','الجملة التالية'],notes:['Notes','ملاحظات'],print:['PDF','PDF'],zoom:['Enlarge scene','تكبير المشهد'],captions:['Arabic captions','التعليق بالعربية'],sandbox:['Try call cases','جرّب حالات المكالمات'],mute:['Mute','كتم الصوت'],unmute:['Unmute','تشغيل الصوت'],close:['Close','إغلاق']};
const word=k=>words[k][locale==='ar'?1:0];
let UI_FIDELITY={enabled:false,slots:{}};
function mirroredX(e){return locale==='ar'?1280-e.x-e.w:e.x;}
function shape(e,i){
 if(e.type==='line'){const x=locale==='ar'?1280-e.x:e.x,x2=locale==='ar'?1280-e.x2:e.x2;return `<line x1="${x}" y1="${e.y}" x2="${x2}" y2="${e.y2}" data-x1="${x}" data-x2="${x2}" data-y1="${e.y}" data-y2="${e.y2}" stroke="${e.color}" stroke-width="${e.width}" stroke-linecap="round" ${e.arrow?'marker-end="url(#arrow-'+i+')"':''}/>`;}
 const x=mirroredX(e);
 if(e.type==='outline')return `<rect x="${x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${e.radius}" fill="none" stroke="${e.color}" stroke-width="${e.width}"/>`;
 if(e.type==='rect')return `<rect x="${x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${e.radius}" fill="${e.fill}" stroke="${e.line}"/>`;
 if(e.type==='ellipse')return `<ellipse cx="${x+e.w/2}" cy="${e.y+e.h/2}" rx="${e.w/2}" ry="${e.h/2}" fill="${e.fill}" stroke="${e.line}"/>`;
 if(e.type==='crop'){const c=e.crop;return `<svg x="${x}" y="${e.y}" width="${e.w}" height="${e.h}" viewBox="${c.x} ${c.y} ${c.w} ${c.h}" overflow="hidden" preserveAspectRatio="none"><image width="${e.source_w}" height="${e.source_h}" href="${assets[e.key]}"/></svg>`;}
 if(e.type==='image')return `<image x="${x}" y="${e.y}" width="${e.w}" height="${e.h}" href="${assets[e.key]}"/>`;
 const align=e.align==='center'?'center':e.align==='end'?(locale==='ar'?'left':'right'):(locale==='ar'?'right':'left');
 return `<foreignObject x="${x}" y="${e.y}" width="${e.w}" height="${e.h}"><div xmlns="http://www.w3.org/1999/xhtml" class="text" data-role="${e.role}" dir="${e.ltr?'ltr':locale==='ar'?'rtl':'ltr'}" style="font-size:${e.size}px;color:${e.color};font-weight:${e.bold?700:450};text-align:${align}">${esc(tr(e.text))}</div></foreignObject>`;
}
function sceneElements(s,i){
 const frame=e=>e.role==='framing'||e.role==='heading'||(e.type==='image'&&e.y===27)||(e.type==='line'&&e.y===670);
 const g=(e,j)=>`<g class="element ${e.type==='line'?'wire':''}" data-index="${j}" data-at="${e.at}" data-until="${e.until??''}" data-slot="${e.slot??''}" data-note-call="${e.note_interaction_id??''}">${shape(e,i)}</g>`;
 return s.elements.map((e,j)=>frame(e)?g(e,j):'').join('')+`<defs><clipPath id="camera-clip-${i}"><rect x="42" y="163" width="1196" height="491" rx="8"/></clipPath></defs><g clip-path="url(#camera-clip-${i})"><g class="camera">`+s.elements.map((e,j)=>!frame(e)?g(e,j):'').join('')+'</g></g>';
}
function setCamera(article,s,time,staticMode=false){
 let scale=1,x=640,y=407;
 if(!staticMode&&!reduced){for(const c of s.cameras??[]){if(time<c.start)break;let p=ease(Math.max(0,Math.min(1,(time-c.start)/(c.end-c.start))));scale=c.scale0+(c.scale1-c.scale0)*p;x=locale==='ar'?1280-c.x:c.x;y=c.y;}}
 article.querySelector('.camera')?.setAttribute('transform',`translate(${x*(1-scale)} ${y*(1-scale)}) scale(${scale})`);
}
function build(){
 document.documentElement.lang=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';document.getElementById('brand').src=assets.brand;
 document.querySelector('[data-action=language]').textContent=locale==='en'?'العربية':'English';
 for(const k of Object.keys(words)){const el=document.querySelector('[data-action='+k+']');if(el)el.textContent=word(k);}
 document.getElementById('deck').innerHTML=story.slides.map((s,i)=>`<article class="scene" hidden data-scene="${s.id}"><svg class="canvas" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(tr(s.title))}"><defs><marker id="arrow-${i}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="m0 0 10 5-10 5z" fill="${story.colors.accent}"/></marker></defs><rect width="1280" height="720" fill="${story.colors.bg}"/>${sceneElements(s,i)}</svg></article>`).join('');
 document.getElementById('chapters').innerHTML=story.slides.map((s,i)=>`<button data-action="chapter" data-index="${i}"><bdi>${String(i+1).padStart(2,'0')}</bdi> ${esc(tr(s.section))}</button>`).join('');
 current=-1;renderAt(renderTime);applyFidelity(UI_FIDELITY);
}
const ease=p=>1-Math.pow(1-p,3);
function sceneAt(time){let i=story.slides.findIndex(s=>time>=s.start&&time<s.end);return i<0?story.slides.length-1:i;}
function setElements(article,s,time,staticMode=false){
 article.querySelectorAll('.element').forEach(el=>{
  const e=s.elements[Number(el.dataset.index)];
  let visible=time>=e.at&&(e.until===null||time<e.until),p=visible?1:0;
  if(e.typing){const full=tr(e.text),progress=(staticMode||reduced)?1:Math.max(0,Math.min(1,(time-e.typing.start)/(e.typing.end-e.typing.start)));const text=el.querySelector('.text');text.textContent=full.slice(0,Math.floor(full.length*progress))+((progress<1&&time>=e.typing.start)?'▏':'');}

  if(visible&&!staticMode&&!reduced&&e.at>s.start+.001)p=ease(Math.max(0,Math.min(1,(time-e.at)/.35)));
  el.style.opacity=String(p);el.setAttribute('aria-hidden',p===0?'true':'false');
  if(el.classList.contains('wire')){const l=el.querySelector('line');if(l){const a=Number(l.dataset.x1),b=Number(l.dataset.x2),c=Number(l.dataset.y1),d=Number(l.dataset.y2);l.setAttribute('x2',a+(b-a)*p);l.setAttribute('y2',c+(d-c)*p);}}
 });
}
function renderAt(time){
 renderTime=Math.max(0,Math.min(duration,time));const index=sceneAt(renderTime),articles=[...document.querySelectorAll('.scene')];
 const transition=index>0&&!reduced&&renderTime-story.slides[index].start<.35;
 articles.forEach((a,i)=>{a.hidden=!(i===index||(transition&&i===index-1));a.style.position=(transition&&i===index-1)?'absolute':'';a.style.inset=(transition&&i===index-1)?'0':'';a.style.opacity=(i===index&&transition)?String(ease((renderTime-story.slides[index].start)/.35)):'1';});
 if(index!==current){current=index;document.querySelectorAll('#chapters button').forEach((b,i)=>b.setAttribute('aria-current',i===current?'true':'false'));if(!exportMode)document.getElementById('announce').textContent=tr(story.slides[current].title);}
 if(transition){const prev=story.slides[index-1];setElements(articles[index-1],prev,prev.end-.001,true);setCamera(articles[index-1],prev,prev.end-.001,true);}
 setElements(articles[current],story.slides[current],renderTime);setCamera(articles[current],story.slides[current],renderTime);
 updateFidelity(articles[current],renderTime);
 if(!exportMode){document.getElementById('seek').value=renderTime;document.getElementById('time').textContent=fmt(renderTime)+' / '+fmt(duration);const cue=story.timeline.cues.find(c=>renderTime>=c.start&&renderTime<c.end);document.getElementById('caption').textContent=cue?.spoken_phrase??'';document.getElementById('play').textContent=word(audio.paused?'play':'pause');}
 return {scene:story.slides[current].id,time:renderTime,visible:story.slides[current].elements.filter(e=>renderTime>=e.at&&(e.until===null||renderTime<e.until)).length};
}
function fmt(t){return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');}
function seek(time){audio.currentTime=Math.max(0,Math.min(duration-.01,time));renderAt(audio.currentTime);}
async function play(){if(!audio.paused){audio.pause();return;}if(audio.ended||audio.currentTime>duration-.1)seek(0);try{await audio.play();}catch(e){document.getElementById('announce').textContent='Use Play to start the narration.';}}
function tick(){if(!audio.paused&&!exportMode)renderAt(audio.currentTime);requestAnimationFrame(tick);}
function setLocale(lang){locale=lang;build();renderAt(exportMode?renderTime:audio.currentTime);}
function nextPhrase(){audio.pause();const next=cues.find(c=>c.start>audio.currentTime+.06);seek(next?next.start+.36:duration-.01);}
function notes(){audio.pause();const s=story.slides[current];document.getElementById('note-content').innerHTML=`<h2>${esc(tr(s.title))}</h2>${s.notes.map(n=>`<p>${esc(tr(n))}</p>`).join('')}<p>One uninterrupted supplied master MP3. Visual cues use measured speech/pause boundaries, assisted by recognition and the supplied script. This is not a human pronunciation audit or certified word-level alignment.</p><p>All customer/product/store data and interfaces are illustrative proposed experiences. Source systems, membership, catalog, inventory, native AI licensing and permissions require validation. No live integration, service commitment, campaign publication or measured outcome is claimed.</p>`;document.getElementById('notes').showModal();}

function printState(){
 audio.pause();document.querySelectorAll('.print-appendix').forEach(e=>e.remove());
 const articles=[...document.querySelectorAll('.scene')];
 articles.forEach((a,i)=>{a.hidden=false;a.style.position='';a.style.inset='';a.style.opacity='1';const s=story.slides[i];setElements(a,s,s.static_time,true);setCamera(a,s,s.static_time,true);});
 for(const ap of story.print_appendices){
  const i=ap.index,t=ap.time,clone=articles[i].cloneNode(true);clone.classList.add('print-appendix');clone.hidden=false;setElements(clone,story.slides[i],t,true);setCamera(clone,story.slides[i],t,true);clone.querySelector('[data-role=heading]').textContent=tr(ap.title);clone.querySelectorAll('.text').forEach(e=>{if(e.textContent.match(/0[1-9] \/ 09/))e.textContent=locale==='en'?'Appendix':'ملحق';});document.getElementById('deck').appendChild(clone);
 }
}
window.addEventListener('beforeprint',printState);window.addEventListener('afterprint',()=>{document.querySelectorAll('.print-appendix').forEach(e=>e.remove());current=-1;renderAt(audio.currentTime);});
/* Future fidelity pass: only approved, anonymized native captures replace explicit regions.
 * Anchors must be remeasured for each actual screen. The empty manifest is intentional. */
function applyFidelity(config){
 UI_FIDELITY=config;
 document.querySelectorAll('.fidelity-image').forEach(e=>e.remove());
 document.querySelectorAll('.element[data-slot]').forEach(e=>e.style.display='');
 if(!config.enabled)return;
 for(const [key,asset] of Object.entries(config.slots??{})){
  if(asset.approved!==true||asset.anonymized!==true||!asset.states?.length)continue;
  story.slides.forEach((s,i)=>{const box=s.slots[key],states=asset.states.filter(state=>!state.scene_id||state.scene_id===s.id);if(!box||!states.length)return;const article=document.querySelectorAll('.scene')[i],svg=article.querySelector('svg'),slotElements=[...article.querySelectorAll('.element')].filter(el=>el.dataset.slot===key);slotElements.forEach(el=>el.style.display='none');const image=document.createElementNS('http://www.w3.org/2000/svg','image');image.setAttribute('class','fidelity-image');image.setAttribute('x',locale==='ar'?1280-box.x-box.w:box.x);image.setAttribute('y',box.y);image.setAttribute('width',box.w);image.setAttribute('height',box.h);image.setAttribute('preserveAspectRatio','xMidYMid meet');image.dataset.states=JSON.stringify(states.map(state=>({at:state.at_cue?cues.find(c=>c.id===state.at_cue)?.start??s.start:state.at??s.start,data_url:state.data_url})));(slotElements[0]?.parentNode??svg.querySelector('.camera')??svg).insertBefore(image,slotElements[0]??null);});
 }
 updateFidelity(document.querySelectorAll('.scene')[current],renderTime);
}
function updateFidelity(article,time){article?.querySelectorAll('.fidelity-image').forEach(image=>{const states=JSON.parse(image.dataset.states).filter(s=>s.at<=time&&s.data_url).sort((a,b)=>a.at-b.at),state=states.at(-1);image.style.display=state?'':'none';if(state&&image.getAttribute('href')!==state.data_url)image.setAttribute('href',state.data_url);});}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;switch(b.dataset.action){case'play':play();break;case'mute':audio.muted=!audio.muted;b.textContent=word(audio.muted?'unmute':'mute');b.setAttribute('aria-pressed',String(audio.muted));break;case'replay':seek(0);audio.play();break;case'step':nextPhrase();break;case'language':setLocale(locale==='en'?'ar':'en');break;case'chapter':seek(story.slides[Number(b.dataset.index)].start);break;case'zoom':{const on=document.getElementById('deck').classList.toggle('enlarged');b.setAttribute('aria-pressed',String(on));break;}case'captions':captions=!captions;document.getElementById('caption').hidden=!captions;b.setAttribute('aria-pressed',String(captions));break;case'notes':notes();break;case'close':document.getElementById('notes').close();break;case'print':printState();window.print();break;}});
document.getElementById('seek').addEventListener('input',e=>seek(Number(e.target.value)));
document.addEventListener('keydown',e=>{if(document.getElementById('notes').open||e.target.closest('button,input'))return;if(e.code==='Space'){e.preventDefault();play();}if(e.key==='ArrowRight'){e.preventDefault();seek(audio.currentTime+5);}if(e.key==='ArrowLeft'){e.preventDefault();seek(audio.currentTime-5);}});
audio.addEventListener('pause',()=>{if(!exportMode)renderAt(audio.currentTime);});audio.addEventListener('seeked',()=>{if(!exportMode)renderAt(audio.currentTime);});audio.addEventListener('ended',()=>{if(!exportMode)renderAt(duration-.001);});
reducedQuery.addEventListener('change',e=>{reduced=e.matches;renderAt(renderTime);});
window.GRINDCTRL={renderAt,seek,setLocale,applyFidelity,getState:()=>({time:renderTime,audioTime:audio.currentTime,paused:audio.paused,scene:story.slides[current].id,locale,reduced}),setExportMode:on=>{exportMode=on;audio.pause();},setReduced:on=>{reduced=on;renderAt(renderTime);},preparePrint:printState};
build();document.fonts.ready.then(()=>renderAt(0));requestAnimationFrame(tick);
