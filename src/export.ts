import {mkdir,readFile,copyFile,writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import type {Project} from './config.js';
import {readJson,atomicJson,safeFile} from './util.js';
import {inspect,readRecordedRun,runDirectory,checkArtifacts} from './verify.js';
import {ReceiptSchema} from './records.js';
import {page,escape,type DemoSummary} from './report.js';
import {labels} from './approval.js';
export function publicDiff(diff:string){return diff.split('\n').map(line=>{if(line.startsWith('diff --git ')){const paths=line.match(/apps\/checkout\/\S+/g);return paths?.length===2?`diff --git a/${paths[0]} b/${paths[1]}`:line;}if(line.startsWith('--- ')||line.startsWith('+++ ')){const index=line.indexOf('apps/checkout/');if(index>=0)return line.slice(0,4)+(line.startsWith('---')?'a/':'b/')+line.slice(index);}return line;}).join('\n');}
export async function exportDemo(project:Project,id:string){
 const demo=await readJson(join(runDirectory(project,id),'demo-summary.json')) as DemoSummary;
 if(!demo.complete||!demo.repairedVerification||!demo.candidate)throw new Error('Only a completed, verified demo can be exported');
 const baseline=ReceiptSchema.parse(await readJson(join(runDirectory(project,demo.healthy),'receipt.json'))),repaired=ReceiptSchema.parse(await readJson(join(runDirectory(project,demo.repairedVerification),'receipt.json')));
 if((await inspect(join(runDirectory(project,demo.healthy),'receipt.json'),project.configPath)).verdict!=='verified'||(await inspect(join(runDirectory(project,demo.repairedVerification),'receipt.json'),project.configPath,demo.candidate)).verdict!=='verified')throw new Error('Current proof integrity or source identity failed inspection');
 const repair=await readJson(join(runDirectory(project,demo.repair),'receipt.json'));
 if(!repair.artifacts||!await checkArtifacts(runDirectory(project,demo.repair),repair.artifacts))throw new Error('Repair transcript/candidate artifacts changed');
 const out=join(project.root,'artifacts/public',id);await mkdir(out,{recursive:true});
 const results=[];
 for(const [stage,runId] of [['Healthy application',baseline.healthy],['Independent fault',baseline.control],['Seeded source regression',demo.regression],['Repaired application',repaired.healthy],['Repaired independent fault',repaired.control]] as const){
  if(!runId)throw new Error('Required public proof stage missing');const run=await readRecordedRun(project,runId);if(!run.artifactsValid||!run.identityValid)throw new Error('Source or artifacts changed before export');
  const result={stage,runId,executionId:run.outcome.executionId,appDigest:run.appDigest,boundaryDigest:run.boundaryDigest,control:run.control,outcome:run.outcome.kind,expectedCents:run.outcome.expectedCents,observedCents:run.outcome.observedCents,evidenceDigest:run.outcome.evidenceDigest,durationMs:run.durationMs,...(run.outcome.screenshot?{screenshot:runId+'-'+run.outcome.screenshot}:{})};
  if(run.outcome.screenshot)await copyFile(await safeFile(runDirectory(project,runId),run.outcome.screenshot),join(out,runId+'-'+run.outcome.screenshot));results.push(result);
 }
 const summary={version:1,scope:'Sanitized summary of genuine local runs; raw sealed packs stay private',demoId:id,frozenContract:project.contract,baselineVerification:baseline.runId,repairedVerification:repaired.runId,repair:{runId:repair.runId,adapter:'codex-exec',changed:repair.changed},results,rejections:demo.rejections};
 const diff=publicDiff(await readFile(join(runDirectory(project,demo.repair),'proposal.diff'),'utf8'));await writeFile(join(out,'repair.diff'),diff);await atomicJson(join(out,'summary.json'),summary);
 const body=`<h1>A repair verified against unchanged requirements.</h1><p>This is a sanitized record of actual Kane and Codex runs on the owned checkout. Original run IDs and content digests identify the private evidence packs. The report contains no account identifiers or share links.</p><h2>Actual proof chain</h2><div class="table-wrap"><table><thead><tr><th>Stage</th><th>Observed result</th><th>Expected / observed</th></tr></thead><tbody>${results.map(r=>`<tr><td>${escape(r.stage)}</td><td>${r.outcome==='passed'?'Passed':'Requirement failed'}</td><td>$${(r.expectedCents!/100).toFixed(2)} / $${(r.observedCents!/100).toFixed(2)}</td></tr>`).join('')}</tbody></table></div><div class="shots">${results.filter(r=>r.screenshot).map(r=>`<figure><a href="${escape(r.screenshot)}"><img src="${escape(r.screenshot)}" alt="Kane screenshot from ${escape(r.stage)}" loading="lazy"></a><figcaption>${escape(r.stage)} · Real Kane capture</figcaption></figure>`).join('')}</div><h2>Actual application repair</h2><pre>${escape(diff)}</pre><h2>Proof reuse rejected</h2><p>Changed requirement: ${escape(demo.rejections.contract.reason)}</p><p>Different source bytes: ${escape(demo.rejections.staleBuild.reason)}</p><details><summary>Sanitized run identifiers and content digests</summary><pre>${escape(JSON.stringify(summary,null,2))}</pre></details><p class="proof"><a href="summary.json">Summary JSON</a> · <a href="repair.diff">Source diff</a>. Reproduce with the repository’s frozen checkout contract and real account access.</p>`;
 await writeFile(join(out,'index.html'),page('Verified repair record',body));return {directory:out,report:join(out,'index.html')};
}
