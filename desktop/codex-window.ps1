param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('launch', 'dreamskin', 'watch', 'session')]
    [string] $Action
)

$ErrorActionPreference = 'Stop'
$packages = @(Get-AppxPackage -Name 'OpenAI.Codex' |
    Where-Object { $_.PackageFamilyName -eq 'OpenAI.Codex_2p2nqsd0c76g0' -and $_.SignatureKind -eq 'Store' })
if (-not $packages.Count) { exit 0 }
$package = $packages[0]
$executables = @($packages | ForEach-Object { Join-Path $_.InstallLocation 'app\ChatGPT.exe' })

function Get-VoyageCodexProcesses {
    Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.ExecutablePath -in $executables -and $_.CommandLine -notmatch '(?:^|\s)--type='
        } |
        Sort-Object CreationDate
}

function Show-VoyageCodexWindow {
    param([int[]] $ProcessIds)
    $shell = New-Object -ComObject WScript.Shell
    foreach ($processId in $ProcessIds) {
        try {
            if ($shell.AppActivate($processId)) { return }
        } catch {}
    }
}

if ($Action -in @('dreamskin', 'session')) {
    $skinRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
    $scripts = Join-Path $skinRoot 'engine\scripts'
    $entry = Join-Path $scripts 'start-dream-skin.ps1'
    if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) {
        if ($Action -eq 'session') { exit 0 }
        $Action = 'launch'
    }
}

if ($Action -in @('dreamskin', 'session')) {
    . (Join-Path $scripts 'common-windows.ps1')
    . (Join-Path $scripts 'theme-windows.ps1')
    function Get-DreamSkinPortListeners {
        param([int] $Port)
        # Preserve Dream Skin's before/after ownership checks, using the native
        # TCP table instead of slow NetTCPIP provider initialization each time.
        $result = Invoke-DreamSkinNative -FilePath (Join-Path $env:SystemRoot 'System32\netstat.exe') -ArgumentList @('-ano') -DiscardStderr
        if ($result.ExitCode -ne 0) { throw 'Unable to verify the TCP listener owner.' }
        foreach ($line in $result.Output) {
            if ($line -notmatch '^\s*TCP\s+(\S+)\s+\S+\s+LISTENING\s+(\d+)\s*$') { continue }
            $endpoint = $Matches[1]
            $ownerId = [int]$Matches[2]
            if ($endpoint -notmatch '^(.*):(\d+)$' -or [int]$Matches[2] -ne $Port) { continue }
            [pscustomobject]@{ LocalAddress = $Matches[1].Trim('[', ']'); OwningProcess = $ownerId }
        }
    }
    function Get-VoyageSkinSession {
        param([switch] $FreshOnly)
        # The registered Store process can expose its verified endpoint before
        # Dream Skin writes the new session state or finishes renderer theming.
        foreach ($process in @(Get-VoyageCodexProcesses)) {
            if ($process.CommandLine -match '(?:^|\s)--remote-debugging-port(?:=|\s+)(\d{1,5})(?:\s|$)') {
                $candidatePort = [int]$Matches[1]
                if ($candidatePort -lt 1024 -or $candidatePort -gt 65535) { continue }
                # This process already passed the registered Store path and
                # browser-command-line checks above. Check the TCP owner both
                # sides of the browser identity request without enumerating
                # Appx manifests and CIM processes again for each listener.
                $listeners = @(Get-DreamSkinPortListeners -Port $candidatePort)
                if (-not $listeners.Count -or @($listeners | Where-Object {
                    $_.LocalAddress -notin @('127.0.0.1', '::1') -or $_.OwningProcess -ne $process.ProcessId
                }).Count) { continue }
                $browser = Get-DreamSkinCdpBrowserIdentity -Port $candidatePort
                if (-not $browser) { continue }
                $listeners = @(Get-DreamSkinPortListeners -Port $candidatePort)
                $current = Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
                if ($current.Path -eq $process.ExecutablePath -and $listeners.Count -and -not @($listeners | Where-Object {
                    $_.LocalAddress -notin @('127.0.0.1', '::1') -or $_.OwningProcess -ne $process.ProcessId
                }).Count) { return @{ Port = $candidatePort; ProcessId = $process.ProcessId } }
            }
        }
        # A cold launch must not spend its loading phase retrying an endpoint
        # belonging to the previous browser. Its command line is the live source.
        if ($FreshOnly) { return $null }
        $context = Get-DreamSkinLiveSessionContext -StateRoot $skinRoot
        if ($context) {
            $verified = Get-DreamSkinVerifiedCdpIdentityForAnyRegistered -Port $context.Port
            if ($verified -and $verified.Identity.BrowserId -eq $context.BrowserId) {
                return @{ Port = $context.Port; Codex = $verified.Codex }
            }
        }
        return $null
    }
    $live = Get-VoyageSkinSession
    if ($Action -eq 'session') {
        if ($live) { 'launched:' + $live.Port }
        exit 0
    }
    $running = @(Get-VoyageCodexProcesses)
    $startInProgress = $running.CommandLine -match '(?:^|\s)--remote-debugging-port(?:=|\s)'
    if (-not $live -and -not $running.Count) {
        $hostExe = Join-Path $PSHOME 'powershell.exe'
        $logs = Join-Path $env:LOCALAPPDATA 'MoonlightVoyage\launch-logs'
        $null = New-Item -ItemType Directory -Path $logs -Force
        $arguments = @('-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'RemoteSigned', '-File', ('"' + $entry + '"'))
        $child = Start-Process -FilePath $hostExe -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'dreamskin-out.log') -RedirectStandardError (Join-Path $logs 'dreamskin-error.log')
        $startInProgress = $true
    }
    if (-not $live -and $startInProgress) {
        $deadline = [DateTime]::UtcNow.AddSeconds($(if ($child) { 95 } else { 20 }))
        $exitedAt = $null
        do {
            $live = Get-VoyageSkinSession -FreshOnly
            if ($live) { break }
            if ($child -and $child.HasExited) {
                if (-not $exitedAt) { $exitedAt = [DateTime]::UtcNow }
                if ([DateTime]::UtcNow -ge $exitedAt.AddSeconds(10)) { break }
            }
            Start-Sleep -Milliseconds 300
        } while ([DateTime]::UtcNow -lt $deadline)
    }
    if ($live) {
        # Hand off the verified port before the slower foreground activation.
        'launched:' + $live.Port
        $owners = if ($live.ProcessId) { @($live.ProcessId) } else { @(Get-DreamSkinPortListeners -Port $live.Port | Select-Object -ExpandProperty OwningProcess -Unique) }
        if ($owners.Count) { Show-VoyageCodexWindow -ProcessIds $owners }
        exit 0
    }
    $running = @(Get-VoyageCodexProcesses)
    if ($running.Count) {
        Show-VoyageCodexWindow -ProcessIds $running.ProcessId
        'launched'
    }
    exit 0
}

if ($Action -eq 'launch') {
    $running = @(Get-VoyageCodexProcesses)
    if ($running.Count) {
        Show-VoyageCodexWindow -ProcessIds $running.ProcessId
        'launched'
        exit 0
    }
    $manifest = Get-AppxPackageManifest -Package $package.PackageFullName
    $appId = $manifest.Package.Applications.Application |
        Where-Object { $_.Id -eq 'App' } |
        Select-Object -ExpandProperty Id -First 1
    if (-not $appId) { exit 0 }
    $target = 'shell:AppsFolder\' + $package.PackageFamilyName + '!' + $appId
    Start-Process -FilePath "$env:SystemRoot\explorer.exe" -ArgumentList $target
    'launched'
    exit 0
}

$stop = [DateTime]::UtcNow.AddSeconds(23)
do {
    $ready = Get-Process -Name 'ChatGPT', 'Codex' -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Path -in $executables -and
            $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.Responding
        } |
        Select-Object -First 1
    if ($ready) { 'ready'; exit 0 }
    Start-Sleep -Milliseconds 250
} while ([DateTime]::UtcNow -lt $stop)
