import {AbsoluteFill,Sequence,OffthreadVideo,Audio,staticFile,useCurrentFrame,useVideoConfig,interpolate,Img} from 'remotion';
import {E} from './lib/anim';
import {seamState,type SeamRecipe} from './fx/Seam';
import proof from './proof.json';
import './brand/fonts/inter/index.css';
import './brand/fonts/geist-mono/index.css';
const forest='#254c3b',paper='#f5f0e6',ink='#252d25'; // cinetic:brand-supplied Caustica checkout
const ease=E.snapOut;
const mix=(f:number,a:number,b:number)=>interpolate(f,[0,45],[a,b],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:ease});
type Crop={x:number;y:number;s:number};
type Shot={from:number;to:number;media?:string;trim?:number;crop?:Crop;target?:Crop;kind?:'intro'|'contract'|'diagram'|'claim'|'end';record?:string;seam?:SeamRecipe};
const full={x:800,y:480,s:.94};
const summary={x:1100,y:550,s:1.38};
const history={x:810,y:735,s:1.20};
const shots:Shot[]=[
 {from:0,to:3,kind:'intro',media:'healthy',trim:3.1,crop:summary,target:summary},
 {from:3,to:10,media:'healthy',trim:2.3,crop:full,target:summary,seam:'matchCut'},
 {from:10,to:18,kind:'contract',media:'healthy',trim:8,crop:summary,target:summary,seam:'sharedElement'},
 {from:18,to:28,record:'frozen',seam:'blurThrough'},
 {from:28,to:34,kind:'diagram',seam:'sharedElement'},
 {from:34,to:40,record:'build',seam:'matchCut'},
 {from:40,to:46,media:'healthy',trim:2.7,crop:full,target:summary,seam:'blurThrough'},
 {from:46,to:51,media:'healthy',trim:8.4,crop:summary,target:summary,seam:'matchCut'},
 {from:51,to:57,media:'healthy',trim:12.5,crop:summary,target:{x:1080,y:680,s:1.36},seam:'sharedElement'},
 {from:57,to:63,media:'healthy',trim:17.8,crop:full,target:history,seam:'matchCut'},
 {from:63,to:69,media:'healthy',trim:23.2,crop:history,target:history,seam:'blurThrough'},
 {from:69,to:75,record:'baseline',seam:'sharedElement'},
 {from:75,to:84,media:'control',trim:1.2,crop:full,target:summary,seam:'blurThrough'},
 {from:84,to:91,media:'control',trim:10.2,crop:summary,target:summary,seam:'matchCut'},
 {from:91,to:100,record:'assertion',seam:'sharedElement'},
 {from:100,to:108,record:'probe',seam:'blurThrough'},
 {from:108,to:118,media:'regression',trim:3,crop:full,target:summary,seam:'matchCut'},
 {from:118,to:126,record:'bundle',seam:'sharedElement'},
 {from:126,to:133,record:'transcript',trim:0,seam:'blurThrough'},
 {from:133,to:141,record:'transcript',trim:7,seam:'matchCut'},
 {from:141,to:151,record:'diff',seam:'sharedElement'},
 {from:151,to:158,record:'proposal',seam:'blurThrough'},
 {from:158,to:166,record:'candidate',seam:'matchCut'},
 {from:166,to:178,media:'candidate',trim:3,crop:full,target:summary,seam:'blurThrough'},
 {from:178,to:185,media:'candidate',trim:23,crop:history,target:history,seam:'sharedElement'},
 {from:185,to:195,record:'verified',seam:'matchCut'},
 {from:195,to:208,record:'contract-rejection',seam:'blurThrough'},
 {from:208,to:222,record:'build-rejection',seam:'sharedElement'},
 {from:222,to:230,record:'commands',seam:'matchCut'},
 {from:230,to:234,kind:'claim',seam:'blurThrough'},
 {from:234,to:240,kind:'end',seam:'sharedElement'}
];
function World(){const f=useCurrentFrame(); // lint-ok: continuous ambient key light movement across the supplied forest stage
return <AbsoluteFill style={{background:forest,overflow:'hidden'}}><Img src={staticFile('assets/forest-stage.png')} style={{position:'absolute',left:0,top:0,width:2200,height:1400,transform:`translate(${interpolate(f,[0,7200],[-170,-50],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:E.strongInOut})}px,-100px)`}}/></AbsoluteFill>;}
function Sheet({close=false}:{close?:boolean}){const f=useCurrentFrame();return <div style={{width:close?1160:760,minHeight:close?400:420,padding:'58px 70px',boxSizing:'border-box',background:paper,backgroundImage:`url(${staticFile('assets/paper-light.png')})`,backgroundSize:'cover',border:'1px solid rgba(255,255,255,.55)',boxShadow:'0 30px 80px rgba(0,0,0,.30)',borderRadius:14,color:ink,textAlign:'center',transform:`scale(${close?mix(f,1,1.02):1})`}}>{close?<div style={{fontSize:170,letterSpacing:-9,fontWeight:600,lineHeight:1.1}}>Caustica</div>:<><div style={{fontSize:38,fontWeight:500,marginBottom:24}}>SAVE10 · Quantity 1</div><div style={{fontSize:168,letterSpacing:-8,fontWeight:600,lineHeight:1}}>$90.00</div><div style={{fontSize:36,marginTop:30}}>Caustica Field Notes</div></>}</div>;}
function Diagram(){const f=useCurrentFrame();return <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',gap:48,color:paper}}><div style={{width:470,textAlign:'center',fontSize:36,lineHeight:1.7,opacity:mix(f,0,1)}}>Contract<br/>Execution context<br/>Harness<div style={{height:1,background:paper,marginTop:22}}/><div style={{fontSize:36,marginTop:20}}>Frozen inputs</div></div><div style={{scale:String(mix(f,.96,1))}}><Sheet/></div><div style={{width:390,fontSize:36,textAlign:'center',lineHeight:1.65,opacity:mix(f,0,1)}}>Declared app files<br/>Served snapshot<br/>Real Chrome assertions</div></div>;}
function Picture({s}:{s:Shot}){const global=useCurrentFrame();const local=global-s.from*30;const files=(proof as unknown as {media:Record<string,string>;records:Record<string,string>});const src=s.record?files.records[s.record]:files.media[s.media||''];const current=s.crop||full,target=s.target||current;const x=mix(local,current.x,target.x),y=mix(local,current.y,target.y),scale=mix(local,current.s,target.s);
 return <div style={{position:'absolute',left:210,top:90,width:1500,height:900,overflow:'hidden',borderRadius:16,boxShadow:'0 30px 90px rgba(0,0,0,.34)',border:'1px solid rgba(255,255,255,.50)',background:paper}}>{src?<div style={{position:'absolute',left:0,top:0,width:1600,height:960,transform:`translate(${750-x*scale}px,${450-y*scale}px) scale(${scale})`,transformOrigin:'0 0'}}><Sequence from={s.from*30} durationInFrames={(s.to-s.from)*30} layout="none"><OffthreadVideo src={staticFile('media/'+src)} startFrom={Math.round((s.trim||0)*30)} muted style={{width:1600,height:960}}/></Sequence></div>:<div style={{position:'absolute',inset:0,display:'flex',justifyContent:'center',alignItems:'center',fontSize:64,fontWeight:500}}>Live proof pending</div>}</div>;
}
function ShotContent({s}:{s:Shot}){const f=useCurrentFrame()-s.from*30;if(s.kind==='diagram')return <Diagram/>;if(s.kind==='end')return <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}><Sequence from={s.from*30} layout="none"><Sheet close/></Sequence></div>;if(s.kind==='claim')return <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',color:paper,fontSize:112,fontWeight:500,lineHeight:1.12,letterSpacing:-4,textAlign:'center',padding:'0 280px'}}>{proof.complete?'Verified for this\ncontract and control':'Live proof pending'}</div>;return <><Picture s={s}/>{s.kind==='intro'&&<><AbsoluteFill style={{background:forest,opacity:.86}}/><div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',color:paper,fontSize:112,fontWeight:500,letterSpacing:-4,textAlign:'center',padding:'0 300px',opacity:mix(f,0,1),transform:`translateY(${mix(f,16,0)}px)`}}>Caustica verifies app repairs</div></>}{s.kind==='contract'&&<><AbsoluteFill style={{background:forest,opacity:.75}}/><div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',transform:`scale(${mix(f,.94,1)})`}}><Sheet/></div></>}</>;}
export function CausticaDemo(){const f=useCurrentFrame();const {fps}=useVideoConfig();const active=shots.findIndex(s=>f>=s.from*fps&&f<s.to*fps);const s=shots[Math.max(0,active)];const incoming=s.seam?seamState(f,{recipe:s.seam,at:s.from*fps,peak:48,dim:.68},{fps,width:1920,height:1080}).in:{x:0,y:0,scale:1,opacity:1,blur:0};const next=shots[active+1];const outgoing=next?.seam?seamState(f,{recipe:next.seam,at:next.from*fps,peak:48,dim:.68},{fps,width:1920,height:1080}).out:{x:0,y:0,scale:1,opacity:1,blur:0};const k=f<s.from*fps+18?incoming:outgoing;
 return <AbsoluteFill style={{fontFamily:'"Inter Variable",sans-serif'}}><World/><AbsoluteFill style={{transform:`translate(${k.x}px,${k.y}px) scale(${k.scale})`,transformOrigin:'50% 50%',opacity:k.opacity,filter:k.blur?`blur(${k.blur}px)`:undefined}}><ShotContent s={s}/></AbsoluteFill><Audio src={staticFile('audio/final-mix.wav')}/></AbsoluteFill>;
}
export const Poster=()=> <AbsoluteFill style={{background:forest,fontFamily:'"Inter Variable",sans-serif',display:'flex',alignItems:'center',justifyContent:'center'}}><Sheet close/></AbsoluteFill>;
