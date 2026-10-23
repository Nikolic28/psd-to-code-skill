/**
 * Ispis svih slojeva PSD fajla: pozicija (x/y/w/h u px dizajna), tekst, font,
 * EFEKTIVNA velicina fonta (fontSize * skala iz transform matrice - PSD "Free
 * Transform" posle kucanja menja matricu, ne fontSize polje), boja, poravnanje,
 * providnost. Zamenjuje pixel-sampling sa JPEG-a (vidi zajednicko README t.9).
 *
 * Pokretanje (bash):
 *   node ~/.claude/skills/psd-u-kod/procitaj_psd.cjs "materijali/fajl.psd" [--json izlaz.json]
 * ag-psd se instalira jednom u folder ovog skilla (ne u projekat).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ALAT = __dirname;
if (!fs.existsSync(path.join(ALAT, "node_modules", "ag-psd"))) {
  console.error("(jednokratno) instaliram ag-psd u " + ALAT + " ...");
  execSync("npm install --no-save --no-audit --no-fund ag-psd", { cwd: ALAT, stdio: "inherit" });
}
// Bez initializeCanvas (trazi native "canvas" paket) - slike slojeva ne citamo.
const { readPsd } = require(path.join(ALAT, "node_modules", "ag-psd"));

const args = process.argv.slice(2);
const fajl = args.find((a) => !a.startsWith("--"));
const jsonIdx = args.indexOf("--json");
if (!fajl) {
  console.error('Upotreba: node procitaj_psd.cjs "<fajl.psd>" [--json izlaz.json]');
  process.exit(2);
}

const psd = readPsd(fs.readFileSync(fajl), {
  skipLayerImageData: true,
  skipCompositeImageData: true,
  skipThumbnail: true,
});

const hex = (c) =>
  c && "r" in c
    ? "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")
    : undefined;
const r1 = (n) => Math.round(n * 10) / 10;

const slojevi = [];
function obidji(lista, putanja) {
  for (const l of lista || []) {
    const ime = putanja ? putanja + " / " + l.name : l.name;
    if (l.children) {
      obidji(l.children, ime);
      continue;
    }
    const s = {
      sloj: ime,
      skriven: !!l.hidden,
      x: l.left, y: l.top,
      w: (l.right ?? 0) - (l.left ?? 0),
      h: (l.bottom ?? 0) - (l.top ?? 0),
      providnost: l.opacity !== undefined && l.opacity < 1 ? r1(l.opacity * 100) + "%" : undefined,
    };
    if (l.text) {
      const t = l.text.transform || [1, 0, 0, 1, 0, 0];
      const skala = Math.hypot(t[2], t[3]); // vertikalna skala - odredjuje visinu slova
      const st = l.text.style || {};
      s.tekst = l.text.text.replace(/\r/g, "\n");
      const runs0 = (l.text.styleRuns || []).find((r) => r.style && r.style.font);
      s.font = (st.font && st.font.name) || (runs0 && runs0.style.font.name);
      s.fontSizePolje = st.fontSize;
      s.skala = Math.round(skala * 1000) / 1000;
      s.fontPx = st.fontSize ? r1(st.fontSize * skala) : undefined;
      s.boja = hex(st.fillColor);
      s.leadingPx = st.leading ? r1(st.leading * skala) : undefined;
      s.tracking = st.tracking || undefined;
      s.poravnanje = l.text.paragraphStyle && l.text.paragraphStyle.justification;
      // SVG sidro: transform[4..5] = baseline prvog reda (x po poravnanju) za
      // "point" tekst. Za "box" tekst je to GORNJI LEVI ugao okvira - x centra =
      // sidroX + sirina okvira x skala / 2, a baseline kalibrisi preklapanjem
      // (Wine Vision Reaktor 2026-10-06: kolona brojeva rang liste).
      s.sidro = { x: r1(t[4]), y: r1(t[5]) };
      if (l.text.shapeType === "box" && l.text.boxBounds) {
        const bw = (l.text.boxBounds[2] - l.text.boxBounds[0]) * Math.hypot(t[0], t[1]);
        s.okvir = { x: r1(t[4]), y: r1(t[5]), w: r1(bw), centarX: r1(t[4] + bw / 2) };
      }
      // Delovi teksta sa drugacijim stilom (npr. jedna rec bold)
      const runs = (l.text.styleRuns || []).filter((r) => r.style);
      if (runs.length > 1) {
        let i = 0;
        s.delovi = runs.map((r) => {
          const deo = l.text.text.slice(i, i + r.length);
          i += r.length;
          return {
            tekst: deo.replace(/\r/g, "\\n"),
            font: (r.style.font && r.style.font.name) || s.font,
            fontPx: r.style.fontSize ? r1(r.style.fontSize * skala) : s.fontPx,
            boja: hex(r.style.fillColor) || s.boja,
          };
        });
      }
    }
    slojevi.push(s);
  }
}
obidji(psd.children, "");

console.log(`PSD ${psd.width}x${psd.height}  (${path.basename(fajl)})`);
if (psd.width !== 1080 || psd.height !== 1920)
  console.log(`  PAZI: dizajn nije 1080x1920 - faktor za CSS: ${r1((1080 / psd.width) * 1000) / 1000}`);
for (const s of slojevi) {
  console.log(
    `\n[${s.sloj}]${s.skriven ? " (SKRIVEN)" : ""}  x=${s.x} y=${s.y} w=${s.w} h=${s.h}` +
      (s.providnost ? ` providnost=${s.providnost}` : "")
  );
  if (s.tekst !== undefined) {
    console.log(`  tekst: ${JSON.stringify(s.tekst)}`);
    console.log(
      `  font: ${s.font}  ${s.fontPx}px` +
        (s.skala !== 1 ? ` (polje ${s.fontSizePolje} x skala ${s.skala})` : "") +
        `  boja ${s.boja}` +
        (s.leadingPx ? `  leading ${s.leadingPx}px` : "") +
        (s.tracking ? `  tracking ${s.tracking}` : "") +
        (s.poravnanje ? `  ${s.poravnanje}` : "")
    );
    if (s.okvir)
      console.log(`  OKVIR-tekst (box): gornji levi ${s.okvir.x},${s.okvir.y}  sirina ${s.okvir.w}  centar x ${s.okvir.centarX}  (baseline kalibrisi preklapanjem)`);
    else console.log(`  SVG sidro (baseline): x=${s.sidro.x} y=${s.sidro.y}`);
    for (const d of s.delovi || [])
      console.log(`    - ${JSON.stringify(d.tekst)}: ${d.font} ${d.fontPx}px ${d.boja}`);
  }
}
if (jsonIdx >= 0 && args[jsonIdx + 1]) {
  fs.writeFileSync(args[jsonIdx + 1], JSON.stringify({ width: psd.width, height: psd.height, slojevi }, null, 2));
  console.log(`\nJSON: ${args[jsonIdx + 1]}`);
}
