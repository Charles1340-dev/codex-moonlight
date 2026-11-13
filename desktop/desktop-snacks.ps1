param([int]$NearX, [int]$NearY)

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
public static class MoonlightDesktop {
  public delegate bool EnumWindow(IntPtr window, IntPtr data);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindow callback, IntPtr data);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string name, string title);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] private static extern bool DestroyIcon(IntPtr icon);
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct FileInfo {
    public IntPtr Icon;
    public int Index;
    public uint Attributes;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string DisplayName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string TypeName;
  }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  private static extern IntPtr SHGetFileInfo(string path, uint attributes, out FileInfo info, uint size, uint flags);
  public static string ShortcutImage(string path) {
    FileInfo info;
    if (SHGetFileInfo(path, 0, out info, (uint)Marshal.SizeOf(typeof(FileInfo)), 0x120) == IntPtr.Zero
        || info.Icon == IntPtr.Zero) return null;
    try {
      using (var icon = Icon.FromHandle(info.Icon))
      using (var bitmap = icon.ToBitmap())
      using (var stream = new MemoryStream()) {
        bitmap.Save(stream, ImageFormat.Png);
        return Convert.ToBase64String(stream.ToArray());
      }
    } finally { DestroyIcon(info.Icon); }
  }
  [DllImport("oleacc.dll")] private static extern int AccessibleObjectFromWindow(IntPtr window, uint id, ref Guid interfaceId, [MarshalAs(UnmanagedType.Interface)] out object client);
  public static object GetClient(IntPtr window) {
    Guid id = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
    object client;
    return AccessibleObjectFromWindow(window, 0xFFFFFFFC, ref id, out client) == 0 ? client : null;
  }
}
'@
[void][MoonlightDesktop]::SetThreadDpiAwarenessContext([IntPtr](-4))

# Match only shortcuts that actually exist in one of the two desktop folders.
$shortcuts = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($folder in @([Environment]::GetFolderPath('DesktopDirectory'), [Environment]::GetFolderPath('CommonDesktopDirectory'))) {
    if ($folder -and (Test-Path -LiteralPath $folder -PathType Container)) {
        Get-ChildItem -LiteralPath $folder -File -ErrorAction SilentlyContinue |
            Where-Object Extension -In '.lnk', '.url', '.appref-ms' |
            ForEach-Object {
                if (!$shortcuts.ContainsKey($_.Name)) { $shortcuts.Add($_.Name, $_.FullName) }
                if (!$shortcuts.ContainsKey($_.BaseName)) { $shortcuts.Add($_.BaseName, $_.FullName) }
            }
    }
}

$script:view = [IntPtr]::Zero
$script:desktop = [IntPtr]::Zero
[void][MoonlightDesktop]::EnumWindows({
    param($window, $data)
    $hostView = [MoonlightDesktop]::FindWindowEx($window, [IntPtr]::Zero, 'SHELLDLL_DefView', [NullString]::Value)
    if ($hostView -eq [IntPtr]::Zero) { return $true }
    $script:view = [MoonlightDesktop]::FindWindowEx($hostView, [IntPtr]::Zero, 'SysListView32', [NullString]::Value)
    if ($script:view -eq [IntPtr]::Zero) { return $true }
    $script:desktop = $window
    return $false
}, [IntPtr]::Zero)

$items = @()
if ($script:view -ne [IntPtr]::Zero -and $shortcuts.Count) {
    $list = [MoonlightDesktop]::GetClient($script:view)
    $count = if ($list) { $list.accChildCount } else { 0 }
    for ($index = 1; $index -le $count; $index++) {
        try {
            $name = $list.accName($index)
            if (!$name -or !$shortcuts.ContainsKey($name)) { continue }
            if ($list.accState($index) -band 0x18000) { continue }
            [int]$x = 0; [int]$y = 0; [int]$width = 0; [int]$height = 0
            $list.accLocation([ref]$x, [ref]$y, [ref]$width, [ref]$height, $index)
        } catch { continue }
        if ($width -le 0 -or $height -le 0) { continue }
        $point = [MoonlightDesktop+Point]::new()
        $point.X = [int]($x + $width / 2)
        $size = [Math]::Min(48, [Math]::Max(24, [Math]::Min($width, $height * 2 / 3)))
        $point.Y = [int]($y + $size / 2)
        $top = [MoonlightDesktop]::GetAncestor([MoonlightDesktop]::WindowFromPoint($point), 2)
        if ($top -ne $script:desktop) { continue }
        $items += [pscustomobject]@{ x = $point.X; y = $point.Y; size = $size; path = $shortcuts[$name] }
    }
}
$items = @($items | Sort-Object { [Math]::Pow($_.x - $NearX, 2) + [Math]::Pow($_.y - $NearY, 2) } |
    Select-Object -First 12 | ForEach-Object {
        $image = try { [MoonlightDesktop]::ShortcutImage($_.path) } catch { $null }
        @{ x = $_.x; y = $_.y; size = $_.size; image = $image }
    })
ConvertTo-Json -InputObject $items -Compress
