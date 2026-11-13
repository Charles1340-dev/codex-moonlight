import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { playNativeVoyage, probeMainWindow } from "../desktop/native-voyage.cjs";
import { runInNewContext } from "node:vm";

test("native intro retries unavailable documents and remounts after a startup reload", async context => {
  const webRoot = mkdtempSync(join(tmpdir(), "moonlight-voyage-test-"));
  const bundle = join(webRoot, "native-voyage");
  mkdirSync(bundle);
  for (const file of ["intro.js", "intro.css"]) writeFileSync(join(bundle, file), "");
  context.after(() => {
    for (const file of ["intro.js", "intro.css"]) unlinkSync(join(bundle, file));
    rmdirSync(bundle);
    rmdirSync(webRoot);
  });

  const target = {
    type: "page", id: "workbench", url: "app://-/index.html?initialRoute=%2F",
    webSocketDebuggerUrl: "ws://127.0.0.1:9335/devtools/page/workbench",
  };
  let lists = 0;
  let documentAge = 1;
  let firstConfirmation = true;
  const mounted = [];
  context.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ++lists === 1 ? [] : [target],
  }));

  const originalSocket = globalThis.WebSocket;
  globalThis.WebSocket = class extends EventTarget {
    constructor() {
      super();
      queueMicrotask(() => this.dispatchEvent(new Event("open")));
    }
    send(message) {
      const { id, params: { expression } } = JSON.parse(message);
      let value;
      if (expression.includes("MoonlightVoyage.mount")) {
        mounted.push(documentAge);
        value = true;
      } else if (expression.includes("moonlight-voyage-finished")) {
        value = !firstConfirmation;
        if (firstConfirmation) documentAge++;
        firstConfirmation = false;
      } else {
        value = lists === 2 ? null : { loadedAt: documentAge, focused: true, reduced: false };
      }
      queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify({ id, result: { result: { value } } }),
      })));
    }
    close() {}
  };
  context.after(() => { globalThis.WebSocket = originalSocket; });

  assert.equal(await playNativeVoyage(9335, webRoot, webRoot), true);
  assert.deepEqual(mounted, [1, 2]);
});

test("native intro prepares the hidden loading page before the workspace exists", async context => {
  const target = {type:'page',id:'loading',url:'app://-/index.html',webSocketDebuggerUrl:'ws://127.0.0.1:9335/devtools/page/loading'};
  context.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>[target]}));
  const original=globalThis.WebSocket;
  globalThis.WebSocket=class extends EventTarget {
    constructor(){super();queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
    send(message){
      const {id,params:{expression}}=JSON.parse(message);
      const value=runInNewContext(expression,{
        location:new URL(target.url),URLSearchParams,performance:{timeOrigin:42},
        document:{hidden:true,readyState:'loading',body:{},getElementById:()=>({}),hasFocus:()=>false,
          querySelector:()=>{throw Error('Workspace is not ready');}},
        sessionStorage:{getItem:()=>null},matchMedia:()=>({matches:false}),
      });
      queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id,result:{result:{value}}})})));
    }
    close(){}
  };
  context.after(()=>{globalThis.WebSocket=original;});
  const page=await probeMainWindow(9335);
  assert.equal(page.state.loadedAt,42);
  assert.equal(page.state.visible,false);
  assert.equal(page.state.started,false);
});
