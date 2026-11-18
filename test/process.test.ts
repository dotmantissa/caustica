import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';import {resolve} from 'node:path';
import {boundedProcess} from '../src/process.js';
test('bounded subprocess persists full output and distinguishes timeout from normal failure',async()=>{
 await mkdir('.caustica/tests',{recursive:true});const dir=await mkdtemp(resolve('.caustica/tests/process-'));
 try{
  const result=await boundedProcess(process.execPath,['-e','process.stdout.write("event\\n");process.stderr.write("diagnostic");process.exit(1)'],{cwd:dir,directory:dir+'/failed',timeoutMs:5000});assert.equal(result.exitCode,1);assert.equal(result.timedOut,false);assert.equal(await readFile(result.stdoutPath,'utf8'),'event\n');assert.equal(await readFile(result.stderrPath,'utf8'),'diagnostic');
  const timeout=await boundedProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{cwd:dir,directory:dir+'/timeout',timeoutMs:50});assert.equal(timeout.timedOut,true);assert.notEqual(timeout.signal,null);assert.equal(JSON.parse(await readFile(dir+'/timeout/process-result.json','utf8')).timedOut,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});
