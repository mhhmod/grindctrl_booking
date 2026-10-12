"""Verify full frame coverage and decoded audio alignment, not just container metadata."""
from pathlib import Path
import json,subprocess,hashlib,base64,re,zipfile
import numpy as np
from scipy import signal
R=Path(__file__).parent.parent
original=R/'input/audio/grindctrl-part03-voiceover-ar.mp3'
if (R/'grindctrl-part03-voiceover-ar.mp3').exists():original=R/'grindctrl-part03-voiceover-ar.mp3'
def probe(p):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]))
def pcm(p):return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-map','0:a:0','-f','f32le','-ar','44100','-ac','1','pipe:1']),dtype=np.float32)
source=pcm(original);report={'source_sha256':hashlib.sha256(original.read_bytes()).hexdigest(),'source_container_duration':float(probe(original)['format']['duration']),'source_decoded_samples':len(source),'source_decoded_duration':len(source)/44100,'audio_peak':float(np.max(np.abs(source))),'audio_rms':float(np.sqrt(np.mean(source*source))),'videos':{},'method':'Decoded PCM window cross-correlation at 44.1 kHz; lag checked at beginning, middle and end. AAC is lossy; MP3 master remains byte-identical in HTML/PPTX.'}
for lang in ['en','ar']:
    file=R/('GRINDCTRL_Concrete_Part03_Customer360.mp4' if lang=='en' else 'GRINDCTRL_Concrete_Part03_Customer360_AR.mp4');info=probe(file);v=next(s for s in info['streams'] if s['codec_type']=='video');a=next(s for s in info['streams'] if s['codec_type']=='audio');decoded=pcm(file)
    assert len(decoded)>=len(source),'Encoded audio does not cover the entire source'
    assert v['width']==1920 and v['height']==1080 and v['avg_frame_rate']=='30/1' and int(v['nb_frames'])==8585
    assert float(a['start_time'])==0 and float(v['start_time'])==0
    windows=[]
    for sec in [0,40,65,101,141,169,189,218,249,280,283]:
        start=int(sec*44100);end=min(start+int(2.5*44100),len(source),len(decoded));x=source[start:end].astype(np.float64);y=decoded[start:end].astype(np.float64)
        corr=float(np.corrcoef(x,y)[0,1]);c=signal.correlate(y,x,mode='full',method='fft');lags=signal.correlation_lags(len(y),len(x));mask=np.abs(lags)<=512;lag=int(lags[mask][np.argmax(c[mask])]);windows.append({'source_start_seconds':sec,'correlation_at_zero_lag':round(corr,7),'best_lag_samples':lag,'best_lag_ms':round(lag/44.1,4)})
        assert abs(lag)<=1 and corr>.98,(lang,sec,lag,corr)
    # Decode every frame through the end to catch broken/truncated output.
    subprocess.run(['ffmpeg','-v','error','-i',str(file),'-map','0:v:0','-f','null','-'],check=True,stdout=subprocess.DEVNULL)
    report['videos'][lang]={'width':v['width'],'height':v['height'],'fps':v['avg_frame_rate'],'frames':int(v['nb_frames']),'container_duration':float(info['format']['duration']),'audio_duration':float(a['duration']),'audio_decoded_samples':len(decoded),'audio_coverage_seconds':min(len(source),len(decoded))/44100,'audio_windows':windows,'complete_video_decode':'passed','sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
html=(R/'GRINDCTRL_Concrete_Part03_Customer360.html').read_text();embedded=base64.b64decode(re.search(r'<audio[^>]+src="data:audio/mpeg;base64,([^"]+)"',html).group(1));assert hashlib.sha256(embedded).hexdigest()==report['source_sha256']
for lang in ['en','ar']:
    with zipfile.ZipFile(R/f'GRINDCTRL_Concrete_Part03_Customer360_{lang}.pptx') as z:assert hashlib.sha256(z.read('ppt/media/grindctrl-part03-voiceover-ar.mp3')).hexdigest()==report['source_sha256']
report['byte_identical_audio_embeddings']=['HTML','English PPTX','Arabic PPTX']
(R/'media-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
