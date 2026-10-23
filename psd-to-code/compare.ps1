# Compares an app screenshot with the client's mockup.
# Writes two images next to the screenshot:
#   <shot>.diff.png    - black where equal, red where different (amplified)
#   <shot>.overlay.png - mockup and screenshot at 50 % each (double edges = offset)
# and prints the percentage of pixels that differ by more than the threshold.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File ~/.claude/skills/psd-to-code/compare.ps1 -Mockup "materials/2.jpg" -Shot "shots/2-start.png"
# Optional: -Threshold 40 (0-255, mean absolute difference over R,G,B; JPEG noise is usually < 25)

param(
  [Parameter(Mandatory = $true)][string]$Mockup,
  [Parameter(Mandatory = $true)][string]$Shot,
  [int]$Threshold = 40
)
Add-Type -AssemblyName System.Drawing

$m0 = [System.Drawing.Bitmap]::new((Resolve-Path $Mockup).Path)
$s = [System.Drawing.Bitmap]::new((Resolve-Path $Shot).Path)
$W = $s.Width; $H = $s.Height

# Scale the mockup to the screenshot size if they differ (e.g. a 2160x3840 mockup)
if ($m0.Width -ne $W -or $m0.Height -ne $H) {
  Write-Host "NOTE: mockup $($m0.Width)x$($m0.Height), screenshot ${W}x${H} - scaling the mockup"
  $m = [System.Drawing.Bitmap]::new($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($m)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($m0, 0, 0, $W, $H); $g.Dispose()
} else { $m = $m0 }

$rect = [System.Drawing.Rectangle]::new(0, 0, $W, $H)
$fmt = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$dm = $m.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $fmt)
$ds = $s.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $fmt)
$n = $dm.Stride * $H
$bm = New-Object byte[] $n; $bs = New-Object byte[] $n
[System.Runtime.InteropServices.Marshal]::Copy($dm.Scan0, $bm, 0, $n)
[System.Runtime.InteropServices.Marshal]::Copy($ds.Scan0, $bs, 0, $n)
$m.UnlockBits($dm); $s.UnlockBits($ds)

# Loop in C# - a PowerShell loop over 2M pixels takes minutes
Add-Type -TypeDefinition @"
public static class PixelDiff {
  public static int[] Compute(byte[] a, byte[] b, byte[] output, int threshold) {
    int differing = 0, total = a.Length / 4;
    for (int i = 0; i < a.Length; i += 4) {
      int d = (System.Math.Abs(a[i] - b[i]) + System.Math.Abs(a[i+1] - b[i+1]) + System.Math.Abs(a[i+2] - b[i+2])) / 3;
      byte v = (byte)System.Math.Min(255, d * 3);
      output[i] = 0; output[i+1] = 0; output[i+2] = v; output[i+3] = 255;
      if (d > threshold) differing++;
    }
    return new int[] { differing, total };
  }
}
"@
$bo = New-Object byte[] $n
$res = [PixelDiff]::Compute($bm, $bs, $bo, $Threshold)

$out = [System.Drawing.Bitmap]::new($W, $H, $fmt)
$do = $out.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, $fmt)
[System.Runtime.InteropServices.Marshal]::Copy($bo, 0, $do.Scan0, $n)
$out.UnlockBits($do)

$base = [System.IO.Path]::ChangeExtension((Resolve-Path $Shot).Path, $null).TrimEnd('.')
$out.Save("$base.diff.png", [System.Drawing.Imaging.ImageFormat]::Png)

$ov = [System.Drawing.Bitmap]::new($W, $H)
$g = [System.Drawing.Graphics]::FromImage($ov)
$g.DrawImage($m, 0, 0, $W, $H)
$cm = [System.Drawing.Imaging.ColorMatrix]::new(); $cm.Matrix33 = 0.5
$ia = [System.Drawing.Imaging.ImageAttributes]::new(); $ia.SetColorMatrix($cm)
$g.DrawImage($s, $rect, 0, 0, $W, $H, [System.Drawing.GraphicsUnit]::Pixel, $ia)
$g.Dispose()
$ov.Save("$base.overlay.png", [System.Drawing.Imaging.ImageFormat]::Png)

$pct = [math]::Round(100.0 * $res[0] / $res[1], 2)
Write-Host "Differing pixels (threshold $Threshold): $pct%"
Write-Host "  $base.diff.png"
Write-Host "  $base.overlay.png"
$m0.Dispose(); $s.Dispose(); $out.Dispose(); $ov.Dispose()
if ($m -ne $m0) { $m.Dispose() }
