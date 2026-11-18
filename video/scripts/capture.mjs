import { chromium } from '/home/dotmantissa/.local/share/demo-studio/tools/node_modules/playwright-core/index.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { loadProject } from '../../dist/config.js';
import { snapshot } from '../../dist/snapshot.js';
import { launchFixture, checkIdentity, probeControl } from '../../dist/fixture.js';
process.env.PLAYWRIGHT_BROWSERS_PATH='/home/dotmantissa/.local/share/demo-studio/browsers';
const root=resolve('..');
const cfg=JSON.parse(await readFile(join(root,'demo-studio.config.json'),'utf8'));
const mode=process.argv[2]||'healthy';
const source=process.argv[3] ? resolve(process.argv[3]) : root;
const destination=resolve('raw',mode+'-'+new Date().toISOString().replaceAll(':','-'));
await mkdir(destination,{recursive:true});
const project=await loadProject(join(root,'caustica.config.json'));
const snap=await snapshot(project,join(destination,'snapshot'),source);
const fixture=await launchFixture(project,snap,join(destination,'fixture'),mode==='control'?'ignore-discount':'none');
const journal={version:1,mode,source,sourceSnapshot:snap,fixture:{url:fixture.url,instance:fixture.instance,control:fixture.control},recording:'Recorded demonstration of source snapshot; not the historical Kane browser session',startedAt:new Date().toISOString(),events:[]};
const browser=await chromium.launch({headless:true,executablePath:cfg.browser_executable,args:['--no-sandbox','--disable-dev-shm-usage'],env:{...process.env,LD_LIBRARY_PATH:cfg.browser_library_path}});
const context=await browser.newContext({viewport:{width:1600,height:960},deviceScaleFactor:1,recordVideo:{dir:destination,size:{width:1600,height:960}}});
const page=await context.newPage(); const started=performance.now();
async function mark(action,data={}){journal.events.push({seconds:(performance.now()-started)/1000,action,...data});await writeFile(join(destination,'actions.json'),JSON.stringify(journal,null,2));}
async function hold(ms){await page.waitForTimeout(ms);}
try{
 await mark('identity', {build:await checkIdentity(fixture)});
 await page.goto(fixture.url,{waitUntil:'networkidle'});await mark('navigate');await hold(2200);
 await page.locator('#coupon').click();await page.locator('#coupon').pressSequentially('SAVE10',{delay:160});await mark('type coupon',{value:'SAVE10'});await hold(1700);
 await page.locator('#apply').click();await page.locator('#coupon-status').waitFor({state:'visible'});await hold(4000);await mark('apply coupon',{total:await page.locator('#total').innerText(),discount:await page.locator('#discount').innerText()});
 await page.screenshot({path:join(destination,'quote.png')});
 if(mode!=='control'&&mode!=='regression'){
  await page.locator('#place-order').click();await page.waitForFunction(()=>document.querySelector('#order-status').textContent.includes('placed.'));await mark('place order',{status:await page.locator('#order-status').innerText()});await hold(5000);
  await page.locator('#history').scrollIntoViewIfNeeded();await mark('history');await hold(4000);
  await page.reload({waitUntil:'networkidle'});await mark('reload',{history:await page.locator('#orders').innerText()});await hold(1500);
  await page.locator('#history').scrollIntoViewIfNeeded();await hold(7000);await page.screenshot({path:join(destination,'history.png')});await mark('history after reload',{history:await page.locator('#orders').innerText()});
 }else{await hold(10000); if(mode==='control')await mark('effective independent fault probe',{probe:await probeControl(fixture)});}
 await hold(1500);await mark('capture end');
 await context.close();journal.video=await page.video().path();journal.completedAt=new Date().toISOString();await writeFile(join(destination,'actions.json'),JSON.stringify(journal,null,2));
}finally{await browser.close();await fixture.stop();}
console.log(JSON.stringify({mode,video:journal.video,journal:join(destination,'actions.json'),digest:snap.appDigest}));
