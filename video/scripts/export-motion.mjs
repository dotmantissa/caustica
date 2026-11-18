import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const c=JSON.parse(await readFile('../demo-studio.config.json','utf8'));
await build({entryPoints:['scripts/export-hybrid.ts'],bundle:true,platform:'node',format:'cjs',outfile:'qa/export-hybrid.cjs',external:['remotion','react']});
const result=spawnSync(c.node,['qa/export-hybrid.cjs'],{stdio:'inherit'});if(result.status!==0)throw new Error('Authored motion export failed');
