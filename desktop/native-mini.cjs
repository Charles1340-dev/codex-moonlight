const { evaluateRenderer } = require("./reasoning.cjs");

function miniTarget(targets, port) {
  if (!Array.isArray(targets)) return;
  return targets.find(target => {
    if (target?.type !== "page" || !/^[A-Za-z0-9-]+$/.test(target.id ?? "")) return false;
    if (target.webSocketDebuggerUrl !== `ws://127.0.0.1:${port}/devtools/page/${target.id}`) return false;
    try {
      const url = new URL(target.url);
      return url.protocol === "app:" && url.hostname === "-" && url.pathname === "/index.html"
        && url.searchParams.get("initialRoute") === "/avatar-overlay";
    } catch {
      return false;
    }
  });
}

function readMini(mask) {
  if (location.protocol !== "app:" || location.hostname !== "-" || location.pathname !== "/index.html"
    || new URLSearchParams(location.search).get("initialRoute") !== "/avatar-overlay") return null;
  const mascot = document.querySelector('[data-avatar-overlay-hit-region="mascot"] [data-avatar-mascot]');
  const sprite = mascot?.querySelector("[data-codex-pet-id]");
  const id = sprite?.getAttribute("data-codex-pet-id") ?? "";
  const luffy = id === "custom:luffy-voyage" || (id.startsWith("pet_")
    && mascot?.getAttribute("aria-label") === "路飞 · 航海版 智能伙伴");
  const rect = sprite?.getBoundingClientRect();
  const visible = !document.hidden && luffy && rect?.width > 0 && rect.height > 0;
  const key = "data-moonlight-mini-replacement";
  const root = document.documentElement;
  if (!luffy || !mask) {
    root.removeAttribute(key);
    if (window.__moonlightMiniLease) window.__moonlightMiniLease.until = 0;
  }
  if (luffy && mask) {
    const styleId = "moonlight-mini-blank-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = ["a", "b"].map(keyframe => `
        html[${key}="${keyframe}"] {
          animation: moonlight-mini-replacement-${keyframe} 2.4s steps(1, end) both !important;
        }
        @keyframes moonlight-mini-replacement-${keyframe} {
          from { opacity: 0; visibility: hidden; }
          to { opacity: 1; visibility: visible; }
        }
      `).join("");
      document.head.append(style);
    }
    if (!window.__moonlightMiniLease) {
      const lease = { until: 0 };
      lease.refresh = () => {
        const current = document.querySelector('[data-avatar-overlay-hit-region="mascot"] [data-avatar-mascot]');
        const pet = current?.querySelector('[data-codex-pet-id]')?.getAttribute('data-codex-pet-id') ?? '';
        const selected = pet === 'custom:luffy-voyage' || (pet.startsWith('pet_')
          && current?.getAttribute('aria-label') === '路飞 · 航海版 智能伙伴');
        if (selected && Date.now() < lease.until) {
          root.setAttribute(key, root.getAttribute(key) === 'a' ? 'b' : 'a');
        } else root.removeAttribute(key);
      };
      document.addEventListener('visibilitychange', lease.refresh);
      lease.observer = new MutationObserver(lease.refresh);
      lease.observer.observe(document.body, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['data-codex-pet-id', 'aria-label'] });
      window.__moonlightMiniLease = lease;
    }
    window.__moonlightMiniLease.until = Date.now() + 2400;
    window.__moonlightMiniLease.refresh();
  }
  return visible ? { x: window.screenX + rect.left + rect.width / 2, y: window.screenY + rect.bottom } : null;
}

function followNativeMini(port, canReplace, showPet, onDisconnected) {
  let stopped = false;
  let timer;
  let failures = 0;
  async function poll() {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
        redirect: "error", signal: AbortSignal.timeout(900),
      });
      if (!response.ok) throw Error("Mini connection unavailable");
      const targets = await response.json();
      const mini = miniTarget(targets, port);
      const anchor = mini ? await evaluateRenderer(mini, `(${readMini.toString()})(${canReplace()})`, 900) : null;
      if (stopped) return;
      failures = 0;
      showPet(Number.isFinite(anchor?.x) && Number.isFinite(anchor?.y) ? anchor : null);
    } catch {
      if (stopped) return;
      showPet(null);
      if (++failures >= 5) { onDisconnected(); return; }
    }
    if (!stopped) timer = setTimeout(poll, 650);
  }
  void poll();
  return () => { stopped = true; clearTimeout(timer); };
}

module.exports = { followNativeMini, miniTarget, readMini };
