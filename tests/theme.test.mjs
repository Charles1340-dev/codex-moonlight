import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { makeThemePack, maxImageBytes } from "../src/theme.mjs";

test("Dream Skin archive has exactly the registered image, manifest and CSS", async () => {
  const wallpaper = await readFile(new URL("../themes/moonlight/wallpaper.webp", import.meta.url));
  const archive = unzipSync(makeThemePack(wallpaper, "moonlight-test"));
  assert.deepEqual(Object.keys(archive).sort(), ["background.webp", "theme.css", "theme.json"]);
  const theme = JSON.parse(strFromU8(archive["theme.json"]));
  assert.equal(theme.id, "moonlight-test");
  assert.equal(theme.image, "background.webp");
  assert.equal(theme.appearance, "dark");
  assert.deepEqual(Buffer.from(archive[theme.image]), wallpaper);
  assert.match(strFromU8(archive["theme.css"]), /data-ds-part="composer"/);
});

test("rejects an unsupported or oversize wallpaper", () => {
  assert.throws(() => makeThemePack(Uint8Array.of(1, 2, 3)), /有效的/);
  assert.throws(() => makeThemePack(new Uint8Array(maxImageBytes + 1)), /10 MB/);
});
