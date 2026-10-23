// Izvlaci svaki sloj PSD-a kao PNG (bez native canvas: useImageData) + info o vektorima/efektima
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const agp = require(path.join(__dirname, "agpsd.cjs"));
const { readPsd } = agp;
agp.initializeCanvas(() => { throw new Error("no canvas"); }, (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }));
const [fajl, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const psd = readPsd(fs.readFileSync(fajl), { useImageData: true, skipThumbnail: true });
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); }
function png(img) {
  const { width: w, height: h, data } = img;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const info = [];
function walk(list, p) {
  for (const l of list || []) {
    const ime = p ? p + " - " + l.name : l.name;
    if (l.children) { walk(l.children, ime); continue; }
    const safe = ime.replace(/[\/:*?"<>|]/g, "_");
    if (l.imageData && l.imageData.width) fs.writeFileSync(path.join(out, safe + ".png"), png(l.imageData));
    info.push({ ime, x: l.left, y: l.top, w: l.right - l.left, h: l.bottom - l.top, opacity: l.opacity, blend: l.blendMode, hidden: l.hidden,
      fill: l.vectorFill, stroke: l.vectorStroke, orig: l.vectorOrigination, effects: l.effects, fillOpacity: l.fillOpacity, placed: l.placedLayer && { type: l.placedLayer.type } });
  }
}
walk(psd.children, "");
if (psd.imageData) fs.writeFileSync(path.join(out, "_composite.png"), png(psd.imageData));
fs.writeFileSync(path.join(out, "_info.json"), JSON.stringify(info, (k, v) => (v && v.constructor && v.constructor.name.endsWith("Array") && v.length > 50 ? "[arr]" : v), 1));
console.log("ok", info.length);
