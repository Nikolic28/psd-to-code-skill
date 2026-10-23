// Indexed layer list per top-level group: index (as used by composite.cjs skip/only),
// name, x,y wxh, HIDDEN, CLIP (clipping mask), pl=<smart object id>, TEXT.
//   node tools/psd_layers.cjs <file.psd>
const fs = require("fs"), path = require("path");
const agp = require(path.join(__dirname, "..", "agpsd.cjs"));
const psd = agp.readPsd(fs.readFileSync(process.argv[2]), { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
for (const g of psd.children) {
  let i = 0;
  const rec = (list, indent) => {
    for (const l of list) {
      if (l.children) {
        console.log(`${g.name}  ${indent}[G ${l.name}]${l.mask ? " MASK" : ""}${l.hidden ? " HIDDEN" : ""}`);
        rec(l.children, indent + "  ");
        continue;
      }
      console.log(`${g.name}#${i++} ${indent}${l.name} | ${l.left},${l.top} ${l.right - l.left}x${l.bottom - l.top}` +
        `${l.hidden ? " HIDDEN" : ""}${l.clipping ? " CLIP" : ""}${l.placedLayer ? " pl=" + l.placedLayer.id.slice(0, 8) : ""}${l.text ? " TEXT" : ""}`);
    }
  };
  rec(g.children || [], "");
}
