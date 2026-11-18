import {spawn,type ChildProcess} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Project} from './config.js';
import {atomicJson,sha256,delay} from './util.js';
import type {Snapshot} from './snapshot.js';
export type Control='none'|'ignore-discount';
export interface Fixture{url:string;instance:string;child:ChildProcess;snapshot:Snapshot;control:Control;stop:()=>Promise<void>;}
export async function launchFixture(project:Project,s:Snapshot,directory:string,control:Control='none',port=0):Promise<Fixture>{
  await mkdir(directory,{recursive:true});const instance=randomUUID();const launch={snapshotRoot:s.root,instance,control,port,appFiles:project.config.appFiles,boundaryFiles:project.config.boundaryFiles,controlFile:project.config.control,database:join(directory,'data/orders.sqlite')};const path=join(directory,'launch.json');await atomicJson(path,launch);
  const child=spawn(process.execPath,[join(s.root,project.config.server)],{env:{...process.env,CAUSTICA_LAUNCH:path},stdio:['ignore','pipe','pipe']});let output='';const log=createWriteStream(join(directory,'server.log'),{mode:0o600});child.stdout!.on('data',chunk=>{output+=chunk;log.write(chunk)});child.stderr!.pipe(log,{end:false});
  let error='';child.on('error',e=>{error=e.message});const exited=new Promise<void>(r=>child.once('close',()=>{log.end();r()}));
  async function stop(){if(child.exitCode!==null||child.signalCode!==null)return;child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),3000);await exited;clearTimeout(timer);}
  await atomicJson(join(directory,'server-process.json'),{pid:child.pid,executable:process.execPath,instance,startedAt:new Date().toISOString(),launchPath:path});
  for(let n=0;n<100;n++){
    for(const line of output.split('\n')){try{const ready=JSON.parse(line);if(ready.type==='server_ready'&&ready.instance===instance)return {url:`http://127.0.0.1:${ready.port}`,instance,child,snapshot:s,control,stop};}catch{}}
    if(error||child.exitCode!==null){await stop();throw new Error('Fixture failed to start: '+(error||output));}await delay(50);
  }await stop();throw new Error('Fixture startup timed out');
}
export async function checkIdentity(f:Pick<Fixture,'url'|'instance'|'snapshot'|'control'>){
  const response=await fetch(f.url+'/__caustica/build',{signal:AbortSignal.timeout(5000)});if(!response.ok)throw new Error('Build endpoint unavailable');const build:any=await response.json();
  if(build.instance!==f.instance||build.control!==f.control||build.appDigest!==f.snapshot.appDigest||build.currentAppDigest!==f.snapshot.appDigest||build.boundaryDigest!==f.snapshot.boundaryDigest||build.currentBoundaryDigest!==f.snapshot.boundaryDigest)throw new Error('Served build identity mismatch');
  for(const entry of f.snapshot.appManifest.filter(e=>e.path.includes('/public/'))){const name=entry.path.split('/public/')[1];const r=await fetch(f.url+(name==='index.html'?'/':'/assets/'+name),{signal:AbortSignal.timeout(5000)});if(!r.ok||sha256(new Uint8Array(await r.arrayBuffer()))!==entry.sha256)throw new Error('Served asset mismatch: '+entry.path);}
  return build;
}
export async function probeControl(f:Fixture){const r=await fetch(f.url+'/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({quantity:1,coupon:'SAVE10'}),signal:AbortSignal.timeout(5000)});const q:any=await r.json();return {effective:r.ok&&q.subtotalCents===10000&&q.discountCents===0&&q.totalCents===10000,quote:q};}
