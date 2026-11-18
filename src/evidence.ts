import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {unzipSync,strFromU8} from 'fflate';
import {parse as yaml} from 'yaml';
import {sha256,safeRelative} from './util.js';
import type {KaneStream} from './kane.js';
import type {Outcome} from './records.js';
export type PackFiles=Record<string,Uint8Array>;
export function amount(value:unknown):number|undefined{
 if(typeof value!=='string'&&typeof value!=='number')return;
 const m=String(value).trim().match(/^\$?(\d+)(?:\.(\d{1,2}))?$/);if(!m)return;
 const cents=Number(m[1])*100+Number((m[2]??'').padEnd(2,'0'));return Number.isSafeInteger(cents)?cents:undefined;
}
export function unpack(bytes:Uint8Array):PackFiles{
 if(bytes.byteLength>128*1024*1024)throw new Error('Evidence pack exceeds supported size');
 let total=0;
 return unzipSync(bytes,{filter:file=>{safeRelative(file.name.replace(/\/$/,''));total+=file.originalSize;if(total>256*1024*1024||file.originalSize>64*1024*1024)throw new Error('Evidence entries exceed supported size');return true;}});
}
const text=(files:PackFiles,path:string)=>{if(!files[path])throw new Error('Missing evidence entry: '+path);return strFromU8(files[path]);};
export function normalizePack(files:PackFiles,stream:KaneStream,url:string,evidenceDigest:string):Outcome{
 const inconclusive=(reason:string):Outcome=>({kind:'inconclusive',reason,evidenceDigest});
 if(!stream.ok||!stream.terminal)return inconclusive(stream.reason??'Terminal evidence is incomplete');
 try{
  const run=yaml(text(files,'run.yaml'));
  const resultPaths=Object.keys(files).filter(p=>/^tests\/[^/]+\/result\.yaml$/.test(p));
  if(run.evidence!=='0.1'||run.status!=='finalized'||run.environment?.producer?.name!=='kane-cli'||run.environment?.producer?.version!=='0.10.6'||resultPaths.length!==1||run.totals?.tests!==1)return inconclusive('Unsupported sealed evidence schema');
  const base=dirname(resultPaths[0]);const result=yaml(text(files,resultPaths[0]));const terminal=stream.terminal;
  const recording=stream.events.find(e=>e.type==='recording_state');
  if(result.evidence!=='0.1'||result.status!==terminal.status||result.external_id?.execution_id!==run.run_id||result.external_id?.session_id!==recording?.session_id||!run.environment?.surfaces?.includes(url))return inconclusive('Pack and terminal execution identities disagree');
  const actions=text(files,base+'/logs/0-actions.ndjson').split('\n').filter(l=>l.trim()).map(l=>JSON.parse(l));
  const steps=Object.keys(files).filter(p=>p.startsWith(base+'/steps/')&&p.endsWith('/step.json')).map(path=>({path,meta:JSON.parse(text(files,path))}));
  const assertions=steps.filter(s=>s.meta.kind==='assert').map(s=>{
   const action=actions.find(a=>a.action_id===s.meta.action_id&&a.action_type==='assert');
   return {...s,action,tree:action?.action_params?.assertion_tree};
  });
  const supported=assertions.filter(a=>a.tree&&typeof a.tree.passed==='boolean'&&Array.isArray(a.tree.sub_results)&&a.tree.sub_results.every((s:any)=>typeof s.passed==='boolean')&&a.tree.status===a.meta.status);
  const description=(a:any)=>a.tree?.description??'';
  const observed=(sub:any)=>sub.variable_refs?.[sub.extracted_value]??sub.extracted_value;
  const numeric=(a:any)=>a.tree.sub_results.find((s:any)=>s.operator==='equals'&&amount(s.expected)===9000&&amount(observed(s))!==undefined);
  const coupon=supported.find(a=>/total is 90 dollars/i.test(description(a))&&!/order.*total/i.test(description(a)));
  const summary=supported.map(a=>({path:a.path,status:a.meta.status,description:description(a)}));
  const terminalSummary={status:terminal.status,summary:terminal.summary,reason:terminal.reason,duration:terminal.duration,credits_consumed:terminal.credits_consumed,final_state:terminal.final_state};
  // Keep account-bearing terminal context and pack metadata private. The public
  // report uses this small objective-only terminal summary.
  for(const k of Object.keys(terminalSummary))if((terminalSummary as any)[k]===undefined)delete (terminalSummary as any)[k];
  const common={evidenceDigest,executionId:run.run_id,assertions:summary,terminal:terminalSummary};
  const applied=actions.some(a=>a.action_type==='fill'&&a.status==='success'&&a.action_params?.text==='SAVE10')&&actions.some(a=>a.action_type==='click'&&a.status==='success'&&/apply coupon/i.test(a.action_instruction??''));
  if(terminal.status==='failed'){
   if(!coupon||coupon.meta.status!=='failed'||coupon.tree.passed!==false||!applied)return inconclusive('Failure lacks a supported coupon assertion checkpoint');
   const sub=numeric(coupon);const observedCents=sub?amount(observed(sub)):undefined;
   // Kane0.10.6 attaches a terminal checkpoint failure to the last browser
   // action, not necessarily to the assertion's ordinal. Require the explicit
   // checkpoint error, same page, and referenced screenshot to corroborate it.
   const failure=Object.keys(files).filter(p=>p.startsWith(base+'/steps/')&&p.endsWith('/failure.yaml')).map(p=>yaml(text(files,p))).find(f=>f.status==='failed'&&/Checkpoint assertion failed/i.test(f.error?.message??'')&&/Total is 90 dollars/i.test(f.error?.message??'')&&f.page_state?.url?.split('#')[0]===url+'/');
   if(!sub||sub.passed!==false||observedCents!==10000||!failure)return inconclusive('Failed checkpoint lacks corroborating checkout page state');
   const screenshot=failure.page_state?.screenshot?base+'/'+safeRelative(failure.page_state.screenshot):undefined;
   if(!screenshot||!files[screenshot])return inconclusive('Failed assertion screenshot missing');
   return {...common,kind:'assertion-failed',acceptanceId:'coupon-total',expectedCents:9000,observedCents,screenshot};
  }
  if(result.steps?.some((s:any)=>s.status!=='passed')||!applied||!coupon||coupon.tree.passed!==true||amount(observed(numeric(coupon)??{}))!==9000||amount(terminal.final_state?.displayed_total)!==9000)return inconclusive('Healthy coupon assertion evidence is incomplete');
  const final=supported.find(a=>a.tree.is_final&&a.tree.passed===true&&/Caustica Field Notes/.test(description(a))&&/SAVE10/.test(description(a))&&numeric(a));
  if(!final||final.tree.sub_results.some((s:any)=>!s.passed)||amount(observed(numeric(final)))!==9000)return inconclusive('Persisted order assertion evidence is incomplete');
  const har=JSON.parse(text(files,base+'/logs/0-network.har'));const entries=har.log?.entries??[];
  const order=entries.find((e:any)=>e.request?.url===url+'/api/orders'&&e.request.method==='POST'&&e.response?.status===201);
  const reload=order&&entries.find((e:any)=>e.request?.url===url+'/'&&e.request.method==='GET'&&e.response?.status===200&&Date.parse(e.startedDateTime)>Date.parse(order.startedDateTime));
  const history=reload&&entries.find((e:any)=>e.request?.url===url+'/api/orders'&&e.request.method==='GET'&&e.response?.status===200&&Date.parse(e.startedDateTime)>Date.parse(reload.startedDateTime));
  if(!order||!reload||!history||!terminal.final_state?.order_id)return inconclusive('Fresh document and persisted history requests after order creation are missing');
  const screenshot=Object.keys(files).find(p=>p.startsWith(dirname(final.path)+'/screenshot.')&&/\.(jpg|png)$/.test(p));
  return {...common,kind:'passed',expectedCents:9000,observedCents:9000,...(screenshot?{screenshot}:{})};
 }catch(e:any){return inconclusive('Unsupported or incomplete artifact: '+e.message);}
}
export async function normalizeEvidence(pack:string|undefined,validated:boolean,stream:KaneStream,url:string,directory:string):Promise<Outcome>{
 if(!pack||!validated)return {kind:'inconclusive',reason:!pack?'No sealed evidence pack':'Kane L1 evidence validation failed'};
 const bytes=await readFile(pack),files=unpack(bytes);const outcome=normalizePack(files,stream,url,sha256(bytes));
 if(outcome.screenshot){const ext=outcome.screenshot.endsWith('.png')?'png':'jpg';const destination=join(directory,'screenshot.'+ext);await mkdir(directory,{recursive:true});await writeFile(destination,files[outcome.screenshot],{mode:0o600});outcome.screenshot='screenshot.'+ext;}
 return outcome;
}
