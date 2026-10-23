// Polozaj svakog slova: PSD sloj (bez efekata) vs Chromium sa poslatim fontom.
// Slova se razdvajaju po kolonama bez mastila; ispis: pocetak/kraj svakog komada.
//   npx electron tools/glifovi.cjs
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
const agp = require(path.join(require("os").homedir(), ".claude/skills/psd-u-kod/agpsd.cjs"));
agp.initializeCanvas(() => { throw new Error("no canvas"); }, (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }));
const ROOT = path.join(__dirname, "..");
const FONTS = path.join(ROOT, "public", "assets", "fonts").replace(/\\/g, "/");

const psd = agp.readPsd(fs.readFileSync(path.join(ROOT, "materijali/Kviz.psd")), { useImageData: true, skipThumbnail: true });
const slojevi = {};
const rec = (l) => { for (const x of l) { if (x.children) rec(x.children); else if (x.text && !slojevi[x.text.text]) slojevi[x.text.text] = x; } };
rec(psd.children);

function komadi(alpha, w, h) {
  const col = new Array(w).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alpha(x, y) > 60) col[x]++;
  const out = []; let s = -1;
  for (let x = 0; x <= w; x++) { const on = x < w && col[x] > 0; if (on && s < 0) s = x; if (!on && s >= 0) { out.push([s, x]); s = -1; } }
  return out;
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 400, height: 400 });
  const file = path.join(app.getPath("temp"), "fc-glif.html");
  fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:"Dans";src:url("file:///${FONTS}/DansHandWriting.otf")}</style><body></body>`);
  await win.loadFile(file);
  for (const [txt, l] of Object.entries(slojevi)) {
    const t = l.text, px = t.style.fontSize * t.transform[3];
    const linije = txt.split(/[\r\n\u0003]/);
    const im = l.imageData;
    const psdK = komadi((x, y) => im.data[(y * im.width + x) * 4 + 3], im.width, im.height).map(([a, b]) => [a + l.left, b + l.left]);
    const chrome = await win.webContents.executeJavaScript(`(async () => {
      await document.fonts.load('100px "Dans"');
      const cv = document.createElement("canvas"); cv.width = 1400; cv.height = 300;
      const c = cv.getContext("2d"); c.font = ${px} + 'px "Dans"'; c.fillText(${JSON.stringify(linije[0])}, 100, 220);
      const d = c.getImageData(0, 0, 1400, 300).data; const col = new Array(1400).fill(0);
      for (let y = 0; y < 300; y++) for (let x = 0; x < 1400; x++) if (d[(y * 1400 + x) * 4 + 3] > 60) col[x]++;
      const out = []; let s = -1;
      for (let x = 0; x <= 1400; x++) { const on = x < 1400 && col[x] > 0; if (on && s < 0) s = x; if (!on && s >= 0) { out.push([s - 100, x - 100]); s = -1; } }
      return { out, w: c.measureText(${JSON.stringify(linije[0])}).width };
    })()`);
    console.log("=== " + JSON.stringify(txt) + " " + px.toFixed(1) + "px (samo 1. red za Chromium)");
    console.log("  PSD     ", psdK.map(([a, b]) => a + "-" + b).join(" "));
    const x0 = psdK[0][0] - chrome.out[0][0];
    console.log("  Chromium", chrome.out.map(([a, b]) => (a + x0) + "-" + (b + x0)).join(" "));
  }
  app.quit();
});
