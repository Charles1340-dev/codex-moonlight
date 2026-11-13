import assert from "node:assert/strict";
import test from "node:test";
import { BOOT_MS, VOYAGE, voyageFrame } from "../src/voyage.mjs";
import { CHAPTER_ART, CHAPTER_BOARDS, CHAPTER_WIDE_ART } from "../src/chapter-art.mjs";
import { EFFORT_LEVELS, EFFORTS, EFFORT_FORMS, FORMS } from "../desktop/forms.mjs";
import reasoning from "../desktop/reasoning.cjs";

test("every voyage stop has its own in-bounds illustration tile", () => {
  assert.deepEqual(Object.keys(CHAPTER_ART).sort(), VOYAGE.map(chapter => chapter.id).sort());
  const tiles = Object.values(CHAPTER_ART);
  assert.equal(new Set(tiles.map(({ file, viewBox }) => file + viewBox)).size, VOYAGE.length);
  for (const { file, viewBox } of tiles) {
    assert.ok(CHAPTER_BOARDS.includes(file));
    const [x, y, w, h] = viewBox.split(" ").map(Number);
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1536 && y + h <= 1024);
    assert.equal(Math.floor(x / 768), Math.floor((x + w - 1) / 768));
    assert.equal(Math.floor(y / 512), Math.floor((y + h - 1) / 512));
  }
  for (const [id, { file, width, height, viewBox }] of Object.entries(CHAPTER_WIDE_ART)) {
    assert.ok(CHAPTER_ART[id]);
    assert.ok(CHAPTER_BOARDS.includes(file));
    const [x, y, w, h] = viewBox.split(" ").map(Number);
    assert.ok(x >= 0 && y >= 0 && w / h > 3 && x + w <= width && y + h <= height);
    assert.equal(Math.floor(y / (height / 2)), Math.floor((y + h - 1) / (height / 2)));
  }
});

test("the midpoint changes ship after Merry's farewell, preserving chapter order", () => {
  assert.equal(VOYAGE.length, 30);
  assert.equal(VOYAGE[0].id, "syrup");
  assert.equal(VOYAGE.at(-1).id, "elbaf");
  assert.ok(VOYAGE.every((chapter, index) => index === 0 || chapter.at > VOYAGE[index - 1].at));
  assert.ok(VOYAGE.every(chapter => !/梅丽号|千阳号/.test(chapter.title + chapter.detail)));
  assert.equal(VOYAGE[14].id, "farewell");
  assert.equal(VOYAGE[15].id, "sunny");
  assert.equal(voyageFrame(BOOT_MS * 0.5).index, 15);
  assert.ok(Math.abs(voyageFrame(BOOT_MS * 0.5).sunnyMix - 0.5) < 0.001);
  assert.equal(voyageFrame(BOOT_MS * 0.46).sunnyMix, 0);
  assert.equal(voyageFrame(BOOT_MS * 0.54).sunnyMix, 1);
  assert.ok(voyageFrame(0).shipX < voyageFrame(BOOT_MS).shipX);
  assert.deepEqual(VOYAGE.filter(chapter => chapter.detour).map(chapter => chapter.id), ["amazon", "impel", "marine"]);
});

test("six distinct effort poses leave the pet forms unchanged", () => {
  assert.equal(FORMS.length, 5);
  assert.deepEqual(EFFORT_LEVELS.map(level => EFFORT_FORMS[EFFORTS[level].form].title),
    ["常态", "二档", "三档", "四档", "五档", "黑色猴子"]);
});

test("the native showcase uses only the expanded effort control and rejects other debug targets", () => {
  const port = 9335;
  const target = { id: "test-frame", type: "page", url: "app://-/index.html", webSocketDebuggerUrl: "ws://127.0.0.1:9335/devtools/page/test-frame" };
  assert.equal(reasoning.debuggerTarget([target], port), target);
  assert.equal(reasoning.debuggerTarget([{ ...target, url: "https://example.com" }], port), null);
  assert.equal(reasoning.debuggerTarget([{ ...target, webSocketDebuggerUrl: target.webSocketDebuggerUrl.replace("127.0.0.1", "example.com") }], port), null);
  assert.equal(reasoning.effortStyles(), "");
  const css = reasoning.effortStyles("abc");
  assert.match(css, /aria-expanded="true".*data-selected-reasoning-effort/);
  assert.match(css, /data-moonlight-effort-stage/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(css, /三档|黑色猴子|完整档位/);
  assert.doesNotMatch(css, /base64|background-position|@keyframes|scale\(/);
  assert.match(css, /content:none!important/);
});
