import assert from 'node:assert/strict';
import test from 'node:test';
import { createPetFilmPlayer, PET_DAILY_CLIPS, PET_TRANSITION_CLIPS } from '../src/pet-film-player.mjs';

class Classes {
  values=new Set();
  add(name){this.values.add(name);}
  remove(name){this.values.delete(name);}
  toggle(name,value){value?this.add(name):this.remove(name);}
}
class Film extends EventTarget {
  style={visibility:'hidden'};classList=new Classes();dataset={};parentElement={dataset:{}};
  src='';paused=true;readyState=0;videoWidth=432;videoHeight=492;duration=1;_time=0;ended=false;loop=false;playbackRate=1;
  load(){
    this.readyState=0;this._time=0;this.ended=false;
    const name=this.src.split(':').at(-1);
    this.duration=({idle:2.65,walk:.833,walkback:.833,walkin:.2,walkout:.2,wave:1.64,sleep:5.82,pistol:1.44})[name]??.94;
    queueMicrotask(()=>{this.readyState=4;this.dispatchEvent(new Event('loadedmetadata'));this.dispatchEvent(new Event('loadeddata'));});
  }
  get currentTime(){return this._time;}
  set currentTime(value){this._time=value;this.ended=false;queueMicrotask(()=>this.dispatchEvent(new Event('seeked')));}
  play(){this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}
  removeAttribute(name){if(name==='src')this.src='';}
  advance(milliseconds){
    if(this.paused)return;
    this._time+=milliseconds*this.playbackRate/1000;
    if(this._time>=this.duration){
      if(this.loop)this._time%=this.duration;
      else{this._time=this.duration;this.ended=true;this.paused=true;this.dispatchEvent(new Event('ended'));}
    }
  }
}

test('pet finishes step/recovery, retains one full-body layer and one decoder across forms',async()=>{
  const video=new Film(),shots=[],states=[],completed=[];
  const canvas={style:{visibility:'hidden'},classList:new Classes(),getContext:()=>({clearRect(){},drawImage(...args){shots.push(args);}})};
  const player=createPetFilmPlayer(video,canvas,state=>{
    states.push(state);
    assert.ok(!(video.style.visibility==='visible'&&canvas.style.visibility==='visible'));
  },result=>completed.push(result));
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const tick=async time=>{video.advance(time);await flush();};
  function library(tag){
    player.setLibrary(tag);
    for(const name of [...PET_DAILY_CLIPS,...PET_TRANSITION_CLIPS,'pistol'])player.supply(tag,name,'blob:'+tag+':'+name);
  }
  library('base');await flush();
  assert.equal(video.dataset.clip,'idle');
  player.request('idle',true,-1,1);await flush();
  assert.equal(video.parentElement.dataset.direction,'-1','neutral idle can turn without reloading its decoder');
  player.request('walk',true,1,10);await flush();
  assert.equal(video.dataset.clip,'walkin');
  await tick(210);assert.equal(video.dataset.clip,'walk');
  await tick(100);
  player.request('idle',true,1,11);await flush();
  assert.equal(video.dataset.clip,'walkback');
  await tick(300);assert.equal(video.dataset.clip,'walkout');
  await tick(210);assert.equal(video.dataset.clip,'idle');
  player.request('walk',true,1,12);await flush();await tick(210);await tick(100);
  player.request('walk',true,-1,13);await flush();
  assert.equal(video.parentElement.dataset.direction,'1','finish the planted step before turning');
  await tick(300);assert.equal(video.dataset.clip,'walkout');
  assert.equal(video.parentElement.dataset.direction,'1');
  await tick(210);assert.equal(video.dataset.clip,'walkin');
  assert.equal(video.parentElement.dataset.direction,'-1','turn only at the neutral stance');
  await tick(210);player.request('idle',true,-1,14);await flush();await tick(700);await tick(210);
  player.request('wave',true,1,20);await flush();await tick(150);
  player.request('idle',true,1,21);await flush();
  assert.equal(video.dataset.clip,'wave','returning to idle must not cut off the gesture');
  await tick(1600);assert.equal(video.dataset.clip,'idle');
  assert.ok(completed.some(result=>result.kind==='wave'&&result.requestId===20));
  player.request('pistol',true,1,30);await flush();await tick(200);
  player.request('pistol',true,1,31);await flush();
  assert.ok(video.currentTime>=.2,'a repeated action waits for the previous recovery');
  await tick(1500);assert.equal(video.dataset.clip,'pistol');
  assert.ok(video.currentTime<.02,'the queued action restarts at the complete neutral body');
  await tick(1500);
  assert.ok(completed.some(result=>result.kind==='pistol'&&result.requestId===30));
  assert.ok(completed.some(result=>result.kind==='pistol'&&result.requestId===31));
  player.request('idle',true,1,32);await flush();
  library('snakeman');
  assert.equal(canvas.style.visibility,'visible','the last decoded body remains while the next form loads');
  await flush();assert.equal(video.dataset.library,'snakeman');
  assert.equal(video.dataset.clip,'idle');
  player.request('sleep',false,1,40);await flush();
  assert.equal(video.paused,true);
  assert.ok(video.currentTime>2.5&&video.currentTime<4,'reduced motion shows a curled sleeping pose');
  assert.ok(shots.length>0&&shots.every(args=>args[0]===video));
  assert.ok(states.every(state=>!state.error));
  player.destroy();
  assert.equal(video.paused,true);
});

