import {chromium} from '/home/dotmantissa/.local/share/demo-studio/tools/node_modules/playwright-core/index.mjs';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const c=JSON.parse(await readFile('../demo-studio.config.json','utf8'));const report=process.argv[2];const name=process.argv[3]||'baseline-report';await mkdir('qa',{recursive:true});
const b=await chromium.launch({headless:true,executablePath:c.browser_executable,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:c.browser_library_path}});
for(const [device,width,height] of [['desktop',1440,1080],['mobile',390,844]]){const p=await b.newPage({viewport:{width,height}});await p.goto(pathToFileURL(report).href);await p.screenshot({path:`qa/${name}-${device}.png`,fullPage:true});console.log(`${name}-${device} captured`);await p.close();}await b.close();
