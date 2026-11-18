import {mkdir,appendFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {atomicJson,newId} from './util.js';
export class RunStore{
  constructor(readonly id:string,readonly directory:string){}
  static async create(root:string,prefix='run'){const id=newId(prefix),s=new RunStore(id,join(root,'.caustica/runs',id));await mkdir(s.directory,{recursive:true});await s.stage('created');return s;}
  path(name:string){return join(this.directory,name);}
  async stage(stage:string,details:Record<string,unknown>={}){const record={runId:this.id,stage,at:new Date().toISOString(),...details};await appendFile(this.path('events.ndjson'),JSON.stringify(record)+'\n',{mode:0o600});await atomicJson(this.path('state.json'),record);}
  async final(receipt:unknown){await writeFile(this.path('receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});await this.stage('finished');}
}
