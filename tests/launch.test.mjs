import assert from "node:assert/strict";
import test from "node:test";
import { launchCodex, runBridge } from "../desktop/launch.cjs";
import { EventEmitter } from 'node:events';

test('verified bridge output hands off before background command completion', async () => {
  const stdout = new EventEmitter();
  let complete;
  const pending = runBridge((_exe,_args,_options,callback)=>{
    complete=callback;
    return {stdout};
  },'powershell.exe',[],{});
  stdout.emit('data','launched');
  stdout.emit('data',':9336\r\n');
  assert.deepEqual(await pending,{stdout:'launched:9336',stderr:''});
  complete(new Error('background verification still pending'),'','');
});

test("a launcher timeout recovers the verified Codex session", async () => {
  const calls = [];
  const result = await launchCodex("dreamskin", async action => {
    calls.push(action);
    if (action === "dreamskin") throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
    return { stdout: "launched:9335\r\n" };
  });
  assert.deepEqual(result, { port: 9335 });
  assert.deepEqual(calls, ["dreamskin", "session"]);
});

test("an opened Codex is a successful handoff when its bridge is still starting", async () => {
  const result = await launchCodex("dreamskin", async action => ({
    stdout: action === "watch" ? "ready\r\n" : "",
  }));
  assert.deepEqual(result, {});
});

test("a real launch failure requires a missing session and a missing Codex window", async () => {
  await assert.rejects(launchCodex("dreamskin", async () => ({ stdout: "" })), /Codex/);
});
