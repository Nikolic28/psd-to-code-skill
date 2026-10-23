---
name: psd-to-code
description: Turns a client's design (PSD, or JPEG/PDF mockups - typically 1080x1920 kiosk screens) into HTML/CSS/SVG or Canvas code with exact positions, fonts, sizes and colors, and verifies the finished screen against the mockup in numbers. Use when a client sends a design/mockup/PSD, when a screen has to be built or fixed to match a design, when the user says "doesn't match the design", "wrong font", "move it", "it's off", or when an updated mockup arrives.
---

# Client design -> code

Rule: **nothing by eye**. Every position, font size and color comes from the PSD or
from a measurement, and every finished screen is checked by overlaying it on the mockup.
Why each rule exists: `LESSONS.md` in this folder.

Requirements: Windows (PowerShell + .NET System.Drawing for images - no Python needed),
Node 22+, Electron in the project (fonts are measured in real Chromium).
`ag-psd` installs itself into the skill folder on first run (`agpsd.cjs`).
Below, `SKILL` = `~/.claude/skills/psd-to-code`.

## A) There is a .psd -> read it directly

```bash
node SKILL/read_psd.cjs "materials/design.psd" --json "$TEMP/psd.json"
node SKILL/tools/psd_layers.cjs "materials/design.psd"   # layer indices per group (for composite.cjs)
node SKILL/tools/psd_text.cjs "materials/design.psd"     # full text style (tracking, kerning, leading)
```
`read_psd` prints every layer per group (groups are usually screens): x/y/w/h, text,
font, **effective fontPx** (already multiplied by the transform matrix scale - do NOT
use the raw `fontSize` field), color, leading, alignment, differently styled runs, and
the **SVG anchor** (baseline) of every text layer.

Design not 1080x1920 (e.g. landscape 1920x1080)? Don't scale - make the `#stage` the
design size and use PSD coordinates 1:1.
A screen that exists only as a JPEG, not in the PSD: measure it with a pixel scan
(PowerShell GetPixel/LockBits inside the button's color rectangle) and validate the method
on a screen that IS in the PSD - it must match to the pixel.

Translating to CSS (design 1080x1920 = CSS px 1:1 inside `#stage`, scaled with CSS `zoom`):
- Image/rectangle: `left: x; top: y; width: w; height: h`.
- `font-family` from the PSD font name (e.g. `Poppins-Medium` -> Poppins 500), font file
  from the client's materials in `public/assets/fonts/`,
  `@font-face url("/assets/fonts/...")` (absolute! a relative URL silently falls back to
  Arial in a Vite build).
- Buttons: check in the PSD whether it is a rounded rectangle or a pill - don't assume.
- Same icon in another color: `filter: brightness(0) invert(1)` (white), not a new asset.

### Images from the PSD

- **`composite.cjs` (first choice)** - a screen (group) WITH layer effects: solidFill,
  outside stroke, dropShadow, clipping masks, group masks.
  `node SKILL/composite.cjs <psd> <outDir> [group:skipIdx,skipIdx:outName;...]`, and from
  code `renderGroup(psd, group, { skip, only })`. First compare the composite with the
  client's JPEG exports (step C) - on Fresh Corner: 0-0.09 %.
  Pattern: screen background = the group WITHOUT the layers that change/animate, and each
  such part a separate PNG cropped to its bounds + `geometry.json` with its coordinates.
  Full example: `examples-fresh-corner/prepare_assets.cjs` (copy `composite.cjs` to
  `<project>/tools/psd_composite.cjs`).
- It does not draw **inner bevel / emboss**: take that area from the client's JPEG
  through a mask (`tools/patch_from_jpeg.ps1`).
- `extract_layers.cjs <psd> <outDir>` - every layer as a PNG WITHOUT effects +
  `_info.json` (vector shape color/corner radius, effects). For a quick look at what exists.

### Vector smart objects (icons, clocks, logos from Illustrator)

`psd.linkedFiles[].data` is a PDF. `tools/psd_smart_objects.cjs <psd> <outDir> [id]`
saves it, `tools/pdf_stream.cjs <pdf> <objectNumber>` prints its drawing operators. The
stream (q/Q/cm/m/l/c/h/re/f/scn) converts to SVG paths 1:1, and `/BaseFont` names the
font of any text INSIDE the object (it is not a text layer - `read_psd` won't show it).
Example: `examples-fresh-corner/clock_svg.cjs` (60 clock ticks + the number's font).

### Text

- Most exact as SVG `<text x y text-anchor="middle">`: `transform[4..5]` of the PSD
  text is the anchor (first-line baseline), leading = fontPx x 1.2 (auto leading).
  A line that has a space before `\n` in the PSD is centered WITH that space
  (`xml:space="preserve"`).
- Even more exact (and robust to swapping the font file): baseline = TOP of the ink of
  the PSD layer + glyph ascent measured in Chromium (`measureText().actualBoundingBox*`),
  center x = center of the PSD bounds. Measuring: `examples-fresh-corner/measure_fonts.cjs`.
- **Before finishing, check the delivered font is the SAME font the designer used** -
  shape and letter spacing: `examples-fresh-corner/font_vs_psd.cjs` (ink bounds),
  `glyphs.cjs` (position of every letter), `fit_font.cjs` (does a per-letter correction
  explain the difference). Also check language-specific letters (e.g. Č Ć Ž Đ Š). If it
  differs: ask the client for the designer's exact font file - don't "fix" the font.

## B) No .psd, only a JPEG/PDF mockup -> measure

1. Element positions: pixel-scan the edges on the JPEG (PowerShell + `System.Drawing`,
   LockBits; first/last row/column whose color differs from the background inside a
   given rectangle).
2. Font size: give the measured width of each text line to `tools/measure_text.cjs`
   (+ `.html`, copy into `<project>/electron/`, fill TARGETS and @font-face) - binary
   search through real Chromium `measureText`, returns px size + ascent/descent.
3. If the mockup is not 1080x1920 (e.g. a PDF export), scale it to 1080x1920 first.

## C) Verify: screenshot vs mockup (mandatory after every visual change)

1. Take full-resolution screenshots from the CURRENT build (an old screenshot lies).
   Tool: CDP `Emulation.setDeviceMetricsOverride` = exact design resolution on any
   monitor, the same tool works on the installed .exe - example
   `examples-fresh-corner/cdp.mjs` + `shot.mjs` (adapt the `window.__fc` test hooks to
   your game). Turn animations off; the mockup shows sample values (50 : 25)? Put them
   into the DOM before the screenshot so the comparison is clean.
2. Compare each screen with its mockup:
   ```bash
   powershell -ExecutionPolicy Bypass -File "$(cygpath -w ~/.claude/skills/psd-to-code/compare.ps1)" \
     -Mockup "materials/2.jpg" -Shot "shots/2-start.png"
   ```
   Writes `<shot>.diff.png` and `<shot>.overlay.png` and prints the % of differing pixels.
3. Look at both images:
   - `diff`: thin red outlines = OK (JPEG noise, antialiasing).
     **Solid red letters** = different font/weight (font didn't load, wrong weight).
     **Doubled, shifted outlines** = offset - measure how much.
   - `overlay`: double edges show the direction and size of an offset.
   - Rule of thumb: a screen taken 1:1 from the PSD ~0 %, ~1-3 % = matches (text),
     >5 % = something is seriously different.
   - A mockup with sample content legitimately differs in that spot - judge only that spot.
4. Fix and repeat until the difference is only noise. Give the user the overlay image
   path as proof, not just "aligned".

## When the client sends an updated design

Save it in `materials/` under a name that says what it is (e.g. `2-updated.jpg`),
compare OLD and NEW mockup with the same `compare.ps1` (the diff shows exactly what the
client changed - don't rely only on their description), and change only that. After the
change: step C for that screen, then a new build and a check of the actually installed copy.
