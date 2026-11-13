const { readFileSync, statSync } = require("node:fs");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
const { setTimeout: wait } = require("node:timers/promises");
const { CHAPTER_BOARDS } = require("../src/chapter-art.mjs");
const { debuggerTarget, evaluateRenderer } = require("./reasoning.cjs");

function image(path, mime) {
  try {
    if (statSync(path).size > 3_500_000) return "";
    return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
  } catch {
    return "";
  }
}

function isMainWindow() {
  const route = new URLSearchParams(location.search).get("initialRoute");
  return location.protocol === "app:" && location.hostname === "-"
    && ["/", "/index.html"].includes(location.pathname)
    && (route === null || route === "/") && Boolean(document.body);
}

async function probeMainWindow(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    redirect: "error", signal: AbortSignal.timeout(1800),
  });
  if (!response.ok) return null;
  const targets = await response.json();
  if (!Array.isArray(targets)) return null;
  const mainPages = targets.filter(target => debuggerTarget([target], port)
    && [null, "/"].includes(new URL(target.url).searchParams.get("initialRoute")));
  const pages = await Promise.all(mainPages.map(async target => ({
    target,
    state: await evaluateRenderer(target, `(() => {
      if (!(${isMainWindow.toString()})()) return null;
      return { loadedAt: performance.timeOrigin, focused: document.hasFocus(), visible: !document.hidden,
        started: sessionStorage.getItem('moonlight-voyage-document') === String(performance.timeOrigin),
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches };
    })()`, 1100),
  })));
  return pages.find(page => page.state?.focused) ?? pages.find(page => page.state?.visible)
    ?? pages.find(page => page.state) ?? null;
}

async function runNativeVoyage(port, webRoot, artRoot) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return false;
  const directory = join(webRoot, "native-voyage");
  const js = readFileSync(join(directory, "intro.js"), "utf8");
  const css = readFileSync(join(directory, "intro.css"), "utf8");
  const refined = image(join(artRoot, "ships-v2.png"), "image/png");
  const ships = refined || image(join(artRoot, "ships.png"), "image/png");
  const chapterArt = Object.fromEntries(CHAPTER_BOARDS.map(file => [file, image(join(artRoot, file), "image/webp")]));
  const ticket = randomUUID();
  const props = { css, ships, refinedShips: Boolean(refined), chapterArt, ticket };
  const expression = `(() => { if (!(${isMainWindow.toString()})()) return false;\n${js}\nreturn MoonlightVoyage.mount(${JSON.stringify(props)}); })()`;
  const confirm = `(() => {
    const ticket = ${JSON.stringify(ticket)};
    try { if (sessionStorage.getItem("moonlight-voyage-finished") === ticket) return true; } catch {}
    const host = document.getElementById("moonlight-native-voyage");
    const active = host?.dataset.launch === ticket && Boolean(host.shadowRoot?.querySelector("dialog:modal"));
    if (active) sessionStorage.setItem('moonlight-voyage-document', String(performance.timeOrigin));
    return active;
  })()`;

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const page = await probeMainWindow(port).catch(() => null);
    if (page?.state.reduced) return false;
    if (page) {
      await evaluateRenderer(page.target, expression, 3500).catch(() => null);
      await wait(600);
      if (await evaluateRenderer(page.target, confirm, 1100).catch(() => null) === true) {
        await wait(1000);
        if (await evaluateRenderer(page.target, confirm, 1100).catch(() => null) === true) return true;
      }
    }
    await wait(350);
  }
  return false;
}

const pendingVoyages = new Map();
function playNativeVoyage(port, webRoot, artRoot) {
  if (pendingVoyages.has(port)) return pendingVoyages.get(port);
  const task = runNativeVoyage(port, webRoot, artRoot).finally(() => pendingVoyages.delete(port));
  pendingVoyages.set(port, task);
  return task;
}

function followNativeVoyage(port, webRoot, artRoot, onNewDocument = () => {}) {
  let stopped = false;
  let timer;
  let previous;
  async function poll() {
    try {
      const page = await probeMainWindow(port);
      if (!stopped && page?.state) {
        const identity = page.target.id + ':' + page.state.loadedAt;
        if (identity !== previous) {
          previous = identity;
          onNewDocument();
          if (!page.state.started && !page.state.reduced) {
            if (!await playNativeVoyage(port, webRoot, artRoot)) previous = undefined;
          }
        }
      }
    } catch { /* The Mini connection watcher verifies and recovers the session. */ }
    if (!stopped) timer = setTimeout(poll, 800);
  }
  void poll();
  return () => { stopped = true; clearTimeout(timer); };
}

module.exports = { playNativeVoyage, followNativeVoyage, probeMainWindow };
