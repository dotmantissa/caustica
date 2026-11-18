import {chromium} from '/home/dotmantissa/.local/share/demo-studio/tools/node_modules/playwright-core/index.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const c=JSON.parse(await readFile('../demo-studio.config.json','utf8'));await mkdir('qa',{recursive:true});
const b=await chromium.launch({headless:true,executablePath:c.browser_executable,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:c.browser_library_path}});
const p=await b.newPage({viewport:{width:1600,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:3417/'+(process.argv[2]||''));await p.waitForTimeout(2500);await p.screenshot({path:'qa/studio.png'});await writeFile('qa/studio-check.json',JSON.stringify({url:p.url(),title:await p.title(),errors},null,2));await b.close();console.log({errors});
