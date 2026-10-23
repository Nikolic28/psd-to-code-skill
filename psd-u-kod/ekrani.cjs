// Sastavlja mockup svakog ekrana (pozadina + slojevi grupe) iz PSD-a -> PNG 1080x1920
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const agp = require(path.join(__dirname, "agpsd.cjs"));
agp.initializeCanvas(() => { throw new Error("no canvas"); }, (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }));
const [fajl, out, setIme] = process.argv.slice(2);
const psd = agp.readPsd(fs.readFileSync(fajl), { useImageData: true, skipThumbnail: true });
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(w, h, data) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const W = 1080, H = 1920;
const bg = psd.children.find((l) => l.name === "background");
function sastavi(slojevi) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (const l of [bg, ...slojevi]) {
    const im = l.imageData; if (!im) continue;
    for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
      const X = x + l.left, Y = y + l.top; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const s = (y * im.width + x) * 4, t = (Y * W + X) * 4, a = (im.data[s + 3] / 255) * (l.opacity ?? 1);
      for (let k = 0; k < 3; k++) d[t + k] = im.data[s + k] * a + d[t + k] * (1 - a);
      d[t + 3] = 255;
    }
  }
  return d;
}
const leaves = (g) => (g.children || []).flatMap((c) => (c.children ? leaves(c) : c.hidden ? [] : [c]));
const grupa = (n) => psd.children.find((l) => l.name === n);
const g3 = grupa("3");
const bez = (g, ime) => leaves({ children: g.children.filter((c) => !c.name.startsWith(ime)) });
const ekr = {
  "1-naslovni": leaves(grupa("1")),
  "2-pravila": leaves(grupa("2")),
  "3-igra-zatvorene": bez(g3, "Prevrnute"),
  ["3-igra-otvorene-" + setIme]: bez(g3, "Okrenute"),
  "5-cestitka": leaves(grupa("5")),
  "6-qr": leaves(grupa("6")),
};
fs.mkdirSync(out, { recursive: true });
for (const [ime, sl] of Object.entries(ekr)) fs.writeFileSync(path.join(out, ime + ".png"), png(W, H, sastavi(sl)));
console.log("ok", Object.keys(ekr).join(", "));
