import pathlib,json,subprocess,os,hashlib,re,datetime,numpy as np,cv2
R=pathlib.Path(__file__).resolve().parent.parent;c=json.loads((R.parent/'demo-studio.config.json').read_text());env=dict(os.environ,LD_LIBRARY_PATH=c['ffmpeg_library_path']);video=R/'output/Caustica_Demo_Final.mp4'
operation={'pid':os.getpid(),'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'video':str(video),'current':'native probe and full frame count'}
def progress(step):
 operation['current']=step;(R/'qa/master-qa-operation.json').write_text(json.dumps(operation,indent=2))
progress('native probe and full frame count')
def run(a):return subprocess.run(a,env=env,check=True,capture_output=True,text=True)
info=json.loads(run([c['ffprobe'],'-v','error','-count_frames','-show_streams','-show_format','-of','json',str(video)]).stdout)
v=next(s for s in info['streams'] if s['codec_type']=='video');a=next(s for s in info['streams'] if s['codec_type']=='audio');assert v['width']==1920 and v['height']==1080 and v['avg_frame_rate']=='30/1' and int(v['nb_read_frames'])==7200 and v['pix_fmt']=='yuv420p' and v['codec_name']=='h264';assert a['codec_name']=='aac' and int(a['sample_rate'])==48000 and a['channels']==2;assert abs(float(info['format']['duration'])-240)<.05
assert all(v.get(k)=='bt709'for k in ['color_space','color_transfer','color_primaries'])
progress('full video and audio decode')
run([c['ffmpeg'],'-v','error','-i',str(video),'-f','null','-'])
progress('encoded-master loudness and silence measurements')
loud=run([c['ffmpeg'],'-hide_banner','-i',str(video),'-af','loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','-']).stderr
silence=run([c['ffmpeg'],'-hide_banner','-i',str(video),'-af','silencedetect=noise=-45dB:d=0.8','-f','null','-']).stderr
(R/'qa/loudness.txt').write_text(loud);(R/'qa/silence.txt').write_text(silence)
measurement=json.loads(re.search(r'\{\s*"input_i".*?\}',loud,re.S).group(0));assert abs(float(measurement['input_i'])+16)<=1 and float(measurement['input_tp'])<=-1
progress('sidecar captions and representative native frames')
sidecars={}
for filename in ['Caustica_Demo_Final.srt','Caustica_Demo_Poster.png']:
 path=R/'output'/filename;assert path.is_file();sidecars[filename]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size}
srt=(R/'output/Caustica_Demo_Final.srt').read_text();cues=re.findall(r'(\d\d):(\d\d):(\d\d),(\d\d\d) --> (\d\d):(\d\d):(\d\d),(\d\d\d)',srt)
assert cues;last=0
for cue in cues:
 values=list(map(int,cue));start=values[0]*3600+values[1]*60+values[2]+values[3]/1000;end=values[4]*3600+values[5]*60+values[6]+values[7]/1000
 assert 0<=start<end<=240 and start>=last;last=end
cap=cv2.VideoCapture(str(video));times=[1.5,6,14,22,31,37,43,49,54,60,66,72,79,87,95,104,114,122,130,137,146,154,162,173,182,190,201,216,226,232,237]
frames=[]
for t in times:
 cap.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,frame=cap.read();assert ok
 name=f'frame-{round(t*30):04d}.png';cv2.imwrite(str(R/'qa'/name),frame);thumb=cv2.resize(frame,(384,216));frames.append(thumb)
cap.release();sheet=np.zeros((7*216,5*384,3),np.uint8)
for i,f in enumerate(frames):sheet[(i//5)*216:(i//5+1)*216,(i%5)*384:(i%5+1)*384]=f
cv2.imwrite(str(R/'qa/contact-sheet.png'),sheet)
manifest={'video':str(video),'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'bytes':video.stat().st_size,'duration':float(info['format']['duration']),'frames':int(v['nb_read_frames']),'videoCodec':v['codec_name'],'pixelFormat':v['pix_fmt'],'audioCodec':a['codec_name'],'audioSampleRate':48000,'audioChannels':2,'colorSpace':'bt709','fullDecode':'passed','loudnessLufs':float(measurement['input_i']),'truePeakDbtp':float(measurement['input_tp']),'sampleFrames':[round(t*30) for t in times],'sidecars':sidecars,'captionCues':len(cues),'edgeOverlayPolicy':'no corner/edge narrative labels; sidecar captions only; Director source/native-frame review','proof':json.loads((R/'src/proof.json').read_text()),'renderPipeline':json.loads((R/'qa/hybrid-operation.json').read_text()),'narrationEngine':c['voice_engine'],'narrationVoice':c['voice'],'audioReview':'automated encoded-master loudness/silence and Earshot review recorded separately; no human listening claimed'}
(R/'qa/manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps({k:manifest[k] for k in ['duration','frames','sha256','bytes','fullDecode']}))
operation['completedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();progress('complete')
