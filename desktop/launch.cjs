function launchResult(output) {
  const match = /^launched(?::(\d{1,5}))?$/m.exec(output ?? "");
  if (!match) return null;
  const port = Number(match[1]);
  if (match[1] && (!Number.isInteger(port) || port < 1024 || port > 65535)) return null;
  return { port: port || undefined };
}

async function launchCodex(mode, windowWatch) {
  try {
    const result = launchResult((await windowWatch(mode === "dreamskin" ? "dreamskin" : "launch")).stdout);
    if (result) return result;
  } catch {}

  if (mode === "dreamskin") {
    const session = await windowWatch("session").catch(() => null);
    const result = launchResult(session?.stdout);
    if (result?.port) return result;
  }
  const window = await windowWatch("watch").catch(() => null);
  if (window?.stdout.trim() === "ready") return {};
  throw new Error("未检测到已打开的 Codex 窗口。");
}

function runBridge(execFile, executable, args, options) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let buffered = '';
    const child = execFile(executable, args, options, (error, stdout, stderr) => {
      if (settled) return;
      settled = true;
      if (error) reject(error); else resolve({stdout, stderr});
    });
    child.stdout.on('data', chunk => {
      if (settled) return;
      buffered = (buffered + chunk).slice(-32768);
      const ready = /^(?:launched(?::\d{1,5})?|ready)\r?\n/m.exec(buffered);
      if (ready) {
        settled = true;
        resolve({stdout: ready[0].trim(), stderr: ''});
      }
    });
  });
}

module.exports = { launchCodex, runBridge };
