import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const c=JSON.parse(await readFile('../demo-studio.config.json','utf8'));
const child=spawn(c.cinetic_venv+'/bin/python',process.argv.slice(2),{stdio:'inherit'});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
