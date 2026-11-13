import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PetFilm } from './PetFilm.jsx';
import moves from '../desktop/pet-moves.json';
import './pet.css';
import './pet-preview.css';

const forms={base:'常态',snakeman:'四档 · 蛇人',nika:'五档'};
const daily={idle:'待机',walk:'走路',wave:'挥手',inspect:'找零食',bite:'咬一口',chew:'咀嚼',happy:'吃饱啦',sleep:'睡觉',jump:'跳跃',stretch:'伸懒腰'};

function Preview(){
  const [variant,setVariant]=useState('base'),[kind,setKind]=useState('idle');
  const [motion,setMotion]=useState(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [large,setLarge]=useState(true),[direction,setDirection]=useState(1);
  const [ready,setReady]=useState(null),[request,setRequest]=useState(0),[automatic,setAutomatic]=useState(false);
  const autoRest=useRef(true),series=useRef(0);
  const stage=useRef(null);
  const play=next=>{setKind(next);setRequest(previous=>previous+1);};
  function form(next){series.current++;setAutomatic(false);setReady(null);setVariant(next);play('idle');}
  useEffect(()=>{
    window.petPreview={play,setVariant:form,setMotion,setDirection,setAutoRest:value=>{autoRest.current=value;},get catalogue(){return {daily:Object.keys(daily),moves};}};
    return()=>{delete window.petPreview;};
  });
  useEffect(()=>{
    const video=document.querySelector('.pet-film video');
    if(!video?.requestVideoFrameCallback)return;
    let active=true,firstQuality,lastStamp,count=0;
    const gaps=[];
    const presented=(now)=>{
      if(!active)return;
      if(video.dataset.clip===kind&&!video.paused){
        const quality=video.getVideoPlaybackQuality();
        if(!firstQuality)firstQuality={time:now,total:quality.totalVideoFrames,dropped:quality.droppedVideoFrames};
        if(lastStamp){gaps.push(now-lastStamp);count++;if(gaps.length>300)gaps.shift();}lastStamp=now;
        if(count>0&&count%60===0){
          const sorted=[...gaps].sort((a,b)=>a-b);
          stage.current.dataset.playback=JSON.stringify({variant,kind,frames:count,fps:count*1000/(now-firstQuality.time),p95:sorted[Math.floor(sorted.length*.95)],maxGap:Math.max(...gaps),dropped:quality.droppedVideoFrames-firstQuality.dropped});
        }
      }
      video.requestVideoFrameCallback(presented);
    };
    video.requestVideoFrameCallback(presented);
    return()=>{active=false;};
  },[variant,kind,request,motion]);
  async function demonstrate(){
    const id=++series.current;setAutomatic(true);autoRest.current=true;
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    for(const action of [...Object.keys(daily).filter(key=>!['idle','bite','chew','happy'].includes(key)),...moves[variant].map(move=>move.id)]){
      if(series.current!==id)break;
      play(action);
      for(let i=0;i<280;i++){
        await wait(25);
        const video=document.querySelector('.pet-film video');
        if(video?.dataset.clip===action&&video.readyState>=2)break;
      }
      if(action==='walk'){await wait(2000);play('idle');await wait(900);}
      else for(let i=0;i<360;i++){
        await wait(25);
        if(series.current!==id||document.querySelector('.pet-film')?.dataset.clip==='idle')break;
      }
      await wait(250);
    }
    if(series.current===id)setAutomatic(false);
  }
  return <main className="motion-preview">
    <header><span>月白解放 / 桌宠动作</span><h1>让路飞动起来</h1><p>走路、互动、侧躺睡觉与各形态的六种招式。</p></header>
    <nav aria-label="桌宠形态">{Object.entries(forms).map(([id,label])=><button key={id} aria-pressed={variant===id} onClick={()=>form(id)}>{label}</button>)}</nav>
    <section ref={stage} className="motion-stage" data-variant={variant} data-action={kind}>
      <div className={'motion-actor'+(large?' motion-large':'')}>
        <PetFilm kind={kind} variant={variant} motion={motion} direction={direction} actionId={request}
          assetBase="/local-themes/pet-v28/clips/" onReady={setReady}
          onComplete={event=>{if(autoRest.current&&event.library===variant)play('idle');}} />
      </div>
      <span className="motion-caption">{daily[kind]||moves[variant].find(move=>move.id===kind)?.label}</span>
    </section>
    <section className="motion-controls" aria-label="动作选择"><div>{Object.entries(daily).map(([id,label])=><button key={id} aria-pressed={kind===id} onClick={()=>{series.current++;setAutomatic(false);play(id);}}>{label}</button>)}</div><div>{moves[variant].map(move=><button key={move.id} aria-pressed={kind===move.id} onClick={()=>play(move.id)}>{move.label}</button>)}</div></section>
    <footer><button onClick={()=>automatic?(series.current++,setAutomatic(false),play('idle')):void demonstrate()}>{automatic?'停止演示':'连续演示'}</button><label><input type="checkbox" checked={motion} onChange={event=>setMotion(event.target.checked)}/>播放动画</label><label><input type="checkbox" checked={large} onChange={event=>setLarge(event.target.checked)}/>放大查看</label><button onClick={()=>setDirection(value=>-value)}>转身</button><output>{ready?.variant===variant?'动作就绪':'准备动作…'}</output></footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
