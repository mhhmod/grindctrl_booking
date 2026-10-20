from pathlib import Path
import json,subprocess,hashlib,base64,re,zipfile,math
import numpy as np
from scipy import signal
R=Path(__file__).parent.parent;S=json.loads((R/'source/story.json').read_text());original=R/'Part04_FINAL_VOICEOVER.mp3';vfile=R/'GRINDCTRL_Concrete_Part04_AI_Opportunities.mp4'
def probe(p):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]))
def pcm(p):return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-map','0:a:0','-f','f32le','-ar','44100','-ac','1','pipe:1']),dtype=np.float32)
source=pcm(original);decoded=pcm(vfile);h=hashlib.sha256(original.read_bytes()).hexdigest();assert h==S['timeline']['audio_sha256'];assert h!='0fd419e6f6bbed75c4bb2e0e3747b3fc3ab5f9b2864b577c4c95bcb95fe70d01'
info=probe(vfile);assert len([x for x in info['streams'] if x['codec_type']=='audio'])==1
assert S['timeline']['audio_track_count']==1 and S['timeline']['audio_edits']==[]
v=next(s for s in info['streams'] if s['codec_type']=='video');a=next(s for s in info['streams'] if s['codec_type']=='audio')
assert len(decoded)>=len(source);assert v['width']==1920 and v['height']==1080 and v['avg_frame_rate']=='30/1' and int(v['nb_frames'])==math.ceil(len(source)/44100*30)
assert float(a['start_time'])==float(v['start_time'])==0
windows=[]
for sec in [0,5,29,45,61,76,93,107,125,138,157,176,189,207,220,238,253,265,273,280,283]:
 start=int(sec*44100);end=min(start+int(2.5*44100),len(source),len(decoded));x=source[start:end].astype(np.float64);y=decoded[start:end].astype(np.float64)
 corr=float(np.corrcoef(x,y)[0,1]);c=signal.correlate(y,x,mode='full',method='fft');lags=signal.correlation_lags(len(y),len(x));mask=np.abs(lags)<=512;lag=int(lags[mask][np.argmax(c[mask])]);assert abs(lag)<=1 and corr>.98,(sec,lag,corr)
 windows.append(dict(source_start_seconds=sec,zero_lag_correlation=round(corr,7),best_lag_samples=lag,best_lag_ms=round(lag/44.1,4)))
subprocess.run(['ffmpeg','-v','error','-i',str(vfile),'-map','0:v:0','-f','null','-'],stdout=subprocess.DEVNULL,check=True)
html=(R/'GRINDCTRL_Concrete_Part04_AI_Opportunities.html').read_text();embedded=base64.b64decode(re.search(r'<audio[^>]+src="data:audio/mpeg;base64,([^"]+)"',html).group(1));assert hashlib.sha256(embedded).hexdigest()==h
for lang in ['en']:
 with zipfile.ZipFile(R/f'GRINDCTRL_Concrete_Part04_AI_Opportunities_{lang}.pptx') as z:assert hashlib.sha256(z.read('ppt/media/Part04_FINAL_VOICEOVER.mp3')).hexdigest()==h
report=dict(source_sha256=h,rejected_audio_excluded=True,source_container_duration=float(probe(original)['format']['duration']),source_decoded_samples=len(source),source_decoded_duration=len(source)/44100,source_peak=float(np.max(np.abs(source))),source_rms=float(np.sqrt(np.mean(source*source))),source_clipped_sample_count=int(np.sum(np.abs(source)>=.999)),original_words_and_speed_preserved=True,video=dict(width=v['width'],height=v['height'],fps=v['avg_frame_rate'],frames=int(v['nb_frames']),container_duration=float(info['format']['duration']),audio_duration=float(a['duration']),audio_decoded_samples=len(decoded),source_coverage_seconds=min(len(source),len(decoded))/44100,full_video_decode='passed',sha256=hashlib.sha256(vfile.read_bytes()).hexdigest()),audio_windows=windows,byte_identical_audio_embeddings=['HTML','English PPTX'],limitations='Signal QA verifies source preservation and audio alignment, not a human pronunciation approval or an end-to-end listening test. MP4 audio uses AAC encoding; the MP3 is unchanged in source, HTML and PPTX.')
(R/'qa/media-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
