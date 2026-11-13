// Every video frame contains one complete drawing; there is no body-part rig.
export const EFFORT_FRAME_COUNT = 144;
export const EFFORT_SEGMENT_MS = 1200;
export function effortAnimationSources(base = '/local-themes/voyage/') {
  return ['forward','reverse','laugh','laugh-reverse'].map(name => base + 'effort-film-' + name + '.webm');
}
export function effortFrame(position) {
  const value = Math.max(0, Math.min(5, position));
  const segment = Math.min(4, Math.max(0, Math.ceil(value) - 1));
  return { segment, frame: Math.round((value - segment) * 143) };
}
export function advanceEffort(position, target, milliseconds, reduced = false) {
  if (reduced) return target;
  const step = Math.max(0, milliseconds) / EFFORT_SEGMENT_MS;
  return position + Math.sign(target - position) * Math.min(Math.abs(target - position), step);
}

// Self-contained: the same single decoder is installed into the native popover.
export function createEffortPlayer(canvas, sources, initial = 0, reduced = false) {
  const context = canvas.getContext('2d', { alpha: true });
  context.imageSmoothingQuality = 'high';
  canvas.width = canvas.height = 768;
  const video = document.createElement('video');
  video.className = 'effort-film';
  video.setAttribute('data-moonlight-effort-film','true');
  video.setAttribute('aria-hidden','true');
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  video.disablePictureInPicture = true;
  video.style.visibility = 'hidden';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const life = new AbortController();
  let urls = [], clip = -1, position = Math.max(0,Math.min(5,initial)), target = position;
  let booted = false, switching = false, stopped = false, hasFrame = false, leavingLaugh = false;
  let handle, frameHandle, last, rate = .3;
  const disabled = () => reduced || media.matches || Boolean(canvas.closest?.('.reduce-motion'));
  const laughEnd = 143 / 90;
  function mount() { if (canvas.parentElement && video.parentElement !== canvas.parentElement) canvas.parentElement.append(video); }
  function originalIndex(value) {
    const segment = Math.min(4, Math.max(0, Math.ceil(value)-1));
    return segment*144 + (value-segment)*143;
  }
  function timeFor(value, nextClip) { const index=originalIndex(value); return (nextClip===1?719-index:index)/120; }
  function readPosition(time=video.currentTime) {
    if(clip>=2) return 4;
    const index=Math.max(0,Math.min(719,clip===1?719-time*120:time*120));
    const segment=Math.min(4,Math.floor(index/144));
    return segment+Math.min(143,index-segment*144)/143;
  }
  function publish(time=video.currentTime) {
    if(switching)return;
    position=readPosition(time);
    if(Math.abs(position-Math.round(position))<.0001)position=Math.round(position);
    const index=Math.max(0,Math.min(719,Math.round(clip===1?719-time*120:time*120)));
    canvas.dataset.position=String(position);
    canvas.dataset.mode=clip>=2?'laugh':'transform';
    canvas.dataset.segment=clip>=2?'laugh':String(Math.min(4,Math.floor(index/144)));
    canvas.dataset.frame=String(clip>=2?Math.min(143,Math.round(time*90)):index%144);
    canvas.dataset.sourcePixels='640';
    canvas.dataset.decoders='1';
    canvas.dataset.playing=String(!video.paused);
  }
  function hold() {
    if(hasFrame&&!switching&&video.readyState>=2) {
      context.clearRect(0,0,768,768);
      context.drawImage(video,0,0,768,768);
      canvas.style.visibility='visible';
    }
    video.style.visibility='hidden';
    video.pause();
  }
  function until(event,check) {
    if(check())return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const finish=error=>{clearTimeout(timer);video.removeEventListener(event,on);video.removeEventListener('error',bad);life.signal.removeEventListener('abort',abort);error?reject(error):resolve();};
      const on=()=>finish(), bad=()=>finish(Error('整身动画解码失败')), abort=()=>finish(Error('动画已关闭'));
      const timer=setTimeout(()=>finish(Error('整身动画载入超时')),6000);
      video.addEventListener(event,on,{once:true});
      video.addEventListener('error',bad,{once:true});
      life.signal.addEventListener('abort',abort,{once:true});
    });
  }
  async function switchClip(next,time) {
    if(stopped)return;
    hold(); switching=true;
    try {
      mount();
      if(clip!==next) {
        video.loop=false;
        video.src=urls[next]; video.load();
        await until('loadedmetadata',()=>video.readyState>=1);
        clip=next;
      }
      const seek=Math.max(0,Math.min(video.duration-.001,time));
      const fps=next>=2?90:120, lastFrame=next>=2?143:719;
      const shownFrame=Math.min(lastFrame,Math.floor((video.currentTime+.00001)*fps));
      // Do not seek the frame already on screen: that can force a whole GOP decode.
      if(shownFrame!==Math.round(seek*fps)||video.seeking) {
        const done=until('seeked',()=>false);
        video.currentTime=seek;
        await done;
      }
      await until('loadeddata',()=>video.readyState>=2&&!video.seeking);
      if(stopped)return;
      hasFrame=true; switching=false;
      video.style.visibility='visible'; canvas.style.visibility='hidden';
      publish();
    } catch(error) {
      switching=false;
      if(!stopped){canvas.dataset.error='true';throw error;}
    }
  }
  function play() {
    if(stopped||document.hidden)return;
    video.play().catch(error=>{if(!stopped&&error.name!=='AbortError')canvas.dataset.error='true';});
    wake();
  }
  async function land(value) {
    const next=value===4&&!disabled()?2:clip>=2?0:Math.max(0,clip);
    leavingLaugh=false;
    await switchClip(next,next===2?0:timeFor(value,next));
    if(stopped)return;
    position=value; canvas.dataset.position=String(value);
    if(next===2&&target===4&&!disabled()){video.loop=true;rate=1;video.playbackRate=1;play();}
    else if(target!==value||disabled()&&next>=2)drive();
  }
  function fail(error) { if(!stopped){canvas.dataset.error='true';video.pause();} }
  function drive() {
    if(!booted||stopped||switching)return;
    mount();
    if(clip<2)position=readPosition();
    if(disabled()) {
      video.pause();
      if(clip>=2||Math.abs(position-target)>.0001)land(target).catch(fail);
      return;
    }
    if(clip>=2) {
      if(target===4) {
        leavingLaugh=false;
        if(clip===3) switchClip(2,Math.max(0,laughEnd-video.currentTime)).then(drive).catch(fail);
        else {video.loop=true;rate=1;video.playbackRate=1;play();}
      } else if(!leavingLaugh) {
        const phase=clip===3?laughEnd-video.currentTime:video.currentTime;
        const next=phase<laughEnd/2?3:2;
        leavingLaugh=true;
        switchClip(next,next===3?laughEnd-phase:phase).then(()=>{video.loop=false;rate=1;video.playbackRate=1;play();}).catch(fail);
      } else play();
      return;
    }
    const distance=target-position;
    if(Math.abs(distance)<.0001) {
      if(target===4)land(4).catch(fail);
      else {video.pause();canvas.dataset.playing='false';}
      return;
    }
    const next=distance>0?0:1;
    if(clip!==next) switchClip(next,timeFor(position,next)).then(()=>{rate=.3;video.playbackRate=rate;drive();}).catch(fail);
    else play();
  }
  function wake(){if(!stopped&&handle===undefined)handle=requestAnimationFrame(tick);}
  function tick(now) {
    handle=undefined;
    if(stopped)return;
    const dt=last===undefined?0:Math.min(40,now-last); last=now;
    if(!switching&&!video.paused) {
      publish();
      if(disabled()){drive();return;}
      if(clip<2) {
        const distance=target-position, direction=clip===0?1:-1;
        if(distance*direction<=.0002) {land(target).catch(fail);last=undefined;return;}
        const desired=Math.max(.16,Math.min(1,Math.abs(distance)/.085));
        rate+=(desired-rate)*(1-Math.exp(-dt/45));
      } else rate+=((leavingLaugh?2:1)-rate)*(1-Math.exp(-dt/65));
      if(Math.abs(video.playbackRate-rate)>.015)video.playbackRate=rate;
    }
    if(!video.paused||switching)wake();else last=undefined;
  }
  function ended() {
    if(stopped||switching)return;
    publish();
    if(clip>=2) {
      leavingLaugh=false;
      if(target===4&&!disabled()){land(4).catch(fail);return;}
      const next=target>4?0:1;
      switchClip(next,timeFor(4,next)).then(drive).catch(fail);
    } else land(target).catch(fail);
  }
  function videoFrame(now,metadata) {
    if(stopped)return;
    if(!switching)publish(metadata.mediaTime);
    frameHandle=video.requestVideoFrameCallback?.(videoFrame);
  }
  function resume(){last=undefined;if(document.hidden)video.pause();else drive();}
  video.addEventListener('ended',ended);
  media.addEventListener?.('change',resume);
  document.addEventListener?.('visibilitychange',resume);
  mount();
  const ready=Promise.all(sources.map(async source=>{
    let blob;
    if(source.startsWith('data:video/webm;base64,')){
      const text=atob(source.slice(source.indexOf(',')+1));
      const bytes=new Uint8Array(text.length);
      for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);
      blob=new Blob([bytes],{type:'video/webm'});
    } else {
      const response=await fetch(source,{signal:life.signal});
      if(!response.ok)throw Error('本地整身动画不可用');
      blob=await response.blob();
    }
    if(stopped)return null;
    const url=URL.createObjectURL(blob);urls.push(url);return url;
  })).then(async loaded=>{
    if(stopped)return;
    urls=loaded;
    const first=position===4&&!disabled()?2:0;
    await switchClip(first,first===2?0:timeFor(position,first));
    if(stopped)return;
    booted=true;canvas.dataset.ready='true';
    frameHandle=video.requestVideoFrameCallback?.(videoFrame);
    drive();
  });
  return {
    ready, mount,
    setTarget(value,disableMotion=reduced) {
      if(!Number.isInteger(value)||value<0||value>5)return;
      target=value;reduced=disableMotion;canvas.dataset.target=String(value);
      drive();
    },
    destroy(){
      stopped=true;life.abort();cancelAnimationFrame(handle);
      video.cancelVideoFrameCallback?.(frameHandle);
      media.removeEventListener?.('change',resume);
      document.removeEventListener?.('visibilitychange',resume);
      video.pause();video.removeAttribute('src');video.load();video.remove();
      urls.forEach(url=>URL.revokeObjectURL(url));urls=[];
    },
  };
}

