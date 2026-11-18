import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {bundle} from '@remotion/bundler';
import {selectComposition,renderStill,openBrowser} from '@remotion/renderer';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
const c=JSON.parse(await readFile('../demo-studio.config.json','utf8'));
const proof=JSON.parse(await readFile('src/proof.json','utf8'));if(!proof.complete)throw new Error('Graphics require complete proof');
process.env.LD_LIBRARY_PATH=c.browser_library_path+':'+c.ffmpeg_library_path;
await mkdir('qa/graphics',{recursive:true});
const operation={pid:process.pid,startedAt:new Date().toISOString(),composition:'CausticaGraphics',frames:{intro:45,contract:420,diagram:930,claim:6960,end:7140},outputs:[]};
await writeFile('qa/graphics-operation.json',JSON.stringify(operation,null,2));
await build({entryPoints:['scripts/export-hybrid.ts'],bundle:true,platform:'node',format:'cjs',outfile:'qa/export-hybrid.cjs',external:['remotion','react']});
const exportResult=spawnSync(c.node,['qa/export-hybrid.cjs'],{stdio:'inherit'});if(exportResult.status!==0)throw new Error('Motion export failed');
const serveUrl=await bundle({entryPoint:resolve('src/index.ts'),outDir:resolve('qa/remotion-bundle')});
const browser=await openBrowser('chrome',{browserExecutable:c.browser_executable,chromiumOptions:{gl:'swangle'}});
try{
 const composition=await selectComposition({serveUrl,id:'CausticaGraphics',puppeteerInstance:browser});
 for(const [name,frame]of Object.entries(operation.frames)){
  const output=resolve(`qa/graphics/${name}.png`);await renderStill({serveUrl,composition,frame,output,imageFormat:'png',puppeteerInstance:browser,chromiumOptions:{gl:'swangle'},logLevel:'warn'});
  operation.outputs.push(output);await writeFile('qa/graphics-operation.json',JSON.stringify(operation,null,2));console.log(name+' rendered');
 }
}finally{await browser.close({silent:true});}
operation.completedAt=new Date().toISOString();await writeFile('qa/graphics-operation.json',JSON.stringify(operation,null,2));
