const {app,BrowserWindow}=require('electron');
const {readFileSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {deflateSync}=require('node:zlib');

function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([length,type,data,checksum]);}
function atlas(){
 const header=Buffer.alloc(13);header.writeUInt32BE(2,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
 // Original red/blue fixture with a valid ancillary chunk; no local character artwork.
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('tEXt',Buffer.from('Regression\0'+'a'.repeat(1700000))),chunk('IDAT',deflateSync(Buffer.from([0,255,30,30,255,20,60,240,255]))),chunk('IEND',Buffer.alloc(0))]);
}
app.whenReady().then(async()=>{
 const root=resolve(__dirname,'..');
 const js=readFileSync(join(root,'dist/client/native-voyage/intro.js'),'utf8');
 const css=readFileSync(join(root,'dist/client/native-voyage/intro.css'),'utf8');
 const ships='data:image/png;base64,'+atlas().toString('base64');
 if(ships.length<=2097152)throw Error('The large-atlas regression fixture must exceed 2 MiB');
 const window=new BrowserWindow({width:960,height:640,show:false,focusable:false,skipTaskbar:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 await window.loadURL('data:text/html,'+encodeURIComponent('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; script-src \'none\'"><body></body>'));
 const results=[];
 for(const refinedShips of [false,true]){
  const props={css,ships,refinedShips,chapterArt:{},ticket:'ship-test-'+refinedShips};
  const mounted=await window.webContents.executeJavaScript(`(()=>{${js};return MoonlightVoyage.mount(${JSON.stringify(props)});})()`);
  if(!mounted)throw Error('Startup did not mount');
  await new Promise(resolve=>setTimeout(resolve,800));
  const state=await window.webContents.executeJavaScript(`(()=>{const s=document.querySelector('#moonlight-native-voyage').shadowRoot;const e=s.querySelector('.voyage-ship');const box=e.getBoundingClientRect();return {width:box.width,height:box.height,images:[...e.children].map(child=>({background:getComputedStyle(child).backgroundImage.length,opacity:Number(getComputedStyle(child).opacity)}))};})()`);
  const screenshot=await window.webContents.capturePage();const pixels=screenshot.toBitmap();let painted=0;
  for(let i=0;i<pixels.length;i+=4)if(pixels[i+2]>200&&pixels[i+1]<80&&pixels[i]<80&&pixels[i+3]>200)painted++;
  const result={refinedShips,...state,painted};results.push(result);
  await window.webContents.executeJavaScript("document.getElementById('moonlight-native-voyage').shadowRoot.querySelector('.boot-skip').click()");
  if(state.width<100||state.height<100||state.images.length!==2||state.images.some(image=>image.background<2097152)||painted<500)throw Error('Ship atlas did not paint: '+JSON.stringify(result));
 }
 // The public build must still show its generic boats without an optional atlas.
 await window.webContents.executeJavaScript(`(()=>{${js};return MoonlightVoyage.mount(${JSON.stringify({css,ships:'',refinedShips:false,chapterArt:{},ticket:'public-boats'})});})()`);
 const fallback=await window.webContents.executeJavaScript("document.getElementById('moonlight-native-voyage').shadowRoot.querySelectorAll('.ship-fallback').length");
 if(fallback!==2)throw Error('Public generic boats are missing');
 console.log(JSON.stringify({passed:true,fixtureBytes:ships.length,results,fallback}));app.exit(0);
}).catch(error=>{console.error(error.message);app.exit(1);});
