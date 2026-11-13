import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { advanceEffort, effortFrame, effortAnimationSources, createEffortPlayer } from '../src/effort-animation.mjs';

test('all 30 form transitions traverse the complete intermediate animation', () => {
  assert.equal(effortAnimationSources().length,4);
  for(let from=0;from<6;from++)for(let to=0;to<6;to++){
    if(from===to)continue;
    let position=from;
    const segments=new Set();
    for(let tick=0;tick<600&&position!==to;tick++){
      const previous=position;
      position=advanceEffort(position,to,1000/60);
      assert.ok(Math.abs(position-previous)<=1/60);
      const sample=effortFrame(position);
      assert.ok(sample.frame>=0&&sample.frame<144);
      segments.add(sample.segment);
    }
    assert.equal(position,to);
    for(let segment=Math.min(from,to);segment<Math.max(from,to);segment++)assert.ok(segments.has(segment));
  }
});

test('serialized native player uses one decoder, preserves the current body, loops laughter and stops reduced motion', async()=>{
  const callbacks=new Map(),elements=[],snapshots=[],revoked=[];
  let sequence=0;
  class Video extends EventTarget {
    style={};paused=true;readyState=0;duration=6;_time=0;playbackRate=1;loop=false;
    setAttribute(){}removeAttribute(){}
    load(){
      this.readyState=0;this.duration=this.src?.includes('laugh')?1.6:6;this._time=0;
      queueMicrotask(()=>{this.readyState=4;this.dispatchEvent(new Event('loadedmetadata'));this.dispatchEvent(new Event('loadeddata'));});
    }
    get currentTime(){return this._time;}
    set currentTime(value){this._time=value;queueMicrotask(()=>this.dispatchEvent(new Event('seeked')));}
    play(){this.paused=false;return Promise.resolve();}
    pause(){this.paused=true;}
    remove(){this.parentElement=null;elements.splice(elements.indexOf(this),1);}
    advance(dt){
      if(this.paused)return;
      this._time+=dt*this.playbackRate/1000;
      if(this._time>=this.duration){
        if(this.loop)this._time%=this.duration;
        else{this._time=this.duration;this.paused=true;this.dispatchEvent(new Event('ended'));}
      }
    }
  }
  const parent={append(video){video.parentElement=this;if(!elements.includes(video))elements.push(video);}};
  const canvas={dataset:{},style:{visibility:'hidden'},parentElement:parent,getContext:()=>({clearRect(){},drawImage(...args){snapshots.push(args);}})};
  const create=runInNewContext('('+createEffortPlayer.toString()+')',{
    document:{hidden:false,createElement:name=>{assert.equal(name,'video');return new Video();}},
    matchMedia:()=>({matches:false}),
    fetch:async name=>({ok:true,blob:async()=>({name})}),
    URL:{createObjectURL:blob=>blob.name,revokeObjectURL:url=>revoked.push(url)},
    AbortController,setTimeout,clearTimeout,
    requestAnimationFrame:cb=>{callbacks.set(++sequence,cb);return sequence;},
    cancelAnimationFrame:id=>callbacks.delete(id),
  });
  const player=create(canvas,effortAnimationSources(),0);
  await player.ready;
  const video=elements[0];
  assert.equal(elements.length,1);
  assert.equal(canvas.style.visibility,'hidden');
  assert.equal(video.style.visibility,'visible');
  let previous=0;
  async function tick(now){
    video.advance(now-previous);previous=now;
    const work=[...callbacks.values()];callbacks.clear();work.forEach(cb=>cb(now));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(elements.length,1);
    assert.ok(!(canvas.style.visibility==='visible'&&video.style.visibility==='visible'));
  }
  player.setTarget(5);
  for(let now=1000/120;now<1000;now+=1000/120)await tick(now);
  const before=Number(canvas.dataset.position);
  assert.ok(before>.5&&before<1);
  player.setTarget(0);
  assert.ok(Math.abs(Number(canvas.dataset.position)-before)<.03);
  for(let now=1010;now<1700;now+=1000/120)await tick(now);
  assert.ok(Number(canvas.dataset.position)<before);
  player.setTarget(5);
  for(let now=1710;now<10000;now+=1000/120)await tick(now);
  assert.equal(canvas.dataset.position,'5');
  assert.equal(callbacks.size,0);
  player.setTarget(4,true);
  for(let now=10010;now<10100;now+=1000/120)await tick(now);
  assert.equal(canvas.dataset.position,'4');
  assert.equal(video.paused,true);
  player.setTarget(4,false);
  const laughFrames=new Set();
  for(let now=10110;now<12600;now+=1000/120){await tick(now);laughFrames.add(canvas.dataset.mode+':'+canvas.dataset.frame);}
  assert.equal(canvas.dataset.mode,'laugh');
  assert.ok(laughFrames.size>120);
  const frame=canvas.dataset.frame;
  player.setTarget(5);
  assert.equal(canvas.dataset.frame,frame);
  for(let now=12610;now<15000;now+=1000/120)await tick(now);
  assert.equal(canvas.dataset.position,'5');
  assert.ok(snapshots.length>0);
  assert.ok(snapshots.every(args=>args[0]===video&&args.length===5));
  player.destroy();
  assert.equal(elements.length,0);
  assert.equal(callbacks.size,0);
  assert.equal(revoked.length,4);
});

