import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
const require=createRequire(import.meta.url);
const runtime=process.env.MOONLIGHT_TEST_ELECTRON||require('electron');
const profile=await mkdtemp(join(tmpdir(),'moonlight-ship-test-'));
try{
 const child=spawn(runtime,[resolve('tests/startup-ship.cjs'),'--user-data-dir='+profile],{stdio:'inherit',windowsHide:true});
 const deadline=setTimeout(()=>child.kill(),25000);
 process.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
 clearTimeout(deadline);
}finally{
 const target=resolve(profile);
 if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('moonlight-ship-test-'))throw Error('Unexpected test profile cleanup path');
 await rm(target,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
