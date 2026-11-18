import {readFile,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {loadProject,type Project} from './config.js';
import {snapshot,manifest,manifestDigest,readFrozen,type Frozen} from './snapshot.js';
import {RunStore} from './run-store.js';
import {launchFixture,checkIdentity,probeControl,type Control} from './fixture.js';
import {runKane,parseStream} from './kane.js';
import {normalizeEvidence,normalizePack,unpack} from './evidence.js';
import {approve,type Decision} from './approval.js';
import {RunRecordSchema,ReceiptSchema,type RunRecord,type Receipt,type Outcome} from './records.js';
import {safeFile,safeRelative,readJson,atomicJson,sha256,canonical} from './util.js';
import {doctor} from './toolchain.js';
export async function artifactIndex(directory:string,paths:string[]){
 const artifacts=[];for(const path of paths){try{const file=await safeFile(directory,path);artifacts.push({path,sha256:sha256(await readFile(file))});}catch(e:any){if(e.code!=='ENOENT')throw e;}}return artifacts;
}
export async function checkArtifacts(directory:string,artifacts:{path:string;sha256:string}[]){
 if(new Set(artifacts.map(a=>a.path)).size!==artifacts.length)return false;
 for(const a of artifacts){try{if(sha256(await readFile(await safeFile(directory,a.path)))!==a.sha256)return false;}catch{return false;}}return true;
}
export function runDirectory(project:Project,id:string){if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('Invalid run ID');return join(project.root,'.caustica/runs',id);}
export async function executeRun(project:Project,frozen:Frozen,sourceRoot=project.root,control:Control='none'):Promise<RunRecord>{
 const store=await RunStore.create(project.root,control==='none'?'checkout':'control'),start=Date.now();
 await atomicJson(store.path('frozen-inputs.json'),frozen);await store.stage('frozen',{frozenId:frozen.id});
 const s=await snapshot(project,store.path('snapshot'),sourceRoot);await store.stage('snapshot-ready',{appDigest:s.appDigest});
 let identityValid=false,artifactsValid=true,controlEffective:boolean|undefined;
 let outcome:Outcome={kind:'inconclusive',reason:'Browser execution has not completed'};
 const tools=await doctor(project.root);
 try{
  const fixture=await launchFixture(project,s,store.directory,control);await store.stage('server-ready',{url:fixture.url,instance:fixture.instance,pid:fixture.child.pid});
  try{
   await atomicJson(store.path('identity-before.json'),await checkIdentity(fixture));
   if(control==='ignore-discount'){const probe=await probeControl(fixture);controlEffective=probe.effective;await atomicJson(store.path('control-probe.json'),probe);}
   const kane=await runKane(project,store,fixture.url);
   outcome=await normalizeEvidence(kane.pack,kane.validated,kane.stream,fixture.url,store.directory);
   await atomicJson(store.path('identity-after.json'),await checkIdentity(fixture));
   identityValid=true;
   const current=await loadProject(project.configPath);const sourceAfter=manifestDigest(await manifest(sourceRoot,project.config.appFiles));
   if(current.boundaryDigest!==frozen.boundaryDigest||current.globalVariablesDigest!==frozen.globalVariablesDigest||sourceAfter!==s.appDigest)identityValid=false;
   const orders=await fetch(fixture.url+'/api/orders',{signal:AbortSignal.timeout(5000)}).then(r=>r.json()) as any[];
   await atomicJson(store.path('orders-observed.json'),orders);
   if(outcome.kind==='passed'&&!orders.some(o=>String(o.id)===(outcome.terminal?.final_state as any)?.order_id&&o.product==='Caustica Field Notes'&&o.coupon==='SAVE10'&&o.totalCents===9000))outcome={...outcome,kind:'inconclusive',reason:'Persisted server order does not corroborate browser evidence'};
  }finally{await fixture.stop();}
 }catch(e:any){outcome={kind:'inconclusive',reason:e.message};}
 await atomicJson(store.path('evidence-normalized.json'),outcome);await store.stage('classified',{outcome:outcome.kind,identityValid});
 const artifacts=await artifactIndex(store.directory,['frozen-inputs.json','snapshot/snapshot-manifest.json',...s.appManifest.map(e=>'snapshot/'+e.path),...s.boundaryManifest.map(e=>'snapshot/'+e.path),'launch.json','server-process.json','identity-before.json','identity-after.json','kane-inputs.json','work/context.md','work/variables.json','kane/stdout.ndjson','kane/stderr.log','kane/process.json','kane/process-result.json','kane/original.evidence','kane/validation/stdout.ndjson','kane/validation/process-result.json','control-probe.json','orders-observed.json','evidence-normalized.json',...(outcome.screenshot?[outcome.screenshot]:[])]);
 const record:RunRecord={version:1,runId:store.id,createdAt:new Date(start).toISOString(),frozenId:frozen.id,boundaryDigest:frozen.boundaryDigest,globalVariablesDigest:frozen.globalVariablesDigest,appDigest:s.appDigest,sourceRoot:resolve(sourceRoot),control,identityValid,artifactsValid,...(controlEffective!==undefined?{controlEffective}:{}),outcome,tools,artifacts,durationMs:Date.now()-start};
 await atomicJson(store.path('run-record.json'),RunRecordSchema.parse(record));await store.stage('finished');return record;
}
export async function readRecordedRun(project:Project,id:string):Promise<RunRecord>{
 const directory=runDirectory(project,id),record=RunRecordSchema.parse(await readJson(join(directory,'run-record.json')));
 if(record.runId!==id)throw new Error('Run record identity mismatch');
 const required=['frozen-inputs.json','snapshot/snapshot-manifest.json','kane/stdout.ndjson','kane/process-result.json','evidence-normalized.json'];
 if(required.some(p=>!record.artifacts.some(a=>a.path===p))||!await checkArtifacts(directory,record.artifacts))return {...record,artifactsValid:false};
 if(record.outcome.kind!=='inconclusive'){
  try{
   const pack=await readFile(join(directory,'kane/original.evidence'));
   const process=await readJson(join(directory,'kane/process-result.json'));
   const stream=parseStream(await readFile(join(directory,'kane/stdout.ndjson'),'utf8'),process);
   const inputs=await readJson(join(directory,'kane-inputs.json'));
   const normalized=normalizePack(unpack(pack),stream,inputs.variables.app_url.value,sha256(pack));
   // The extracted screenshot gets a local basename at capture time.
   if(normalized.screenshot)normalized.screenshot='screenshot.'+(normalized.screenshot.endsWith('.png')?'png':'jpg');
   if(canonical(normalized)!==canonical(record.outcome))return {...record,artifactsValid:false};
   const validation=await readJson(join(directory,'kane/validation/process-result.json'));
   if(validation.exitCode!==0||validation.timedOut)return {...record,artifactsValid:false};
  }catch{return {...record,artifactsValid:false};}
 }
 return record;
}
export async function verify(project:Project,sourceRoot=project.root):Promise<Receipt>{
 const frozen=await readFrozen(project),store=await RunStore.create(project.root,'verify');await store.stage('verification-started',{frozenId:frozen.id,sourceRoot});
 const healthy=await executeRun(project,frozen,sourceRoot);await store.stage('healthy-recorded',{healthy:healthy.runId});
 const control=healthy.outcome.kind==='passed'&&healthy.identityValid?await executeRun(project,frozen,sourceRoot,'ignore-discount'):undefined;
 const expected={boundaryDigest:project.boundaryDigest,globalVariablesDigest:project.globalVariablesDigest,appDigest:manifestDigest(await manifest(sourceRoot,project.config.appFiles))};
 const decision=approve(healthy,control,expected);
 const receipt:Receipt={version:1,kind:'verification',runId:store.id,createdAt:new Date().toISOString(),frozenId:frozen.id,...expected,sourceRoot:resolve(sourceRoot),...decision,healthy:healthy.runId,...(control?{control:control.runId}:{}),artifacts:[]};
 for(const r of [healthy,control].filter((r):r is RunRecord=>!!r))receipt.artifacts.push({path:r.runId+'/run-record.json',sha256:sha256(await readFile(join(runDirectory(project,r.runId),'run-record.json')))});
 await store.final(ReceiptSchema.parse(receipt));return receipt;
}
export async function inspect(receiptPath:string,configPath='caustica.config.json',sourceRoot?:string):Promise<Decision>{
 try{
  const receipt=ReceiptSchema.parse(await readJson(resolve(receiptPath))),project=await loadProject(configPath),frozen=await readFrozen(project);
  const expected={boundaryDigest:project.boundaryDigest,globalVariablesDigest:project.globalVariablesDigest,appDigest:manifestDigest(await manifest(sourceRoot??project.root,project.config.appFiles))};
  if(receipt.boundaryDigest!==expected.boundaryDigest||receipt.frozenId!==frozen.id||receipt.globalVariablesDigest!==expected.globalVariablesDigest)return {verdict:'evidence-rejected',reason:'Receipt belongs to changed frozen requirements or execution inputs'};
  if(receipt.appDigest!==expected.appDigest)return {verdict:'evidence-rejected',reason:'Receipt belongs to different application bytes'};
  const linked=[receipt.healthy,...(receipt.control?[receipt.control]:[])];
  if(receipt.artifacts.length!==linked.length||linked.some(id=>!receipt.artifacts.some(a=>a.path===id+'/run-record.json'))||!await checkArtifacts(join(project.root,'.caustica/runs'),receipt.artifacts))return {verdict:'evidence-rejected',reason:'Linked run records changed or are missing'};
  const healthy=await readRecordedRun(project,receipt.healthy),control=receipt.control?await readRecordedRun(project,receipt.control):undefined;
  const decision=approve(healthy,control,expected);
  if(decision.verdict!==receipt.verdict)return {verdict:'evidence-rejected',reason:'Receipt verdict disagrees with recorded evidence'};return decision;
 }catch(e:any){return {verdict:'evidence-rejected',reason:e.message};}
}
