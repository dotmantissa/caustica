import asyncio,json,re,subprocess,pathlib
import edge_tts
ROOT=pathlib.Path(__file__).resolve().parent.parent
CFG=json.loads((ROOT.parent/'demo-studio.config.json').read_text())
FFMPEG=CFG['ffmpeg']; FFPROBE=CFG['ffprobe']
import os
ENV=dict(os.environ,LD_LIBRARY_PATH=CFG['ffmpeg_library_path'])
segments=json.loads((ROOT/'treatment/narration.json').read_text())
folder=ROOT/'audio/voice';folder.mkdir(parents=True,exist_ok=True)
def run(args):return subprocess.run(args,env=ENV,check=True,capture_output=True,text=True)
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
async def voice(s):
 path=folder/(s['id']+'.mp3'); marker=folder/(s['id']+'.source.json');
 if not path.exists() or not marker.exists() or json.loads(marker.read_text())['text']!=s['text']:
  communicate=edge_tts.Communicate(s['text'],CFG['voice'],rate='+0%',boundary='SentenceBoundary')
  subs=edge_tts.SubMaker()
  with path.open('wb') as f:
   async for chunk in communicate.stream():
    if chunk['type']=='audio':f.write(chunk['data'])
    elif chunk['type']=='SentenceBoundary':subs.feed(chunk)
  (folder/(s['id']+'.srt')).write_text(subs.get_srt());marker.write_text(json.dumps({'text':s['text'],'voice':CFG['voice']},indent=2))
 duration=float(run([FFPROBE,'-v','error','-show_entries','format=duration','-of','csv=p=0',str(path)]).stdout)
 target=s['end']-s['start']-.35
 rate=duration/target
 # Fit connected speech to the scene; restrained tempo adjustment preserves the saved voice.
 out=folder/(s['id']+'.wav')
 run([FFMPEG,'-y','-i',str(path),'-af',f'atempo={rate:.7f},loudnorm=I=-18:TP=-2:LRA=6','-ar','48000',str(out)])
 s.update(sourceDuration=duration,fitDuration=target,tempo=rate,audio=str(out.relative_to(ROOT)))
 return s
async def main():
 result=[]
 for s in segments:
  result.append(await voice(s));print(json.dumps({'voice':s['id'],'sourceDuration':s['sourceDuration'],'tempo':s['tempo']}),flush=True)
 (ROOT/'qa/narration-fit.json').write_text(json.dumps(result,indent=2))
 captions=[]
 for s in result:
  for block in (folder/(s['id']+'.srt')).read_text().strip().split('\n\n'):
   lines=block.splitlines()
   if len(lines)<3:continue
   times=re.findall(r'(\d+):(\d+):(\d+),(\d+)',lines[1]);
   sec=lambda a:int(a[0])*3600+int(a[1])*60+int(a[2])+int(a[3])/1000
   start=s['start']+sec(times[0])/s['tempo'];end=s['start']+sec(times[1])/s['tempo']
   captions.append({'text':' '.join(lines[2:]),'startMs':round(start*1000),'endMs':round(end*1000),'timestampMs':round((start+end)*500),'confidence':None})
 (ROOT/'output/Caustica_Demo_Final.captions.json').write_text(json.dumps(captions,indent=2))
 (ROOT/'output/Caustica_Demo_Final.srt').write_text('\n\n'.join(f"{i+1}\n{stamp(c['startMs']/1000)} --> {stamp(c['endMs']/1000)}\n{c['text']}" for i,c in enumerate(captions))+'\n')
asyncio.run(main())
