const { readFileSync, statSync } = require("node:fs");
const { dirname, join } = require("node:path");
const { randomUUID } = require('node:crypto');
const { createEffortPlayer, effortAnimationSources } = require("../src/effort-animation.mjs");
const { EFFORTS } = require("./forms.mjs");

function isCodexRenderer(value) {
  try {
    const url = new URL(value);
    return url.protocol === "app:" && url.hostname === "-" && ["/", "/index.html"].includes(url.pathname);
  } catch {
    return false;
  }
}

function debuggerTarget(targets, port) {
  if (!Array.isArray(targets)) return null;
  return targets.find(target => target?.type === "page" && isCodexRenderer(target.url)
    && typeof target.id === "string" && /^[A-Za-z0-9-]+$/.test(target.id)
    && target.webSocketDebuggerUrl === "ws://127.0.0.1:" + port + "/devtools/page/" + target.id) ?? null;
}

function effortStyles(available = "") {
  if (!available) return "";
  const panel = 'body:has([data-composer-navigation-target="reasoning"][aria-expanded="true"][data-selected-reasoning-effort]) [class*="ViewControls-"][data-effort-header]';
  return panel + '{--moonlight-stage-size:clamp(150px,23vh,194px);padding-block-end:calc(var(--moonlight-stage-size) + 8px);}'
    + panel + '::before,' + panel + '::after{content:none!important;animation:none!important;background-image:none!important;}'
    + '[data-moonlight-effort-stage],[data-moonlight-effort-film]{position:absolute;pointer-events:none;bottom:2px;left:calc(50% - var(--moonlight-stage-size)/2);width:var(--moonlight-stage-size);height:var(--moonlight-stage-size);object-fit:contain;border-radius:8px;}'
    + '@media(prefers-reduced-motion:reduce){[data-moonlight-effort-stage]{scroll-behavior:auto;}}';
}

function readAnimationSources(artPath) {
  try {
    let total = 0;
    return effortAnimationSources('').map(name => {
      const path = join(dirname(artPath), name);
      const size = statSync(path).size;
      total += size;
      if (size > 48_000_000 || total > 100_000_000) throw Error('Animation clip too large');
      const bytes = readFileSync(path);
      if (bytes.readUInt32BE(0) !== 0x1a45dfa3) throw Error('Invalid animation clip');
      return 'data:video/webm;base64,' + bytes.toString('base64');
    });
  } catch { return null; }
}

function installEffortAnimation(createPlayer, sources, mapping) {
  window.__moonlightEffortMotion?.disconnect();
  let surface;
  let player;
  function clear() { player?.destroy(); surface?.remove(); player = surface = undefined; }
  function update() {
    const trigger = document.querySelector('[data-composer-navigation-target="reasoning"][aria-expanded="true"]');
    const panel = document.querySelector('[class*="ViewControls-"][data-effort-header]');
    const form = mapping[trigger?.dataset.selectedReasoningEffort];
    if (!trigger) { clear(); return; }
    if (!panel || form === undefined) return;
    if (!surface) {
      surface = document.createElement('canvas');
      surface.setAttribute('data-moonlight-effort-stage', 'full-body-frames');
      surface.setAttribute('aria-hidden', 'true');
      panel.append(surface);
      player = createPlayer(surface, sources, form);
      player.ready.catch(() => { if(surface) surface.dataset.error = 'true'; });
    }
    if (surface.parentElement !== panel) panel.append(surface);
    player.setTarget(form, trigger.dataset.daybreakReducedMotion === 'true');
  }
  const observer = new MutationObserver(update);
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,
    attributeFilter:['data-selected-reasoning-effort','aria-expanded','data-daybreak-reduced-motion']});
  window.__moonlightEffortMotion = { disconnect() { observer.disconnect(); clear(); } };
  update();
  return true;
}

async function attachEffortShowcase(port, artPath) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return false;
  const sources = readAnimationSources(artPath);
  if (!sources) return false;
  const response = await fetch("http://127.0.0.1:" + port + "/json/list", {redirect:'error',signal:AbortSignal.timeout(1800)});
  if (!response.ok) return false;
  const targets = await response.json();
  if (!Array.isArray(targets)) return false;
  const pages = targets.filter(target => debuggerTarget([target],port)
    && [null,'/'].includes(new URL(target.url).searchParams.get('initialRoute')));
  const mapping = Object.fromEntries(Object.entries(EFFORTS).map(([key,{form}])=>[key,form]));
  const slot = '__moonlightEffortSources_' + randomUUID().replaceAll('-', '');
  const expression = `(() => {
    const id = 'moonlight-voyage-effort';
    const style = document.getElementById(id) || document.createElement('style');
    style.id = id;
    style.textContent = ${JSON.stringify(effortStyles(true))};
    document.head.append(style);
    return (${installEffortAnimation.toString()})(${createEffortPlayer.toString()},window[${JSON.stringify(slot)}],${JSON.stringify(mapping)});
  })()`;
  const results = await Promise.all(pages.map(async target => {
    if (!await evaluateRenderer(target, `Boolean(window[${JSON.stringify(slot)}]=[])`)) return false;
    try {
      for (let index = 0; index < sources.length; index++) {
        if (!await evaluateRenderer(target, `Boolean(window[${JSON.stringify(slot)}][${index}]=${JSON.stringify(sources[index])})`,7000)) return false;
      }
      return await evaluateRenderer(target,expression,7000);
    } finally { await evaluateRenderer(target,`delete window[${JSON.stringify(slot)}]`); }
  }));
  return results.some(Boolean);
}

function evaluateRenderer(target, expression, limit = 2500) {
  return new Promise(resolve => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const timeout = setTimeout(() => done(null), limit);
    function done(value) {
      clearTimeout(timeout);
      socket.close();
      resolve(value);
    }
    socket.addEventListener("error", () => done(null), { once: true });
    socket.addEventListener("open", () => socket.send(JSON.stringify({
      id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true },
    })), { once: true });
    socket.addEventListener("message", event => {
      let result;
      try { result = JSON.parse(event.data); } catch { return; }
      if (result.id === 1) done(result.result?.result?.value ?? null);
    });
  });
}

module.exports = { attachEffortShowcase, debuggerTarget, effortStyles, evaluateRenderer };
