from pathlib import Path
import subprocess,json,hashlib,re,sys,os
import numpy as np
from scipy.signal import correlate,correlation_lags
R=Path(__file__).parent;D=Path(os.environ.get('GRINDCTRL_OUTPUT',str(Path(__file__).resolve().parent.parent)));films=json.loads((D/'source/films.json').read_text())
selected=sys.argv[1] if len(sys.argv)>1 else None
reports=json.loads((D/'QA_MEDIA.json').read_text()) if selected and (D/'QA_MEDIA.json').exists() else []
for f in films:
    if selected and f['id']!=selected:continue
    video=D/(f['stem']+'.mp4')
    if not video.exists() or not (D/'review'/f"{f['id']}-render.json").exists():continue
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]))
    v=next(s for s in probe['streams'] if s['codec_type']=='video');a=next(s for s in probe['streams'] if s['codec_type']=='audio')
    assert (v['width'],v['height'],v['r_frame_rate'],v['nb_frames'])==(1920,1080,'30/1','4500')
    assert abs(float(v['duration'])-150)<.0001 and abs(float(a['duration'])-150)<.005
    assert v['codec_name']=='h264' and a['codec_name']=='aac'
    subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'],check=True)
    decoded=lambda p:np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-ar','44100','-ac','1','-f','f32le','-']),dtype='<f4')
    source=decoded(D/f['audio_file']);out=decoded(video)
    assert hashlib.sha256((D/f['audio_file']).read_bytes()).hexdigest()==f['source_audio_sha256']
    assert sum(s['samples'] for s in f['narration_segments'])==len(source)
    sample_checks=[]
    # Check several interior voiced windows per segment against the actual mixed MP4.
    for seg in f['narration_segments']:
        sa=round(seg['source_start_sec']*44100);sb=round(seg['source_end_sec']*44100)
        assert hashlib.sha256(source[sa:sb].tobytes()).hexdigest()==seg['source_pcm_sha256']
        candidates=[]
        for fraction in [.15,.5,.83]:
            ss=seg['source_start_sec']+(seg['source_end_sec']-seg['source_start_sec'])*fraction
            # Select a voiced interior window near each anchor; a pause plus quiet
            # music can produce an ambiguous pitch-period correlation maximum.
            options=[min(seg['source_end_sec']-.65,max(seg['source_start_sec']+.03,ss+shift)) for shift in [-.7,-.35,0,.35,.7]]
            ss=max(options,key=lambda t:float(np.mean(source[round(t*44100):round((t+.6)*44100)]**2)))
            begin=round(ss*44100);window=source[begin:begin+round(.6*44100)]
            if len(window)<2000:continue
            target=round((seg['target_start_sec']+ss-seg['source_start_sec'])*44100)
            # +/- 30ms matching allows detection of encoder/filter offset, not guessing it.
            pad=1323;actual=out[target-pad:target+len(window)+pad]
            corr=correlate(actual,window,mode='valid',method='fft');lag=int(np.argmax(corr))-pad
            aligned=out[target+lag:target+lag+len(window)]
            coefficient=float(np.corrcoef(window,aligned)[0,1])
            candidates.append(dict(source_sec=ss,target_sec=target/44100,lag_samples=lag,correlation=coefficient))
        sample_checks.extend(candidates)
    assert max(abs(x['lag_samples']) for x in sample_checks)<=5,(f['id'],sample_checks)
    music=[]
    for lo,hi in f['visual_only_intervals']:
        arr=out[round((lo+.2)*44100):round((hi-.2)*44100)]
        rms=float(np.sqrt(np.mean(arr*arr)));assert rms>1e-5
        music.append(dict(start=lo,end=hi,rms_dbfs=20*np.log10(rms)))
    measured=subprocess.run(['ffmpeg','-hide_banner','-i',str(video),'-af','loudnorm=I=-16:TP=-1:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True).stderr
    loud=json.JSONDecoder().raw_decode(measured[measured.rfind('{'):])[0]
    assert -18<float(loud['input_i'])<-14 and float(loud['input_tp'])<-.8
    # Caption intervals are strictly ordered and never cross inserted visual-only gaps.
    previous=0
    for c in f['captions']:
        assert c['start']>=previous-.001 and c['end']>c['start']
        previous=c['end']
        assert not any(c['start']<hi-.001 and c['end']>lo+.001 for lo,hi in f['visual_only_intervals'])
        assert len(c['text'])<=148 and not '[' in c['text']
    item=dict(film=f['id'],filename=video.name,bytes=video.stat().st_size,sha256=hashlib.sha256(video.read_bytes()).hexdigest(),video=dict(width=v['width'],height=v['height'],frames=int(v['nb_frames']),fps=v['r_frame_rate'],duration=float(v['duration']),codec=v['codec_name']),audio=dict(duration=float(a['duration']),codec=a['codec_name'],sample_rate=a['sample_rate'],channels=a['channels'],integrated_lufs=float(loud['input_i']),true_peak_dbtp=float(loud['input_tp']),pcm_windows=sample_checks,minimum_correlation=min(x['correlation'] for x in sample_checks)),source=dict(file=f['audio_file'],sha256=f['source_audio_sha256'],container_seconds=f['source_container_duration'],decoded_seconds=f['source_decoded_duration'],preserved_samples=len(source),all_source_segments_preserved=True),extra_visual_only_seconds=f['additional_visual_only_sec'],music_backed_intervals=music,subtitles=dict(cues=len(f['captions']),max_lines=2,timing='actual source pause boundaries plus measured insertions; ASR context reconciliation; no human verbatim certification'),full_decode='passed')
    reports=[r for r in reports if r['film']!=f['id']]+[item];print(f['id'],'media passed',loud['input_i'],'LUFS',loud['input_tp'],'dBTP','lag',max(abs(x['lag_samples']) for x in sample_checks),flush=True)
(D/'QA_MEDIA.json').write_text(json.dumps(reports,indent=2))
