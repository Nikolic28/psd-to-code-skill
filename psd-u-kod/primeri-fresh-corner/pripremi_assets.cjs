// Pravi sve slike igre iz materijali/Kviz.psd (sa efektima slojeva) -> public/assets/img
// + public/assets/geometry.json (tacna pozicija svakog dela na ekranu 1080x1920).
//
//   node tools/pripremi_assets.cjs
//
// Pozadine ekrana ("plate-*") su ceo ekran BEZ delova koji se menjaju ili animiraju;
// ti delovi su posebni PNG-ovi isečeni na svoj okvir. Indeksi slojeva su iz
// `node tools/psd_lista.cjs materijali/Kviz.psd`.
// Sastavljanje (tools/psd_sastavi.cjs) je provereno prema JPEG-ovima klijenta:
// ekrani 1-6 0-0,09 %, ekran 7 0,34 % (inner bevel na solji ag-psd ne crta -
// zato se solja na ekranu 7 uzima iz 7.jpg, vidi zakrpi_jpeg.ps1).

const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { png, W, H, renderGroup, agp } = require("./psd_sastavi.cjs");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public/assets/img");
const REF = path.join(ROOT, "materijali/_ref");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(REF, { recursive: true });

const psd = agp.readPsd(fs.readFileSync(path.join(ROOT, "materijali/Kviz.psd")), { useImageData: true, skipThumbnail: true });
const geo = {};

function ceo(ime, grupa, skip, dir = OUT) {
  fs.writeFileSync(path.join(dir, ime + ".png"), png(W, H, renderGroup(psd, grupa, { skip: new Set(skip) })));
  console.log("ekran", ime);
}

/** Jedan sloj (sa efektima) isecen na okvir svojih piksela. */
function deo(ime, grupa, idx) {
  const d = renderGroup(psd, grupa, { samo: new Set([idx]) });
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 0) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, c = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) c.set(d.subarray(((y + y0) * W + x0) * 4, ((y + y0) * W + x1 + 1) * 4), y * w * 4);
  fs.writeFileSync(path.join(OUT, ime + ".png"), png(w, h, c));
  geo[ime] = { x: x0, y: y0, w, h };
  console.log("deo", ime, geo[ime]);
}

// 1 - naslovni: ceo ekran je staticna slika (naslov je fiksan tekst iz PSD-a).
ceo("plate-1", "1", []);

// 2 - Start: dugme, natpis i konfete posebno (animiraju se).
ceo("plate-2", "2", [17, 18, 19, 20]);
deo("start-conf-l", "2", 17);
deo("start-conf-r", "2", 18);
deo("start-btn", "2", 19);
deo("start-text", "2", 20);

// 3-6 - pitanje: pozadina grupe 3 bez maskota, sata, bodova, pitanja i odgovora.
ceo("plate-game", "3", [17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
deo("cup", "3", 17);
deo("hotdog", "3", 20);
deo("btn-a", "3", 24);
deo("btn-b", "3", 25);
deo("btn-c", "3", 26);
deo("check", "4", 35);
deo("x", "5", 35);
deo("conf-a", "4", 34);
deo("conf-b", "6", 11);
deo("conf-c", "6", 13);
deo("clock-ref", "3", 21); // samo za proveru SVG sata (tools/proveri_sat.mjs)
fs.renameSync(path.join(OUT, "clock-ref.png"), path.join(REF, "clock-ref.png"));
fs.writeFileSync(path.join(REF, "clock-ref.json"), JSON.stringify(geo["clock-ref"]));
delete geo["clock-ref"];
// Brojevi i tekst iz PSD-a samo kao referenca za kalibraciju SVG teksta.
for (const [ime, g, i] of [["ref-50", "3", 22], ["ref-25", "3", 23], ["ref-q", "3", 18], ["ref-a", "3", 28], ["ref-b", "3", 27], ["ref-c", "3", 29], ["ref-85", "7", 24], ["ref-100", "7", 25]]) {
  deo(ime, g, i);
  fs.renameSync(path.join(OUT, ime + ".png"), path.join(REF, ime + ".png"));
  delete geo[ime];
}

// 7 - pobednik: pozadina bez bodova, "Pobednik!" i konfeta pobednika.
ceo("plate-7-psd", "7", [24, 25, 26, 27, 28, 29], REF);
deo("pobednik", "7", 26);
deo("conf7-top", "7", 27);
deo("conf7-r", "7", 28);
deo("conf7-l", "7", 29);
// Maska solje (sloj 22 + 13 px okolo) - tu se uzimaju pikseli iz 7.jpg (bevel).
{
  const d = renderGroup(psd, "7", { samo: new Set([22]) });
  const m = new Uint8ClampedArray(W * H * 4);
  const R = 16;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a = 0;
    for (let dy = -R; dy <= R && a < 255; dy += 2) for (let dx = -R; dx <= R; dx += 2) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H || dx * dx + dy * dy > R * R) continue;
      if (d[(Y * W + X) * 4 + 3] > 0) { a = 255; break; }
    }
    m[(y * W + x) * 4 + 3] = a; m[(y * W + x) * 4] = m[(y * W + x) * 4 + 1] = m[(y * W + x) * 4 + 2] = a;
  }
  fs.writeFileSync(path.join(REF, "maska-solja-7.png"), png(W, H, m));
}
execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "zakrpi_jpeg.ps1"),
  "-Plate", path.join(REF, "plate-7-psd.png"), "-Jpeg", path.join(ROOT, "materijali/7.jpg"),
  "-Maska", path.join(REF, "maska-solja-7.png"), "-Izlaz", path.join(OUT, "plate-7.png")], { stdio: "inherit" });

fs.writeFileSync(path.join(ROOT, "public/assets/geometry.json"), JSON.stringify(geo, null, 1));
console.log("geometry.json:", Object.keys(geo).length, "delova");
