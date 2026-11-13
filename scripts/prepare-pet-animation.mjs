import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, rename, access, readdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { promisify } from 'node:util';
const run=promisify(execFile);
const root=resolve('.');
const arg=name=>{const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1];};
const variants=(arg('--variants')||'base,snakeman,nika').split(',');
const pairs=(arg('--pairs')||'idle-inspect,walk-wave,bite-chew,sleep-stretch,jump-happy,attacks-a,attacks-b,attacks-c').split(',');
const rife=resolve(arg('--rife')||'qa/rife-tools/rife-ncnn-vulkan.exe');
const upscaler=resolve(arg('--upscaler')||'qa/esrgan-tools/realesrgan-ncnn-vulkan.exe');
const work=resolve('qa/pet-v28/render'),sheets=resolve('local-themes/pet-v28/sheets'),out=resolve('local-themes/pet-v28/clips');
const hd=join(work,'hd'),logs=join(work,'logs');
await Promise.all([work,hd,logs,out].map(path=>mkdir(path,{recursive:true})));
const manifestPath=join(work,'manifest.json');
let manifest;try{manifest=JSON.parse(await readFile(manifestPath,'utf8'));}catch{manifest={sheets:{},clips:{}};}
manifest.backgrounds??={};
const catalogue=JSON.parse(await readFile('desktop/pet-moves.json','utf8'));
const daily={
'idle-inspect':[['idle',2650],['inspect',1520]],
'walk-wave':[['walk',830],['wave',1640]],
'bite-chew':[['bite',670],['chew',940]],
'sleep-stretch':[['sleep',5820],['stretch',1570]],
'jump-happy':[['jump',1020],['happy',690]],
};
async function command(file,args,log){
 try{const result=await run(file,args,{windowsHide:true,maxBuffer:16_000_000});if(log)await writeFile(join(logs,log),result.stdout+result.stderr);}
 catch(error){if(log)await writeFile(join(logs,log),(error.stdout||'')+(error.stderr||''));throw error;}
}
const digest=value=>createHash('sha256').update(value).digest('hex');
const hdFile=(variant,pair,index)=>join(hd,variant+'__'+pair+'__'+String(index).padStart(2,'0')+'.png');
const keyInput=join(work,'input-'+Date.now());
await mkdir(keyInput,{recursive:true});
const updated=[];
const extendedSleep=new Set();
for(const variant of variants){
 if(!Object.hasOwn(catalogue,variant))throw Error('Unknown pet form');
 if(pairs.includes('sleep-stretch'))try{await access(join(sheets,variant+'-sleep-full.png'));extendedSleep.add(variant);}catch{}
 const needed=new Set([...pairs,'idle-inspect','walk-wave',...(pairs.includes('jump-happy')?['bite-chew']:[]),...(extendedSleep.has(variant)?['sleep-full']:[])]);
 for(const pair of needed){
  const path=join(sheets,variant+'-'+pair+'.png');
  const bytes=await readFile(path),hash=digest(bytes);
  if(manifest.sheets[variant+'-'+pair]===hash){try{await access(hdFile(variant,pair,23));continue;}catch{}}
  const result=await run('ffprobe',['-v','error','-show_entries','stream=width,height','-of','json',path],{windowsHide:true});
  const image=JSON.parse(result.stdout).streams[0];
  if(image.width!==1536||image.height!==1024)throw Error('Expected a 6x4 square-cell atlas: '+path);
  const matte=await run('ffmpeg',['-hide_banner','-loglevel','error','-i',path,'-vf','format=rgba,crop=8:8:0:0','-frames:v','1','-pix_fmt','rgba','-f','rawvideo','pipe:1'],{windowsHide:true,encoding:'buffer'});
  if(!Buffer.isBuffer(matte.stdout)||Array.from({length:64},(_,i)=>i*4).some(i=>matte.stdout[i+3]>12&&!(matte.stdout[i]<30&&matte.stdout[i+1]>230&&matte.stdout[i+2]<30)))throw Error('Atlas background must have transparent alpha or uniform chroma green: '+path);
  manifest.backgrounds[variant+'-'+pair]=matte.stdout[3]>12?'green':'transparent';
  const graph="color=c=0x00ff00:s=256x256:r=24[bg];[0:v]crop=256:256:x='mod(n,6)*256':y='floor(mod(n,24)/6)*256',trim=end_frame=24,setpts=PTS-STARTPTS[actor];[bg][actor]overlay=shortest=1:format=auto,format=rgb24[out]";
  await command('ffmpeg',['-hide_banner','-loglevel','error','-threads','2','-loop','1','-framerate','24','-i',path,'-filter_complex',graph,'-map','[out]','-frames:v','24','-start_number','0','-y',join(keyInput,variant+'__'+pair+'__%02d.png')]);
  updated.push({key:variant+'-'+pair,hash});
 }
}
if(updated.length){
 await command(upscaler,['-i',keyInput,'-o',hd,'-m',join(dirname(upscaler),'models'),'-n','realesr-animevideov3','-s','2','-j','1:1:1','-f','png'],'upscale-'+Date.now()+'.log');
 for(const entry of updated)manifest.sheets[entry.key]=entry.hash;
 await writeFile(manifestPath,JSON.stringify(manifest,null,2));
}
const alpha='255-max(0,g(X,Y)-max(r(X,Y),b(X,Y)))';
function unmix(green){
 const coverage=green?'if(gt(g(X,Y)-max(r(X,Y),b(X,Y)),150)*gt(g(X,Y),190),0,'+alpha+')':alpha;
 return "format=gbrap,geq=r='r(X,Y)':g='min(g(X,Y),max(r(X,Y),b(X,Y)))':b='b(X,Y)':a='if(lt("+coverage+",12),0,"+coverage+")',unpremultiply=inplace=1,premultiply=inplace=1,unpremultiply=inplace=1,format=rgba";
}
async function encode(frames,count,name,reversed=false,green=false){
 const temp=join(out,name+'.part.webm'),destination=join(out,name+'.webm');
 const filter=(reversed?'reverse,':'')+'scale=424:424:flags=lanczos,'+unmix(green)+',pad=432:492:4:34:color=0x00000000,format=yuva420p';
 await command('ffmpeg',['-hide_banner','-loglevel','error','-threads','2','-framerate','60','-start_number','1','-i',join(frames,'%08d.png'),'-vf',filter,'-frames:v',String(count),'-c:v','libvpx-vp9','-pix_fmt','yuva420p','-auto-alt-ref','0','-row-mt','1','-deadline','realtime','-cpu-used','6','-crf','22','-b:v','0','-g','12','-threads','2','-an','-y',temp]);
 await rename(temp,destination);
}
const jobs=[];
for(const variant of variants)for(const pair of pairs){
 const actions=daily[pair]??catalogue[variant].slice((pair.charCodeAt(pair.length-1)-97)*2,(pair.charCodeAt(pair.length-1)-97)*2+2).map(move=>[move.id,move.duration]);
 if(actions.length!==2)throw Error('Unknown action pair '+pair);
 for(let row=0;row<2;row++){
  const [kind,duration]=actions[row];
  let ids=Array.from({length:12},(_,index)=>row*12+index);
  if(kind==='walk')ids=[1,2,3,4,5,6,7,8,9,10,1];
  if(kind==='sleep')ids=[0,1,2,3,4,5,6,7,8,7,6,5,6,7,8,9,10,11];
  if(kind==='sleep'&&extendedSleep.has(variant))ids=[...Array.from({length:18},(_,i)=>i),16,15,14,13,12,13,14,15,16,17,18,19,20,21,22,23];
  const keys=ids.map(index=>hdFile(variant,kind==='sleep'&&extendedSleep.has(variant)?'sleep-full':pair,index));
  const neutral=hdFile(variant,'idle-inspect',0),chew=hdFile(variant,'bite-chew',12);
  if(kind!=='walk')keys[0]=kind==='chew'||kind==='happy'?chew:neutral;
  keys[keys.length-1]=kind==='walk'?keys[0]:kind==='bite'||kind==='chew'?chew:neutral;
  jobs.push({variant,kind,duration,keys,green:manifest.backgrounds[variant+'-'+pair]==='green'});
 }
 if(pair==='walk-wave')jobs.push({variant,kind:'walkin',duration:200,keys:[hdFile(variant,'idle-inspect',0),hdFile(variant,'walk-wave',1)],green:manifest.backgrounds[variant+'-'+pair]==='green'});
}
for(const job of jobs){
 const {variant,kind,duration,keys,green}=job;
 const prefix='pet-motion-'+(variant==='base'?'':variant+'-'),name=prefix+kind;
 const count=Math.max(12,Math.round(duration*60/1000));
 const keyHash=digest(Buffer.concat(await Promise.all(keys.map(path=>readFile(path)))));
 const hash=digest('v28:full-frame:guard4:432x492:60:vp9:12:'+duration+':'+keyHash+(green?':chroma:immutable-keys-v2':''));
 if(manifest.clips[name]===hash){try{await access(join(out,name+'.webm'));console.log('Cached '+name);continue;}catch{}}
 let existing;
 for(const entry of (await readdir(work,{withFileTypes:true})).filter(item=>item.isDirectory()&&item.name.startsWith(name+'-')).sort((a,b)=>b.name.localeCompare(a.name))){
  const candidate=join(work,entry.name);
  try{
   const metadata=JSON.parse(await readFile(join(candidate,'render.json'),'utf8'));
   if(metadata.keyHash!==keyHash||metadata.count!==count)continue;
   const files=(await readdir(join(candidate,'keys'))).filter(file=>/^\d{8}\.png$/.test(file)).sort();
   if(files.length!==keys.length)continue;
   const actual=digest(Buffer.concat(await Promise.all(files.map(file=>readFile(join(candidate,'keys',file))))));
   if(actual!==keyHash)continue;
   await access(join(candidate,'frames',String(count).padStart(8,'0')+'.png'));
   existing=candidate;break;
  }catch{/* A partial render is never reused. */}
 }
 const folder=existing??join(work,name+'-'+Date.now()),input=join(folder,'keys'),frames=join(folder,'frames');
 await mkdir(input,{recursive:true});await mkdir(frames,{recursive:true});
 if(!existing){
  for(let i=0;i<keys.length;i++)await copyFile(keys[i],join(input,String(i).padStart(8,'0')+'.png'));
  await command(rife,['-i',input,'-o',frames,'-m',join(dirname(rife),'rife-v4.6'),'-n',String(count),'-j','1:1:1','-f','%08d.png'],name+'.log');
  await writeFile(join(folder,'render.json'),JSON.stringify({keyHash,count}));
 }
 await encode(frames,count,name,false,green);
 if(kind==='walk')await encode(frames,count,prefix+'walkback',true,green);
 if(kind==='walkin')await encode(frames,count,prefix+'walkout',true,green);
 manifest.clips[name]=hash;
 await writeFile(manifestPath,JSON.stringify(manifest,null,2));
 console.log('Rendered '+name+' '+count+' complete-body frames');
}
console.log('Prepared '+jobs.length+' actions in '+out);

