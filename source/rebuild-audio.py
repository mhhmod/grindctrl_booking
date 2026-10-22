from pathlib import Path
import os,json,hashlib,subprocess
import numpy as np
import soundfile as sf
D=Path(os.environ.get('GRINDCTRL_OUTPUT',Path(__file__).resolve().parent.parent))
R=D/'audio-build';R.mkdir(exist_ok=True)
SR=44100
for film in json.loads((D/'source/films.json').read_text()):
    num=film['id'];idx=int(num)-1;stem=film['stem'];original=D/film['audio_file']
    assert hashlib.sha256(original.read_bytes()).hexdigest()==film['source_audio_sha256'],'Wrong approved narration'
    voice=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(original),'-f','f32le','-ac','1','-ar',str(SR),'-']),dtype='<f4')
    placed=np.zeros(150*SR,dtype=np.float32)
    for segment in film['narration_segments']:
        a=round(segment['source_start_sec']*SR);b=round(segment['source_end_sec']*SR);target=round(segment['target_start_sec']*SR)
        part=voice[a:b];assert hashlib.sha256(part.tobytes()).hexdigest()==segment['source_pcm_sha256']
        placed[target:target+len(part)]=part
    voice_gain=10**(film['loudness']['constant_voice_gain_db']/20)
    cold=film['cold_open_sec'];cuts=[]
    intervals=film['visual_only_intervals']
    # Original rights-cleared procedural score: soft additive pads, sparse mallets.
    total=150*SR;times=np.arange(total,dtype=np.float32)/SR
    music=np.zeros((total,2),dtype=np.float32)
    roots=[[48,53,45,55],[50,45,53,48],[53,48,55,50]][idx]
    for bar,start in enumerate(np.arange(0,150,7.5)):
        length=min(10.5,150-start);k=round(start*SR);n=min(round(length*SR),total-k);tt=np.arange(n,dtype=np.float32)/SR
        env=np.minimum(tt/1.4,1)*np.minimum((length-tt)/2.8,1);env=np.maximum(env,0)
        chord=np.zeros(n,dtype=np.float32)
        root=roots[bar%4]
        for j,note in enumerate([root,root+7,root+12,root+16,root+23]):
            f=440*2**((note-69)/12)
            chord+=(np.sin(2*np.pi*f*tt+.16*np.sin(2*np.pi*.17*tt+j))+.18*np.sin(4*np.pi*f*tt))/(8+j)
        for ch in range(2):music[k:k+n,ch]+=chord*env*.08*(.9 if (bar+ch)%2 else 1)
    for beat,start in enumerate(np.arange(1.25,148,2.5)):
        if beat%3==1:continue
        k=round(start*SR);n=min(round(1.8*SR),total-k);tt=np.arange(n,dtype=np.float32)/SR
        note=roots[(beat//3)%4]+[24,31,28,35][beat%4];f=440*2**((note-69)/12)
        mal=(np.sin(2*np.pi*f*tt)+.22*np.sin(2*np.pi*f*2.01*tt))*np.exp(-tt*3.8)*np.minimum(tt/.012,1)*.018
        pan=.25 if beat%2 else .75
        music[k:k+n,0]+=mal*(1-pan);music[k:k+n,1]+=mal*pan
    # Smoothly expose music in purposeful visual-only beats, duck under narration.
    env=np.ones(total,dtype=np.float32)*.48
    intervals=film['visual_only_intervals']
    for a,b in intervals:
        lo=max(0,round(a*SR));hi=min(total,round(b*SR));tt=np.arange(hi-lo)/SR
        ramp=np.clip(np.minimum(tt/.35,(b-a-tt)/.35),0,1);env[lo:hi]=.48+.52*ramp
    music*=env[:,None]
    fade=np.minimum(times/1.5,1)*np.minimum((150-times)/2,1);music*=np.clip(fade,0,1)[:,None]
    mix=music+placed[:,None]*voice_gain
    peak=float(np.max(np.abs(mix)))
    # Floating point staging avoids clipping before broadcast mix leveling.
    sf.write(R/f'{num}-mix.wav',mix,SR,subtype='FLOAT')
    leveled=subprocess.run(['ffmpeg','-hide_banner','-y','-i',str(R/f'{num}-mix.wav'),'-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-c:a','aac','-b:a','192k','-ar',str(SR),'-t','150',str(D/(stem+'.m4a'))],capture_output=True,text=True,check=True).stderr
    mix_loudness=json.JSONDecoder().raw_decode(leveled[leveled.rfind('{'):])[0]
    print(num,'rebuilt the approved 150-second mix')
