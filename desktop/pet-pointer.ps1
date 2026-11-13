param([Parameter(Mandatory = $true)][int]$OwnerId)

$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

public static class MoonlightPointer
{
    [StructLayout(LayoutKind.Sequential)]
    private struct Point { public int X; public int Y; }

    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] private static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] private static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);

    public static void Watch(int ownerId)
    {
        SetThreadDpiAwarenessContext(new IntPtr(-4));
        int[] buttons = { 1, 2, 4, 5, 6 };
        int primary = GetSystemMetrics(23) == 0 ? 1 : 2;
        int secondary = primary == 1 ? 2 : 1;
        bool[] pressed = new bool[buttons.Length];
        for (int i = 0; i < buttons.Length; i++) pressed[i] = GetAsyncKeyState(buttons[i]) < 0;

        using (var owner = Process.GetProcessById(ownerId))
        {
            int ticks = 0;
            while (ticks++ % 24 != 0 || !owner.HasExited)
            {
                for (int i = 0; i < buttons.Length; i++)
                {
                    bool down = GetAsyncKeyState(buttons[i]) < 0;
                    if (down != pressed[i] && (down || buttons[i] == primary))
                    {
                        Point point;
                        if (GetCursorPos(out point))
                        {
                            string action = down ? (buttons[i] == secondary ? "context" : "down") : "up";
                            Console.WriteLine("{0} {1} {2}", action, point.X, point.Y);
                            Console.Out.Flush();
                        }
                    }
                    pressed[i] = down;
                }
                Thread.Sleep(12);
            }
        }
    }
}
'@
[MoonlightPointer]::Watch($OwnerId)
