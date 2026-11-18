import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const launch=JSON.parse(await readFile(process.env.CAUSTICA_LAUNCH,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function manifest(files){return Promise.all([...files].sort().map(async path=>({path,sha256:hash(await readFile(join(launch.snapshotRoot,path)))})));}
const appManifest=await manifest(launch.appFiles),boundaryManifest=await manifest(launch.boundaryFiles);
const appDigest=hash(JSON.stringify(appManifest)),boundaryDigest=hash(JSON.stringify(boundaryManifest));
const {quote}=await import(pathToFileURL(join(launch.snapshotRoot,'apps/checkout/src/pricing.mjs')).href);
const {applyControl}=await import(pathToFileURL(join(launch.snapshotRoot,launch.controlFile)).href);
const assets=new Map();for(const entry of appManifest.filter(e=>e.path.includes('/public/')))assets.set(entry.path.split('/public/')[1],await readFile(join(launch.snapshotRoot,entry.path)));
await mkdir(dirname(launch.database),{recursive:true});const db=new DatabaseSync(launch.database);
db.exec('CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, product TEXT, coupon TEXT, totalCents INTEGER, createdAt TEXT)');
function price(quantity,coupon){const q=applyControl(quote(quantity,coupon),launch.control);if(!['subtotalCents','discountCents','totalCents'].every(k=>Number.isSafeInteger(q[k])&&q[k]>=0)||q.totalCents!==q.subtotalCents-q.discountCents)throw new Error('Invalid pricing result');return q;}
async function body(req){let b='';for await(const chunk of req){b+=chunk;if(b.length>8192)throw new Error('Request too large');}const v=JSON.parse(b);if(v.quantity!==1||typeof v.coupon!=='string'||v.coupon.length>32)throw new Error('Invalid checkout input');return v;}
const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  function json(code,v){res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(v));}
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(req.method==='GET'&&url.pathname==='/__caustica/health')return json(200,{ok:true});
    if(req.method==='GET'&&url.pathname==='/__caustica/build')return json(200,{instance:launch.instance,appDigest,boundaryDigest,control:launch.control,currentAppDigest:hash(JSON.stringify(await manifest(launch.appFiles))),currentBoundaryDigest:hash(JSON.stringify(await manifest(launch.boundaryFiles)))});
    if(req.method==='GET'&&url.pathname==='/api/orders')return json(200,db.prepare('SELECT * FROM orders ORDER BY id DESC').all());
    if(req.method==='POST'&&['/api/quote','/api/orders'].includes(url.pathname)){
      const v=await body(req),coupon=v.coupon.trim().toUpperCase(),q=price(v.quantity,coupon);
      if(url.pathname==='/api/quote')return json(200,q);
      const product='Caustica Field Notes',createdAt=new Date().toISOString();
      const result=db.prepare('INSERT INTO orders(product,coupon,totalCents,createdAt) VALUES(?,?,?,?)').run(product,coupon,q.totalCents,createdAt);
      return json(201,{id:Number(result.lastInsertRowid),product,coupon,totalCents:q.totalCents,createdAt});
    }
    const name=url.pathname==='/'?'index.html':url.pathname.startsWith('/assets/')?url.pathname.slice(8):'';
    if(req.method==='GET'&&assets.has(name)){const type=name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':name.endsWith('.mjs')?'text/javascript':'application/octet-stream';res.writeHead(200,{'Content-Type':type});return res.end(assets.get(name));}
    json(404,{error:'Not found'});
  }catch(e){json(400,{error:e.message});}
});
server.listen(launch.port??0,'127.0.0.1',()=>console.log(JSON.stringify({type:'server_ready',port:server.address().port,instance:launch.instance})));
function stop(){server.close(()=>{db.close();process.exit(0)});setTimeout(()=>process.exit(1),2000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
