/**
 * Prints every layer of a PSD file: position (x/y/w/h in design px), text, font,
 * EFFECTIVE font size (fontSize * scale from the transform matrix - a Photoshop
 * "Free Transform" after typing changes the matrix, not the fontSize field), color,
 * alignment, opacity. Replaces pixel-sampling from the JPEG export.
 *
 * Usage (bash):
 *   node ~/.claude/skills/psd-to-code/read_psd.cjs "materials/design.psd" [--json out.json]
 */
const fs = require("fs");
const path = require("path");
// No initializeCanvas (needs the native "canvas" package) - layer pixels are not read here.
const { readPsd } = require(path.join(__dirname, "agpsd.cjs"));

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const jsonIdx = args.indexOf("--json");
if (!file) {
  console.error('Usage: node read_psd.cjs "<file.psd>" [--json out.json]');
  process.exit(2);
}

const psd = readPsd(fs.readFileSync(file), {
  skipLayerImageData: true,
  skipCompositeImageData: true,
  skipThumbnail: true,
});

const hex = (c) =>
  c && "r" in c
    ? "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")
    : undefined;
const r1 = (n) => Math.round(n * 10) / 10;

const layers = [];
function walk(list, parent) {
  for (const l of list || []) {
    const name = parent ? parent + " / " + l.name : l.name;
    if (l.children) {
      walk(l.children, name);
      continue;
    }
    const s = {
      layer: name,
      hidden: !!l.hidden,
      x: l.left, y: l.top,
      w: (l.right ?? 0) - (l.left ?? 0),
      h: (l.bottom ?? 0) - (l.top ?? 0),
      opacity: l.opacity !== undefined && l.opacity < 1 ? r1(l.opacity * 100) + "%" : undefined,
    };
    if (l.text) {
      const t = l.text.transform || [1, 0, 0, 1, 0, 0];
      const scale = Math.hypot(t[2], t[3]); // vertical scale - determines glyph height
      const st = l.text.style || {};
      s.text = l.text.text.replace(/\r/g, "\n");
      const runs0 = (l.text.styleRuns || []).find((r) => r.style && r.style.font);
      s.font = (st.font && st.font.name) || (runs0 && runs0.style.font.name);
      s.fontSizeField = st.fontSize;
      s.scale = Math.round(scale * 1000) / 1000;
      s.fontPx = st.fontSize ? r1(st.fontSize * scale) : undefined;
      s.color = hex(st.fillColor);
      s.leadingPx = st.leading ? r1(st.leading * scale) : undefined;
      s.tracking = st.tracking || undefined;
      s.align = l.text.paragraphStyle && l.text.paragraphStyle.justification;
      // SVG anchor: transform[4..5] = baseline of the first line (x per alignment) for
      // "point" text. For "box" text it is the TOP LEFT corner of the box - center x =
      // anchorX + box width x scale / 2, and calibrate the baseline by overlay.
      s.anchor = { x: r1(t[4]), y: r1(t[5]) };
      if (l.text.shapeType === "box" && l.text.boxBounds) {
        const bw = (l.text.boxBounds[2] - l.text.boxBounds[0]) * Math.hypot(t[0], t[1]);
        s.box = { x: r1(t[4]), y: r1(t[5]), w: r1(bw), centerX: r1(t[4] + bw / 2) };
      }
      // Parts of the text with a different style (e.g. one bold word)
      const runs = (l.text.styleRuns || []).filter((r) => r.style);
      if (runs.length > 1) {
        let i = 0;
        s.runs = runs.map((r) => {
          const part = l.text.text.slice(i, i + r.length);
          i += r.length;
          return {
            text: part.replace(/\r/g, "\\n"),
            font: (r.style.font && r.style.font.name) || s.font,
            fontPx: r.style.fontSize ? r1(r.style.fontSize * scale) : s.fontPx,
            color: hex(r.style.fillColor) || s.color,
          };
        });
      }
    }
    layers.push(s);
  }
}
walk(psd.children, "");

console.log(`PSD ${psd.width}x${psd.height}  (${path.basename(file)})`);
if (psd.width !== 1080 || psd.height !== 1920)
  console.log(`  NOTE: design is not 1080x1920 - use a #stage of ${psd.width}x${psd.height} and PSD coordinates 1:1`);
for (const s of layers) {
  console.log(
    `\n[${s.layer}]${s.hidden ? " (HIDDEN)" : ""}  x=${s.x} y=${s.y} w=${s.w} h=${s.h}` +
      (s.opacity ? ` opacity=${s.opacity}` : "")
  );
  if (s.text !== undefined) {
    console.log(`  text: ${JSON.stringify(s.text)}`);
    console.log(
      `  font: ${s.font}  ${s.fontPx}px` +
        (s.scale !== 1 ? ` (field ${s.fontSizeField} x scale ${s.scale})` : "") +
        `  color ${s.color}` +
        (s.leadingPx ? `  leading ${s.leadingPx}px` : "") +
        (s.tracking ? `  tracking ${s.tracking}` : "") +
        (s.align ? `  ${s.align}` : "")
    );
    if (s.box)
      console.log(`  BOX text: top left ${s.box.x},${s.box.y}  width ${s.box.w}  center x ${s.box.centerX}  (calibrate the baseline by overlay)`);
    else console.log(`  SVG anchor (baseline): x=${s.anchor.x} y=${s.anchor.y}`);
    for (const d of s.runs || [])
      console.log(`    - ${JSON.stringify(d.text)}: ${d.font} ${d.fontPx}px ${d.color}`);
  }
}
if (jsonIdx >= 0 && args[jsonIdx + 1]) {
  fs.writeFileSync(args[jsonIdx + 1], JSON.stringify({ width: psd.width, height: psd.height, layers }, null, 2));
  console.log(`\nJSON: ${args[jsonIdx + 1]}`);
}
