import {writeFileSync} from 'node:fs';
import {E} from '../src/lib/anim';
import {seamState,type SeamRecipe} from '../src/fx/Seam';
import shots from '../src/demo-shots.json';
const context={fps:30,width:1920,height:1080};
const frames=Array.from({length:7200},(_,f)=>{
 const index=shots.findIndex(s=>f>=s.from*30&&f<s.to*30),s=shots[index],local=f-s.from*30;
 const a=('crop'in s&&s.crop)||{x:800,y:480,s:.94},b=('target'in s&&s.target)||a,t=E.snapOut(Math.min(1,local/45));
 const incoming='seam'in s?seamState(f,{recipe:s.seam as SeamRecipe,at:s.from*30,peak:48,dim:.68},context).in:{scale:1,opacity:1,blur:0,x:0,y:0};
 const next=shots[index+1],outgoing=next&&'seam'in next?seamState(f,{recipe:next.seam as SeamRecipe,at:next.from*30,peak:48,dim:.68},context).out:{scale:1,opacity:1,blur:0,x:0,y:0};
 return {shot:index,local,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,scale:a.s+(b.s-a.s)*t,seam:local<18?incoming:outgoing,backgroundX:170-120*E.strongInOut(f/7200),land:t};
});
writeFileSync('qa/hybrid-motion.json',JSON.stringify({fps:30,width:1920,height:1080,frames}));
console.log('7200 authored motion states exported');
