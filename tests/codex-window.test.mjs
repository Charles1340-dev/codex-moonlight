import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const bridge = readFileSync(new URL("../desktop/codex-window.ps1", import.meta.url), "utf8");

test("Windows launcher reuses running Codex and starts it only when absent", { skip: process.platform !== "win32" }, context => {
  const localAppData = mkdtempSync(join(tmpdir(), "moonlight-launch-test-"));
  context.after(() => rmSync(localAppData, { recursive: true, force: true }));
  const scripts = join(localAppData, "CodexDreamSkin", "engine", "scripts");
  mkdirSync(scripts, { recursive: true });
  writeFileSync(join(scripts, "common-windows.ps1"), String.raw`
    function Get-DreamSkinLiveSessionContext {
      if ($env:MOONLIGHT_TEST_SCENARIO -eq 'starting') { throw 'Stale state must not delay the new verified endpoint' }
      if ($env:MOONLIGHT_TEST_SCENARIO -eq 'themed' -or (Test-Path -LiteralPath $env:MOONLIGHT_TEST_MARKER)) {
        @{ Port = 9335; BrowserId = 'verified' }
      }
    }
    function Get-DreamSkinVerifiedCdpIdentityForAnyRegistered {
      param($Port)
      $listeners = @(Get-DreamSkinPortListeners -Port $Port)
      if (-not $listeners.Count -or @($listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') -or $_.OwningProcess -ne 41 }).Count) { return $null }
      @{ Identity = @{ BrowserId = 'verified' } }
    }
    function Invoke-DreamSkinNative {
      $address = if ($env:MOONLIGHT_TEST_SCENARIO -eq 'wildcard') { '0.0.0.0' } else { '127.0.0.1' }
      $owner = if ($env:MOONLIGHT_TEST_SCENARIO -eq 'foreign') { 99 } else { 41 }
      @{ ExitCode = 0; Output = @("  TCP    $($address):9335   0.0.0.0:0   LISTENING   $owner", '  TCP    [::1]:9335   [::]:0   LISTENING   41', '  TCP    127.0.0.1:9335   127.0.0.1:443   ESTABLISHED   99', '  TCP    0.0.0.0:19335   0.0.0.0:0   LISTENING   99') }
    }
    function Get-DreamSkinCdpBrowserIdentity {
      if ($env:MOONLIGHT_TEST_SCENARIO -ne 'unverified') { @{ BrowserId = 'verified' } }
    }
  `);
  writeFileSync(join(scripts, "theme-windows.ps1"), "");
  writeFileSync(join(scripts, "start-dream-skin.ps1"), String.raw`
    Add-Content -LiteralPath $env:MOONLIGHT_TEST_MARKER -Value 'start'
  `);

  const mocks = String.raw`
    $install = Join-Path $env:LOCALAPPDATA 'FakeStore'
    function Get-AppxPackage {
      [pscustomobject]@{ PackageFamilyName = 'OpenAI.Codex_2p2nqsd0c76g0'; SignatureKind = 'Store'; InstallLocation = $install }
    }
    function Get-AppxPackageManifest {
      @{ Package = @{ Applications = @{ Application = [pscustomobject]@{ Id = 'App' } } } }
    }
    function Get-CimInstance {
      $path = Join-Path $install 'app\ChatGPT.exe'
      [pscustomobject]@{ ExecutablePath = $path; CommandLine = '--type=renderer'; ProcessId = 99 }
      if ($env:MOONLIGHT_TEST_SCENARIO -ne 'cold' -or (Test-Path -LiteralPath $env:MOONLIGHT_TEST_MARKER)) {
        $command = if ($env:MOONLIGHT_TEST_SCENARIO -in @('starting', 'wildcard', 'foreign', 'unverified') -or (Test-Path -LiteralPath $env:MOONLIGHT_TEST_MARKER)) { 'ChatGPT.exe --remote-debugging-port=9335' } else { 'ChatGPT.exe' }
        [pscustomobject]@{ ExecutablePath = $path; CommandLine = $command; ProcessId = 41 }
      }
    }
    function Get-Process { [pscustomobject]@{ Path = (Join-Path $install 'app\ChatGPT.exe') } }
    function New-Object {
      $shell = [pscustomobject]@{}
      Add-Member -InputObject $shell -MemberType ScriptMethod -Name AppActivate -Value {
        Write-Host "activate:$($args[0])"
        return $true
      }
      $shell
    }
    function Start-Process {
      param($FilePath)
      if ($FilePath -like '*powershell.exe') {
        Set-Content -LiteralPath $env:MOONLIGHT_TEST_MARKER -Value 'start'
        [pscustomobject]@{ HasExited = $false }
      } else { Write-Host 'store-launch' }
    }
  `;
  const marker = join(localAppData, "started.txt");
  const run = (action, scenario) => execFileSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-Command", mocks + "\n& {\n" + bridge + "\n} -Action " + action,
  ], {
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, LOCALAPPDATA: localAppData, MOONLIGHT_TEST_SCENARIO: scenario, MOONLIGHT_TEST_MARKER: marker },
  }).trim().split(/\r?\n/);

  assert.deepEqual(run("dreamskin", "themed"), ["launched:9335", "activate:41"]);
  assert.deepEqual(run("session", "themed"), ["launched:9335"]);
  assert.deepEqual(run("session", "ordinary"), [""]);
  assert.deepEqual(run("session", "starting"), ["launched:9335"]);
  assert.deepEqual(run("session", "wildcard"), [""]);
  assert.deepEqual(run("session", "foreign"), [""]);
  assert.deepEqual(run("session", "unverified"), [""]);
  assert.deepEqual(run("dreamskin", "ordinary"), ["activate:41", "launched"]);
  assert.deepEqual(run("launch", "ordinary"), ["activate:41", "launched"]);
  assert.deepEqual(run("launch", "cold"), ["store-launch", "launched"]);
  assert.deepEqual(run("dreamskin", "cold"), ["launched:9335", "activate:41"]);
  assert.equal(readFileSync(marker, "utf8").trim(), "start");
});
