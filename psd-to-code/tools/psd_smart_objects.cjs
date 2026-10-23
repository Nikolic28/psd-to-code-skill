// Saves the files embedded in smart objects (usually PDF/AI from Illustrator).
// Without ids: all of them. The id prefix is shown by psd_layers.cjs as pl=<id>.
//   node tools/psd_smart_objects.cjs <file.psd> <outDir> [idPrefix ...]
const fs = require("fs"), path = require("path");
const agp = require(path.join(__dirname, "..", "agpsd.cjs"));
const [file, out, ...ids] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const psd = agp.readPsd(fs.readFileSync(file), { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
for (const f of psd.linkedFiles || []) {
  if (ids.length && !ids.some((p) => f.id.startsWith(p))) continue;
  const head = Buffer.from(f.data.slice(0, 8)).toString("latin1");
  const p = path.join(out, f.id.slice(0, 8) + (head.startsWith("%PDF") ? ".pdf" : ".bin"));
  fs.writeFileSync(p, Buffer.from(f.data));
  console.log(f.id.slice(0, 8), f.name, f.data.length, "bytes", head, "->", p);
}
