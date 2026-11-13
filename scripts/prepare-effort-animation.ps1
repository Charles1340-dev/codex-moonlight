param(
    [Parameter(Mandatory = $true)][string] $Rife,
    [Parameter(Mandatory = $true)][string] $Upscaler,
    [string] $ReuseWorkRoot,
    [ValidateRange(0, 5)][int[]] $Segments = @(0,1,2,3,4,5),
    [switch] $RefreshKeys,
    [switch] $DiagnosticSheets
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$rifePath = (Resolve-Path -LiteralPath $Rife).Path
$upscalerPath = (Resolve-Path -LiteralPath $Upscaler).Path
$model = Join-Path (Split-Path $rifePath -Parent) 'rife-v4.6'
$ffmpeg = (Get-Command ffmpeg.exe -ErrorAction Stop).Source
$workRoot = if ($ReuseWorkRoot) { (Resolve-Path -LiteralPath $ReuseWorkRoot).Path } else { Join-Path $root ('qa/effort-hd-' + [guid]::NewGuid().ToString('N')) }
$null = New-Item -ItemType Directory -Path $workRoot -Force
Set-Content -LiteralPath (Join-Path $root 'qa/effort-render-v27.txt') -Value $workRoot

# Development-only anime restoration and neural in-between tools, never shipped.
# https://github.com/xinntao/Real-ESRGAN
# https://github.com/nihui/rife-ncnn-vulkan/releases/tag/20221029
$alpha = '255-max(0,g(X,Y)-max(r(X,Y),b(X,Y)))'
$unmix = "format=gbrap,geq=r='r(X,Y)*255/max(1,$alpha)':g='min(g(X,Y),max(r(X,Y),b(X,Y)))*255/max(1,$alpha)':b='b(X,Y)*255/max(1,$alpha)':a='if(lt($alpha,12),0,$alpha)',format=rgba"
$keys = Join-Path $workRoot 'keys'
if ($ReuseWorkRoot -and $RefreshKeys) { $keys = Join-Path $workRoot ('keys-refresh-' + [guid]::NewGuid().ToString('N')) }
$hd = Join-Path $workRoot 'keys-hd'
$null = New-Item -ItemType Directory -Path $keys, $hd -Force
if (-not $ReuseWorkRoot -or $RefreshKeys) {
foreach ($index in $Segments) {
    $file = if ($index -eq 5) { 'effort-laugh-v27.png' } elseif ($index -ge 2) { "effort-transform-$index-v27.png" } else { "effort-transform-$index.png" }
    $source = Join-Path $root ("local-themes/voyage/" + $file)
    $graph = "color=c=0x00ff00:s=256x256:r=24[bg];[0:v]crop=256:256:x='mod(n,6)*256':y='floor(mod(n,24)/6)*256',trim=end_frame=24,setpts=PTS-STARTPTS[actor];[bg][actor]overlay=shortest=1:format=auto,format=rgb24[out]"
    & $ffmpeg -hide_banner -loglevel error -threads 2 -loop 1 -framerate 24 -i $source -filter_complex $graph -map '[out]' -frames:v 24 -start_number ($index * 24) -y (Join-Path $keys '%08d.png')
    if ($LASTEXITCODE -ne 0) { throw "Could not decode keyframes $index" }
}
try {
    $ErrorActionPreference = 'Continue'
    & $upscalerPath -i $keys -o $hd -m (Join-Path (Split-Path $upscalerPath -Parent) 'models') -n realesr-animevideov3 -s 4 -j 1:1:1 -f png *> (Join-Path $workRoot 'upscale.log')
    $upscaleExit = $LASTEXITCODE
} finally { $ErrorActionPreference = 'Stop' }
if ($upscaleExit -ne 0 -or @(Get-ChildItem -LiteralPath $hd -Filter '*.png').Count -ne 144) { throw 'Could not restore anime line art.' }
}

foreach ($index in $Segments) {
    $inputFrames = Join-Path $workRoot ("keys-" + $index)
    $outputFrames = Join-Path $workRoot ("frames-" + $index)
    $null = New-Item -ItemType Directory -Path $inputFrames, $outputFrames -Force
    foreach ($frame in 0..23) {
        Copy-Item -LiteralPath (Join-Path $hd (('{0:D8}' -f ($index * 24 + $frame)) + '.png')) -Destination (Join-Path $inputFrames (('{0:D8}' -f $frame) + '.png'))
    }
    # Shared exact endpoints remove hard cuts between transformation arcs and the laugh loop.
    $startKey = if ($index -eq 4 -or $index -eq 5) { 120 } elseif ($index -gt 0) { $index * 24 - 1 } else { 0 }
    Copy-Item -LiteralPath (Join-Path $hd (('{0:D8}' -f $startKey) + '.png')) -Destination (Join-Path $inputFrames '00000000.png') -Force
    if ($index -eq 3 -or $index -eq 5) {
        Copy-Item -LiteralPath (Join-Path $hd '00000120.png') -Destination (Join-Path $inputFrames '00000023.png') -Force
    }
    if ($RefreshKeys -or @(Get-ChildItem -LiteralPath $outputFrames -Filter '*.png').Count -ne 144) { try {
        $ErrorActionPreference = 'Continue'
        & $rifePath -i $inputFrames -o $outputFrames -m $model -n 144 -j 1:1:1 -f '%08d.png' *> (Join-Path $workRoot ("rife-" + $index + '.log'))
        $renderExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = 'Stop' } } else { $renderExit = 0 }
    if ($renderExit -ne 0 -or @(Get-ChildItem -LiteralPath $outputFrames -Filter '*.png').Count -ne 144) { throw "Could not refine arc $index" }
    if ($DiagnosticSheets) { foreach ($sheet in 0..5) {
        $file = if ($index -eq 5) { "effort-laugh-$sheet.webp" } else { "effort-hd-$index-$sheet.webp" }
        $destination = Join-Path $root ("local-themes/voyage/" + $file)
        # RIFE writes 1-based files. Adjacent sheets must not repeat or skip a frame.
        & $ffmpeg -hide_banner -loglevel error -threads 2 -framerate 120 -start_number ($sheet * 24 + 1) -i (Join-Path $outputFrames '%08d.png') -vf "scale=640:640:flags=lanczos,$unmix,pad=644:644:2:2:color=0x00000000,tile=6x4:nb_frames=24" -frames:v 1 -c:v libwebp -preset drawing -lossless 0 -q:v 97 -compression_level 6 -y $destination
        if ($LASTEXITCODE -ne 0) { throw "Could not encode $file" }
        if ((Get-Item -LiteralPath $destination).Length -gt 8000000) { throw "Oversized sheet $file" }
    } }
    Write-Output ("Prepared 640px complete-body sequence " + $index)
}
Write-Output $workRoot
& (Join-Path $PSScriptRoot 'prepare-effort-film.ps1') -WorkRoot $workRoot
