import {mkdir,copyFile,writeFile,readFile,chmod} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import type {Project} from './config.js';
import {freeze,readFrozen} from './snapshot.js';
import {RunStore} from './run-store.js';
import {verify,executeRun,inspect,runDirectory,readRecordedRun,checkArtifacts} from './verify.js';
import {repair} from './repair.js';
import {safeFile,atomicJson,readJson} from './util.js';
import {renderDemoReport,type DemoSummary} from './report.js';
export async function demo(project:Project){
 let frozen;try{frozen=await readFrozen(project);}catch(e:any){if(e.code!=='ENOENT')throw e;frozen=await freeze(project);}
 const store=await RunStore.create(project.root,'demo');await store.stage('baseline-started',{frozenId:frozen.id});
 const healthy=await verify(project);await store.stage('baseline-recorded',{verification:healthy.runId,verdict:healthy.verdict});
 if(healthy.verdict!=='verified'){const result={version:1,runId:store.id,complete:false,reason:'Healthy application/control prerequisite did not verify',healthy:healthy.runId};await store.final(result);return result;}
 const regressionRoot=store.path('regression');
 for(const path of project.config.appFiles){const target=join(regressionRoot,path);await mkdir(dirname(target),{recursive:true});await copyFile(await safeFile(project.root,path),target);}
 await copyFile(await safeFile(project.root,'demo/coupon-regression.mjs'),join(regressionRoot,'apps/checkout/src/pricing.mjs'));
 await store.stage('regression-started',{sourceRoot:regressionRoot});const regression=await executeRun(project,frozen,regressionRoot);await store.stage('regression-recorded',{regression:regression.runId,outcome:regression.outcome.kind});
 const repaired=await repair(project,regression.runId);await store.stage('repair-recorded',{repair:repaired.runId,verdict:repaired.verdict,candidate:repaired.candidate});
 // Build the contract rejection example in a private copy; leave the caller's
 // frozen contract intact. Reuse the old receipt only to demonstrate rejection.
 const changed=store.path('changed-contract');
 for(const path of ['caustica.config.json',project.config.contract,project.config.context,...project.config.appFiles,...project.config.boundaryFiles]){const target=join(changed,path);await mkdir(dirname(target),{recursive:true});await copyFile(await safeFile(project.root,path),target);}
 const contract=JSON.parse(await readFile(join(changed,project.config.contract),'utf8'));contract.objective=contract.objective.replaceAll('90 dollars','100 dollars');await atomicJson(join(changed,project.config.contract),contract);
 await mkdir(join(changed,'.caustica'),{recursive:true});await atomicJson(join(changed,'.caustica/frozen.json'),frozen);
 const receiptPath=join(runDirectory(project,healthy.runId),'receipt.json');
 const contractRejection=await inspect(receiptPath,join(changed,'caustica.config.json'));
 const staleRejection=await inspect(receiptPath,project.configPath,regressionRoot);
 const complete=repaired.verdict==='verified'&&regression.outcome.kind==='assertion-failed'&&contractRejection.verdict==='evidence-rejected'&&staleRejection.verdict==='evidence-rejected';
 const summary:DemoSummary={version:1,runId:store.id,complete,healthy:healthy.runId,regression:regression.runId,repair:repaired.runId,...(repaired.candidate?{candidate:repaired.candidate}:{}),...(repaired.verification?{repairedVerification:repaired.verification}:{}),rejections:{contract:contractRejection,staleBuild:staleRejection},reason:complete?'Actual source repair passed the unchanged contract and matching fault calibration; changed-contract and different-build proof reuse were rejected.':'One or more required proof stages did not complete; inspect the recorded result.'};
 await atomicJson(store.path('demo-summary.json'),summary);await store.final(summary);const report=await renderDemoReport(project,summary);return {...summary,report};
}
export async function continueDemo(project:Project,previousId:string,repairId:string){
 const previous=await readJson(join(runDirectory(project,previousId),'demo-summary.json')) as DemoSummary;
 const repaired=await readJson(join(runDirectory(project,repairId),'receipt.json'));
 const frozen=await readFrozen(project),regression=await readRecordedRun(project,previous.regression);
 if(previous.runId!==previousId||previous.complete)throw new Error('Continuation requires the original incomplete demo');
 if(repaired.runId!==repairId||repaired.failure!==previous.regression||repaired.verdict!=='verified'||!repaired.candidate||!repaired.verification||repaired.verification===previous.healthy)throw new Error('Continuation requires a fresh verified repair of the same source failure');
 if(!['codex-exec','developer-mediated'].includes(repaired.adapter)||!repaired.artifacts?.length||!await checkArtifacts(runDirectory(project,repairId),repaired.artifacts))throw new Error('Repair proposal/provenance artifacts changed');
 if(!regression.artifactsValid||!regression.identityValid||regression.boundaryDigest!==frozen.boundaryDigest||regression.globalVariablesDigest!==frozen.globalVariablesDigest||regression.control!=='none'||regression.outcome.kind!=='assertion-failed')throw new Error('Original regression evidence no longer meets the frozen repair prerequisites');
 const baseline=await inspect(join(runDirectory(project,previous.healthy),'receipt.json'),project.configPath);
 const candidate=await inspect(join(runDirectory(project,repaired.verification),'receipt.json'),project.configPath,repaired.candidate);
 if(baseline.verdict!=='verified'||candidate.verdict!=='verified')throw new Error('Baseline or candidate failed independent inspection');
 const contract=await inspect(join(runDirectory(project,previous.healthy),'receipt.json'),join(runDirectory(project,previousId),'changed-contract/caustica.config.json'));
 const staleBuild=await inspect(join(runDirectory(project,previous.healthy),'receipt.json'),project.configPath,join(runDirectory(project,previousId),'regression'));
 const store=await RunStore.create(project.root,'demo');await store.stage('continuation-validated',{previousDemo:previousId,repair:repairId,adapter:repaired.adapter});
 const complete=contract.verdict==='evidence-rejected'&&staleBuild.verdict==='evidence-rejected';
 const summary:DemoSummary={version:1,runId:store.id,complete,previousDemo:previousId,previousRepair:previous.repair,adapter:repaired.adapter,healthy:previous.healthy,regression:previous.regression,repair:repairId,candidate:repaired.candidate,repairedVerification:repaired.verification,rejections:{contract,staleBuild},reason:complete?`Actual ${repaired.adapter} source repair passed the unchanged contract and a fresh matching fault calibration; changed-contract and different-build proof reuse were rejected.`:'Required proof reuse rejection did not complete.'};
 await atomicJson(store.path('demo-summary.json'),summary);await store.final(summary);return {...summary,report:await renderDemoReport(project,summary)};
}
