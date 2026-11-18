import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {strToU8} from 'fflate';
import {normalizePack,type PackFiles} from '../src/evidence.js';import {parseStream} from '../src/kane.js';
async function fixture(name:string){const v=JSON.parse(await readFile(new URL('./fixtures/'+name+'.json',import.meta.url),'utf8'));const files:PackFiles=Object.fromEntries(Object.entries(v.files).map(([p,s])=>[p,strToU8(s as string)]));const exitCode=v.events.at(-1).status==='passed'?0:1;return {v,files,stream:parseStream(v.events.map(JSON.stringify).join('\n'),{exitCode,timedOut:false,signal:null})};}
test('real metadata distinguishes healthy checkout, explicit fault assertion and preassertion investigation',async()=>{
 for(const [name,kind] of [['healthy-v1','passed'],['healthy-bifurcated-v3','passed'],['control-v2','assertion-failed'],['preassertion-failure-v1','inconclusive']]){const f=await fixture(name);assert.equal(normalizePack(f.files,f.stream,f.v.url,'a'.repeat(64)).kind,kind,name);}
});
test('summaries, wrong expected amounts, missing page state and unknown schemas do not calibrate',async()=>{
 const f=await fixture('control-v2');
 const failures=Object.keys(f.files).filter(p=>p.endsWith('/failure.yaml'));for(const p of failures)delete f.files[p];
 assert.equal(normalizePack(f.files,f.stream,f.v.url,'a'.repeat(64)).kind,'inconclusive');
 const fresh=await fixture('control-v2');for(const p of Object.keys(fresh.files).filter(p=>p.endsWith('actions.ndjson')))fresh.files[p]=strToU8(new TextDecoder().decode(fresh.files[p]).replaceAll('"expected": "90"','"expected": "100"'));
 assert.equal(normalizePack(fresh.files,fresh.stream,fresh.v.url,'a'.repeat(64)).kind,'inconclusive');
 const unknown=await fixture('healthy-v1');unknown.files['run.yaml']=strToU8('evidence: future');assert.equal(normalizePack(unknown.files,unknown.stream,unknown.v.url,'a'.repeat(64)).kind,'inconclusive');
});
test('healthy summary without recorded refresh cannot prove persistence',async()=>{const f=await fixture('healthy-v1');for(const p of Object.keys(f.files).filter(p=>p.endsWith('network.har')))f.files[p]=strToU8('{"log":{"entries":[]}}');assert.equal(normalizePack(f.files,f.stream,f.v.url,'a'.repeat(64)).kind,'inconclusive');});
