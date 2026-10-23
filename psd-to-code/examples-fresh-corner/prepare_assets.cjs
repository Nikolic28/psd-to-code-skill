// REAL PROJECT EXAMPLE (Fresh Corner quiz, 2026-10). Copy into <project>/tools/ together
// with composite.cjs (as tools/psd_composite.cjs) and patch_from_jpeg.ps1, then adapt.
//
// Builds every game image from materials/Kviz.psd (with layer effects) -> public/assets/img
// + public/assets/geometry.json (exact position of every part on the 1080x1920 screen).
//
//   node tools/prepare_assets.cjs
//
// Screen backgrounds ("plate-*") are the whole screen WITHOUT the parts that change or
// animate; those parts are separate PNGs cropped to their own bounds. Layer indices come
// from `node ~/.claude/skills/psd-to-code/tools/psd_layers.cjs materials/Kviz.psd`.
// The compositing was checked against the client's JPEGs: screens 1-6 0-0.09 %, screen 7
// 0.34 % (ag-psd does not draw the inner bevel on the cup - so the cup on screen 7 is taken
// from 7.jpg, see patch_from_jpeg.ps1).
// Group names "1".."7" and layer names are the client's (Serbian) names from the PSD.

const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { png, renderGroup, agp } = require("./psd_composite.cjs");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public/assets/img");
const REF = path.join(ROOT, "materials/_ref");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(REF, { recursive: true });

const psd = agp.readPsd(fs.readFileSync(path.join(ROOT, "materials/Kviz.psd")), { useImageData: true, skipThumbnail: true });
const W = psd.width, H = psd.height;
const geo = {};

function fullScreen(name, group, skip, dir = OUT) {
  fs.writeFileSync(path.join(dir, name + ".png"), png(W, H, renderGroup(psd, group, { skip: new Set(skip) })));
  console.log("screen", name);
}

/** One layer (with effects) cropped to the bounds of its pixels. */
function part(name, group, idx) {
  const d = renderGroup(psd, group, { only: new Set([idx]) });
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 0) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, c = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) c.set(d.subarray(((y + y0) * W + x0) * 4, ((y + y0) * W + x1 + 1) * 4), y * w * 4);
  fs.writeFileSync(path.join(OUT, name + ".png"), png(w, h, c));
  geo[name] = { x: x0, y: y0, w, h };
  console.log("part", name, geo[name]);
}

// 1 - title: the whole screen is a static image (the title is fixed text from the PSD).
fullScreen("plate-1", "1", []);

// 2 - Start: button, label and confetti separately (they animate).
fullScreen("plate-2", "2", [17, 18, 19, 20]);
part("start-conf-l", "2", 17);
part("start-conf-r", "2", 18);
part("start-btn", "2", 19);
part("start-text", "2", 20);

// 3-6 - question: group 3 background without mascots, clock, scores, question and answers.
fullScreen("plate-game", "3", [17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
part("cup", "3", 17);
part("hotdog", "3", 20);
part("btn-a", "3", 24);
part("btn-b", "3", 25);
part("btn-c", "3", 26);
part("check", "4", 35);
part("x", "5", 35);
part("conf-a", "4", 34);
part("conf-b", "6", 11);
part("conf-c", "6", 13);
part("clock-ref", "3", 21); // only for checking the SVG clock against the PSD
fs.renameSync(path.join(OUT, "clock-ref.png"), path.join(REF, "clock-ref.png"));
fs.writeFileSync(path.join(REF, "clock-ref.json"), JSON.stringify(geo["clock-ref"]));
delete geo["clock-ref"];
// Numbers and text from the PSD only as a reference for calibrating the SVG text.
for (const [name, g, i] of [["ref-50", "3", 22], ["ref-25", "3", 23], ["ref-q", "3", 18], ["ref-a", "3", 28], ["ref-b", "3", 27], ["ref-c", "3", 29], ["ref-85", "7", 24], ["ref-100", "7", 25]]) {
  part(name, g, i);
  fs.renameSync(path.join(OUT, name + ".png"), path.join(REF, name + ".png"));
  delete geo[name];
}

// 7 - winner: background without scores, "Pobednik!" (Winner!) and the winner's confetti.
fullScreen("plate-7-psd", "7", [24, 25, 26, 27, 28, 29], REF);
part("winner", "7", 26);
part("conf7-top", "7", 27);
part("conf7-r", "7", 28);
part("conf7-l", "7", 29);
// Cup mask (layer 22 + 16 px around it) - pixels there are taken from 7.jpg (bevel).
{
  const d = renderGroup(psd, "7", { only: new Set([22]) });
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
  fs.writeFileSync(path.join(REF, "cup-mask-7.png"), png(W, H, m));
}
execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "patch_from_jpeg.ps1"),
  "-Plate", path.join(REF, "plate-7-psd.png"), "-Jpeg", path.join(ROOT, "materials/7.jpg"),
  "-Mask", path.join(REF, "cup-mask-7.png"), "-Out", path.join(OUT, "plate-7.png")], { stdio: "inherit" });

fs.writeFileSync(path.join(ROOT, "public/assets/geometry.json"), JSON.stringify(geo, null, 1));
console.log("geometry.json:", Object.keys(geo).length, "parts");
