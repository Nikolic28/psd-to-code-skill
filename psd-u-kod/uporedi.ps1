# Poredi screenshot app-a (iz snimci/, shot.cjs) sa mockupom klijenta.
# Pravi dve slike pored snimka:
#   <snimak>.razlika.png - crno gde je isto, crveno gde se razlikuje (pojacano)
#   <snimak>.preklop.png - mockup i snimak preko pola providno (duple ivice = pomeraj)
# i ispisuje procenat piksela koji se razlikuju vise od praga.
#
# Upotreba:
#   powershell -ExecutionPolicy Bypass -File ~/.claude/skills/psd-u-kod/uporedi.ps1 -Mockup "materijali/JPEGs/2.jpg" -Snimak "snimci/2-pravila.png"
# Opciono: -Prag 40 (0-255, zbir razlike po kanalu / 3; JPEG sum je obicno < 25)

param(
  [Parameter(Mandatory = $true)][string]$Mockup,
  [Parameter(Mandatory = $true)][string]$Snimak,
  [int]$Prag = 40
)
Add-Type -AssemblyName System.Drawing

$m0 = [System.Drawing.Bitmap]::new((Resolve-Path $Mockup).Path)
$s = [System.Drawing.Bitmap]::new((Resolve-Path $Snimak).Path)
$W = $s.Width; $H = $s.Height

# Mockup skaliraj na velicinu snimka ako se razlikuju (npr. mockup 2160x3840)
if ($m0.Width -ne $W -or $m0.Height -ne $H) {
  Write-Host "PAZI: mockup $($m0.Width)x$($m0.Height), snimak ${W}x${H} - skaliram mockup"
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

# Petlja u C# - PowerShell petlja preko 2M piksela traje minutima
Add-Type -TypeDefinition @"
public static class Razlika {
  public static int[] Racunaj(byte[] a, byte[] b, byte[] izlaz, int prag) {
    int razl = 0, ukupno = a.Length / 4;
    for (int i = 0; i < a.Length; i += 4) {
      int d = (System.Math.Abs(a[i] - b[i]) + System.Math.Abs(a[i+1] - b[i+1]) + System.Math.Abs(a[i+2] - b[i+2])) / 3;
      byte v = (byte)System.Math.Min(255, d * 3);
      izlaz[i] = 0; izlaz[i+1] = 0; izlaz[i+2] = v; izlaz[i+3] = 255;
      if (d > prag) razl++;
    }
    return new int[] { razl, ukupno };
  }
}
"@
$bo = New-Object byte[] $n
$rez = [Razlika]::Racunaj($bm, $bs, $bo, $Prag)

$out = [System.Drawing.Bitmap]::new($W, $H, $fmt)
$do = $out.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, $fmt)
[System.Runtime.InteropServices.Marshal]::Copy($bo, 0, $do.Scan0, $n)
$out.UnlockBits($do)

$baza = [System.IO.Path]::ChangeExtension((Resolve-Path $Snimak).Path, $null).TrimEnd('.')
$out.Save("$baza.razlika.png", [System.Drawing.Imaging.ImageFormat]::Png)

$pre = [System.Drawing.Bitmap]::new($W, $H)
$g = [System.Drawing.Graphics]::FromImage($pre)
$g.DrawImage($m, 0, 0, $W, $H)
$cm = [System.Drawing.Imaging.ColorMatrix]::new(); $cm.Matrix33 = 0.5
$ia = [System.Drawing.Imaging.ImageAttributes]::new(); $ia.SetColorMatrix($cm)
$g.DrawImage($s, $rect, 0, 0, $W, $H, [System.Drawing.GraphicsUnit]::Pixel, $ia)
$g.Dispose()
$pre.Save("$baza.preklop.png", [System.Drawing.Imaging.ImageFormat]::Png)

$pct = [math]::Round(100.0 * $rez[0] / $rez[1], 2)
Write-Host "Razlicitih piksela (prag $Prag): $pct%"
Write-Host "  $baza.razlika.png"
Write-Host "  $baza.preklop.png"
$m0.Dispose(); $s.Dispose(); $out.Dispose(); $pre.Dispose()
if ($m -ne $m0) { $m.Dispose() }
