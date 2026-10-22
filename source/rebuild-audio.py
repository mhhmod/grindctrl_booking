from pathlib import Path
import os,json,hashlib,subprocess
import numpy as np
import soundfile as sf
D=Path(os.environ.get('GRINDCTRL_OUTPUT',Path(__file__).resolve().parent.parent));R=D/'audio-build';R.mkdir(exist_ok=True)
SR=44100
for film in json.loads((D/'source/films.json').read_text()):
    n=film['id'];idx=int(n)-1;stem=film['stem'];source=D/film['source_audio'];cues=film['captions'];visual_only=film['visual_only_intervals']
    assert hashlib.sha256(source.read_bytes()).hexdigest()==film['source_sha256'],'Wrong approved source narration'
    voice=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-ar',str(SR),'-ac','1','-f','f32le','-']),dtype='<f4')
    placed=np.zeros(150*SR,dtype=np.float32)
    for seg in film['narration_segments']:
        lo=round(seg['source_start_sec']*SR);hi=round(seg['source_end_sec']*SR);target=round(seg['target_start_sec']*SR);part=voice[lo:hi]
        assert hashlib.sha256(part.tobytes()).hexdigest()==seg['source_pcm_sha256']
        placed[target:target+len(part)]=part
    # New original restrained ambient/piano score. No reused old VO or recordings.
    length=150*SR;time=np.arange(length,dtype=np.float32)/SR;music=np.zeros((length,2),dtype=np.float32)
    roots=[[45,53,48,50],[50,45,48,53],[48,55,53,45]][idx]
    for bar,begin in enumerate(np.arange(0,150,8.)):
        at=round(begin*SR);size=min(length-at,round(11*SR));tt=np.arange(size,dtype=np.float32)/SR;env=np.minimum(tt/1.8,1)*np.clip((11-tt)/3,0,1)
        chord=np.zeros(size,dtype=np.float32)
        for j,note in enumerate([roots[bar%4],roots[bar%4]+7,roots[bar%4]+12,roots[bar%4]+16]):
            freq=440*2**((note-69)/12);chord+=(np.sin(2*np.pi*freq*tt+.11*np.sin(tt*1.1+j))+.08*np.sin(4*np.pi*freq*tt))/(j+10)
        music[at:at+size,0]+=chord*env*.055;music[at:at+size,1]+=chord*env*.052
    for k,begin in enumerate(np.arange(2,148,4.)):
        at=round(begin*SR);size=min(length-at,round(2*SR));tt=np.arange(size,dtype=np.float32)/SR;freq=440*2**((roots[(k//2)%4]+[24,31,28][k%3]-69)/12)
        pluck=(np.sin(2*np.pi*freq*tt)+.15*np.sin(2*np.pi*freq*2.003*tt))*np.minimum(tt/.008,1)*np.exp(-tt*3.3)*.013
        music[at:at+size,k%2]+=pluck;music[at:at+size,(k+1)%2]+=pluck*.5
    duck=np.ones(length,dtype=np.float32)*.55
    for a,b in visual_only:
        aa=round(a*SR);bb=round(b*SR);tt=np.arange(bb-aa)/SR;ramp=np.clip(np.minimum(tt/.25,(b-a-tt)/.25),0,1);duck[aa:bb]=.55+.45*ramp
    music*=duck[:,None];music*=np.minimum(time/1.,1)[:,None]*np.clip((150-time)/1.6,0,1)[:,None]
    # A tiny original soft tap at selected meaningful interface events only.
    taps=['search Soho' if n=='01' else 'records a new note' if n=='02' else 'Taps try']
    for term in taps:
        hits=[q['start'] for q in cues if term.lower() in q['raw_recognition'].lower()]
        if hits:
            at=round(hits[0]*SR);tt=np.arange(round(.04*SR))/SR;tap=np.sin(2*np.pi*960*tt)*np.exp(-tt*110)*np.minimum(tt/.002,1)*.007;music[at:at+len(tap),:]+=tap[:,None]
    raw_loud=subprocess.run(['ffmpeg','-hide_banner','-i',str(source),'-af','loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True).stderr
    measured=json.JSONDecoder().raw_decode(raw_loud[raw_loud.rfind('{'):])[0];gain=10**((-18-float(measured['input_i']))/20)
    mix=music+placed[:,None]*gain;sf.write(R/f'{n}-mix.wav',mix,SR,subtype='FLOAT')
    command=['ffmpeg','-hide_banner','-y','-i',str(R/f'{n}-mix.wav'),'-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-ar',str(SR),'-c:a','aac','-b:a','192k','-t','150',str(D/(stem+'.m4a'))]
    log=subprocess.run(command,capture_output=True,text=True,check=True).stderr;loud=json.JSONDecoder().raw_decode(log[log.rfind('{'):])[0]
    print(n,'rebuilt approved audio timeline and original score')
