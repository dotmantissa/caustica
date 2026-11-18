import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Project} from './config.js';
import type {ProcessResult} from './process.js';
import {boundedProcess} from './process.js';
import {kaneExecutable,runtimeEnv} from './toolchain.js';
import {atomicJson,sha256,safeFile} from './util.js';
import type {RunStore} from './run-store.js';
export interface KaneStream{ok:boolean;reason?:string;terminal?:Record<string,any>;events:Record<string,any>[];}
export function parseStream(text:string,process:Pick<ProcessResult,'exitCode'|'timedOut'|'signal'|'spawnError'>):KaneStream{
 const bad=(reason:string,events:Record<string,any>[]=[]):KaneStream=>({ok:false,reason,events});
 if(process.timedOut||process.signal||process.spawnError)return bad('Kane execution interrupted or failed to start');
 const events:Record<string,any>[]=[];
 for(const line of text.split('\n').filter(l=>l.trim())){try{const e=JSON.parse(line);if(!e||typeof e!=='object'||Array.isArray(e))return bad('Unsupported terminal stream',events);events.push(e);}catch{return bad('Truncated or malformed terminal stream',events);}}
 const starts=events.filter(e=>e.type==='stream_start'),ends=events.filter(e=>e.type==='run_end');
 if(starts.length!==1||starts[0].cli_version!=='0.10.6'||starts[0].v!==1)return bad('Unsupported Kane stream version',events);
 if(ends.length!==1)return bad('Missing or conflicting terminal run_end events',events);
 const terminal=ends[0];if(!['passed','failed'].includes(terminal.status))return bad('Unsupported Kane terminal status',events);
 if(events.at(-1)!==terminal)return bad('Events continue after terminal run_end',events);
 if(events.some(e=>e.type==='error'))return bad('Kane reported an execution or upload error',events);
 if(process.exitCode!==(terminal.status==='passed'?0:1))return bad('Kane exit status disagrees with terminal evidence',events);
 return {ok:true,terminal,events};
}
export async function runKane(project:Project,store:RunStore,url:string){
 const work=store.path('work');await mkdir(work,{recursive:true});
 const context=join(work,'context.md');await writeFile(context,project.context,{mode:0o600});
 const variables={app_url:{value:url,secret:false}};await atomicJson(join(work,'variables.json'),variables);
 const args=[kaneExecutable(project.root),'run',project.contract.objective,'--agent','--headless','--timeout',String(project.config.runtime.timeoutSeconds),'--max-steps',String(project.config.runtime.maxSteps),'--url',url,'--target','desktop','--mode','testing','--assertion-mode','dom','--bug-detection','off','--final-validation','on','--assertion-failure-mode','stop','--name',store.id.replaceAll('-','_'),'--chrome-profile',store.path('browser-profile'),'--global-context',context,'--local-context',context,'--variables-file',join(work,'variables.json')];
 await atomicJson(store.path('kane-inputs.json'),{objective:project.contract.objective,resolvedObjectiveDigest:sha256(project.contract.objective.replaceAll('{{app_url}}',url)),contextDigest:sha256(project.context),variables,arguments:args});
 await store.stage('kane-running',{executable:process.execPath});
 const processResult=await boundedProcess(process.execPath,args,{cwd:work,directory:store.path('kane'),env:await runtimeEnv(project.root),timeoutMs:(project.config.runtime.timeoutSeconds+90)*1000,onStart:async pid=>store.stage('kane-running',{pid})});
 const stream=parseStream(await readFile(processResult.stdoutPath,'utf8'),processResult);
 let pack:string|undefined;
 try{
  const directory=join(work,'.testmuai/evidence');const packs=(await readdir(directory)).filter(n=>n.endsWith('.evidence'));
  if(packs.length===1){const source=await safeFile(directory,packs[0]);pack=store.path('kane/original.evidence');await copyFile(source,pack);}
 }catch(e:any){if(e.code!=='ENOENT')throw e;}
 let validated=false;
 if(pack){const result=await boundedProcess(process.execPath,[kaneExecutable(project.root),'evidence','validate',pack,'--profile','L1','--json'],{cwd:work,directory:store.path('kane/validation'),env:await runtimeEnv(project.root),timeoutMs:60000});validated=result.exitCode===0&&!result.timedOut;}
 await store.stage('evidence-recorded',{hasPack:!!pack,validated,streamOk:stream.ok});
 return {processResult,stream,pack,validated};
}
