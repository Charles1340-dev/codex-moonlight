// One decoder and one temporary complete-body frame. No pose crossfade or image warping.
const LOOPS = new Set(['idle','walk','chew']);
const INTERNAL = new Set(['walkin','walkout','walkback']);
const STILL = { sleep:.55, wave:.52, stretch:.52, jump:.56, inspect:.42, bite:.82, chew:.2, happy:.5 };
export const PET_DAILY_CLIPS = ['idle','walk','wave','inspect','bite','chew','happy','sleep','jump','stretch'];
export const PET_TRANSITION_CLIPS = ['walkin','walkout','walkback'];

export function createPetFilmPlayer(video, canvas, onState, onComplete) {
  const sources=new Map();
  let library='',currentLibrary='',desired='idle',current='',stage='direct';
  let direction=1,shownDirection=1,motion=true,requestId,playingId;
  let loading=false,destroyed=false,operation,epoch=0,staticFrame=false;
  let held=false;
  function report(error=false){
    onState({shown:current,holding:held,decoding:loading,direction:shownDirection,library:currentLibrary,error});
  }
  function reveal(){
    held=false;canvas.style.visibility='hidden';canvas.classList.remove('pet-film-hold');
    video.style.visibility='visible';video.classList.add('pet-film-playing');
    if(video.parentElement){video.parentElement.dataset.direction=String(shownDirection);video.parentElement.dataset.ready='true';}
  }
  function hold(){
    if(!loading&&video.readyState>=2&&video.videoWidth){
      canvas.width=video.videoWidth;canvas.height=video.videoHeight;
      const context=canvas.getContext('2d');context.clearRect(0,0,canvas.width,canvas.height);
      context.drawImage(video,0,0);held=true;
    }
    video.pause();video.style.visibility='hidden';video.classList.remove('pet-film-playing');
    canvas.style.visibility=held?'visible':'hidden';canvas.classList.toggle('pet-film-hold',held);
  }
  function waitFor(event,check,signal){
    if(check())return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const finish=error=>{clearTimeout(timer);video.removeEventListener(event,done);video.removeEventListener('error',bad);signal.removeEventListener('abort',abort);error?reject(error):resolve();};
      const done=()=>finish(),bad=()=>finish(Error('桌宠动作解码失败'));
      const abort=()=>{const error=Error('动作已取消');error.name='AbortError';finish(error);};
      const timer=setTimeout(()=>finish(Error('桌宠动作载入超时')),6000);
      video.addEventListener(event,done,{once:true});video.addEventListener('error',bad,{once:true});signal.addEventListener('abort',abort,{once:true});
    });
  }
  async function show(name,nextStage='direct',seek=0){
    if(destroyed||!sources.has(name))return;
    hold();operation?.abort();operation=new AbortController();
    const signal=operation.signal,token=++epoch,tag=library,id=requestId;
    const nextDirection=nextStage==='finish'||nextStage==='walkout'?shownDirection:direction;
    loading=true;report();
    try{
      const source=sources.get(name);
      video.loop=false;
      if(video.src!==source){video.src=source;video.load();}
      await waitFor('loadedmetadata',()=>video.readyState>=1,signal);
      let time=seek;
      if(!motion)time=(STILL[name]??(LOOPS.has(name)?0:.55))*video.duration;
      time=Math.max(0,Math.min(video.duration-.001,time));
      const last=Math.max(0,Math.round(video.duration*60)-1);
      const frame=Math.min(last,Math.floor((video.currentTime+.00001)*60));
      if(frame!==Math.round(time*60)||video.seeking){
        const ready=waitFor('seeked',()=>false,signal);video.currentTime=time;await ready;
      }
      await waitFor('loadeddata',()=>video.readyState>=2&&!video.seeking,signal);
      if(destroyed||token!==epoch||tag!==library)return;
      current=name;currentLibrary=tag;stage=nextStage;playingId=id;
      shownDirection=nextDirection;loading=false;staticFrame=!motion;
      video.dataset.clip=name;video.dataset.library=tag;video.dataset.source=source;
      video.loop=motion&&LOOPS.has(name)&&nextStage!=='finish';
      video.playbackRate=nextStage==='finish'?1.5:1;
      reveal();report();
      if(motion)video.play().catch(error=>{if(!destroyed&&error.name!=='AbortError')report(true);});
      // A newer request made during decoding is resolved from this complete frame.
      pump();
    }catch(error){
      if(token===epoch&&!destroyed&&error.name!=='AbortError'){loading=false;report(true);}
    }
  }
  function leaveWalk(){
    stage='finish';
    const elapsed=video.currentTime,duration=video.duration;
    if(elapsed<duration/2&&sources.has('walkback'))void show('walkback','finish',Math.max(0,duration-1/60-elapsed));
    else {video.loop=false;video.playbackRate=1.5;void video.play().catch(()=>{});report();}
  }
  function settleWalk(){
    if(desired==='walk'&&direction===shownDirection){void show('walk','walk');return;}
    if(sources.has('walkout'))void show('walkout','walkout');
    else {stage='direct';current='';pump();}
  }
  function pump(){
    if(destroyed||loading||!sources.has(desired)&&current)return;
    const wanted=sources.has(desired)?desired:sources.has('idle')?'idle':'';
    if(!wanted)return;
    if(!motion){
      if(current!==wanted||currentLibrary!==library||!staticFrame)void show(wanted);
      else video.pause();
      return;
    }
    if(staticFrame){staticFrame=false;void show(wanted);return;}
    if(stage==='finish'||stage==='walkout'||stage==='walkin')return;
    if(current==='walk'&&(wanted!=='walk'||shownDirection!==direction)){leaveWalk();return;}
    // Let autonomous/manual recovery reach its final neutral body before returning to idle.
    if(wanted==='idle'&&current&&!LOOPS.has(current)&&!INTERNAL.has(current)&&!video.ended&&!video.paused)return;
    if(current===wanted&&currentLibrary===library){
      if(current==='idle'&&shownDirection!==direction){
        shownDirection=direction;if(video.parentElement)video.parentElement.dataset.direction=String(shownDirection);report();
      }
      if(playingId!==requestId&&!LOOPS.has(current)){
        if(video.ended)void show(wanted);
        return;
      }
      if(video.paused&&!video.ended)void video.play().catch(()=>{});
      return;
    }
    if(wanted==='walk'&&sources.has('walkin'))void show('walkin','walkin');
    else void show(wanted,wanted==='walk'?'walk':'direct');
  }
  function ended(){
    if(destroyed||loading)return;
    if(stage==='walkin'){
      if(desired==='walk'&&direction===shownDirection)void show('walk','walk');
      else settleWalk();
      return;
    }
    if(stage==='finish'){settleWalk();return;}
    if(stage==='walkout'){stage='direct';current='';pump();return;}
    if(!INTERNAL.has(current)&&!LOOPS.has(current))onComplete({kind:current,library:currentLibrary,requestId:playingId});
    if(desired!==current||playingId!==requestId)pump();
  }
  video.muted=true;video.playsInline=true;video.preload='auto';
  video.addEventListener('ended',ended);
  return {
    setLibrary(tag){
      if(tag===library)return;
      hold();operation?.abort();epoch++;sources.clear();
      library=tag;current='';currentLibrary='';stage='direct';loading=false;staticFrame=false;report();
    },
    supply(tag,name,url){if(destroyed||tag!==library)return;sources.set(name,url);pump();},
    request(name,enabled=true,facing=1,id){
      desired=name;motion=enabled;direction=facing===-1?-1:1;requestId=id;pump();
    },
    destroy(){destroyed=true;epoch++;operation?.abort();video.removeEventListener('ended',ended);video.pause();video.removeAttribute('src');video.load();sources.clear();},
  };
}

