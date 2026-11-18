#!/usr/bin/env node
import {Command} from 'commander';
import {join,resolve} from 'node:path';
import {loadProject} from './config.js';
import {freeze,readFrozen,snapshot} from './snapshot.js';
import {RunStore} from './run-store.js';
import {launchFixture,checkIdentity} from './fixture.js';
import {verify,inspect,runDirectory} from './verify.js';
import {doctor} from './toolchain.js';
import {repair} from './repair.js';
import {renderReport} from './report.js';
import {demo,continueDemo} from './demo.js';
import {exportDemo} from './export.js';
import {labels,exitCodes,type Decision} from './approval.js';
const program=new Command().name('caustica').description('Frozen-contract verification and calibrated checkout repair').version('0.1.0');
const output=(value:unknown)=>{process.stdout.write(JSON.stringify(value,null,2)+'\n');};
const decision=(r:Decision)=>{output({...r,label:labels[r.verdict]});process.exitCode=exitCodes[r.verdict];};
const config=(c:Command)=>c.option('--config <path>','Project configuration','caustica.config.json');
config(program.command('doctor').description('Check runtime, Kane, Chrome and Codex interfaces')).action(async opts=>{const p=await loadProject(opts.config),checks=await doctor(p.root);output(checks);if(!checks.ready)process.exitCode=4;});
config(program.command('freeze').description('Freeze a new contract and harness version; previous proof is not inherited')).action(async opts=>output(await freeze(await loadProject(opts.config))));
config(program.command('verify').description('Run real positive checkout and independent fault calibration').option('--source <root>','Candidate application source root')).action(async opts=>{const p=await loadProject(opts.config);try{await readFrozen(p);}catch(e:any){decision({verdict:'evidence-rejected',reason:e.message});return;}const receipt=await verify(p,opts.source?resolve(opts.source):p.root);const report=await renderReport(p,receipt.runId);output({...receipt,label:labels[receipt.verdict],report});process.exitCode=exitCodes[receipt.verdict];});
config(program.command('repair').description('Verify an app-only repair from Codex or an explicit developer-mediated proposal').requiredOption('--failure <run-id>','Application failure run ID').option('--proposal <root>','Developer-mediated workspace containing the exact frozen failure bundle').option('--feedback <file>','Recorded developer-mediated coding-agent feedback')).action(async opts=>{const p=await loadProject(opts.config),r=await repair(p,opts.failure,{proposalRoot:opts.proposal,feedbackPath:opts.feedback});output({...r,label:labels[r.verdict]});process.exitCode=exitCodes[r.verdict];});
config(program.command('inspect').description('Reject changed inputs, source or altered archived evidence').requiredOption('--receipt <path>','Verification receipt JSON').option('--source <root>','Current candidate application root')).action(async opts=>decision(await inspect(opts.receipt,opts.config,opts.source?resolve(opts.source):undefined)));
config(program.command('report').description('Render a report from actual verification records').requiredOption('--run <id>','Verification run ID')).action(async opts=>output({report:await renderReport(await loadProject(opts.config),opts.run)}));
config(program.command('export').description('Export checked demo summaries and synthetic checkout screenshots; keep raw packs private').requiredOption('--run <id>','Completed demo ID')).action(async opts=>output(await exportDemo(await loadProject(opts.config),opts.run)));
config(program.command('serve').description('Serve an isolated checkout snapshot for local inspection').option('--port <number>','Local HTTP port','4173')).action(async opts=>{const p=await loadProject(opts.config),port=Number(opts.port);if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port');const store=await RunStore.create(p.root,'preview'),s=await snapshot(p,store.path('snapshot')),f=await launchFixture(p,s,store.directory,'none',port);await checkIdentity(f);await store.stage('preview-serving',{pid:f.child.pid,url:f.url,instance:f.instance});output({url:f.url,runId:store.id});const stop=async()=>{await f.stop();await store.stage('preview-stopped');process.exit(0);};process.once('SIGINT',stop);process.once('SIGTERM',stop);});
config(program.command('demo').description('Run the proof chain or append a verified repair to an incomplete demo').option('--resume <id>','Original incomplete demo ID').option('--repair <id>','Fresh verified repair ID for continuation')).action(async opts=>{if(!!opts.resume!==!!opts.repair)throw new Error('Demo continuation requires both --resume and --repair');const p=await loadProject(opts.config),result=opts.resume?await continueDemo(p,opts.resume,opts.repair):await demo(p);output(result);if(!result.complete)process.exitCode=3;});
try{await program.parseAsync();}catch(e:any){output({error:e.message});process.exitCode=4;}
