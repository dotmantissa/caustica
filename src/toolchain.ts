import {access,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export function kaneExecutable(root:string){return join(root,'node_modules/@testmuai/kane-cli/bin/kane-cli.cjs');}
export async function runtimeEnv(root:string):Promise<NodeJS.ProcessEnv>{
 const env:NodeJS.ProcessEnv={...process.env,KANE_CLI_USER_AGENT:'codex'};
 const chrome=join(root,'.caustica/browser/chrome/linux-158.0.8127.36/chrome-linux64/chrome');
 if(!env.KANE_CLI_CHROME_PATH){try{await access(chrome,constants.X_OK);env.KANE_CLI_CHROME_PATH=chrome;}catch{}}
 const libs=join(root,'.caustica/browser-libs/root/usr/lib/x86_64-linux-gnu');
 try{await access(libs);env.LD_LIBRARY_PATH=[libs,env.LD_LIBRARY_PATH].filter(Boolean).join(':');}catch{}
 // Use the existing Kane login profile. Auth files are only a secure local source;
 // never put credentials in argv, manifests, prompts or exported artifacts.
 return env;
}
export async function doctor(root:string){
 const env=await runtimeEnv(root);const checks:Record<string,unknown>={node:process.version,nodeReady:Number(process.versions.node.split('.')[0])>=24};
 for(const [name,file,args] of [['kane',process.execPath,[kaneExecutable(root),'--version']],['chrome',env.KANE_CLI_CHROME_PATH??'google-chrome',['--version']],['codex','codex',['--version']]] as const){
  try{const r=await exec(file,[...args],{env,timeout:15000});checks[name]=r.stdout.trim();}catch(e:any){checks[name]={ready:false,reason:e.code??'Unavailable'};}
 }
 checks.ready=checks.nodeReady&&['kane','chrome','codex'].every(k=>typeof checks[k]==='string');return checks;
}
