import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseStream} from '../src/kane.js';
const start={type:'stream_start',cli_version:'0.10.6',v:1};
const end={type:'run_end',status:'passed'};
const process={exitCode:0,timedOut:false,signal:null};
const stream=(events:unknown[])=>events.map(e=>JSON.stringify(e)).join('\n');
test('incomplete, conflicting, error and exit-disagreeing streams cannot establish pass',()=>{
 assert.equal(parseStream(stream([start,end]),process).ok,true);
 for(const events of [[start],[start,end,end],[start,{type:'error',message:'Upload failed'},end],[{...start,cli_version:'future'},end]])assert.equal(parseStream(stream(events),process).ok,false);
 assert.equal(parseStream(stream([start,end])+'\n{"type":',process).ok,false);
 assert.equal(parseStream(stream([start,end]),{...process,exitCode:1}).ok,false);
 assert.equal(parseStream(stream([start,end]),{...process,timedOut:true}).ok,false);
});
