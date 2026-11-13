param(
 [Parameter(Mandatory=$true)][string]$WorkRoot
)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$work=(Resolve-Path -LiteralPath $WorkRoot).Path
$ffmpeg=(Get-Command ffmpeg.exe).Source
$alpha='255-max(0,g(X,Y)-max(r(X,Y),b(X,Y)))'
$unmix="format=gbrap,geq=r='r(X,Y)':g='min(g(X,Y),max(r(X,Y),b(X,Y)))':b='b(X,Y)':a='if(lt($alpha,12),0,$alpha)',unpremultiply=inplace=1,premultiply=inplace=1,unpremultiply=inplace=1,format=rgba"
foreach($clip in @('forward','reverse','laugh','laugh-reverse')){
 $folder=Join-Path $work ('film-'+$clip)
 $null=New-Item -ItemType Directory -Path $folder -Force
 $length=if($clip -like 'laugh*'){144}else{720}
 foreach($index in 0..($length-1)){
  $sourceIndex=if($clip -like '*reverse'){$length-1-$index}else{$index}
  $segment=if($clip -like 'laugh*'){5}else{[math]::Floor($sourceIndex/144)}
  $frame=$sourceIndex%144+1
  $source=Join-Path (Join-Path $work ('frames-'+$segment)) (('{0:D8}' -f $frame)+'.png')
  $destination=Join-Path $folder (('{0:D8}' -f $index)+'.png')
  if(-not(Test-Path -LiteralPath $destination)){$null=New-Item -ItemType HardLink -Path $destination -Target $source}
 }
 $fps=if($clip -like 'laugh*'){90}else{120}
 $destination=Join-Path $root ('local-themes/voyage/effort-film-'+$clip+'.webm')
 & $ffmpeg -hide_banner -loglevel error -threads 2 -framerate $fps -i (Join-Path $folder '%08d.png') -vf "scale=640:640:flags=lanczos,$unmix,pad=672:672:16:16:color=0x00000000,format=yuva420p" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 20 -deadline realtime -cpu-used 6 -row-mt 1 -threads 4 -auto-alt-ref 0 -an -y $destination
 if($LASTEXITCODE-ne0){throw "Could not encode $clip"}
 Write-Output ('Prepared transparent video '+$clip)
}

