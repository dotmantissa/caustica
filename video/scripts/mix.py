import pathlib,json,numpy as np,soundfile as sf,subprocess,os
R=pathlib.Path(__file__).resolve().parent.parent;c=json.loads((R.parent/'demo-studio.config.json').read_text());sr=48000;length=240*sr
mix=np.zeros((length,2),np.float64);voice=np.zeros((length,2),np.float64)
for s in json.loads((R/'qa/narration-fit.json').read_text()):
 data,rate=sf.read(R/s['audio'],always_2d=True)
 assert rate==sr
 if data.shape[1]==1:data=np.repeat(data,2,axis=1)
 start=round(s['start']*sr);n=min(len(data),length-start);voice[start:start+n]+=data[:n]
bed,rate=sf.read(R/'audio/music-effects.wav',always_2d=True);assert rate==sr
n=min(len(bed),length);mix[:n]+=bed[:n]*10**(-18/20)
mix+=voice
sf.write(R/'audio/voice-timeline.wav',voice,sr,subtype='PCM_24');sf.write(R/'audio/premaster.wav',mix,sr,subtype='PCM_24')
(R/'public/audio').mkdir(parents=True,exist_ok=True)
env=dict(os.environ,LD_LIBRARY_PATH=c['ffmpeg_library_path'])
subprocess.run([c['ffmpeg'],'-y','-i',str(R/'audio/premaster.wav'),'-af','loudnorm=I=-16:TP=-1.5:LRA=7','-ar','48000','-c:a','pcm_s24le',str(R/'public/audio/final-mix.wav')],env=env,check=True,capture_output=True)
print('Final240s narration/music/effects mix ready')
