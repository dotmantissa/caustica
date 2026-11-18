import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,rename,mkdir,lstat,realpath} from 'node:fs/promises';
import {dirname,resolve,relative,isAbsolute,sep} from 'node:path';
export const sha256=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex');
export function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
export const digest=(value:unknown)=>sha256(canonical(value));
export async function readJson(path:string):Promise<any>{return JSON.parse(await readFile(path,'utf8'));}
export async function atomicJson(path:string,value:unknown){await mkdir(dirname(path),{recursive:true});const tmp=path+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(tmp,path);}
export function safeRelative(path:string){if(!path||isAbsolute(path)||path.includes('\\')||path.split('/').some(p=>p==='..'||p==='.'||p===''))throw new Error('Unsafe relative path: '+path);return path;}
export async function safeFile(root:string,path:string){
  safeRelative(path);const base=await realpath(root);let current=base;
  for(const part of path.split('/')){current=resolve(current,part);if((await lstat(current)).isSymbolicLink())throw new Error('Symlink input rejected: '+path);}
  if(!(await lstat(current)).isFile())throw new Error('Expected regular file: '+path);
  const rel=relative(base,await realpath(current));if(rel.startsWith('..'+sep)||isAbsolute(rel))throw new Error('Outside project root');return current;
}
export const newId=(prefix='run')=>`${prefix}-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`;
export const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
