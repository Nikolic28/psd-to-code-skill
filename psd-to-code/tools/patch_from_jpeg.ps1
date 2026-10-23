# Fills in what composite.cjs cannot draw (e.g. an "inner bevel" effect): where the
# mask is white, take the pixel from the client's JPEG export (Photoshop output, with
# the effect); everywhere else keep the PSD composite. The mask edge is softened (7x7 box blur).
#   powershell -ExecutionPolicy Bypass -File tools/patch_from_jpeg.ps1 `
#     -Plate composite.png -Jpeg materials/7.jpg -Mask mask.png -Out final.png
# All three images must have the same size. Example of building the mask:
# examples-fresh-corner/prepare_assets.cjs (layer with effects, grown by 16 px).
param(
  [Parameter(Mandatory = $true)][string]$Plate,
  [Parameter(Mandatory = $true)][string]$Jpeg,
  [Parameter(Mandatory = $true)][string]$Mask,
  [Parameter(Mandatory = $true)][string]$Out
)
Add-Type -AssemblyName System.Drawing

function Load([string]$p) {
  $b = [System.Drawing.Bitmap]::new($p)
  $r = [System.Drawing.Rectangle]::new(0, 0, $b.Width, $b.Height)
  $d = $b.LockBits($r, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($d.Stride * $b.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $bytes, 0, $bytes.Length)
  $size = @($b.Width, $b.Height)
  $b.UnlockBits($d); $b.Dispose()
  return @{ Bytes = $bytes; W = $size[0]; H = $size[1] }
}

$p = Load $Plate
$j = Load $Jpeg
$m = Load $Mask
$W = $p.W; $H = $p.H
if ($j.W -ne $W -or $j.H -ne $H -or $m.W -ne $W -or $m.H -ne $H) { throw "Plate, Jpeg and Mask must have the same size" }

Add-Type -TypeDefinition @"
public static class JpegPatch {
  public static void Merge(byte[] p, byte[] j, byte[] m, int W, int H) {
    // soft edge: 7x7 box blur of the mask
    float[] a = new float[W * H];
    for (int i = 0; i < W * H; i++) a[i] = m[i * 4] / 255f;
    float[] b = new float[W * H];
    int R = 3;
    for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) {
      float s = 0; int n = 0;
      for (int dy = -R; dy <= R; dy++) for (int dx = -R; dx <= R; dx++) {
        int X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; s += a[Y * W + X]; n++; }
      b[y * W + x] = s / n;
    }
    for (int i = 0; i < W * H; i++) {
      float t = b[i]; if (t <= 0) continue;
      for (int k = 0; k < 3; k++) p[i * 4 + k] = (byte)(j[i * 4 + k] * t + p[i * 4 + k] * (1 - t) + 0.5f);
      p[i * 4 + 3] = 255;
    }
  }
}
"@
[JpegPatch]::Merge($p.Bytes, $j.Bytes, $m.Bytes, $W, $H)

$bmp = [System.Drawing.Bitmap]::new($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$r = [System.Drawing.Rectangle]::new(0, 0, $W, $H)
$d = $bmp.LockBits($r, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
[System.Runtime.InteropServices.Marshal]::Copy($p.Bytes, 0, $d.Scan0, $p.Bytes.Length)
$bmp.UnlockBits($d)
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "patched -> $Out"
