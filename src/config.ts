import {z} from 'zod';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {homedir} from 'node:os';
import {canonical,digest,safeFile,safeRelative,sha256} from './util.js';
const requirement=z.object({id:z.enum(['coupon-total','order-total','order-refresh']),expectedCents:z.literal(9000),description:z.string().min(1)}).strict();
export const ContractSchema=z.object({version:z.number().int().positive(),title:z.string(),objective:z.string().min(20),requirements:z.array(requirement).length(3)}).strict();
export const ConfigSchema=z.object({version:z.literal(1),contract:z.string(),context:z.string(),appFiles:z.array(z.string()).min(4),boundaryFiles:z.array(z.string()).min(2),server:z.string(),control:z.string(),runtime:z.object({timeoutSeconds:z.number().int().min(30).max(600),maxSteps:z.number().int().min(1).max(50),kaneVersion:z.literal('0.10.6')}).strict()}).strict();
export type Config=z.infer<typeof ConfigSchema>;
export type Contract=z.infer<typeof ContractSchema>;
export interface Project {root:string;configPath:string;config:Config;contract:Contract;context:string;boundaryDigest:string;globalVariablesDigest:string;}
export async function globalVariablesDigest(){
  const directory=join(homedir(),'.testmuai/kaneai/variables');let names:string[];
  try{names=(await readdir(directory)).filter(p=>p.endsWith('.json')).sort();}catch(e:any){if(e.code==='ENOENT')return digest([]);throw e;}
  const hashes=[];for(const name of names){const path=await safeFile(directory,name);hashes.push({path:name,sha256:sha256(await readFile(path))});}
  return digest(hashes); // Store only hashes; global variables may contain secrets.
}
export async function loadProject(configPath='caustica.config.json'):Promise<Project>{
  const absolute=resolve(configPath),root=dirname(absolute);const configBytes=await readFile(absolute,'utf8');const config=ConfigSchema.parse(JSON.parse(configBytes));
  const all=[config.contract,config.context,...config.appFiles,...config.boundaryFiles];all.forEach(safeRelative);
  if(new Set(all).size!==all.length)throw new Error('Duplicate/overlapping input manifest');
  if(config.appFiles.some(p=>!/^apps\/checkout\/(src|public)\//.test(p)))throw new Error('Editable manifest must stay inside checkout source/public');
  if(!config.boundaryFiles.includes(config.server)||!config.boundaryFiles.includes(config.control))throw new Error('Server/control must be frozen boundary files');
  if(!config.appFiles.includes('apps/checkout/src/pricing.mjs'))throw new Error('Missing owned pricing input');
  const contractBytes=await readFile(await safeFile(root,config.contract),'utf8');const contract=ContractSchema.parse(JSON.parse(contractBytes));
  if(new Set(contract.requirements.map(r=>r.id)).size!==3)throw new Error('Acceptance IDs must be unique');
  const substitutions=[...contract.objective.matchAll(/\{\{([^}]+)\}\}/g)].map(m=>m[1]);if(substitutions.some(s=>s!=='app_url')||!substitutions.includes('app_url'))throw new Error('Only app_url may be substituted');
  const context=await readFile(await safeFile(root,config.context),'utf8');const boundary=[];
  for(const path of [...config.boundaryFiles].sort())boundary.push({path,sha256:sha256(await readFile(await safeFile(root,path)))});
  // Freeze actual requirement/context bytes, configuration and trusted harness.
  const boundaryDigest=digest({config:sha256(configBytes),contract:sha256(contractBytes),context:sha256(context),boundary});
  return {root,configPath:absolute,config,contract,context,boundaryDigest,globalVariablesDigest:await globalVariablesDigest()};
}
