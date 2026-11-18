import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const c=JSON.parse(await readFile('../demo-studio.config.json','utf8'));
process.env.PLAYWRIGHT_BROWSERS_PATH=c.playwright_browsers_path;
const {chromium}=await import('/home/dotmantissa/.local/share/demo-studio/tools/node_modules/playwright-core/index.mjs');
const report=resolve(process.argv[2]);
const dir=resolve('raw/report-'+new Date().toISOString().replaceAll(':','-'));
await mkdir(dir,{recursive:true});await mkdir('qa',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:c.browser_executable,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:c.browser_library_path}});
const journal={source:report,sha256:createHash('sha256').update(await readFile(report)).digest('hex'),recording:'Genuine navigation of sanitized final proof report',actions:[]};
try{
 for(const [device,width,height] of [['desktop',1440,1080],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height}});await page.goto(pathToFileURL(report).href,{waitUntil:'networkidle'});
  await page.screenshot({path:`qa/final-report-${device}.png`,fullPage:true});await page.close();
 }
 const context=await browser.newContext({viewport:{width:1600,height:960},recordVideo:{dir,size:{width:1600,height:960}}});const page=await context.newPage();
 await page.goto(pathToFileURL(report).href,{waitUntil:'networkidle'});journal.actions.push({action:'navigate',t:0});await page.waitForTimeout(5200);
 for(let n=1;n<=24;n++){await page.evaluate(y=>window.scrollTo(0,y),n*11);await page.waitForTimeout(100);}
 journal.actions.push({action:'scroll to full proof chain',t:5.2});await page.waitForTimeout(5200);
 await page.locator('h2',{hasText:'Actual application repair'}).scrollIntoViewIfNeeded();journal.actions.push({action:'scroll to genuine repair and rejection results',t:12.8});await page.waitForTimeout(5500);
 await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(3500);
 await page.screenshot({path:'qa/final-report-frame.png'});await context.close();const original=await page.video().path();
 await copyFile(original,'public/media/record-report.webm');journal.original=original;await writeFile(dir+'/actions.json',JSON.stringify(journal,null,2));
 console.log('Final report footage and desktop/mobile screenshots captured');
}finally{await browser.close();}
