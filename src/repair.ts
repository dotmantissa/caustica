import {readFile,writeFile,mkdir,copyFile,chmod,readdir,lstat} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import type {Project} from './config.js';
import {loadProject} from './config.js';
import {readFrozen,manifest,manifestDigest} from './snapshot.js';
import {boundedProcess} from './process.js';
import {RunStore} from './run-store.js';
import {atomicJson,sha256,safeFile} from './util.js';
import {readRecordedRun,runDirectory,verify,artifactIndex} from './verify.js';
import type {Receipt} from './records.js';
const exec=promisify(execFile);
export async function workspaceManifest(root:string):Promise<Map<string,string>>{
 const found=new Map<string,string>();
 async function walk(relative=''){
  for(const name of (await readdir(join(root,relative))).sort()){
   const path=relative?relative+'/'+name:name,absolute=join(root,path),stat=await lstat(absolute);
   if(stat.isSymbolicLink())throw new Error('Repair workspace contains a symlink: '+path);
   if(stat.isDirectory())await walk(path);else if(stat.isFile())found.set(path,sha256(await readFile(absolute)));else throw new Error('Unsupported repair workspace entry: '+path);
  }
 }
 await walk();return found;
}
export function checkProposal(before:Map<string,string>,after:Map<string,string>,allowed:string[]){
 const changed=[...new Set([...before.keys(),...after.keys()])].filter(p=>before.get(p)!==after.get(p));
 const forbidden=changed.filter(p=>!allowed.includes(p));
 const removed=allowed.filter(p=>!after.has(p));
 return {accepted:changed.length>0&&forbidden.length===0&&removed.length===0,changed,forbidden,removed};
}
export interface RepairResult{version:1;runId:string;failure:string;verdict:'verified'|'requirement-failed'|'evidence-rejected'|'inconclusive';reason:string;candidate?:string;changed?:string[];verification?:string;diff?:string;artifacts?:{path:string;sha256:string}[];}
export async function repair(project:Project,failureId:string):Promise<RepairResult>{
 const frozen=await readFrozen(project),failure=await readRecordedRun(project,failureId),store=await RunStore.create(project.root,'repair'),started=Date.now();
 const result=(verdict:RepairResult['verdict'],reason:string,extra:Partial<RepairResult>={}):RepairResult=>({version:1,runId:store.id,failure:failureId,verdict,reason,...extra});
 if(!failure.artifactsValid||!failure.identityValid||failure.boundaryDigest!==frozen.boundaryDigest||failure.globalVariablesDigest!==frozen.globalVariablesDigest||failure.control!=='none'){const r=result('evidence-rejected','Repair requires unchanged, authentic application-source failure evidence with the independent fault disabled');await store.final(r);return r;}
 if(failure.outcome.kind!=='assertion-failed'){const r=result('inconclusive','No supported acceptance assertion failure to send to Codex');await store.final(r);return r;}
 const workspace=store.path('workspace'),baseline=store.path('baseline');
 const source=join(runDirectory(project,failureId),'snapshot');
 for(const path of [...project.config.appFiles,...project.config.boundaryFiles]){
  for(const root of [workspace,baseline]){const target=join(root,path);await mkdir(dirname(target),{recursive:true});await copyFile(await safeFile(source,path),target);await chmod(target,project.config.appFiles.includes(path)?0o644:0o444);}
 }
 for(const path of [project.config.contract,project.config.context]){const target=join(workspace,path);await mkdir(dirname(target),{recursive:true});await copyFile(await safeFile(project.root,path),target);await chmod(target,0o444);}
 const bundle=join(workspace,'repair-input');await mkdir(bundle,{recursive:true});
 await atomicJson(join(bundle,'failure.json'),failure.outcome);await atomicJson(join(bundle,'frozen.json'),frozen);
 if(failure.outcome.screenshot)await copyFile(await safeFile(runDirectory(project,failureId),failure.outcome.screenshot),join(bundle,failure.outcome.screenshot));
 const before=await workspaceManifest(workspace);await atomicJson(store.path('proposal-baseline.json'),Object.fromEntries(before));
 const prompt=`Repair this owned checkout application using the actual Kane failure in repair-input/failure.json and its screenshot. Requirements are frozen in contracts/checkout.json and repair-input/frozen.json. The independent response-layer fault was DISABLED for this source regression. Do not change any expected amount.\n\nYou may edit ONLY these existing files:\n${project.config.appFiles.map(p=>'- '+p).join('\n')}\n\nSAVE10 must visibly produce total9000 cents from subtotal10000 cents; placing the order must persist product, coupon and total, and history must survive reload. Read the actual source and make a minimal real repair. Do not replace the contract, control, server, input bundle, verifier or evidence. Do not add files, delete manifest files, initialize Git, commit, write task notes, or use additional agents. The parent project owns the canonical ignored TASKS.md. The adapter rejects any changes outside the manifest and runs fresh positive/control checks.\n\nThe workspace is ${workspace}. Do not access /home/dotmantissa/lab or any content within it, including through symlinks. Work entirely within this workspace. Use ${process.execPath} for a focused source check if needed. Do not run Kane yourself. Describe the changed source and validation in your final message.\n`;
 await writeFile(store.path('prompt.txt'),prompt,{mode:0o600});await store.stage('repair-running',{workspace,adapter:'codex-exec',failure:failureId});
 const processResult=await boundedProcess('codex',['exec','--json','--ephemeral','--sandbox','workspace-write','--cd',workspace,'--skip-git-repo-check','-c','approval_policy="never"','-c','features.multi_agent=false','-'],{cwd:workspace,directory:store.path('codex'),timeoutMs:600000,input:prompt,onStart:async pid=>store.stage('repair-running',{pid,workspace})});
 let proposal:ReturnType<typeof checkProposal>;
 try{proposal=checkProposal(before,await workspaceManifest(workspace),project.config.appFiles);}catch(e:any){const r=result('evidence-rejected',e.message);await store.final(r);return r;}
 await atomicJson(store.path('proposal-check.json'),proposal);
 const events=[];for(const line of (await readFile(processResult.stdoutPath,'utf8')).split('\n').filter(l=>l.trim())){try{events.push(JSON.parse(line));}catch{}}
 if(processResult.timedOut||processResult.exitCode!==0||!events.some(e=>e.type==='turn.completed')||events.some(e=>['turn.failed','error'].includes(e.type))){const r=result('inconclusive','Codex repair did not complete successfully; transcript retained',{changed:proposal.changed});await store.final(r);return r;}
 if(!proposal.accepted){const r=result(proposal.forbidden.length||proposal.removed.length?'evidence-rejected':'inconclusive',proposal.changed.length?'Repair changed files outside the allowed application manifest or removed required inputs':'Codex produced no application diff',{changed:proposal.changed});await store.final(r);return r;}
 const current=await loadProject(project.configPath);if(current.boundaryDigest!==frozen.boundaryDigest||current.globalVariablesDigest!==frozen.globalVariablesDigest){const r=result('evidence-rejected','Frozen inputs changed during repair');await store.final(r);return r;}
 let diff='';for(const path of proposal.changed){try{diff+=(await exec('git',['diff','--no-index','--',join(baseline,path),join(workspace,path)],{maxBuffer:1024*1024})).stdout;}catch(e:any){if(e.code!==1)throw e;diff+=e.stdout;}}
 await writeFile(store.path('proposal.diff'),diff,{mode:0o600});await store.stage('proposal-accepted',{changed:proposal.changed});
 // Isolate the exact checked proposal before Kane: no child process can mutate
 // what the positive/control verification receives after proposal approval.
 const candidate=store.path('candidate');for(const path of project.config.appFiles){const target=join(candidate,path);await mkdir(dirname(target),{recursive:true});await copyFile(await safeFile(workspace,path),target);await chmod(target,0o444);}
 const verification=await verify(project,candidate);
 const artifacts=await artifactIndex(store.directory,['prompt.txt','proposal-baseline.json','proposal-check.json','proposal.diff','codex/stdout.ndjson','codex/stderr.log','codex/process.json','codex/process-result.json',...project.config.appFiles.map(p=>'candidate/'+p)]);
 const r=result(verification.verdict,verification.reason,{candidate,changed:proposal.changed,verification:verification.runId,diff:'proposal.diff',artifacts});await store.final(r);return r;
}
