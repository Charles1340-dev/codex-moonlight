import { strToU8, zipSync } from "fflate";

export const maxImageBytes = 10 * 1024 * 1024;
const safeCss = [
  '[data-ds-part="sidebar"] { border-color: #685b87; }',
  '[data-ds-part="composer"] { background-color: rgba(28, 24, 45, 0.94); border-color: #a896ca; transition-property: border-color, background-color; transition-duration: 180ms; }',
  '[data-ds-part="composer"]:hover { background-color: rgba(32, 27, 51, 0.96); border-color: #d3c2ff; }',
].join("\n");

function imageExtension(data) {
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpg";
  const header = String.fromCharCode(...data.slice(0, 12));
  if (header.startsWith("\x89PNG\r\n\x1a\n")) return "png";
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") return "webp";
  throw new Error("请选择有效的 PNG、JPG 或 WebP 图片。");
}

function checkedImage(data) {
  if (!data.length || data.length > maxImageBytes) throw new Error("壁纸大小须在 10 MB 以内。");
  return imageExtension(data);
}

export function makeThemePack(data, id = "moonlight-codex") {
  const image = "background." + checkedImage(data);
  const theme = {
    schemaVersion: 1,
    id,
    name: "月白解放",
    image,
    appearance: "dark",
    art: { focusX: 0.62, focusY: 0.49, safeArea: "left", taskMode: "ambient" },
  };
  return zipSync({
    "theme.json": strToU8(JSON.stringify(theme, null, 2) + "\n"),
    "theme.css": strToU8(safeCss + "\n"),
    [image]: data,
  }, { level: 0 });
}

export async function readWallpaper(file) {
  if (!file.size || file.size > maxImageBytes) throw new Error("壁纸大小须在 10 MB 以内。");
  checkedImage(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const { naturalWidth: width, naturalHeight: height } = image;
    if (width > 16384 || height > 16384 || width * height > 50_000_000) {
      throw new Error("壁纸边长须在 16,384 像素以内，总像素数须在 5,000 万以内。");
    }
    return url;
  } catch (error) {
    URL.revokeObjectURL(url);
    if (error instanceof DOMException) throw new Error("图片无法解码，请换一张壁纸。");
    throw error;
  }
}

export function localWallpaper(action, file) {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open("moonlight-wallpaper", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("settings");
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const operation = db.transaction("settings", action === "get" ? "readonly" : "readwrite");
      const store = operation.objectStore("settings");
      let request;
      if (action === "get") request = store.get("wallpaper");
      if (action === "put") request = store.put(file, "wallpaper");
      if (action === "delete") request = store.delete("wallpaper");
      operation.oncomplete = () => { db.close(); resolve(request?.result); };
      operation.onabort = () => { db.close(); reject(operation.error); };
    };
  });
}

export async function downloadTheme(art) {
  const response = await fetch(art);
  if (!response.ok) throw new Error("读取当前壁纸失败。");
  const data = new Uint8Array(await response.arrayBuffer());
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  const suffix = Array.from(bytes.slice(0, 5), byte => byte.toString(16).padStart(2, "0")).join("");
  const contents = makeThemePack(data, "moonlight-" + suffix);
  const url = URL.createObjectURL(new Blob([contents], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "moonlight-theme.zip";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
