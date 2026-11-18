import pathlib,json,subprocess,os
root=pathlib.Path(__file__).resolve().parent.parent;c=json.loads((root.parent/'demo-studio.config.json').read_text());env=dict(os.environ,LD_LIBRARY_PATH=c['ffmpeg_library_path'])
p=root/'src/proof.json';proof=json.loads(p.read_text())
for mode in ['healthy','control','regression','candidate']:
 dirs=sorted((root/'raw').glob(mode+'-*'))
 if not dirs:continue
 folders=[d for d in dirs if (d/'actions.json').exists() and 'completedAt' in json.loads((d/'actions.json').read_text())]
 if not folders:continue
 d=folders[-1];j=json.loads((d/'actions.json').read_text());out=root/'public/media'/f'{mode}.mp4';out.parent.mkdir(parents=True,exist_ok=True)
 if not out.exists() or out.stat().st_mtime < pathlib.Path(j['video']).stat().st_mtime:
  subprocess.run([c['ffmpeg'],'-y','-i',j['video'],'-an','-r','30','-c:v','libx264','-crf','16','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],env=env,check=True,capture_output=True)
 proof['media'][mode]=out.name
 p.write_text(json.dumps(proof,indent=2)+'\n')
print(proof['media'])
