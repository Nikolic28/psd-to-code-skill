# Lessons from real projects (design -> code)

Every rule in `SKILL.md` comes from a mistake on a real project (touch-screen kiosk games,
1080x1920, Electron + Vite, 2026-09/10).

## Reading the PSD

**ag-psd instead of measuring the JPEG.** A JPEG has compression noise and no font name or
exact text size. ag-psd gives exact x/y/w/h, font and color. CAREFUL: after a "Free
Transform" in Photoshop the text size is `fontSize x scale from the transform matrix`, not
just `fontSize` (`read_psd.cjs` already does this).

**Layer effects exist only in the PSD composite.** ag-psd returns layer pixels WITHOUT
strokes, color overlays and shadows. `composite.cjs` draws them itself: solidFill, outside
stroke, dropShadow (multiply over transparency = the shadow color, not black!), clipping,
group masks. Measured against Photoshop JPEG exports: 0-0.09 %. It does not draw inner
bevel - take that area from the client's JPEG through a mask (`tools/patch_from_jpeg.ps1`).

**A vector smart object is a PDF inside the PSD.** The clock on the Fresh Corner quiz was
neither a bitmap nor a text layer, but a PDF from Illustrator. Its drawing stream gave the
exact ticks (SVG) and `/BaseFont` gave the font of the number (Solido Compact Medium) -
otherwise the "clock animation" would have been built by eye.

## Text and fonts

**SVG `<text>` with the anchor from the PSD** - every screen matched on the first try
(0.02-0.8 %). Photoshop centers a line that ends with a space before the line break
WITH that space.

**The font file the client sends is not always the font in the design.**
- One project: same file name, different font (narrow, free version, missing Č/Ć/Ž/Đ).
- Fresh Corner: same glyph shapes and height, but no kerning table - letter spacing off by
  1-3 px ("5" and "0" touch in the design, not with the delivered file).
- Always: check the language-specific letters, render a word from the PSD with that font and
  compare it with the layer. If it doesn't match: fixed text can be an image from the PSD
  composite, variable text (numbers) the closest font chosen BY PIXEL COMPARISON, and ask
  the client for the real file.
- The PSD text anchor can include a trailing space ("35 ") - center by the ink.

**Stylistic alternates (ss01..ss07).** Canvas takes `font-feature-settings` from the
canvas ELEMENT's CSS, not from `@font-face`. After enabling one, re-measure the size.

**Vite + @font-face: `url("./assets/fonts/...")` SILENTLY fails in the build** - the font
falls back to Arial while `npm run dev` works. Use `url("/assets/fonts/...")`. A build that
prints "didn't resolve at build time" is NOT a correct build.

**No PSD: font size by binary search** through real Chromium `measureText`
(`tools/measure_text.cjs`), line width measured with a pixel scan of the JPEG.

## Verification

**Numbers, not "by eye".** `compare.ps1` gives the % of differing pixels + a diff and an
overlay image. Screens taken 1:1 from the mockup must give ~0 %. Without it, the letter
spacing problem on Fresh Corner would never have been noticed - it looked "about the same".

**Screenshots through the DevTools protocol** (`--remote-debugging-port`,
`Emulation.setDeviceMetricsOverride`, `Page.captureScreenshot`): exactly the design size on
any monitor, tap coordinates = design coordinates, the same tool for the dev build and the
INSTALLED .exe. Keep the test window off-screen and unfocusable
(`x: -2600, focusable: false` + `disable-features=CalculateNativeWinOcclusion`), otherwise
it receives real clicks from the person at the computer.

**Scaling the stage: CSS `zoom`, not `transform: scale()`** (blurry on the kiosk).
