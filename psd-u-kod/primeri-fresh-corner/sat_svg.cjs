// Sat iz PSD-a (vektorski smart object 148b7459 = Illustrator/PDF) -> SVG putanje.
//   node tools/sat_svg.cjs   -> src/game/clockArt.ts
// Cita PDF tok sadrzaja (q/Q/cm/m/l/c/h/re/f/scn) i pise putanje u koordinatama
// PDF stranice (y okrenut na dole). Braon crtice idu u igru 1:1; narandzasti
// isecci (6 komada od po 60 stepeni) ovde se samo mere - u igri ih zamenjuje
// jedan isecak koji raste (vidi src/game/clock.ts).
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const agp = require(path.join(require("os").homedir(), ".claude/skills/psd-u-kod/agpsd.cjs"));
const ROOT = path.resolve(__dirname, "..");

const psd = agp.readPsd(fs.readFileSync(path.join(ROOT, "materijali/Kviz.psd")), { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
const lf = psd.linkedFiles.find((f) => f.id.startsWith("148b7459"));
const pdf = Buffer.from(lf.data), s = pdf.toString("latin1");

const media = s.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/).slice(1).map(Number);
const PW = media[2], PH = media[3];
const contentsId = s.match(/\/Type\s*\/Page\b[\s\S]*?\/Contents (\d+) 0 R/)?.[1] ?? s.match(/\/Contents (\d+) 0 R/)[1];
const i0 = s.search(new RegExp("[\\r\\n]" + contentsId + " 0 obj"));
let p = s.indexOf("stream", i0) + 6; if (s[p] === "\r") p++; if (s[p] === "\n") p++;
const tok = zlib.inflateSync(pdf.slice(p, s.indexOf("endstream", p))).toString("latin1");

// --- mini interpreter ---
const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
let fill = "#000000", d = []; const shapes = []; let text = null, textColor = null;
const pt = (x, y) => { const X = ctm[0] * x + ctm[2] * y + ctm[4], Y = ctm[1] * x + ctm[3] * y + ctm[5]; return [+(X).toFixed(3), +(PH - Y).toFixed(3)]; };
const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
const ops = []; let nums = [];
const words = tok.match(/\((?:\\.|[^\\)])*\)|\/[^\s/\[\]()<>]+|[-+]?\d*\.?\d+|[A-Za-z*'"]+|\[|\]/g);
let inText = false, tf = null;
for (const w of words) {
  if (/^[-+]?\d*\.?\d+$/.test(w)) { nums.push(Number(w)); continue; }
  if (w.startsWith("/") || w === "[" || w === "]") { nums.push(w); continue; }
  if (w.startsWith("(")) { nums.push(w.slice(1, -1)); continue; }
  const n = nums; nums = [];
  if (inText) {
    if (w === "Tm") tf = n.slice(-6);
    if (w === "scn" || w === "sc") textColor = hex(...n.slice(-3));
    if (w === "Tj") text = { str: n[n.length - 1], tm: tf };
    if (w === "ET") inText = false;
    continue;
  }
  switch (w) {
    case "BT": inText = true; break;
    case "q": stack.push(ctm); break;
    case "Q": ctm = stack.pop(); break;
    case "cm": ctm = mul(n.slice(-6), ctm); break;
    case "scn": case "sc": if (n.length >= 3) fill = hex(...n.slice(-3)); break;
    case "m": d.push("M" + pt(n[0], n[1]).join(" ")); break;
    case "l": d.push("L" + pt(n[0], n[1]).join(" ")); break;
    case "c": d.push("C" + [pt(n[0], n[1]), pt(n[2], n[3]), pt(n[4], n[5])].map((q) => q.join(" ")).join(" ")); break;
    case "h": d.push("Z"); break;
    case "re": { const [x, y, ww, hh] = n; d.push("M" + pt(x, y).join(" "), "L" + pt(x + ww, y).join(" "), "L" + pt(x + ww, y + hh).join(" "), "L" + pt(x, y + hh).join(" "), "Z"); break; }
    case "f": case "f*": case "F": {
      const str = d.join(" ");
      if (str.replace(/[MZ]/g, "").trim().split(/\s+/).length > 4) shapes.push({ fill, d: str });
      d = []; break; }
    case "n": d = []; break;
  }
}

const brown = shapes.filter((x) => x.fill !== "#ff7f00");
const orange = shapes.filter((x) => x.fill === "#ff7f00");
const tm = text.tm; // [a b c d e f] - velicina fonta i sidro (baseline) u PDF jedinicama
const out = `// GENERISANO: node tools/sat_svg.cjs (iz materijali/Kviz.psd, smart object sata).
// Koordinate su PDF stranice sata (viewBox ${PW} x ${PH}); u PSD-u sat stoji na
// x=364 y=180, 353 x 352 px.
export const CLOCK_VIEW = { w: ${PW}, h: ${PH} } as const;
/** Braon crtice (${brown.length} komada), boja ${brown[0].fill}. */
export const CLOCK_TICKS: readonly string[] = ${JSON.stringify(brown.map((x) => x.d), null, 1)};
export const CLOCK_TICK_COLOR = "${brown[0].fill}";
/** Narandzasti isecci iz PSD-a (${orange.length} komada) - samo za proveru oblika. */
export const CLOCK_ORANGE_PSD: readonly string[] = ${JSON.stringify(orange.map((x) => x.d), null, 1)};
export const CLOCK_ORANGE = "#ff7f00";
/** Broj: Solido Compact Medium, velicina i sidro (baseline levo) iz PDF-a. */
export const CLOCK_TEXT = { str: ${JSON.stringify(text.str)}, size: ${tm[0]}, x: ${tm[4]}, y: ${+(PH - tm[5]).toFixed(3)}, color: "${textColor}" } as const;
`;
fs.writeFileSync(path.join(ROOT, "src/game/clockArt.ts"), out);
console.log("crtica:", brown.length, "narandzastih:", orange.length, "tekst:", JSON.stringify(text), textColor, "stranica", PW, PH);
for (const o of orange) console.log("  isecak", o.d.slice(0, 160));
