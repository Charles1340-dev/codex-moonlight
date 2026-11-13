import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { BootScene } from "./BootScene.jsx";
import { BOOT_MS } from "./voyage.mjs";
import "./native-voyage.css";

export function mount({ css, ships, refinedShips, chapterArt, ticket }) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const id = "moonlight-native-voyage";
  try { if (ticket && sessionStorage.getItem("moonlight-voyage-finished") === ticket) return true; } catch {}
  const current = document.getElementById(id);
  if (current) {
    if (ticket) current.dataset.launch = ticket;
    return true;
  }

  const previousFocus = document.activeElement;
  const host = document.createElement("div");
  host.id = id;
  if (ticket) host.dataset.launch = ticket;
  const shadow = host.attachShadow({ mode: "open" });
  const stylesheet = new CSSStyleSheet();
  stylesheet.replaceSync(css);
  shadow.adoptedStyleSheets = [stylesheet];
  const modal = document.createElement("dialog");
  modal.setAttribute("aria-label", "草帽团航海启动动画");
  shadow.append(modal);
  document.body.append(host);
  const root = createRoot(modal);
  let timer;
  let finished = false;
  let playing = false;

  function close(completed = true) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    try { if (completed && host.dataset.launch) sessionStorage.setItem("moonlight-voyage-finished", host.dataset.launch); } catch {}
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("visibilitychange", begin);
    modal.close();
    root.unmount();
    host.remove();
    if (previousFocus?.isConnected && document.activeElement === document.body) previousFocus.focus({ preventScroll: true });
  }

  function onKey(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  function reveal() {
    modal.classList.add("voyage-opening-complete");
    timer = setTimeout(close, 240);
  }

  function render() {
    flushSync(() => root.render(<BootScene startedAt={performance.now()} ships={ships} refinedShips={refinedShips}
      chapterArt={chapterArt} onSkip={close} />));
  }

  function begin() {
    if (finished || playing || document.hidden) return;
    playing = true;
    document.removeEventListener("visibilitychange", begin);
    render();
    timer = setTimeout(reveal, BOOT_MS);
  }

  try {
    modal.addEventListener("cancel", event => { event.preventDefault(); close(); });
    document.addEventListener("keydown", onKey, true);
    modal.showModal();
    if (document.hidden) {
      render();
      document.addEventListener("visibilitychange", begin);
    } else begin();
    return true;
  } catch {
    close(false);
    return false;
  }
}
