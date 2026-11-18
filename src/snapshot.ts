import {readFile,mkdir,copyFile,chmod} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {sha256,safeFile,atomicJson,newId,readJson} from './util.js';
import {z} from 'zod';
import {ContractSchema,ConfigSchema} from './config.js';
import type {Project} from './config.js';
export interface FileEntry{path:string;sha256:string;}
export interface Snapshot{root:string;appManifest:FileEntry[];appDigest:string;boundaryManifest:FileEntry[];boundaryDigest:string;}
export async function manifest(root:string,files:string[]):Promise<FileEntry[]>{const entries=[];for(const path of [...files].sort())entries.push({path,sha256:sha256(await readFile(await safeFile(root,path)))});return entries;}
export const manifestDigest=(entries:FileEntry[])=>sha256(JSON.stringify(entries));
export async function snapshot(project:Project,destination:string,sourceRoot=project.root):Promise<Snapshot>{
  const appManifest=await manifest(sourceRoot,project.config.appFiles),boundaryManifest=await manifest(project.root,project.config.boundaryFiles);
  for(const entry of [...appManifest,...boundaryManifest]){const root=project.config.appFiles.includes(entry.path)?sourceRoot:project.root;const target=join(destination,entry.path);await mkdir(dirname(target),{recursive:true});await copyFile(await safeFile(root,entry.path),target);if(sha256(await readFile(target))!==entry.sha256)throw new Error('Source changed while snapshotting: '+entry.path);await chmod(target,0o444);}
  const s={root:destination,appManifest,appDigest:manifestDigest(appManifest),boundaryManifest,boundaryDigest:manifestDigest(boundaryManifest)};await atomicJson(join(destination,'snapshot-manifest.json'),s);return s;
}
export interface Frozen {version:1;id:string;createdAt:string;boundaryDigest:string;globalVariablesDigest:string;contract:Project['contract'];config:Project['config'];}
export const FrozenSchema=z.object({version:z.literal(1),id:z.string().min(1),createdAt:z.string(),boundaryDigest:z.string().regex(/^[a-f0-9]{64}$/),globalVariablesDigest:z.string().regex(/^[a-f0-9]{64}$/),contract:ContractSchema,config:ConfigSchema}).strict();
export async function readFrozen(project:Project):Promise<Frozen>{
 const f=FrozenSchema.parse(await readJson(join(project.root,'.caustica/frozen.json')));
 if(f.boundaryDigest!==project.boundaryDigest||f.globalVariablesDigest!==project.globalVariablesDigest)throw new Error('Frozen requirements or global variable inputs changed; freeze a new version and recalibrate');return f;
}
export async function freeze(project:Project):Promise<Frozen>{
  const id=newId('contract');const frozen:Frozen={version:1,id,createdAt:new Date().toISOString(),boundaryDigest:project.boundaryDigest,globalVariablesDigest:project.globalVariablesDigest,contract:project.contract,config:project.config};
  const inputRoot=join(project.root,'.caustica/contracts',id+'-inputs');
  for(const path of [project.config.contract,project.config.context,...project.config.boundaryFiles]){const target=join(inputRoot,path);await mkdir(dirname(target),{recursive:true});await copyFile(await safeFile(project.root,path),target);await chmod(target,0o444);}
  await atomicJson(join(project.root,'.caustica/contracts',id+'.json'),frozen);await atomicJson(join(project.root,'.caustica/frozen.json'),frozen);return frozen;
}
