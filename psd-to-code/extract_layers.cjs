// Extracts every PSD layer as a PNG (raw pixels, WITHOUT layer effects - use
// composite.cjs for those) + _info.json (vector fill/stroke/corner radii, effects,
// blend mode) + _composite.png (Photoshop's own flattened image, if saved in the file).
//   node extract_layers.cjs <file.psd> <outDir>
const fs = require("fs"), path = require("path");
const agp = require(path.join(__dirname, "agpsd.cjs"));
const { png } = require(path.join(__dirname, "composite.cjs"));
const [file, out] = process.argv.slice(2);
if (!file || !out) { console.error("Usage: node extract_layers.cjs <file.psd> <outDir>"); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const psd = agp.readPsd(fs.readFileSync(file), { useImageData: true, skipThumbnail: true });
const info = [];
function walk(list, parent) {
  for (const l of list || []) {
    const name = parent ? parent + " - " + l.name : l.name;
    if (l.children) { walk(l.children, name); continue; }
    const safe = name.replace(/[\/\\:*?"<>|]/g, "_");
    if (l.imageData && l.imageData.width) fs.writeFileSync(path.join(out, safe + ".png"), png(l.imageData.width, l.imageData.height, l.imageData.data));
    info.push({ name, x: l.left, y: l.top, w: l.right - l.left, h: l.bottom - l.top, opacity: l.opacity, blend: l.blendMode, hidden: l.hidden,
      fill: l.vectorFill, stroke: l.vectorStroke, origination: l.vectorOrigination, effects: l.effects, fillOpacity: l.fillOpacity, placed: l.placedLayer && { type: l.placedLayer.type } });
  }
}
walk(psd.children, "");
if (psd.imageData) fs.writeFileSync(path.join(out, "_composite.png"), png(psd.imageData.width, psd.imageData.height, psd.imageData.data));
fs.writeFileSync(path.join(out, "_info.json"), JSON.stringify(info, (k, v) => (v && v.constructor && v.constructor.name.endsWith("Array") && v.length > 50 ? "[array]" : v), 1));
console.log("ok", info.length, "layers ->", out);
