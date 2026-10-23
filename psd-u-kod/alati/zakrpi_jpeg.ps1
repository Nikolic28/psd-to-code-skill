# Ekran 7: solja ima "inner bevel" efekat koji ag-psd ne crta. Gde je maska
# (solja + kontura) bela, uzmi piksel iz klijentovog 7.jpg (Photoshop izvoz,
# sa bevel-om); svuda drugde ostaje sastav iz PSD-a. Ivica maske je meka (blur 3 px).
param(
  [Parameter(Mandatory = $true)][string]$Plate,
  [Parameter(Mandatory = $true)][string]$Jpeg,
  [Parameter(Mandatory = $true)][string]$Maska,
  [Parameter(Mandatory = $true)][string]$Izlaz
)
Add-Type -AssemblyName System.Drawing

function Ucitaj([string]$p) {
  $b = [System.Drawing.Bitmap]::new($p)
  $r = [System.Drawing.Rectangle]::new(0, 0, $b.Width, $b.Height)
  $d = $b.LockBits($r, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($d.Stride * $b.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $bytes, 0, $bytes.Length)
  $b.UnlockBits($d); $b.Dispose()
  return ,$bytes
}

$p = Ucitaj $Plate
$j = Ucitaj $Jpeg
$m = Ucitaj $Maska
$W = 1080; $H = 1920

Add-Type -TypeDefinition @"
public static class Zakrpa {
  public static void Spoji(byte[] p, byte[] j, byte[] m, int W, int H) {
    // meka ivica: box blur maske 7x7
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
[Zakrpa]::Spoji($p, $j, $m, $W, $H)

$out = [System.Drawing.Bitmap]::new($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$r = [System.Drawing.Rectangle]::new(0, 0, $W, $H)
$d = $out.LockBits($r, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
[System.Runtime.InteropServices.Marshal]::Copy($p, 0, $d.Scan0, $p.Length)
$out.UnlockBits($d)
$out.Save($Izlaz, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose()
Write-Host "zakrpljeno -> $Izlaz"
