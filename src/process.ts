import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {atomicJson} from './util.js';
export interface ProcessResult{exitCode:number|null;signal:string|null;timedOut:boolean;spawnError?:string;durationMs:number;stdoutPath:string;stderrPath:string;}
export async function boundedProcess(executable:string,args:string[],options:{cwd:string;directory:string;timeoutMs:number;input?:string;env?:NodeJS.ProcessEnv;onStart?:(pid:number)=>Promise<void>}):Promise<ProcessResult>{
  await mkdir(options.directory,{recursive:true});const stdoutPath=join(options.directory,'stdout.ndjson'),stderrPath=join(options.directory,'stderr.log');const out=createWriteStream(stdoutPath,{mode:0o600}),err=createWriteStream(stderrPath,{mode:0o600});
  const started=Date.now();const child=spawn(executable,args,{cwd:options.cwd,env:options.env??process.env,stdio:['pipe','pipe','pipe'],detached:process.platform!=='win32'});let timedOut=false,spawnError:string|undefined;
  child.stdout.pipe(out);child.stderr.pipe(err);
  const completed=new Promise<{code:number|null;signal:string|null}>(resolve=>{child.on('error',e=>{spawnError=e.message;});child.on('close',(code,signal)=>resolve({code,signal}));});
  await atomicJson(join(options.directory,'process.json'),{pid:child.pid??null,executable,args,startedAt:new Date(started).toISOString(),cwd:options.cwd});
  if(child.pid&&options.onStart)await options.onStart(child.pid);
  child.stdin.on('error',()=>{});child.stdin.end(options.input??'');
  function stop(signal:NodeJS.Signals){try{if(child.pid&&process.platform!=='win32')process.kill(-child.pid,signal);else child.kill(signal);}catch{}}
  let force:ReturnType<typeof setTimeout>|undefined;const timer=setTimeout(()=>{timedOut=true;stop('SIGTERM');force=setTimeout(()=>stop('SIGKILL'),3000);},options.timeoutMs);
  const onInterrupt=()=>{timedOut=true;stop('SIGTERM');};process.once('SIGINT',onInterrupt);process.once('SIGTERM',onInterrupt);
  const result=await completed;clearTimeout(timer);if(force)clearTimeout(force);process.removeListener('SIGINT',onInterrupt);process.removeListener('SIGTERM',onInterrupt);
  await Promise.all([new Promise<void>(r=>out.writableFinished?r():out.on('finish',r)),new Promise<void>(r=>err.writableFinished?r():err.on('finish',r))]);
  const record={exitCode:result.code,signal:result.signal,timedOut,...(spawnError?{spawnError}:{}),durationMs:Date.now()-started,stdoutPath,stderrPath};await atomicJson(join(options.directory,'process-result.json'),record);return record;
}
