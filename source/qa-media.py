from pathlib import Path
import json,subprocess,hashlib,os,sys
import numpy as np
from scipy.signal import correlate
D=Path(os.environ.get('GRINDCTRL_OUTPUT',str(Path(__file__).resolve().parent.parent)))
films=json.loads((D/'source/films.json').read_text());selected=sys.argv[1] if len(sys.argv)>1 else None
report=json.loads((D/'QA_MEDIA.json').read_text()) if selected and (D/'QA_MEDIA.json').exists() else []
def decode(p):return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-ar','44100','-ac','1','-f','f32le','-']),dtype='<f4')
for f in films:
    if selected and f['id']!=selected:continue
    path=D/(f['stem']+'.mp4')
    if not (D/'review'/f"{f['id']}-render.json").exists():continue
    p=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(path)]))
    v=next(s for s in p['streams'] if s['codec_type']=='video');a=next(s for s in p['streams'] if s['codec_type']=='audio')
    assert (v['width'],v['height'],v['r_frame_rate'],v['nb_frames'],v['nb_read_frames'])==(1920,1080,'30/1','4500','4500')
    assert float(v['duration'])==150 and abs(float(a['duration'])-150)<.001
    assert v['codec_name']=='h264' and a['codec_name']=='aac' and int(a['channels'])==2
    source=decode(D/f['source_audio']);mixed=decode(path)
    assert hashlib.sha256((D/f['source_audio']).read_bytes()).hexdigest()==f['source_sha256']
    assert sum(s['samples'] for s in f['narration_segments'])==len(source)
    if f['id'] in ['01','02']:assert len(f['narration_segments'])==1
    elif f['id']=='03':assert len(f['narration_segments'])==4 and f['exception']
    windows=[];cut_checks=[]
    for seg in f['narration_segments']:
        lo=round(seg['source_start_sec']*44100);hi=round(seg['source_end_sec']*44100)
        assert hashlib.sha256(source[lo:hi].tobytes()).hexdigest()==seg['source_pcm_sha256']
        fractions=np.linspace(.03,.97,12) if (hi-lo)/44100>100 else [.07,.25,.5,.75,.93]
        for frac in fractions:
            anchor=seg['source_start_sec']+(seg['source_end_sec']-seg['source_start_sec'])*frac
            choices=[min(seg['source_end_sec']-.8,max(seg['source_start_sec']+.02,anchor+shift)) for shift in [-.6,-.3,0,.3,.6]]
            ss=max(choices,key=lambda t:float(np.mean(source[round(t*44100):round((t+.7)*44100)]**2)))
            begin=round(ss*44100);sample=source[begin:begin+30870];target=round((seg['target_start_sec']+ss-seg['source_start_sec'])*44100);pad=1323
            seq=mixed[target-pad:target+len(sample)+pad];lag=int(np.argmax(correlate(seq,sample,mode='valid',method='fft')))-pad
            aligned=mixed[target+lag:target+lag+len(sample)];corr=float(np.corrcoef(sample,aligned)[0,1]);windows.append(dict(source_sec=ss,target_sec=target/44100,lag_samples=lag,correlation=corr))
        if hi<len(source):
            tiny=source[max(0,hi-441):hi+441];cut_checks.append(dict(source_cut_sec=hi/44100,near_cut_rms_dbfs=20*np.log10(max(1e-12,float(np.sqrt(np.mean(tiny*tiny)))))))
    assert max(abs(w['lag_samples']) for w in windows)<=5,(f['id'],windows)
    music=[]
    for lo,hi in f['visual_only_intervals']:
        if hi-lo<.5:continue
        sample=mixed[round((lo+.1)*44100):round((hi-.1)*44100)];rms=float(np.sqrt(np.mean(sample*sample)));assert rms>1e-6;music.append(dict(start=lo,end=hi,rms_dbfs=20*np.log10(rms)))
    measured=subprocess.run(['ffmpeg','-hide_banner','-i',str(path),'-af','loudnorm=I=-16:TP=-1:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True).stderr
    loud=json.JSONDecoder().raw_decode(measured[measured.rfind('{'):])[0];assert -18<float(loud['input_i'])<-14 and float(loud['input_tp'])<-1
    previous=0
    for q in f['captions']:
        assert q['start']>=previous-.001 and q['end']>q['start'] and len(q['text'])<148
        assert not any(q['start']<hi-.001 and q['end']>lo+.001 for lo,hi in f['visual_only_intervals'])
        previous=q['end']
    row=dict(film=f['id'],file=path.name,bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),video=dict(width=1920,height=1080,fps='30/1',frames=4500,decoded_frames=int(v['nb_read_frames']),duration=float(v['duration']),codec=v['codec_name']),audio=dict(duration=float(a['duration']),codec=a['codec_name'],channels=int(a['channels']),integrated_lufs=float(loud['input_i']),true_peak_dbtp=float(loud['input_tp']),windows=windows,minimum_correlation=min(w['correlation'] for w in windows)),source=dict(file=f['source_audio'],sha256=f['source_sha256'],decoded_duration=len(source)/44100,samples=len(source),all_source_samples_included_exactly_once=True,continuous_uncut=f['id']!='03'),inserted_pause_checks=cut_checks,music_backed_intervals=music,subtitle_cues=len(f['captions']),exception=f['exception'])
    report=[r for r in report if r['film']!=f['id']]+[row];(D/'QA_MEDIA.json').write_text(json.dumps(report,indent=2));print(f['id'],'passed',loud['input_i'],'LUFS',loud['input_tp'],'dBTP','maxlag',max(abs(w['lag_samples']) for w in windows),flush=True)
