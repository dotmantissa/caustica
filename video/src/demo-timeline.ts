export const FPS=30,W=1920,H=1080,TOTAL=7200,BPM=124,PACE_NAME='calm';
export const LOOK={blur:'crisp',texture:'clean',filmType:'explainer',whiteWorld:false,oneTake:false};
export const ACT={problem:{from:0,dur:540},freeze:{from:540,dur:660},healthy:{from:1200,dur:1050},control:{from:2250,dur:990},regression:{from:3240,dur:750},repair:{from:3990,dur:990},candidate:{from:4980,dur:870},reuse:{from:5850,dur:810},outcome:{from:6660,dur:360},end:{from:7020,dur:180}};
export const CUE={intro:15,freeze:540,coupon:1380,order:1590,reload:1890,control:2250,assertion:2730,bundle:3540,diff:4230,candidate:4980,contractRejection:5850,buildRejection:6240,outcome:6660,lockup:7095};
export const COPY=[{id:'promise',text:'Caustica verifies app repairs',in:0,resolved:15,out:90,kind:'copy' as const,words:4},{id:'claim',text:'Verified for this contract and control',in:6900,resolved:6918,out:7020,kind:'copy' as const,words:7},{id:'close',text:'Caustica',in:7020,resolved:7095,out:7200,kind:'copy' as const,words:1}];
export const END={from:7020,to:7200,mark:7095};
export const REVEAL=4980;
export const SEAMS=[540,840,1020,1200,1380,1530,1710,1890,2070,2250,2520,2730,3000,3240,3540,3780,3990,4230,4530,4740,4980,5340,5550,5850,6240,6660,6900,7020].map((at,i)=>({at,kind:(['defocus','mask','snapZoom'] as const)[i%3],carry:'scale' as const,id:['blurThrough','sharedElement','matchCut'][i%3]+':scene-'+i}));
