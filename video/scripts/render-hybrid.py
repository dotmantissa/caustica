"""Native 1080p hybrid master: authored Remotion motion + genuine footage.

Remotion renders transparent graphic plates. Its easing and Seam state functions
export all 7200 motion states. OpenCV applies those states to original recordings;
FFmpeg encodes per-shot intermediates, then concatenates and adds the final mix.
No draft frames are enlarged. Operation files permit interrupted shot recovery.
"""
import argparse,concurrent.futures,datetime,hashlib,json,os,pathlib,subprocess,time
import cv2,numpy as np

ROOT=pathlib.Path(__file__).resolve().parent.parent
CONFIG=json.loads((ROOT.parent/'demo-studio.config.json').read_text())
ENV=dict(os.environ,LD_LIBRARY_PATH=CONFIG['ffmpeg_library_path'])
SHOTS=json.loads((ROOT/'src/demo-shots.json').read_text())
PROOF=json.loads((ROOT/'src/proof.json').read_text())
MOTION=json.loads((ROOT/'qa/hybrid-motion.json').read_text())['frames']
CODE_DIGEST=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
MOTION_DIGEST=hashlib.sha256((ROOT/'qa/hybrid-motion.json').read_bytes()).hexdigest()
QA=ROOT/'qa';CHUNKS=QA/'hybrid-shots';CHUNKS.mkdir(exist_ok=True)
cv2.setNumThreads(1)
PLATE=cv2.imread(str(ROOT/'public/assets/forest-stage.png'))
MASK=np.zeros((900,1500),np.uint8)
cv2.rectangle(MASK,(16,0),(1483,899),255,-1);cv2.rectangle(MASK,(0,16),(1499,883),255,-1)
for x,y in [(16,16),(1483,16),(16,883),(1483,883)]:cv2.circle(MASK,(x,y),16,255,-1,cv2.LINE_AA)
PANE_ALPHA=MASK.astype(np.float32)/255
PANE_BORDER=cv2.subtract(MASK,cv2.erode(MASK,np.ones((3,3),np.uint8)))>0
SHADOW_MASK=np.zeros((1080,1920),np.float32);SHADOW_MASK[120:1020,210:1710]=PANE_ALPHA
SHADOW_ALPHA=cv2.GaussianBlur(SHADOW_MASK,(0,0),35)*.34
SHADOW_ALPHA[:90]=0
SHADOW_WEIGHT=np.repeat((1-SHADOW_ALPHA)[:,:,None],3,axis=2)
GEOMETRIES={900:(MASK,PANE_ALPHA,PANE_BORDER,SHADOW_ALPHA,SHADOW_WEIGHT,90)}
def geometry(height):
 if height in GEOMETRIES:return GEOMETRIES[height]
 mask=np.zeros((height,1500),np.uint8);cv2.rectangle(mask,(16,0),(1483,height-1),255,-1);cv2.rectangle(mask,(0,16),(1499,height-17),255,-1)
 for x,y in [(16,16),(1483,16),(16,height-17),(1483,height-17)]:cv2.circle(mask,(x,y),16,255,-1,cv2.LINE_AA)
 alpha=mask.astype(np.float32)/255;border=cv2.subtract(mask,cv2.erode(mask,np.ones((3,3),np.uint8)))>0;top=(1080-height)//2
 shadow=np.zeros((1080,1920),np.float32);shadow[top+30:top+30+height,210:1710]=alpha;shadow=cv2.GaussianBlur(shadow,(0,0),35)*.34
 weight=np.repeat((1-shadow)[:,:,None],3,axis=2);GEOMETRIES[height]=(mask,alpha,border,shadow,weight,top);return GEOMETRIES[height]

def atomic(path,data):
 tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(json.dumps(data,indent=2));tmp.replace(path)

def transparent_pane(frame,state,height):
 mask,panealpha,border,shadow,weight,top=geometry(height)
 matrix=np.float32([[state['scale'],0,750-state['x']*state['scale']],[0,state['scale'],height/2-state['y']*state['scale']]])
 pane=cv2.warpAffine(frame,matrix,(1500,height),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=(230,240,245))
 pane[border]=pane[border]*.5+127.5
 alpha=shadow.copy();rgb=np.zeros((1080,1920,3),np.float32)
 # Keep a premultiplied foreground so seam blurs cannot produce black fringes.
 alpha[top:top+height,210:1710]=panealpha+alpha[top:top+height,210:1710]*(1-panealpha)
 rgb[top:top+height,210:1710]=pane.astype(np.float32)*panealpha[:,:,None]
 return rgb,alpha

def apply_seam(rgb,alpha,state):
 seam=state['seam'];scale=seam['scale']
 if abs(scale-1)>.00001 or seam['x'] or seam['y']:
  matrix=np.float32([[scale,0,960*(1-scale)+seam['x']],[0,scale,540*(1-scale)+seam['y']]])
  rgb=cv2.warpAffine(rgb,matrix,(1920,1080),flags=cv2.INTER_LINEAR)
  alpha=cv2.warpAffine(alpha,matrix,(1920,1080),flags=cv2.INTER_LINEAR)
 if seam['blur']>.35:
  rgb=cv2.GaussianBlur(rgb,(0,0),seam['blur']);alpha=cv2.GaussianBlur(alpha,(0,0),seam['blur'])
 return rgb*seam['opacity'],alpha*seam['opacity']

def opaque_pane(frame,state,background,height):
 """Fast settled-frame path; original native pixels still receive the same crop."""
 mask,panealpha,border,shadow,weight,top=geometry(height)
 matrix=np.float32([[state['scale'],0,750-state['x']*state['scale']],[0,state['scale'],height/2-state['y']*state['scale']]])
 pane=cv2.warpAffine(frame,matrix,(1500,height),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=(230,240,245))
 pane[border]=pane[border]*.5+127.5
 output=cv2.multiply(background,weight,dtype=cv2.CV_8U)
 cv2.copyTo(pane,mask,output[top:top+height,210:1710])
 return output

def verify_chunk(path,frames):
 if not path.exists():return False
 p=subprocess.run([CONFIG['ffprobe'],'-v','error','-show_entries','stream=nb_frames,width,height','-of','json',str(path)],env=ENV,capture_output=True,text=True)
 if p.returncode:return False
 try:
  s=json.loads(p.stdout)['streams'][0];return s['width']==1920 and s['height']==1080 and int(s['nb_frames'])==frames
 except (KeyError,ValueError,IndexError):return False

def render_shot(index,force=False):
 shot=SHOTS[index];first=round(shot['from']*30);count=round((shot['to']-shot['from'])*30)
 out=CHUNKS/f'{index:02d}.mp4';opfile=CHUNKS/f'{index:02d}.json'
 filename=PROOF['records'][shot['record']] if 'record'in shot else PROOF['media'].get(shot.get('media',''))
 source=ROOT/'qa/graphics'/f'{shot["kind"]}.png' if 'kind'in shot else ROOT/'public/media'/filename
 source_digest=hashlib.sha256(source.read_bytes()).hexdigest()
 identity=hashlib.sha256(json.dumps(shot,sort_keys=True).encode()+json.dumps(PROOF,sort_keys=True).encode()+CODE_DIGEST.encode()+MOTION_DIGEST.encode()+source_digest.encode()).hexdigest()
 if not force and verify_chunk(out,count) and opfile.exists() and json.loads(opfile.read_text()).get('identity')==identity:
  print(f'{index:02d} recovered verified chunk',flush=True);return str(out)
 graphics=shot.get('kind');cap=None;last=None
 if graphics:
  source=ROOT/'qa/graphics'/f'{graphics}.png';image=cv2.imread(str(source),cv2.IMREAD_UNCHANGED)
  if image is None or image.shape!=(1080,1920,4):raise RuntimeError(f'Native transparent graphic missing: {source}')
  basealpha=image[:,:,3].astype(np.float32)/255;basergb=image[:,:,:3].astype(np.float32)*basealpha[:,:,None]
 else:
  filename=PROOF['records'][shot['record']] if 'record'in shot else PROOF['media'][shot['media']]
  source=ROOT/'public/media'/filename;cap=cv2.VideoCapture(str(source));fps=cap.get(cv2.CAP_PROP_FPS)
  if not cap.isOpened() or fps<=0:raise RuntimeError(f'Cannot decode authentic media: {source}')
  position=int(round(shot.get('trim',0)*fps));cap.set(cv2.CAP_PROP_POS_FRAMES,position);lastpos=position-1
 args=[CONFIG['ffmpeg'],'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','bgr24','-video_size','1920x1080','-framerate','30','-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','16','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-video_track_timescale','90000','-threads','2','-frames:v',str(count),str(out)]
 err=open(CHUNKS/f'{index:02d}.log','w');encoder=subprocess.Popen(args,stdin=subprocess.PIPE,stderr=err,env=ENV)
 operation={'shot':index,'source':str(source),'sourceSha256':source_digest,'codeSha256':CODE_DIGEST,'motionSha256':MOTION_DIGEST,'identity':identity,'frames':count,'pid':encoder.pid,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'output':str(out),'completedFrames':0}
 atomic(opfile,operation);t0=time.monotonic()
 try:
  for n in range(count):
   state=MOTION[first+n]
   background=cv2.getRectSubPix(PLATE,(1920,1080),(state['backgroundX']+959.5,639.5))
   if graphics:
    rgb,alpha=basergb,basealpha
    # Graphic typography is rendered by Remotion; only the authored land moves here.
    if graphics in ('intro','contract','end'):
     land=(.94+.06*state['land']) if graphics=='contract' else (.98+.02*state['land']) if graphics=='end' else 1
     matrix=np.float32([[land,0,960*(1-land)],[0,land,540*(1-land)]]);
     rgb=cv2.warpAffine(basergb,matrix,(1920,1080),flags=cv2.INTER_LINEAR);alpha=cv2.warpAffine(basealpha,matrix,(1920,1080),flags=cv2.INTER_LINEAR)
     if graphics=='intro':rgb*=state['land'];alpha*=state['land']
   else:
    desired=int(round((shot.get('trim',0)+n/30)*fps))
    while lastpos<desired:
     ok,frame=cap.read();lastpos+=1
     if ok:last=frame
     else:break
    if last is None:raise RuntimeError(f'No source frame at {desired}: {source}')
    if last.shape[:2]!=(960,1600):raise RuntimeError(f'Unexpected source resolution: {last.shape}')
    seam=state['seam'];settled=abs(seam['scale']-1)<.00001 and seam['opacity']==1 and seam['blur']<=.35 and not seam['x'] and not seam['y']
    if settled:output=opaque_pane(last,state,background,shot.get('paneHeight',900))
    else:rgb,alpha=transparent_pane(last,state,shot.get('paneHeight',900))
   if graphics or not settled:
    rgb,alpha=apply_seam(rgb,alpha,state)
    output=np.clip(rgb+background.astype(np.float32)*(1-alpha[:,:,None]),0,255).astype(np.uint8)
   encoder.stdin.write(output.tobytes())
   if n==count//2:cv2.imwrite(str(QA/f'hybrid-sample-{index:02d}.png'),output)
   if n%90==0:
    operation['completedFrames']=n+1;operation['fps']=round((n+1)/(time.monotonic()-t0),2);atomic(opfile,operation)
  encoder.stdin.close();code=encoder.wait()
  if code or not verify_chunk(out,count):raise RuntimeError(f'Encoder validation failed for shot {index}: {code}')
  operation.update(completedFrames=count,completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),seconds=round(time.monotonic()-t0,2));atomic(opfile,operation)
  print(f'{index:02d} {count} native frames in {operation["seconds"]}s',flush=True)
 finally:
  if cap:cap.release()
  if encoder.poll() is None:encoder.kill();encoder.wait()
  err.close()
 return str(out)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--only');ap.add_argument('--workers',type=int,default=2);ap.add_argument('--force',action='store_true');a=ap.parse_args()
 if not PROOF['complete']:raise RuntimeError('Incomplete proof cannot be rendered as a final master')
 indices=[int(x)for x in a.only.split(',')] if a.only else list(range(len(SHOTS)))
 operation={'pid':os.getpid(),'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'engine':'Remotion graphics and motion states + OpenCV composition + FFmpeg encoding','codeSha256':CODE_DIGEST,'motionSha256':MOTION_DIGEST,'nativeResolution':[1920,1080],'fps':30,'frames':7200,'shots':indices,'workers':a.workers,'outputs':[]};atomic(QA/'hybrid-operation.json',operation)
 with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers)as pool:
  futures={pool.submit(render_shot,i,a.force):i for i in indices}
  for future in concurrent.futures.as_completed(futures):
   operation['outputs'].append(future.result());atomic(QA/'hybrid-operation.json',operation)
 if a.only:
  operation['completedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();atomic(QA/'hybrid-operation.json',operation);return
 listing=QA/'hybrid-concat.txt';listing.write_text(''.join(f"file '{(CHUNKS/f'{i:02d}.mp4').as_posix()}'\n"for i in range(len(SHOTS))))
 out=ROOT/'output/Caustica_Demo_Final.mp4'
 subprocess.run([CONFIG['ffmpeg'],'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(listing),'-i',str(ROOT/'public/audio/final-mix.wav'),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-t','240','-movflags','+faststart',str(out)],env=ENV,check=True)
 operation.update(completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),master=str(out));atomic(QA/'hybrid-operation.json',operation);print(str(out),flush=True)

if __name__=='__main__':main()
