import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {zipSync} from 'fflate';

const root=resolve('.'),manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const directories=['.github','.openai','desktop','docs','scripts','src','tests','themes','worker'];
const topFiles=['.gitignore','.npmrc','AGENTS.md','CONTRIBUTING.md','LICENSE','README.md','index.html','package.json','package-lock.json','vite.config.mjs'];
const forbidden=/(^|\/)(?:\.git|node_modules|dist|release|qa|local-themes)(\/|$)|(^|\/)\.env(?:\.|$)|\.(?:pem|key|p12|pfx)$/i;
const credential=/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,})\b/;
const files=[];
async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name),name=relative(root,path).replaceAll('\\','/');if(forbidden.test(name))continue;if(entry.isSymbolicLink())throw Error('公开源码不接受符号链接：'+name);if(entry.isDirectory())await walk(path);else if(entry.isFile())files.push(path);}}
for(const directory of directories)await walk(join(root,directory));
for(const file of topFiles)files.push(join(root,file));
const entries={},records=[];
for(const file of files.sort()){
 const name=relative(root,file).replaceAll('\\','/'),bytes=await readFile(file);
 if(forbidden.test(name)||bytes.length>5_000_000)throw Error('禁止发布或过大的源码文件：'+name);
 if(/\.(?:m?js|cjs|jsx|json|md|ps1|yml|html|css)$|^\.npmrc$/.test(name)){
  const text=bytes.toString('utf8');
  if(credential.test(text)||(name==='.npmrc'&&/(?:_authToken|_password|_auth)\s*=/i.test(text)))throw Error('检测到疑似凭据，请先从源码移除：'+name);
 }
 entries['codex-moonlight-'+manifest.version+'-source/'+name]=[bytes,{mtime:new Date('2026-01-01T00:00:00Z'),level:9}];
 records.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await mkdir(join(root,'release'),{recursive:true});
const name='MoonlightCodex-'+manifest.version+'-source.zip',archive=zipSync(entries);
await writeFile(join(root,'release',name),archive);
await writeFile(join(root,'release',name+'.sha256'),createHash('sha256').update(archive).digest('hex')+'  '+name+'\n');
await writeFile(join(root,'release','source-manifest.json'),JSON.stringify({version:manifest.version,files:records},null,2)+'\n');
console.log(JSON.stringify({archive:name,files:records.length,bytes:archive.length}));
