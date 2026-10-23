// Pun stil svakog tekst-sloja iz PSD-a (tracking, skala, kerning, prored...).
//   node tools/psd_tekst.cjs materijali/Kviz.psd
const fs = require("fs"), path = require("path");
const agp = require(path.join(__dirname, "..", "agpsd.cjs"));
const psd = agp.readPsd(fs.readFileSync(process.argv[2]), { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
const seen = new Set();
const rec = (list, g) => {
  for (const x of list) {
    if (x.children) { rec(x.children, g); continue; }
    if (!x.text || seen.has(x.text.text)) continue;
    seen.add(x.text.text);
    const t = x.text;
    console.log("=== [" + g + "] " + JSON.stringify(t.text) + " transform=" + JSON.stringify(t.transform) + " bbox=" + [x.left, x.top, x.right, x.bottom]);
    console.log(" style:", JSON.stringify(t.style));
    console.log(" runs:", JSON.stringify(t.styleRuns));
    console.log(" para:", JSON.stringify(t.paragraphStyle));
    console.log(" shape:", t.shapeType, JSON.stringify(t.boxBounds || t.bounds || null), "antialias", t.antiAlias);
  }
};
for (const g of psd.children) rec(g.children, g.name);
