import assert from "node:assert/strict";
import test from "node:test";
import { createDesktopPet, PET_HEIGHT, PET_WIDTH } from "../desktop/pet-desktop.cjs";
import { miniTarget, readMini } from "../desktop/native-mini.cjs";
import { runInNewContext } from "node:vm";

test("desktop feeding waits a minute and uses only the current display's visible shortcut", async context => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"] });
  const scenes = [];
  let scans = 0;
  const display = { id: 1, workArea: { x: 0, y: 0, width: 1500, height: 900 } };
  const bounds = { x: 112, y: 1, width: PET_WIDTH, height: PET_HEIGHT };
  const window = {
    isDestroyed: () => false,
    getBounds: () => bounds,
    getContentBounds: () => bounds,
    setBounds: next => Object.assign(bounds, next),
    webContents: { send: (name, scene) => { if (name === "moonlight:pet-scene") scenes.push(scene); } },
  };
  const screen = {
    getDisplayMatching: () => display,
    getDisplayNearestPoint: ({ x }) => x >= 1500 ? { id: 2 } : display,
  };
  const pet = createDesktopPet(window, screen, async () => {
    scans++;
    return [{ x: 1600, y: 350 }, { x: 200, y: PET_HEIGHT - 100, image: "data:image/png;base64,fixture", size: 40 }];
  });
  context.after(() => pet.close());
  pet.sync({ feed: true, drool: true, food: "cookie", paused: false });
  context.mock.timers.tick(59_999);
  assert.equal(scans, 0);
  context.mock.timers.tick(1);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(scans, 1);
  assert.equal(scenes.at(-1).kind, "walk");
  assert.deepEqual([bounds.x, bounds.y], [112, 1]);
  context.mock.timers.tick(400);
  await Promise.resolve();
  assert.equal(scenes.at(-1).kind, "drool");
  assert.deepEqual([bounds.x, bounds.y], [136, 1]);
  assert.deepEqual(scenes.at(-1).snack, { x: 64, y: PET_HEIGHT - 101, toX: 134, toY: PET_HEIGHT - 101,
    food: "cookie", icon: true, iconImage: "data:image/png;base64,fixture", iconSize: 40 });
  for (const [duration, phase] of [[950, "morph"], [700, "bite"], [680, "eat"], [950, "happy"], [700, "idle"]]) {
    context.mock.timers.tick(duration);
    await Promise.resolve();
    assert.equal(scenes.at(-1).kind, phase);
  }
  pet.sync({ feed: true, drool: true, paused: true });
  context.mock.timers.tick(60_000);
  assert.equal(scans, 1);
});

test("Mini integration targets the native overlay on the verified loopback port", () => {
  const target = {
    id: "mini", type: "page", url: "app://-/index.html?initialRoute=%2Favatar-overlay",
    webSocketDebuggerUrl: "ws://127.0.0.1:9335/devtools/page/mini",
  };
  assert.equal(miniTarget([{ ...target, url: "app://-/index.html" }, target], 9335), target);
  assert.equal(miniTarget([{ ...target, url: target.url.replace("app://-", "https://example.com") }], 9335), undefined);
  assert.equal(miniTarget([target], 9336), undefined);
});

test("dragging follows the pointer across screens and suspends automatic feeding", context => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"] });
  const bounds = { x: 30, y: 20, width: 1000, height: 504 };
  let pointer = { x: 180, y: 375 };
  let scans = 0;
  let offset;
  const window = {
    isDestroyed: () => false,
    getBounds: () => bounds,
    getContentBounds: () => bounds,
    setBounds: next => Object.assign(bounds, next),
    webContents: { send: (name, value) => { if (name === "moonlight:pet-position") offset = value; } },
  };
  const display = { id: 2, workArea: { x: 1200, y: 0, width: 1500, height: 900 } };
  const screen = {
    getCursorScreenPoint: () => pointer,
    getDisplayMatching: () => display,
    getDisplayNearestPoint: () => display,
  };
  const pet = createDesktopPet(window, screen, async () => { scans++; return []; });
  context.after(() => pet.close());
  pet.sync({ feed: true, paused: false });
  pet.drag("drag-start");
  pointer = { x: 1530, y: 480 };
  context.mock.timers.tick(16);
  assert.deepEqual([bounds.x, bounds.y], [1380, 125]);
  assert.deepEqual([bounds.width, bounds.height], [PET_WIDTH, PET_HEIGHT]);
  assert.deepEqual(offset, { x: 0, y: 0 });
  pointer = { x: 1200, y: 0 };
  context.mock.timers.tick(16);
  assert.deepEqual([bounds.x, bounds.y], [1200, 0]);
  assert.deepEqual(offset, { x: -78, y: -277 });
  pointer = { x: 2699, y: 899 };
  context.mock.timers.tick(16);
  assert.deepEqual([bounds.x, bounds.y], [2400, 450]);
  assert.deepEqual(offset, { x: 78, y: 9 });
  context.mock.timers.tick(60_000);
  assert.equal(scans, 0);
  assert.equal(pet.drag("drag-end"), true);
  pet.menu();
  assert.deepEqual([bounds.x, bounds.y], [2400, 450]);
  assert.deepEqual(offset, { x: 78, y: 9 });
  context.mock.timers.tick(250);
  assert.equal(scans, 1);
  pet.setVisible(false);
  context.mock.timers.tick(60_000);
  assert.equal(scans, 1);
});

test("random and manual attacks stay within the selected form and pause during drag", async context => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"] });
  context.mock.method(Math, "random", () => 0);
  const scenes = [];
  const display = { workArea: { x: 0, y: 0, width: 1000, height: 800 } };
  const bounds = { x: 600, y: 100, width: PET_WIDTH, height: PET_HEIGHT };
  const window = {
    isDestroyed: () => false,
    getBounds: () => bounds,
    webContents: { send: (_name, scene) => scenes.push(scene) },
  };
  const screen = { getDisplayNearestPoint: () => display, getCursorScreenPoint: () => ({ x: 710, y: 420 }) };
  const pet = createDesktopPet(window, screen, async () => []);
  context.after(() => pet.close());
  pet.sync({ variant: "snakeman", moves: ["pistol", "cobra"], paused: false });
  const before = scenes.length;
  await pet.action("attack", "pistol");
  assert.equal(scenes.length, before);
  context.mock.timers.tick(11_000);
  assert.equal(scenes.at(-1).kind, "cobra");
  assert.equal(scenes.at(-1).direction, -1);
  assert.ok(Number.isSafeInteger(scenes.at(-1).sequence));
  pet.drag("drag-start");
  context.mock.timers.tick(15_000);
  assert.equal(scenes.at(-1).kind, "idle");
  pet.drag("drag-end");
  pet.sync({ variant: "nika", moves: ["lightning"], attacks: false, paused: false });
  context.mock.timers.tick(15_000);
  assert.equal(scenes.at(-1).kind, "idle");
  const move = pet.action("attack", "lightning");
  assert.equal(scenes.at(-1).kind, "lightning");
  context.mock.timers.tick(1780);
  assert.equal(scenes.at(-1).kind, "lightning", "the full recovery waits for the decoder's completion");
  const sequence = scenes.at(-1).sequence;
  assert.equal(pet.finishAction({ kind: "lightning", sequence: sequence - 1 }), false);
  assert.equal(pet.finishAction({ kind: "pistol", sequence }), false);
  assert.equal(pet.finishAction({ kind: "lightning", sequence }), true);
  await move;
  assert.equal(scenes.at(-1).kind, "idle");
  const missingDecoder = pet.action("attack", "lightning");
  context.mock.timers.tick(5000);
  await missingDecoder;
  assert.equal(scenes.at(-1).kind, "idle", "a missing completion has a bounded fallback");
  assert.equal(pet.finishAction({ kind: "lightning", sequence }), false);
});

test("native Mini is masked before showing and renews its lease before the first paint", () => {
  const attributes = new Map();
  let selected = "custom:luffy-voyage";
  const sprite = {
    getAttribute: () => selected,
    getBoundingClientRect: () => ({ left: 20, bottom: 80, width: 40, height: 60 }),
  };
  let style;
  const listeners = {};
  let onMutation;
  const document = {
    hidden: true,
    body: {},
    addEventListener: (name, callback) => { listeners[name] = callback; },
    documentElement: {
      getAttribute: key => attributes.get(key),
      setAttribute: (key, value) => attributes.set(key, value),
      removeAttribute: key => attributes.delete(key),
    },
    querySelector: () => ({ querySelector: () => sprite, getAttribute: () => "路飞 · 航海版 智能伙伴" }),
    getElementById: () => style,
    createElement: () => ({}),
    head: { append: element => { style = element; } },
  };
  const window = { screenX: 200, screenY: 300 };
  const invoke = mask => runInNewContext(`(${readMini.toString()})(${mask})`, {
    document, window, URLSearchParams,
    MutationObserver: class { constructor(callback) { onMutation = callback; } observe() {} },
    location: new URL("app://-/index.html?initialRoute=%2Favatar-overlay"),
  });
  assert.equal(invoke(true), null);
  assert.match(style.textContent, /html\[data-moonlight-mini-replacement="a"\] \{/);
  assert.match(style.textContent, /from \{ opacity: 0; visibility: hidden; \}/);
  assert.equal(attributes.size, 1);
  const previous = attributes.get("data-moonlight-mini-replacement");
  document.hidden = false;
  listeners.visibilitychange();
  assert.notEqual(attributes.get("data-moonlight-mini-replacement"), previous);
  assert.equal(invoke(true).x, 240);
  selected = "codex";
  onMutation();
  assert.equal(attributes.size, 0);
  selected = "pet_saved_luffy";
  assert.equal(invoke(true).x, 240);
  assert.equal(invoke(false).y, 380);
  assert.equal(attributes.size, 0);
  listeners.visibilitychange();
  assert.equal(attributes.size, 0);
});
