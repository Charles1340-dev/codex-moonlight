import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowUp, Bell, Box, Check, ChevronDown, CircleHelp, Clock3,
  CloudMoon, Folder, GitFork, House, ImagePlus, MessageSquare,
  Minus, PanelLeft, Play, Plus, Search, Sparkles, Square, X,
} from "lucide-react";
import defaultArt from "../themes/moonlight/wallpaper.webp";
import { BootScene } from "./BootScene.jsx";
import { BOOT_MS, REVEAL_MS } from "./voyage.mjs";
import { ReasoningControl } from "./ReasoningControl.jsx";
import { useChapterArt, useLocalIllustration } from "./local-illustration.js";
import { downloadTheme, localWallpaper, readWallpaper } from "./theme.mjs";

const native = window.moonlight;
const requestedLaunch = native && new URLSearchParams(location.search).get("launch");
const initialLaunch = ["official", "dreamskin"].includes(requestedLaunch) ? requestedLaunch : null;
const sampleThreads = [
  { id: "theme", title: "Codex 桌面主题方案", project: "主题设计" },
  { id: "boot", title: "启动动画与衔接", project: "主题设计" },
  { id: "visual", title: "视觉细节优化", project: "模型训练" },
];
const projects = ["模型训练", "主题设计"];
const controls = [
  { icon: House, label: "首页", action: "home" },
  { icon: MessageSquare, label: "最近对话", action: "recent" },
  { icon: Box, label: "项目", action: "projects" },
  { icon: Clock3, label: "启动动画", action: "boot" },
  { icon: GitFork, label: "主题工具", action: "theme" },
];

export function App() {
  const [art, setArt] = useState(defaultArt);
  const [threads, setThreads] = useState(sampleThreads);
  const [active, setActive] = useState(null);
  const [project, setProject] = useState("");
  const [mode, setMode] = useState("home");
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState("");
  const [sidebar, setSidebar] = useState(() => !matchMedia("(max-width: 525px)").matches);
  const [notice, setNotice] = useState("");
  const [systemReduced, setSystemReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [ambient, setAmbient] = useState(true);
  const [boot, setBoot] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [nativeLaunch, setNativeLaunch] = useState(false);
  const fileInput = useRef(null);
  const searchInput = useRef(null);
  const composer = useRef(null);
  const replay = useRef(null);
  const animationTimer = useRef(0);
  const revealTimer = useRef(0);
  const launchSequence = useRef(0);
  const importedArt = useRef(null);
  const legacyShips = useLocalIllustration("ships");
  const ships = useLocalIllustration("ships-v2") || legacyShips;
  const chapterArt = useChapterArt();
  const reduced = systemReduced || !ambient;
  const activeThread = threads.find(thread => thread.id === active);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = event => setSystemReduced(event.matches);
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
      clearTimeout(animationTimer.current);
      clearTimeout(revealTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV && !native) return;
    const localArt = new Image();
    localArt.onload = () => setArt(previous => previous === defaultArt ? localArt.src : previous);
    localArt.src = "/local-themes/gear-five/wallpaper.webp";
    return () => { localArt.onload = null; };
  }, []);

  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    if (initialLaunch) {
      queueMicrotask(() => { if (!cancelled) void startBoot(initialLaunch); });
      return () => { cancelled = true; };
    }
    async function initialize() {
      try {
        const file = await localWallpaper("get");
        if (file && !cancelled) {
          const saved = await readWallpaper(file);
          if (cancelled) URL.revokeObjectURL(saved);
          else {
            importedArt.current = saved;
            setArt(saved);
          }
        }
      } catch {
        if (!cancelled) setNotice("无法读取上次的壁纸，已使用默认壁纸。");
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

  function finishBoot(skipped = false) {
    clearTimeout(animationTimer.current);
    clearTimeout(revealTimer.current);
    setBoot(null);
    setReveal(!skipped && !reduced);
    if (!nativeLaunch) requestAnimationFrame(() => replay.current?.focus());
    if (!skipped && !reduced) {
      revealTimer.current = setTimeout(() => setReveal(false), REVEAL_MS);
    }
  }

  useEffect(() => {
    function onKey(event) {
      if (event.key !== "Escape") return;
      if (boot) {
        finishBoot(true);
      } else {
        setMenu("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boot, nativeLaunch, reduced]);

  async function startBoot(target = "preview") {
    const sequence = ++launchSequence.current;
    const isNative = target !== "preview" && Boolean(native);
    clearTimeout(animationTimer.current);
    clearTimeout(revealTimer.current);
    setMenu("");
    setReveal(false);
    setNotice("");
    setNativeLaunch(isNative);
    if (!reduced && !isNative) {
      setBoot({ sequence, startedAt: performance.now() });
    }
    if (!isNative) {
      if (reduced) setNotice("已启用减少动态效果，直接显示工作台。");
      else animationTimer.current = setTimeout(finishBoot, BOOT_MS);
      return;
    }
    try {
      const result = await native.launch(target, reduced ? 0 : BOOT_MS);
      if (sequence !== launchSequence.current) return;
      if (!result.ok) {
        setNotice(result.message);
        finishBoot(true);
      }
    } catch {
      if (sequence === launchSequence.current) {
        setNotice("启动失败，请从 Windows 开始菜单打开 Codex。");
        finishBoot(true);
      }
    } finally {
      if (sequence === launchSequence.current) setNativeLaunch(false);
    }
  }

  function newThread() {
    setActive(null);
    setMode("home");
    setMenu("");
    setDraft("");
    requestAnimationFrame(() => composer.current?.focus());
  }

  function sendTask(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;
    const id = active ?? String(Date.now());
    if (active) {
      setThreads(previous => previous.map(thread => thread.id === id
        ? { ...thread, messages: [...(thread.messages ?? []), message] }
        : thread));
    } else {
      const title = [...message].slice(0, 24).join("");
      setThreads(previous => [{ id, title, project, messages: [message] }, ...previous]);
    }
    setActive(id);
    setDraft("");
  }

  function openThread(id) {
    const thread = threads.find(item => item.id === id);
    setActive(id);
    setProject(thread?.project ?? "");
    setDraft("");
  }

  function selectRail(action) {
    if (action === "boot") {
      void startBoot();
    } else if (action === "theme") {
      setMenu(previous => previous === "theme" ? "" : "theme");
    } else {
      if (action === "home") newThread();
      setMode(action);
      setSidebar(true);
      setQuery("");
    }
  }

  function toggleSearch() {
    setSearchVisible(!searchVisible);
    if (searchVisible) setQuery("");
    else requestAnimationFrame(() => searchInput.current?.focus());
  }

  async function importWallpaper(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const next = await readWallpaper(file);
      if (importedArt.current) URL.revokeObjectURL(importedArt.current);
      importedArt.current = next;
      setArt(next);
      if (native) await localWallpaper("put", file);
      setNotice("已应用本地壁纸。");
    } catch (error) {
      setNotice(error.message);
    }
    setMenu("");
  }

  async function resetWallpaper() {
    if (importedArt.current) URL.revokeObjectURL(importedArt.current);
    importedArt.current = null;
    setArt(defaultArt);
    setMenu("");
    try {
      if (native) await localWallpaper("delete");
      setNotice("已恢复默认壁纸。");
    } catch {
      setNotice("已恢复默认壁纸，但未能清除上次的本地记录。");
    }
  }

  async function exportTheme() {
    try {
      await downloadTheme(art);
      setNotice("主题包已生成，可从 Dream Skin 托盘导入。");
    } catch (error) {
      setNotice(error.message);
    }
    setMenu("");
  }

  const bootScene = boot && <BootScene key={boot.sequence} startedAt={boot.startedAt} ships={ships} chapterArt={chapterArt}
    onSkip={() => finishBoot(true)} />;

  if (initialLaunch) return <div className="desktop">{bootScene}</div>;

  const visibleThreads = threads.filter(thread => (
    (!query || thread.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    && (mode !== "projects" || !project || thread.project === project)
  ));

  return (
    <div className={"desktop" + (reduced ? " reduce-motion" : "") + (reveal ? " revealing" : "")}>
      <div className="wallpaper" aria-hidden="true"><img src={art} alt="" draggable="false" /></div>
      <div className="wallpaper-shade" aria-hidden="true" />
      <div className="moon-glow" aria-hidden="true" />
      <header className="titlebar">
        <IconButton icon={ArrowLeft} label="返回首页" onClick={newThread} />
        <IconButton icon={PanelLeft} label={sidebar ? "隐藏侧栏" : "显示侧栏"} onClick={() => setSidebar(!sidebar)} />
        <span className="title-brand">Codex</span>
        <button className="title-link" aria-expanded={menu === "theme"} onClick={() => setMenu(menu === "theme" ? "" : "theme")}>主题 <ChevronDown size={12} /></button>
        <span className="title-drag" />
        <button ref={replay} className="replay-button" onClick={() => startBoot()}><Play size={13} /> 重播启动</button>
        {native && <button className="launch-button" disabled={nativeLaunch} aria-expanded={menu === "launch"} onClick={() => setMenu(menu === "launch" ? "" : "launch")}>启动 Codex <ChevronDown size={12} /></button>}
        {native && <div className="window-buttons">
          <IconButton icon={Minus} label="最小化" onClick={() => native.window("minimize")} />
          <IconButton icon={Square} label="切换最大化" onClick={() => native.window("maximize")} />
          <IconButton icon={X} label="关闭" onClick={() => native.window("close")} />
        </div>}
      </header>

      {menu && <div className="menu-backdrop" onClick={() => setMenu("")} aria-hidden="true" />}
      {menu === "theme" && (
        <section className="menu-popover theme-popover" aria-label="主题工具">
          <span className="menu-heading">月白解放</span>
          <button onClick={() => fileInput.current?.click()}><ImagePlus size={16} /> 选择本地壁纸</button>
          <button onClick={() => { setAmbient(!ambient); setMenu(""); }}><CloudMoon size={16} /> {ambient ? "暂停界面动效" : "启用界面动效"}</button>
          <button onClick={exportTheme}><Box size={16} /> 导出 Dream Skin 主题</button>
          <button onClick={resetWallpaper}><Sparkles size={16} /> 恢复默认壁纸</button>
        </section>
      )}
      {menu === "launch" && (
        <section className="menu-popover launch-popover" aria-label="启动方式">
          <span className="menu-heading">Windows 桌面端</span>
          <button onClick={() => startBoot("official")}><Play size={16} /> 打开 Codex</button>
          <button onClick={() => startBoot("dreamskin")}><CloudMoon size={16} /> 从 Dream Skin 启动</button>
        </section>
      )}
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={importWallpaper} hidden />

      <div className="workspace">
        <nav className="rail" aria-label="工作台导航">
          {controls.map(({ icon, label, action }) => (
            <IconButton key={action} icon={icon} label={label} onClick={() => selectRail(action)} active={mode === action} />
          ))}
          <span className="rail-spacer" />
          <IconButton icon={CircleHelp} label="关于这个预览" onClick={() => setNotice("这是主题预览。输入内容仅保存在当前预览中。")} />
        </nav>
        {sidebar && <aside className="sidebar" aria-label="项目与对话">
          <div className="sidebar-top">
            <span className="workspace-name">Codex</span>
            <IconButton icon={Search} label="搜索对话" onClick={toggleSearch} active={searchVisible} />
            <IconButton icon={Bell} label="通知" onClick={() => setNotice("目前没有新通知。")} />
          </div>
          <button className="new-thread" onClick={newThread}><Plus size={16} /> 新建对话</button>
          {searchVisible && <label className="thread-search"><Search size={13} /><input ref={searchInput} value={query} placeholder="搜索对话" aria-label="搜索对话" onChange={event => setQuery(event.target.value)} /></label>}
          {mode !== "recent" && <section className="side-section">
            <h2>项目</h2>
            {projects.map(name => (
              <button key={name} className={"side-item" + (project === name ? " current" : "")}
                aria-pressed={project === name} onClick={() => setProject(project === name ? "" : name)}>
                <Folder size={15} /><span>{name}</span>
              </button>
            ))}
          </section>}
          <section className="side-section">
            <h2>最近</h2>
            {visibleThreads.map(thread => (
              <button key={thread.id} className={"side-item" + (active === thread.id ? " current" : "")}
                aria-current={active === thread.id ? "page" : undefined} onClick={() => openThread(thread.id)}>
                <MessageSquare size={14} /><span>{thread.title}</span>
              </button>
            ))}
            {visibleThreads.length === 0 && <p className="no-threads">没有匹配的对话</p>}
          </section>
        </aside>}

        <main className={"main-workspace" + (activeThread ? " conversation" : "")}>
          {activeThread ? (
            <section className="message-panel" aria-label="预览对话">
              <h1>{activeThread.title}</h1>
              <p className="thread-hint">主题预览 · 本地对话</p>
              {activeThread.messages?.map((message, index) => <p key={index} className="message">{message}</p>)}
            </section>
          ) : (
            <div className="workspace-welcome"><h1>我们要构建什么？</h1></div>
          )}
          <form className="composer" onSubmit={sendTask}>
            <div className="composer-context">
              <label className="project-select"><Folder size={14} />
                <select value={project} aria-label="选择项目" onChange={event => setProject(event.target.value)}>
                  <option value="">选择项目</option>
                  {projects.map(name => <option key={name}>{name}</option>)}
                </select>
                <ChevronDown size={12} />
              </label>
              <span className="context-label"><Box size={13} /> 本地预览</span>
            </div>
            <div className="composer-card">
              <span className="composer-ornament" aria-hidden="true"><Sparkles size={14} /></span>
              <textarea ref={composer} value={draft} onChange={event => setDraft(event.target.value)}
                aria-label="描述你的任务" placeholder="描述你的任务" rows={2}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.form.requestSubmit();
                  }
                }} />
              <div className="composer-actions">
                <IconButton icon={Plus} label="选择本地壁纸" onClick={() => fileInput.current?.click()} />
                <span className="composer-meta">{project || "工作台"}</span>
                <ReasoningControl />
                <button className="send-button" type="submit" aria-label="发送预览消息" disabled={!draft.trim()}><ArrowUp size={17} /></button>
              </div>
            </div>
          </form>
        </main>
      </div>
      {notice && <div className="notice" role="status"><Check size={15} />{notice}
        <IconButton icon={X} label="关闭通知" onClick={() => setNotice("")} />
      </div>}
      {bootScene}
      {reveal && <div className="reveal-sweep" aria-hidden="true" />}
    </div>
  );
}

function IconButton({ icon: Icon, label, onClick, active }) {
  return <button className={"icon-button" + (active ? " active" : "")} type="button"
    aria-label={label} title={label} onClick={onClick}><Icon size={16} aria-hidden="true" /></button>;
}
