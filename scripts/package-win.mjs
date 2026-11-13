import { packager } from "@electron/packager";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { makeThemePack } from "../src/theme.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (process.platform !== "win32") throw new Error("请在 Windows 上构建便携包。");

const execute = promisify(execFile);
const output = join(root, "release");
const appName = "MoonlightCodex";
const fileName = appName + "-" + manifest.version + "-win-x64.zip";
const electronZipDir = process.env.MOONLIGHT_ELECTRON_ZIP_DIR;
if (electronZipDir) {
  const electronZip = "electron-v" + manifest.devDependencies.electron + "-win32-x64.zip";
  const expected = JSON.parse(await readFile(join(root, "node_modules", "electron", "checksums.json"), "utf8"))[electronZip];
  const actual = createHash("sha256").update(await readFile(join(electronZipDir, electronZip))).digest("hex");
  if (!expected || expected !== actual) throw new Error("Electron 压缩包的 SHA-256 校验失败。");
}
const stage = await mkdtemp(join(tmpdir(), "moonlight-package-"));
if (dirname(stage) !== tmpdir() || !basename(stage).startsWith("moonlight-package-")) {
  throw new Error("打包临时目录不在预期位置。");
}

try {
  const appDir = join(stage, "app");
  await mkdir(appDir);
  await mkdir(join(appDir, "src"));
  await Promise.all([
    cp(join(root, "dist", "client"), join(appDir, "client"), { recursive: true }),
    cp(join(root, "desktop"), join(appDir, "desktop"), { recursive: true }),
    cp(join(root, "src", "chapter-art.mjs"), join(appDir, "src", "chapter-art.mjs")),
    cp(join(root, "src", "effort-animation.mjs"), join(appDir, "src", "effort-animation.mjs")),
    writeFile(join(appDir, "package.json"), JSON.stringify({
      name: manifest.name, version: manifest.version, main: manifest.main,
    })),
  ]);
  const [appFolder] = await packager({
    dir: appDir,
    name: appName,
    platform: "win32",
    arch: "x64",
    electronVersion: manifest.devDependencies.electron,
    electronZipDir,
    out: join(stage, "output"),
    asar: false,
  });
  await cp(join(root, "README.md"), join(appFolder, "使用说明.md"));
  await cp(join(root, "LICENSE"), join(appFolder, "LICENSE"));
  await mkdir(join(appFolder, "docs"));
  await cp(join(root, "docs", "航海启动分镜.md"), join(appFolder, "docs", "航海启动分镜.md"));
  await cp(join(root, "docs", "章节原画来源.md"), join(appFolder, "docs", "章节原画来源.md"));
  await cp(join(root, "docs", "模型强度变身动画.md"), join(appFolder, "docs", "模型强度变身动画.md"));
  await cp(join(root, "docs", "桌宠自然动作.md"), join(appFolder, "docs", "桌宠自然动作.md"));
  await cp(join(root, "docs", "本地素材接入.md"), join(appFolder, "docs", "本地素材接入.md"));
  await cp(join(root, "docs", "GitHub开源发布.md"), join(appFolder, "docs", "GitHub开源发布.md"));
  await cp(join(root, "CONTRIBUTING.md"), join(appFolder, "CONTRIBUTING.md"));
  await cp(join(root, "docs", "启动船只修复.md"), join(appFolder, "docs", "启动船只修复.md"));
  const wallpaper = await readFile(join(root, "themes", "moonlight", "wallpaper.webp"));
  await writeFile(join(appFolder, "moonlight-theme.zip"), makeThemePack(wallpaper));
  await mkdir(output, { recursive: true });
  const archive = join(stage, fileName);
  const powershell = join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  await execute(powershell, [
    "-NoProfile", "-NonInteractive", "-Command",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:MOONLIGHT_ZIP_SOURCE, $env:MOONLIGHT_ZIP_DEST, [IO.Compression.CompressionLevel]::Optimal, $true)",
  ], { windowsHide: true, env: { ...process.env, MOONLIGHT_ZIP_SOURCE: appFolder, MOONLIGHT_ZIP_DEST: archive } });
  const releaseFile = join(output, fileName);
  // Copy across volumes before replacing the final file.
  const stagingFile = releaseFile + ".part";
  await cp(archive, stagingFile);
  await rename(stagingFile, releaseFile);
  const checksum = createHash("sha256").update(await readFile(releaseFile)).digest("hex");
  await writeFile(releaseFile + ".sha256", checksum + "  " + fileName + "\n");
  console.log(releaseFile);
} finally {
  await rm(stage, { recursive: true, force: true });
}
