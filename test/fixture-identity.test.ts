import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,chmod,rm,symlink} from 'node:fs/promises';import {join,resolve} from 'node:path';
import {loadProject} from '../src/config.js';import {snapshot} from '../src/snapshot.js';import {launchFixture,checkIdentity,probeControl} from '../src/fixture.js';
import {safeFile} from '../src/util.js';
test('served snapshot stays isolated and changes to loaded assets are rejected',async()=>{
 const project=await loadProject();await mkdir('.caustica/tests',{recursive:true});const dir=await mkdtemp(resolve('.caustica/tests/identity-'));
 try{const s=await snapshot(project,join(dir,'snapshot'));const f=await launchFixture(project,s,dir);
  try{await checkIdentity(f);const path=join(s.root,'apps/checkout/public/app.mjs');await chmod(path,0o644);await writeFile(path,'// changed after startup');await assert.rejects(checkIdentity(f),/identity mismatch/);}finally{await f.stop();}
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('fault applies independently to quote and persisted orders',async()=>{
 const project=await loadProject();await mkdir('.caustica/tests',{recursive:true});const dir=await mkdtemp(resolve('.caustica/tests/control-'));
 try{const s=await snapshot(project,join(dir,'snapshot'));const f=await launchFixture(project,s,dir,'ignore-discount');
  try{await checkIdentity(f);assert.equal((await probeControl(f)).effective,true);const order=await fetch(f.url+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({quantity:1,coupon:'SAVE10'})}).then(r=>r.json()) as any;assert.equal(order.totalCents,10000);const history=await fetch(f.url+'/api/orders').then(r=>r.json()) as any[];assert.equal(history[0].id,order.id);assert.equal(history[0].coupon,'SAVE10');}finally{await f.stop();}
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('input symlinks reject without following their targets',async()=>{await mkdir('.caustica/tests',{recursive:true});const dir=await mkdtemp(resolve('.caustica/tests/symlink-'));try{await writeFile(join(dir,'source'),'ok');await symlink('source',join(dir,'alias'));await assert.rejects(safeFile(dir,'alias'),/Symlink/);await assert.rejects(safeFile(dir,'../source'),/Unsafe/);}finally{await rm(dir,{recursive:true,force:true});}});
