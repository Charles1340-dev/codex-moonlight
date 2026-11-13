import { useEffect, useRef, useState } from "react";
import { Footprints, Hand, Ham, MoonStar, PawPrint, Sparkles, Swords, UserRound, X } from "lucide-react";
import { EFFORT_FORMS as FORMS } from "../desktop/forms.mjs";
import movesByVariant from "../desktop/pet-moves.json";
import { FormPortrait } from "./ReasoningControl.jsx";
import { PetMotion } from "./PetMotion.jsx";
import { PetFilm } from "./PetFilm.jsx";
import { useLocalIllustration } from "./local-illustration.js";
import "./pet.css";

const actions = {
  idle: { label: "待机", icon: PawPrint },
  walk: { label: "走路", duration: 2300, icon: Footprints },
  feed: { label: "找零食", icon: Ham },
  sleep: { label: "睡觉", duration: 5900, icon: MoonStar },
  wave: { label: "挥手", duration: 1700, icon: Hand },
  jump: { label: "跳跃", duration: 1050, icon: Sparkles },
  stretch: { label: "伸懒腰", duration: 1600, icon: Sparkles },
};
const feeding = { sniff: "闻一闻", drool: "流口水", morph: "变零食", bite: "一口吞", eat: "咀嚼", happy: "吃饱啦" };
const defaults = { roam: true, feed: true, drool: true, food: "random", attacks: true };
const resting = { kind: "idle" };
const films = { 0: "base", 3: "snakeman", 4: "nika" };
const formTitle = index => index === 3 ? "四档 · 蛇人" : FORMS[index].title;

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem("moonlight-pet-settings") || "null");
    if (!stored) return defaults;
    return {
      roam: stored.roam !== false,
      feed: stored.feed !== false,
      drool: stored.drool !== false,
      food: ["meat", "cookie"].includes(stored.food) ? stored.food : "random",
      attacks: stored.attacks !== false,
    };
  } catch {
    return defaults;
  }
}

export function Pet({ floating = false, reduced = false }) {
  const base = useLocalIllustration("pet");
  const rig = useLocalIllustration("pet-rig");
  const forms = useLocalIllustration("pet-forms");
  const fullForms = useLocalIllustration("forms-full");
  const portraits = useLocalIllustration("forms");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(0);
  const [settings, setSettings] = useState(loadSettings);
  const [manual, setManual] = useState(null);
  const [desktopScene, setDesktopScene] = useState(resting);
  const [loadedFilm, setLoadedFilm] = useState(null);
  const widget = useRef(null);
  const panel = useRef(null);
  const drag = useRef(null);
  const dragged = useRef(false);
  const dragResult = useRef(null);
  const [systemReduced, setSystemReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const motion = !reduced && !systemReduced;
  const scene = manual ?? desktopScene;
  const kind = scene.kind;
  const activeForm = (films[form] || kind === "idle") ? form : 0;
  const variant = films[activeForm];
  const ready = loadedFilm?.variant === variant && loadedFilm !== null;
  const moves = ready && variant === films[form] ? movesByVariant[variant].filter(move => loadedFilm.loaded[move.id]) : [];
  const direction = scene.direction ?? 1;
  const actionLabel = kind === "idle" && activeForm ? formTitle(activeForm)
    : (actions[kind]?.label ?? feeding[kind] ?? moves.find(move => move.id === kind)?.label);
  const paused = open || Boolean(manual) || !motion;

  function filmEnded(result) {
    if (result.library !== variant) return;
    setManual(previous => previous && !previous.steps && previous.kind === result.kind ? null : previous);
    if (floating && Number.isSafeInteger(result.requestId)) {
      void window.moonlight.petAction("clip-ended", { kind: result.kind, sequence: result.requestId });
    }
  }

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = event => setSystemReduced(event.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("moonlight-pet-settings", JSON.stringify(settings)); } catch { /* Storage may be unavailable. */ }
    const variant = films[form];
    const moves = loadedFilm?.variant === variant && loadedFilm ? movesByVariant[variant].filter(move => loadedFilm.loaded[move.id]).map(move => move.id) : [];
    if (floating) void window.moonlight.petAction("sync", { ...settings, roam: settings.roam && Boolean(variant), paused, variant, moves });
  }, [floating, settings, paused, form, loadedFilm]);

  useEffect(() => {
    if (!floating) return;
    const remove = window.moonlight.onPetScene(next => {
      setDesktopScene(previous => next.direction ? next : { ...next, direction: previous.direction });
    });
    let offset = { x: 0, y: 0 };
    function placePet() {
      const element = widget.current;
      if (!element) return;
      const { x, y } = offset;
      element.style.setProperty("--pet-x", x + "px");
      element.style.setProperty("--pet-y", y + "px");
      const bodyTop = 277 + y;
      element.toggleAttribute("data-menu-below", bodyTop < Math.min(204, innerHeight - bodyTop - 164));
    }
    const removePosition = window.moonlight.onPetPosition(next => {
      offset = next;
      placePet();
    });
    void window.moonlight.petAction("layout");
    let interactive = false;
    function setInteractive(next) {
      if (interactive === next) return;
      interactive = next;
      void window.moonlight.petAction("interactive", next);
    }
    const removeDismiss = window.moonlight.onPetDismiss(() => {
      setOpen(false);
      if (!drag.current) setInteractive(false);
    });
    const removeContext = window.moonlight.onPetContext(() => {
      setOpen(true);
      setInteractive(true);
    });
    const removeRelease = window.moonlight.onPetRelease(moved => {
      drag.current = null;
      dragged.current ||= moved;
      if (moved) {
        setManual(null);
        setOpen(false);
      }
    });
    const move = event => setInteractive(Boolean(drag.current || event.target.closest?.(".pet-character, .pet-panel")));
    const leave = () => { if (!drag.current) setInteractive(false); };
    window.addEventListener("mousemove", move);
    window.addEventListener("resize", placePet);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      remove();
      removePosition();
      removeDismiss();
      removeContext();
      removeRelease();
      leave();
      window.removeEventListener("mousemove", move);
      window.removeEventListener("resize", placePet);
      document.documentElement.removeEventListener("mouseleave", leave);
    };
  }, [floating]);

  useEffect(() => {
    if (!open || !panel.current) return;
    const menu = panel.current;
    const dismiss = event => {
      if (!event.target.closest?.(".pet-character, .pet-panel")) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss, true);
    if (!floating) return () => document.removeEventListener("pointerdown", dismiss, true);
    const report = () => {
      const { left, top, right, bottom } = menu.getBoundingClientRect();
      void window.moonlight.petAction("menu-bounds", { left, top, right, bottom });
    };
    const observer = new ResizeObserver(report);
    observer.observe(menu);
    window.addEventListener("resize", report);
    report();
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("resize", report);
      observer.disconnect();
      void window.moonlight.petAction("menu-bounds", null);
    };
  }, [open, floating]);

  useEffect(() => {
    if (!manual) return;
    const delay = manual.steps?.[0]?.[1] ?? manual.duration ?? actions[manual.kind]?.duration;
    if (!delay) return;
    const timer = setTimeout(() => {
      const rest = manual.steps?.slice(1);
      setManual(rest?.length ? { ...manual, kind: rest[0][0], steps: rest } : null);
    }, delay + (manual.steps ? 0 : 1200));
    return () => clearTimeout(timer);
  }, [manual]);

  async function play(next) {
    setOpen(false);
    setDesktopScene(resting);
    if (floating) await window.moonlight.petAction("stop");
    const move = moves.find(move => move.id === next);
    if (move) {
      if (floating && motion) {
        setManual(null);
        void window.moonlight.petAction("attack", next);
      } else setManual({ kind: next, duration: move.duration });
    } else if (floating && motion && (next === "walk" || next === "feed")) {
      setManual(null);
      void window.moonlight.petAction(next);
    } else if (next === "feed") {
      const steps = settings.drool ? [["drool", 950]] : [["sniff", 460]];
      steps.push(["morph", 700], ["bite", 680], ["eat", 950], ["happy", 700]);
      const food = settings.food === "random" ? (Math.random() < .66 ? "meat" : "cookie") : settings.food;
      setManual({ kind: steps[0][0], steps, snack: { food, icon: false } });
    } else {
      setManual(next === "idle" ? null : { kind: next });
    }
  }

  function transform(next) {
    if (form !== next && films[form] !== films[next]) setLoadedFilm(null);
    setForm(next);
    setManual(null);
    setDesktopScene(resting);
    setOpen(false);
    if (floating) void window.moonlight.petAction("stop");
  }

  async function toggleMenu(event) {
    if (event.type === "contextmenu") {
      event.preventDefault();
      setOpen(true);
      if (floating) void window.moonlight.petAction("menu");
      return;
    }
    else if (event.detail && (dragged.current || await dragResult.current)) return;
    if (!open && floating) void window.moonlight.petAction("menu");
    setOpen(!open);
  }

  function beginDrag(event) {
    if (!floating || event.button !== 0) return;
    dragged.current = false;
    dragResult.current = null;
    drag.current = { id: event.pointerId, x: event.screenX, y: event.screenY };
    event.currentTarget.setPointerCapture(event.pointerId);
    void window.moonlight.petAction("drag-start");
  }

  function moveDrag(event) {
    const start = drag.current;
    if (start?.id !== event.pointerId) return;
    if (dragged.current || Math.hypot(event.screenX - start.x, event.screenY - start.y) < 4) return;
    dragged.current = true;
    setManual(null);
    setOpen(false);
  }

  function endDrag(event) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    dragResult.current = window.moonlight.petAction("drag-end");
  }

  function greet() {
    if (!open && films[form] && !manual && desktopScene.kind === "idle" && motion) setManual({ kind: "wave" });
  }

  return <aside ref={widget} className={"pet-widget" + (floating ? " pet-floating" : "") + (motion ? "" : " pet-still")}
    aria-label="路飞桌宠" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
    {open && <section ref={panel} className="pet-panel" aria-label="桌宠动作与形态">
      <div className="pet-heading">
        <b>路飞 · {formTitle(form)}</b>
        <button type="button" aria-label="关闭菜单" onClick={() => setOpen(false)}><X size={15} /></button>
      </div>
      <span className="pet-group-label">动作</span>
      <div className="pet-actions">
        {Object.entries(actions).map(([key, item]) =>
          <button type="button" key={key} onClick={() => void play(key)}><item.icon size={13} />{item.label}</button>)}
      </div>
      {moves.length > 0 && <>
        <span className="pet-group-label">招式</span>
        <div className="pet-actions pet-attacks">
          {moves.map(move => <button key={move.id} type="button" onClick={() => void play(move.id)}><Swords size={13} />{move.label}</button>)}
        </div>
      </>}
      <span className="pet-group-label">形态</span>
      <div className="pet-forms">
        {FORMS.map((item, index) => [0, 3, 4].includes(index) && <button key={item.title} type="button" aria-pressed={index === form} onClick={() => transform(index)}>
          {fullForms ? <span className="pet-form-icon" style={{ backgroundImage: "url(" + fullForms + ")", backgroundPosition: item.x + " " + item.y }} />
            : <FormPortrait index={index} atlas={portraits} />}{formTitle(index)}
        </button>)}
      </div>
      <span className="pet-group-label">{floating ? "桌面习惯" : "Windows 桌面习惯"}</span>
      <div className="pet-settings">
        <label><input type="checkbox" checked={settings.roam} onChange={event => setSettings({ ...settings, roam: event.target.checked })} /> 自主游荡</label>
        <label><input type="checkbox" checked={settings.feed} onChange={event => setSettings({ ...settings, feed: event.target.checked })} /> 每分钟演出吃图标</label>
        <label><input type="checkbox" checked={settings.drool} onChange={event => setSettings({ ...settings, drool: event.target.checked })} /> 见到零食流口水</label>
        <label><input type="checkbox" checked={settings.attacks} onChange={event => setSettings({ ...settings, attacks: event.target.checked })} /> 空闲随机出招</label>
        <label className="pet-food-label">零食 <select value={settings.food} onChange={event => setSettings({ ...settings, food: event.target.value })}>
          <option value="random">随机</option><option value="meat">肉</option><option value="cookie">饼干</option>
        </select></label>
      </div>
    </section>}
    {scene.snack && ["sniff", "drool", "morph", "bite", "eat", "happy"].includes(kind) &&
      <Snack snack={scene.snack} phase={kind} />}
    <button type="button" className={"pet-character" + (activeForm ? " advanced" : "") + (!floating && kind === "walk" ? " pet-preview-walk" : "")}
      aria-label={"路飞桌宠：" + actionLabel + "。右键打开菜单，按住拖动"} aria-expanded={open}
      onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag}
      onPointerCancel={event => { if (event.pointerType !== "mouse") endDrag(event); }}
      onLostPointerCapture={event => { if (event.pointerType !== "mouse") endDrag(event); }}
      onClick={toggleMenu} onContextMenu={toggleMenu} onPointerEnter={greet}>
      {variant && <PetFilm kind={kind} direction={direction} motion={motion} variant={variant}
        actionId={scene.sequence} onReady={setLoadedFilm} onComplete={filmEnded} />}
      {ready ? null
        : !activeForm && rig ? <PetMotion atlas={rig} kind={kind} direction={direction} motion={motion} />
        : activeForm && fullForms ? <span key={activeForm} className="pet-sprite pet-transformation" style={{ backgroundImage: "url(" + fullForms + ")", backgroundSize: "300% 200%",
          backgroundPosition: FORMS[activeForm].x + " " + FORMS[activeForm].y }} />
        : activeForm && activeForm < 5 && forms ? <span key={activeForm} className="pet-sprite pet-transformation" style={{ backgroundImage: "url(" + forms + ")", backgroundSize: "200% 200%",
          backgroundPosition: ((activeForm - 1) % 2 * 100) + "% " + (Math.floor((activeForm - 1) / 2) * 100) + "%" }} />
        : activeForm && portraits ? <FormPortrait className="pet-fallback" index={activeForm} atlas={portraits} />
        : base ? <span className="pet-sprite pet-legacy" data-pose={kind} style={{ backgroundImage: "url(" + base + ")" }} />
        : <UserRound size={55} />}
    </button>
    <span className="pet-status" role="status">{actionLabel}</span>
  </aside>;
}

function Snack({ snack, phase }) {
  const desktop = Number.isFinite(snack.x);
  const style = desktop ? {
    left: `calc(${snack.x}px + var(--pet-x, 0px))`, top: `calc(${snack.y}px + var(--pet-y, 0px))`,
    "--bite-x": (snack.toX - snack.x) + "px", "--bite-y": (snack.toY - snack.y) + "px",
    "--icon-size": Math.max(24, Math.min(96, snack.iconSize ?? 40)) + "px",
  } : undefined;
  return <span className={"pet-snack" + (desktop ? " pet-snack-desktop" : "")} data-phase={phase} style={style} aria-hidden="true">
    {snack.icon && <span className="pet-shortcut">
      <span className="pet-shortcut-mist" />
      {snack.iconImage && <img className="pet-shortcut-image" src={snack.iconImage} alt="" />}
    </span>}
    <span className="pet-snack-spark" />
    <svg className="pet-food" viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="pet-cookie-color" x1="14" y1="7" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe1a2" /><stop offset=".49" stopColor="#da9351" /><stop offset="1" stopColor="#a75937" />
        </linearGradient>
        <linearGradient id="pet-meat-color" x1="24" y1="9" x2="31" y2="37" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8af64" /><stop offset=".55" stopColor="#ca6b35" /><stop offset="1" stopColor="#8c3c29" />
        </linearGradient>
      </defs>
      {snack.food === "cookie" ? <>
        <path d="M25 7c8-1 13 4 16 9 4 8 1 18-5 22-6 6-16 6-22 1-8-4-10-14-7-20 3-8 8-11 18-12Z" fill="url(#pet-cookie-color)" stroke="#633b30" strokeWidth="2" />
        <path d="m13 21 3-1m8-6 2 2m7 8 3-1m-12 7 1 3m-11-5 3 2m14 5 2-2" stroke="#633b30" strokeWidth="3.5" strokeLinecap="round" />
      </> : <>
        <path d="m18 27-7 6c-4-2-8 2-5 6 0 5 7 6 9 1l9-8" fill="#fff2d1" stroke="#6b3e32" strokeWidth="2" />
        <path d="M15 24c0-7 8-16 16-16s13 5 12 13c-1 7-9 14-16 15-7 1-12-5-12-12Z" fill="url(#pet-meat-color)" stroke="#743d33" strokeWidth="2" />
        <path d="M23 20c2-4 6-7 11-7" stroke="#ffe2ad" strokeWidth="3" strokeLinecap="round" />
        <path d="M24 27c5 1 10-1 13-4" stroke="#8e4029" strokeWidth="2" strokeLinecap="round" />
      </>}
    </svg>
  </span>;
}
