// Poslati DansHandWriting.otf ima drugacije sirine nekih slova od fonta kojim je
// radjen PSD (visina/oblik isti). Ovde se iz SVIH tekst-slojeva PSD-a (6 velicina)
// trazi ispravka sirine (advance) po znaku, u em jedinicama - ista ispravka mora
// da vazi u svim velicinama, inace nije razlika fonta.
// Poredjenje je 1D: zbir mastila po kolonama (polozaj slova po x), za svaki red.
//   npx electron tools/fit_font.cjs   -> materijali/_ref/font_ispravke.json
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
const agp = require(path.join(require("os").homedir(), ".claude/skills/psd-u-kod/agpsd.cjs"));
agp.initializeCanvas(() => { throw new Error("no canvas"); }, (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }));
const ROOT = path.join(__dirname, "..");
const FONT = process.argv.find((a) => a.endsWith(".otf")) || path.join(ROOT, "public/assets/fonts/DansHandWriting.otf");

const psd = agp.readPsd(fs.readFileSync(path.join(ROOT, "materijali/Kviz.psd")), { useImageData: true, skipThumbnail: true });
const layers = {};
const rec = (l) => { for (const x of l) { if (x.children) rec(x.children); else if (x.text && !layers[x.text.text]) layers[x.text.text] = x; } };
rec(psd.children);

// Redovi: tekst, velicina, i y-opseg reda u sloju (visereni tekst se deli po prazninama).
const lines = [];
for (const [txt, l] of Object.entries(layers)) {
  const px = l.text.style.fontSize * l.text.transform[3];
  const parts = txt.split(/[\r\n\u0003]/);
  const im = l.imageData, W = im.width, H = im.height;
  const rowInk = Array.from({ length: H }, (_, y) => { let s = 0; for (let x = 0; x < W; x++) s += im.data[(y * W + x) * 4 + 3]; return s; });
  // granice redova: za n redova, n-1 najsiromasnijih vrsta u srednjim delovima
  const bounds = [0];
  for (let k = 1; k < parts.length; k++) {
    const c = Math.round((H * k) / parts.length), r = Math.round(H / parts.length / 3);
    let best = c; for (let y = c - r; y <= c + r; y++) if (rowInk[y] < rowInk[best]) best = y;
    bounds.push(best);
  }
  bounds.push(H);
  parts.forEach((p, k) => {
    const prof = new Array(W).fill(0);
    for (let y = bounds[k]; y < bounds[k + 1]; y++) for (let x = 0; x < W; x++) prof[x] += im.data[(y * W + x) * 4 + 3] / 255;
    lines.push({ text: p, px, prof, left: l.left });
  });
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 400, height: 400 });
  const file = path.join(app.getPath("temp"), "fc-fit.html");
  fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:"Dans";src:url("file:///${FONT.replace(/\\/g, "/")}")}</style><body></body>`);
  await win.loadFile(file);
  const out = await win.webContents.executeJavaScript(`(async () => {
    await document.fonts.load('100px "Dans"');
    const lines = ${JSON.stringify(lines)};
    const cv = document.createElement("canvas"); cv.width = 600; cv.height = 500;
    const c = cv.getContext("2d", { willReadFrequently: true });
    // profil glifa: zbir alfe po kolonama, crtan u x = 100
    const cache = new Map();
    const glyph = (ch, px) => {
      const k = ch + "|" + px; if (cache.has(k)) return cache.get(k);
      c.clearRect(0, 0, 600, 500); c.font = px + 'px "Dans"'; c.fillText(ch, 100, 350);
      const d = c.getImageData(0, 0, 600, 500).data; const prof = new Float32Array(600);
      for (let y = 0; y < 500; y++) for (let x = 0; x < 600; x++) prof[x] += d[(y * 600 + x) * 4 + 3] / 255;
      const g = { prof, adv: c.measureText(ch).width }; cache.set(k, g); return g;
    };
    const chars = [...new Set(lines.flatMap((l) => [...l.text]))];
    const delta = Object.fromEntries(chars.map((ch) => [ch, 0]));
    // profil reda za date ispravke (pocetak prvog slova u x=0)
    const render = (l) => {
      const W = l.prof.length + 200; const p = new Float32Array(W); let x = 0;
      for (const ch of l.text) {
        const g = glyph(ch, l.px);
        const fx = Math.floor(x), fr = x - fx;
        for (let i = 0; i < 600; i++) { const v = g.prof[i]; if (!v) continue; const X = fx + i - 100 + 60; if (X >= 0 && X + 1 < W) { p[X] += v * (1 - fr); p[X + 1] += v * fr; } }
        x += g.adv + delta[ch] * l.px;
      }
      return p;
    };
    // greska reda: najbolji pomeraj s (PSD kolona x <-> kolona x + s u nasem profilu)
    const lineErr = (l) => {
      const r = render(l); const P = l.prof; let best = Infinity;
      for (let s = 30; s <= 90; s += 1) {
        let e = 0;
        for (let j = 0; j < r.length; j++) { const pj = j - s; e += Math.abs(r[j] - (pj >= 0 && pj < P.length ? P[pj] : 0)); }
        if (e < best) best = e;
      }
      return best;
    };
    // pomeraj reda: trazi se jednom dobro (sirok opseg), posle oko pronadjenog
    const total = () => lines.reduce((s, l) => s + lineErr(l), 0);
    const pre = lines.map((l) => ({ text: l.text, px: +l.px.toFixed(1), err: Math.round(lineErr(l)) }));
    const step = 0.004;
    for (let pass = 0; pass < 4; pass++) {
      for (const ch of chars) {
        const own = lines.filter((l) => l.text.includes(ch));
        const cost = () => own.reduce((s, l) => s + lineErr(l), 0);
        let bestD = delta[ch], bestC = cost();
        for (let d = -0.08; d <= 0.08001; d += step) { delta[ch] = d; const cc = cost(); if (cc < bestC - 1e-6) { bestC = cc; bestD = d; } }
        delta[ch] = +bestD.toFixed(4);
      }
    }
    const post = lines.map((l) => ({ text: l.text, err: Math.round(lineErr(l)) }));
    // koliko puta se svaki znak pojavljuje i u koliko velicina
    const seen = Object.fromEntries(chars.map((ch) => [ch, { n: lines.reduce((s, l) => s + [...l.text].filter((x) => x === ch).length, 0), sizes: [...new Set(lines.filter((l) => l.text.includes(ch)).map((l) => +l.px.toFixed(1)))] }]));
    return { delta, pre, post, seen };
  })()`);
  const outFile = path.join(ROOT, "materijali/_ref/font_ispravke.json");
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.log("greska po redu (pre -> posle):");
  out.pre.forEach((p, i) => console.log("  " + JSON.stringify(p.text).padEnd(40), p.px, p.err, "->", out.post[i].err));
  console.log("ispravke (em), znak: delta  [pojavljivanja, velicine]");
  for (const [ch, d] of Object.entries(out.delta).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])))
    console.log("  " + JSON.stringify(ch), d.toFixed(3), JSON.stringify(out.seen[ch]));
  app.quit();
});
