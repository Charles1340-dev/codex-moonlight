const { app, BrowserWindow, dialog, ipcMain, net, protocol, screen } = require("electron");
const { execFile, spawn } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const { dirname, isAbsolute, join, relative, resolve } = require("node:path");
const { pathToFileURL } = require("node:url");
const { createInterface } = require("node:readline");
const { promisify } = require("node:util");
const { attachEffortShowcase } = require("./reasoning.cjs");
const { followNativeMini } = require("./native-mini.cjs");
const { playNativeVoyage, followNativeVoyage } = require("./native-voyage.cjs");
const { launchCodex, runBridge } = require("./launch.cjs");
const { createDesktopPet, containPet, petWindowOrigin, PET_WIDTH, PET_HEIGHT } = require("./pet-desktop.cjs");
const petMoves = require("./pet-moves.json");

const execute = promisify(execFile);
const smoke = process.argv.includes("--smoke-test");
const petOnly = process.argv.includes("--pet");
const root = app.getAppPath();
const webRoot = join(root, app.isPackaged ? "client" : "dist/client");
const localArtRoot = join(app.isPackaged ? dirname(process.execPath) : root, "local-themes", "voyage");
function launcherUrl(args) {
  const mode = args.includes("--dreamskin") ? "dreamskin" : args.includes("--launch") ? "official" : "";
  return "moonlight://app/index.html" + (mode ? "?launch=" + mode : "");
}
let rendererUrl = launcherUrl(smoke ? [] : process.argv);
const petUrl = "moonlight://app/index.html?pet=1";
const windowsRoot = process.env.SystemRoot || "C:\\Windows";
const powershell = join(windowsRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const windowScript = readFileSync(join(__dirname, "codex-window.ps1"), "utf8");
const snackScript = readFileSync(join(__dirname, "desktop-snacks.ps1"), "utf8");
const pointerScript = readFileSync(join(__dirname, "pet-pointer.ps1"), "utf8");
let win;
let pending;
let petWindow;
let petReady = false;
let desktopPet;
let stopMini;
let stopVoyage;
let miniPort;
let petWanted = false;
let petMenu;
let smokePointer;
let connectionTimer;
let recoveringConnection = false;

protocol.registerSchemesAsPrivileged([{
  scheme: "moonlight",
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

function serveRenderer(request) {
  const url = new URL(request.url);
  if (url.host !== "app" || request.method !== "GET") return new Response(null, { status: 404 });
  const localArt = /^\/local-themes\/voyage\/((?:ships(?:-v2)?|forms(?:-full)?|pet(?:-forms|-rig)?)\.png|(?:chapter-board-[a-z]+|effort-transform-[0-4])\.webp|effort-film-(?:forward|reverse|laugh|laugh-reverse)\.webm|pet-motion-(?:(?:snakeman|nika)-)?[a-z]+\.webm)$/.exec(url.pathname);
  const wallpaper = url.pathname === "/local-themes/gear-five/wallpaper.webp";
  const folder = wallpaper ? join(localArtRoot, "..", "gear-five") : localArt ? localArtRoot : webRoot;
  const path = wallpaper ? join(folder, "wallpaper.webp") : localArt ? join(folder, localArt[1]) : resolve(folder, "." + decodeURIComponent(url.pathname));
  const withinRoot = relative(folder, path);
  if (!withinRoot || withinRoot.startsWith("..") || isAbsolute(withinRoot) || !existsSync(path)) {
    return new Response(null, { status: 404 });
  }
  return net.fetch(pathToFileURL(path).href).then(response => {
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    return new Response(response.body, { status: response.status, headers });
  });
}

function createWindow() {
  const direct = rendererUrl.includes("?launch=");
  win = new BrowserWindow({
    width: 1360,
    height: 720,
    minWidth: 640,
    minHeight: 500,
    frame: false,
    show: false,
    skipTaskbar: direct,
    backgroundColor: "#14121f",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_web, _permission, answer) => answer(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  if (!smoke && !direct) win.once("ready-to-show", () => win.show());
  win.on("closed", () => { win = undefined; });
  return win.loadURL(rendererUrl);
}

function trusted(event) {
  return win && event.sender === win.webContents && event.senderFrame?.url === rendererUrl;
}

function handlePetPointer(kind, point) {
  if (!petWindow || !desktopPet) return;
  if (kind === "context" && petWindow.isVisible() && desktopPet.isAtBody(point)) {
    desktopPet.menu();
    if (!smoke) petWindow.setIgnoreMouseEvents(false);
    petWindow.webContents.send("moonlight:pet-context");
    return;
  }
  if (kind === "up" && desktopPet.isDragging()) {
    petWindow.webContents.send("moonlight:pet-release", desktopPet.drag("drag-end", point));
  }
  if (!["down", "context"].includes(kind) || !petMenu || desktopPet.isAtBody(point)) return;
  const { x, y } = petWindow.getContentBounds();
  const left = point.x - x;
  const top = point.y - y;
  if (left >= petMenu.left && left < petMenu.right && top >= petMenu.top && top < petMenu.bottom) return;
  petMenu = undefined;
  petWindow.webContents.send("moonlight:pet-dismiss");
}

function openPet(anchor) {
  petReady = false;
  const width = PET_WIDTH;
  const height = PET_HEIGHT;
  const area = screen.getDisplayNearestPoint(anchor ?? screen.getCursorScreenPoint()).workArea;
  const side = anchor?.x < area.x + area.width / 2 ? 1 : -1;
  const origin = containPet(
    anchor ? anchor.x + side * 124 - width / 2 : area.x + area.width - width - 12,
    anchor ? anchor.y - height - 6 : area.y + area.height - height - 12,
    area,
  );
  petWindow = new BrowserWindow({
    ...petWindowOrigin(origin, area),
    width, height, frame: false, transparent: true, resizable: false, skipTaskbar: true,
    alwaysOnTop: true, show: false, backgroundColor: "#00000000",
    webPreferences: { preload: join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  petWindow.setAlwaysOnTop(true, "screen-saver");
  petWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  petWindow.webContents.on("will-navigate", event => event.preventDefault());
  const petScreen = smoke ? {
    getCursorScreenPoint: () => smokePointer ?? screen.getCursorScreenPoint(),
    getDisplayNearestPoint: point => screen.getDisplayNearestPoint(point),
  } : screen;
  desktopPet = createDesktopPet(petWindow, petScreen, async point => {
    if (process.platform !== "win32") return [];
    const { x, y } = screen.dipToScreenPoint(point);
    const { stdout } = await execute(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
      "& {\n" + snackScript + "\n} -NearX " + Math.round(x) + " -NearY " + Math.round(y),
    ], {
      windowsHide: true, timeout: 4500, maxBuffer: 512 * 1024,
    });
    const icons = JSON.parse(stdout.trim());
    return (Array.isArray(icons) ? icons : [])
      .filter(icon => Number.isFinite(icon?.x) && Number.isFinite(icon?.y))
      .map(icon => {
        const point = screen.screenToDipPoint({ x: icon.x, y: icon.y });
        const scale = screen.getDisplayNearestPoint(point).scaleFactor;
        const image = typeof icon.image === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(icon.image)
          ? "data:image/png;base64," + icon.image : undefined;
        return { ...point, image, size: Number.isFinite(icon.size) ? icon.size / scale : undefined };
      });
  }, origin);
  let pointerWatch;
  function stopPointerWatch() {
    petMenu = undefined;
    pointerWatch?.kill();
    pointerWatch = undefined;
  }
  petWindow.setIgnoreMouseEvents(true, { forward: !smoke });
  if (!smoke) petWindow.once("ready-to-show", () => {
    if (petWanted) petWindow?.showInactive();
  });
  petWindow.on("show", () => {
    petWindow?.moveTop();
    desktopPet?.setVisible(true);
    if (smoke || process.platform !== "win32" || pointerWatch) return;
    const watch = spawn(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
      "& {\n" + pointerScript + "\n} -OwnerId " + process.pid,
    ], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    pointerWatch = watch;
    createInterface({ input: watch.stdout }).on("line", line => {
      if (pointerWatch !== watch) return;
      const match = /^(down|up|context) (-?\d+) (-?\d+)$/.exec(line);
      if (!match) return;
      handlePetPointer(match[1], screen.screenToDipPoint({ x: Number(match[2]), y: Number(match[3]) }));
    });
    watch.on("error", () => { if (pointerWatch === watch) pointerWatch = undefined; });
    watch.on("exit", () => { if (pointerWatch === watch) pointerWatch = undefined; });
  });
  petWindow.on("hide", () => {
    stopPointerWatch();
    desktopPet?.setVisible(false);
    petWindow.webContents.send("moonlight:pet-dismiss");
  });
  desktopPet.setVisible(false);
  petWindow.on("closed", () => {
    stopPointerWatch();
    desktopPet?.close();
    desktopPet = undefined;
    petWindow = undefined;
    petReady = false;
    petWanted = false;
  });
  return petWindow.loadURL(petUrl).catch(() => petWindow?.close());
}

function syncMiniPet(anchor) {
  const wanted = Boolean(anchor);
  if (petWanted === wanted) return;
  petWanted = wanted;
  if (!wanted) petWindow?.hide();
  else if (petWindow) petWindow.showInactive();
  else void openPet(anchor);
}

function watchMini(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || miniPort === port) return;
  if (!["pet-motion-idle.webm", "pet-rig.png", "pet.png"].some(file => existsSync(join(localArtRoot, file)))) return;
  stopMini?.();
  stopVoyage?.();
  miniPort = port;
  stopVoyage = followNativeVoyage(port, webRoot, localArtRoot, () => {
    petMenu = undefined;
    if (petWindow) {
      petWindow.setIgnoreMouseEvents(true, { forward: true });
      petWindow.webContents.send("moonlight:pet-dismiss");
      desktopPet?.layout();
    }
  });
  if (!petWindow) void openPet();
  stopMini = followNativeMini(port, () => petReady, syncMiniPet, () => {
    stopMini = undefined;
    stopVoyage?.();
    stopVoyage = undefined;
    miniPort = undefined;
    recoverConnection();
    petWindow?.close();
  });
}

function recoverConnection() {
  if (connectionTimer || recoveringConnection || miniPort) return;
  connectionTimer = setTimeout(async () => {
    connectionTimer = undefined;
    recoveringConnection = true;
    try {
      const result = await windowWatch("session");
      const match = /^launched:(\d{1,5})$/m.exec(result.stdout);
      if (match) {
        const port = Number(match[1]);
        watchMini(port);
        void attachEffortShowcase(port, join(localArtRoot, "forms-full.png")).catch(() => false);
      }
    } catch {} finally {
      recoveringConnection = false;
      if (!miniPort) recoverConnection();
    }
  }, 3000);
}

ipcMain.handle("moonlight:pet-action", (event, action, value) => {
  if (!petWindow || event.sender !== petWindow.webContents || event.senderFrame?.url !== petUrl) return;
  if (action === "interactive" && typeof value === "boolean") {
    if (!smoke) petWindow.setIgnoreMouseEvents(!value, { forward: true });
    return;
  }
  if (action === "sync") return desktopPet.sync(value);
  if (action === "clip-ended" && value && Number.isSafeInteger(value.sequence) && typeof value.kind === "string") {
    return desktopPet.finishAction(value);
  }
  if (action === "layout") {
    petReady = true;
    return desktopPet.layout();
  }
  if (action === "menu") return desktopPet.menu();
  if (action === "menu-bounds") {
    petMenu = value && ["left", "top", "right", "bottom"].every(edge => Number.isFinite(value[edge])) ? value : undefined;
    return;
  }
  if (action === "drag-start" || action === "drag-end") return desktopPet.drag(action);
  return desktopPet.action(action, value);
});

function windowWatch(action) {
  return runBridge(execFile, powershell, [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
    "& {\n" + windowScript + "\n} -Action " + action,
  ], { windowsHide: true, timeout: { watch: 28_000, dreamskin: 135_000, session: 18_000 }[action] ?? 12_000 });
}

ipcMain.handle("moonlight:launch", async (event, mode, duration) => {
  if (!trusted(event) || !["official", "dreamskin"].includes(mode) || process.platform !== "win32") {
    return { ok: false, message: "此启动方式仅适用于 Windows 桌面启动器。" };
  }
  if (pending) return { ok: false, message: "Codex 正在启动，请稍候。" };

  const window = win;
  const direct = new URL(rendererUrl).searchParams.has("launch");
  pending = true;
  window.hide();
  let handedOff = false;
  let failure = "启动 Codex 时出错。请检查它是否能从 Windows 开始菜单打开。";
  try {
    const { port } = await launchCodex(mode, windowWatch);
    handedOff = true;
    if (port) watchMini(port);
    else if (mode === "dreamskin") recoverConnection();
    if (port && duration > 0) await playNativeVoyage(port, webRoot, localArtRoot).catch(() => false);
    const effortLinked = port
      ? await attachEffortShowcase(port, join(localArtRoot, "forms-full.png")).catch(() => false)
      : undefined;
    return { ok: true, effortLinked };
  } catch {
    return { ok: false, message: failure };
  } finally {
    if (handedOff || direct) {
      setTimeout(async () => {
        if (!handedOff && !window.isDestroyed()) {
          window.hide();
          await dialog.showMessageBox({ type: "error", title: "Codex 启动失败", message: failure }).catch(() => {});
        }
        pending = undefined;
        if (!window.isDestroyed()) window.close();
      }, 0);
    } else {
      pending = undefined;
      if (!window.isDestroyed()) {
        window.show();
      }
    }
  }
});

ipcMain.on("moonlight:window", (event, action) => {
  if (!trusted(event)) return;
  if (action === "minimize") win.minimize();
  if (action === "maximize") {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
  if (action === "close") win.close();
});

function handleLaunch(args) {
  if (args.includes('--resume')) { recoverConnection(); return; }
  if (!pending) {
    const nextUrl = launcherUrl(args);
    if (!win || nextUrl.includes("?launch=")) {
      rendererUrl = nextUrl;
      if (!win) { void createWindow(); return; }
      win.setSkipTaskbar(true);
      win.hide();
      void win.loadURL(rendererUrl);
      return;
    }
  }
  if (pending) return;
  if (win?.isMinimized()) win.restore();
  win?.show();
}

const primary = smoke || app.requestSingleInstanceLock();
if (!primary) app.quit();
if (primary && !smoke) app.on("second-instance", (_event, args) => handleLaunch(args));
if (primary) app.whenReady().then(async () => {
  if (!existsSync(join(webRoot, "index.html"))) throw new Error("请先运行 npm run build。");
  protocol.handle("moonlight", serveRenderer);
  if (!smoke && process.argv.includes('--resume')) { recoverConnection(); return; }
  if (!(petOnly && smoke)) await createWindow();
  if (smoke) {
    const state = petOnly || await win.webContents.executeJavaScript(
      'Promise.all(Array.from(document.images, image => image.decode())).then(() => Boolean(window.moonlight?.launch && document.querySelector(".reasoning-trigger")))',
    );
    if (!petOnly && existsSync(join(localArtRoot, 'effort-film-forward.webm'))) {
      win.setOpacity(0);
      win.setIgnoreMouseEvents(true);
      win.showInactive();
      const effort = await win.webContents.executeJavaScript(`(async () => {
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        const wait = async check => { for(let i=0;i<180;i++){if(check())return true;await delay(50);}return false; };
        document.querySelector('.reasoning-trigger').click();
        if(!await wait(()=>document.querySelector('.effort-animation')?.dataset.ready==='true'))throw Error('Full-body animation did not decode');
        const canvas=document.querySelector('.effort-animation');
        const levels=[...document.querySelectorAll('.reasoning-marks button')];
        levels[0].click();
        if(!await wait(()=>canvas.dataset.position==='0'))throw Error('Low form not reached');
        let running=true,last;const samples=[],seen=new Set();
        function observe(now){if(!running)return;seen.add(canvas.dataset.segment+':'+canvas.dataset.frame);if(last)samples.push(now-last);last=now;requestAnimationFrame(observe);}
        requestAnimationFrame(observe);levels.at(-1).click();
        if(!await wait(()=>canvas.dataset.position==='5'))throw Error('Highest form not reached');
        running=false;
        levels[0].click();await delay(350);const before=Number(canvas.dataset.position);
        levels.at(-1).click();await delay(80);const after=Number(canvas.dataset.position);
        await delay(350);const recovered=Number(canvas.dataset.position);
        levels[4].click();
        if(!await wait(()=>canvas.dataset.position==='4'&&canvas.dataset.mode==='laugh'))throw Error('Gear Five laugh did not begin');
        const laughing=new Set();const laughStart=performance.now();
        while(performance.now()-laughStart<1800){laughing.add(canvas.dataset.frame);await delay(8);}
        samples.sort((a,b)=>a-b);
        const result={distinctFrames:seen.size,meanFrameMs:samples.reduce((a,b)=>a+b,0)/samples.length,
          p95FrameMs:samples[Math.floor(samples.length*.95)],
          sourcePixels:Number(canvas.dataset.sourcePixels),laughFrames:laughing.size,decoders:Number(canvas.dataset.decoders),
          videoWidth:document.querySelector('[data-moonlight-effort-film]').videoWidth,
          rapidChangeContinuous:Math.abs(after-before)<.15&&recovered>before,layers:document.querySelectorAll('.effort-animation').length};
        document.querySelector('.reasoning-trigger').click();return result;
      })()`);
      console.log('effort animation smoke ' + JSON.stringify(effort));
      if (effort.distinctFrames < 300 || effort.p95FrameMs > 35 || effort.laughFrames < 65 || effort.sourcePixels !== 640
        || effort.decoders !== 1 || effort.videoWidth !== 672 || !effort.rapidChangeContinuous || effort.layers !== 1) throw Error('Full-body animation playback check failed');
      win.hide();
    }
    const primaryDisplay = screen.getPrimaryDisplay();
    const area = primaryDisplay.workArea;
    await openPet({ x: area.x + area.width / 2, y: area.y + area.height - 1 });
    for (let i = 0; !petReady && i < 120; i++) await new Promise(resolve => setTimeout(resolve, 25));
    if (!petReady) throw new Error('Pet renderer did not attach its position listener');
    petWindow.setOpacity(0);
    await new Promise(resolve => {
      petWindow.once('show', resolve);
      petWindow.showInactive();
    });
    const displays = [...screen.getAllDisplays().filter(display => display.id !== primaryDisplay.id), primaryDisplay];
    for (const { workArea } of displays) {
      const center = await petWindow.webContents.executeJavaScript(`
        (() => {
          const { left, top, width, height } = document.querySelector(".pet-character").getBoundingClientRect();
          return { x: left + width / 2, y: top + height / 2 };
        })()
      `);
      const before = petWindow.getContentBounds();
      smokePointer = { x: before.x + center.x, y: before.y + center.y };
      desktopPet.drag("drag-start");
      smokePointer = { x: Math.round(workArea.x + workArea.width / 2), y: workArea.y };
      handlePetPointer("up", smokePointer);
      const local = await petWindow.webContents.executeJavaScript(`
        new Promise(resolve => requestAnimationFrame(() => {
          const { left, top } = document.querySelector(".pet-character").getBoundingClientRect();
          resolve({ left, top });
        }))
      `);
      const bounds = petWindow.getContentBounds();
      if (Math.abs(bounds.y + local.top - workArea.y) > 1 || bounds.width !== PET_WIDTH || bounds.height !== PET_HEIGHT) {
        throw new Error("Pet drag bounds: " + JSON.stringify({ workArea, bounds, local }));
      }
      const overflow = await petWindow.webContents.executeJavaScript(`
        [document.documentElement, document.body, document.getElementById('root')].some(element =>
          getComputedStyle(element).overflow !== 'hidden' || element.clientWidth !== innerWidth || element.clientHeight !== innerHeight)
      `);
      if (overflow) throw new Error('Pet root must remain a clipped viewport without document scrollbars');
    }
    const smokeForms = [
      { title: "常态", variant: "base" },
      { title: "四档 · 蛇人", variant: "snakeman" },
      { title: "五档", variant: "nika" },
    ].map(({ title, variant }) => {
      const prefix = variant === "base" ? "" : variant + "-";
      return { title, idle: "pet-motion-" + prefix + "idle.webm",
        moves: petMoves[variant].filter(move => existsSync(join(localArtRoot, "pet-motion-" + prefix + move.id + ".webm"))) };
    }).filter(form => form.moves.length);
    const pet = await petWindow?.webContents.executeJavaScript(`
      (async () => {
        if (!window.moonlight?.petAction || !document.querySelector(".pet-floating .pet-character")) return false;
        const requireFilm = ${existsSync(join(localArtRoot, "pet-motion-idle.webm"))};
        const requireRig = ${existsSync(join(localArtRoot, "pet-rig.png"))};
        if (!requireFilm && !requireRig) return true;
        const waitFor = async check => {
          for (let i = 0; i < 160; i++) {
            const value = check();
            if (value) return value;
            await new Promise(resolve => setTimeout(resolve, 25));
          }
          return false;
        };
        const ready = await waitFor(() => {
          const player = document.querySelector(".pet-film-playing");
          if (requireFilm && player?.readyState >= 2 && player.videoWidth > 0) return true;
          const canvas = document.querySelector(".pet-motion");
          if (!requireFilm && canvas?.getContext("2d").getImageData(180, 140, 1, 1).data[3] > 0) return true;
          return false;
        });
        if (!ready) return false;
        const character = document.querySelector(".pet-character");
        if (!await waitFor(() => Math.abs(character.getBoundingClientRect().top) < 1)) return false;
        const openMenu = () => character.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
        for (const form of ${JSON.stringify(smokeForms)}) {
          openMenu();
          const select = await waitFor(() => [...document.querySelectorAll(".pet-forms button")].find(button => button.textContent === form.title));
          if (!select) return false;
          select.click();
          if (!await waitFor(() => !document.querySelector(".pet-panel") &&
            document.querySelector(".pet-film-playing")?.dataset.source.endsWith(form.idle))) return false;
          for (const move of form.moves) {
            openMenu();
            const button = await waitFor(() => [...document.querySelectorAll(".pet-attacks button")].find(item => item.textContent === move.label));
            if (!button) return false;
            const panel = document.querySelector(".pet-panel").getBoundingClientRect();
            if (panel.top <= character.getBoundingClientRect().bottom || panel.bottom > innerHeight ||
              panel.width > 209 || panel.height > 199) return false;
            const video = document.querySelector(".pet-film video");
            if (!video || document.querySelectorAll(".pet-film video").length !== 1 ||
              !document.querySelector(".pet-film").dataset.available.split(" ").includes(move.id)) return false;
            if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
              button.click();
              if (!await waitFor(() => video.classList.contains("pet-film-playing") && video.dataset.clip === move.id && video.currentTime > .025)) return false;
              const visibleLayers = [...document.querySelectorAll('.pet-film video, .pet-film canvas')]
                .filter(element => getComputedStyle(element).visibility === 'visible');
              if (visibleLayers.length !== 1) return false;
            } else {
              openMenu();
            }
            if (!await waitFor(() => !document.querySelector(".pet-panel"))) return false;
          }
        }
        openMenu();
        return Boolean(await waitFor(() => {
          const panel = document.querySelector(".pet-panel");
          return panel && panel.scrollHeight > panel.clientHeight;
        }));
      })()
    `);
    if (!pet && petWindow) console.error(await petWindow.webContents.executeJavaScript(`
      (async () => {
        const video = document.querySelector(".pet-film video");
        if (!video) return "Pet video unavailable";
        const response = await fetch(video.src);
        return JSON.stringify({ ready: video.readyState, error: video.error?.message,
          status: response.status, type: response.headers.get("content-type") });
      })()
    `));
    if (pet) {
      petWindow.webContents.send('moonlight:pet-dismiss');
      await petWindow.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(resolve))');
      const body = await petWindow.webContents.executeJavaScript(`
        (() => {const r=document.querySelector('.pet-character').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()
      `);
      const bounds = petWindow.getContentBounds();
      handlePetPointer('context', {x:bounds.x+body.x,y:bounds.y+body.y});
      const reopened = await petWindow.webContents.executeJavaScript(`
        (async()=>{for(let i=0;i<80;i++){if(document.querySelector('.pet-panel'))return true;await new Promise(r=>setTimeout(r,25));}return false;})()
      `);
      if (!reopened) throw new Error('Native right-click observer did not open the pet menu');
    }
    const outside = pet && Boolean(petMenu);
    if (outside) handlePetPointer("down", { x: area.x, y: area.y + area.height - 1 });
    const dismissed = outside && await petWindow.webContents.executeJavaScript(`
      new Promise(resolve => requestAnimationFrame(() => resolve(!document.querySelector(".pet-panel"))))
    `);
    if (pet && existsSync(join(localArtRoot,'pet-motion-idle.webm'))) {
      petWindow.hide();
      const paused = await petWindow.webContents.executeJavaScript(`(async()=>{for(let i=0;i<120;i++){const video=document.querySelector('.pet-film video');if(document.hidden&&video?.readyState>=2&&video.paused)return true;await new Promise(r=>setTimeout(r,25));}return false;})()`);
      if(!paused)throw Error('Hidden pet video kept playing');
      petWindow.showInactive();
      const resumed = await petWindow.webContents.executeJavaScript(`(async()=>{for(let i=0;i<120;i++){const video=document.querySelector('.pet-film video');const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(!document.hidden&&video?.readyState>=2&&(reduced?video.paused:!video.paused))return true;await new Promise(r=>setTimeout(r,25));}return false;})()`);
      if(!resumed)throw Error('Pet video did not resume after showing');
      console.log('pet visibility pause/resume passed');
    }
    console.log(state && pet && dismissed ? "desktop and pet smoke passed" : "desktop smoke failed");
    app.exit(state && pet && dismissed ? 0 : 1);
  }
}).catch(error => {
  console.error(error?.message ?? String(error));
  app.exit(1);
});
app.on("window-all-closed", () => { if (!stopMini && !connectionTimer && !recoveringConnection) app.quit(); });
app.on("before-quit", () => { clearTimeout(connectionTimer); stopMini?.(); stopVoyage?.(); });
