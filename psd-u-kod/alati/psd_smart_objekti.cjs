// izvuci ugradjene smart-object fajlove (PDF/AI) po id prefiksu
const fs = require("fs"), path = require("path");
const agp = require(path.join(__dirname, "..", "agpsd.cjs"));
const [fajl, out, ...ids] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const psd = agp.readPsd(fs.readFileSync(fajl), { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
for (const f of psd.linkedFiles || []) {
  if (ids.length && !ids.some((p) => f.id.startsWith(p))) continue;
  const p = path.join(out, f.id.slice(0, 8) + ".pdf");
  fs.writeFileSync(p, Buffer.from(f.data));
  console.log(f.id.slice(0, 8), f.name, f.type, f.data.length, Buffer.from(f.data.slice(0, 8)).toString("latin1"));
}
