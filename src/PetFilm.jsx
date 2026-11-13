import { useEffect, useLayoutEffect, useRef, useState } from "react";
import movesByVariant from "../desktop/pet-moves.json";
import { createPetFilmPlayer, PET_DAILY_CLIPS, PET_TRANSITION_CLIPS } from "./pet-film-player.mjs";

const clipFor={sniff:"inspect",drool:"inspect",morph:"inspect",eat:"chew"};
export function PetFilm({kind,direction,motion,variant,onReady,onComplete,actionId,assetBase="/local-themes/voyage/"}) {
  const available=import.meta.env.DEV||Boolean(window.moonlight);
  const [visible,setVisible]=useState(()=>!document.hidden);
  const [loaded,setLoaded]=useState({});
  const [state,setState]=useState({shown:"",holding:false,decoding:true,direction:1,library:"",error:false});
  const video=useRef(null),hold=useRef(null),controller=useRef(null),callbacks=useRef({});
  callbacks.current={onReady,onComplete};
  const desired=clipFor[kind]??kind;
  const prefix=assetBase+"pet-motion-"+(variant==="base"?"":variant+"-");

  useEffect(()=>{
    const update=()=>setVisible(!document.hidden);
    document.addEventListener('visibilitychange',update);
    return()=>document.removeEventListener('visibilitychange',update);
  },[]);

  useLayoutEffect(()=>{
    if(!available)return;
    const instance=createPetFilmPlayer(video.current,hold.current,setState,result=>callbacks.current.onComplete?.(result));
    controller.current=instance;
    return()=>{instance.destroy();controller.current=null;};
  },[available]);

  useEffect(()=>{
    if(!available)return;
    const abort=new AbortController(),urls=new Map();
    controller.current.setLibrary(variant);
    setLoaded({});
    const names=[...PET_DAILY_CLIPS.slice(0,1),...PET_TRANSITION_CLIPS,...PET_DAILY_CLIPS.slice(1),...movesByVariant[variant].map(move=>move.id)];
    async function download(){
      while(names.length&&!abort.signal.aborted){
        const name=names.shift();
        try {
          const response=await fetch(prefix+name+".webm?v=28",{signal:abort.signal});
          if(!response.ok)continue;
          const bytes=await response.blob();
          if(abort.signal.aborted)return;
          const url=URL.createObjectURL(bytes);urls.set(name,url);
          controller.current?.supply(variant,name,url);
          setLoaded(previous=>({...previous,[name]:true}));
        }catch{/* Older local packs can continue to use their existing clips. */}
      }
    }
    void Promise.all(Array.from({length:4},download));
    return()=>{abort.abort();for(const url of urls.values())URL.revokeObjectURL(url);};
  },[available,prefix,variant]);

  useEffect(()=>{controller.current?.request(desired,motion&&visible,direction,actionId);},[desired,motion,visible,direction,actionId]);
  useEffect(()=>{
    if(state.shown&&!state.decoding&&!state.error&&state.library===variant)callbacks.current.onReady?.({variant,loaded});
  },[loaded,state,variant]);

  if(!available)return null;
  return <span className="pet-film" data-clip={state.shown} data-variant={variant}
    data-available={Object.keys(loaded).join(" ")} data-direction={state.direction} data-pose={kind}
    data-error={state.error?"true":undefined} aria-hidden="true">
    <canvas ref={hold} className={state.holding?"pet-film-hold":"pet-film-buffer"}/>
    <video ref={video} className={!state.decoding&&state.shown?"pet-film-playing":undefined}
      data-clip={state.shown} data-source={prefix+state.shown+".webm"}
      preload="auto" playsInline muted tabIndex={-1} disablePictureInPicture disableRemotePlayback/>
    {kind==="drool"&&state.shown==="inspect"&&<span className="pet-film-drool"/>}
  </span>;
}

