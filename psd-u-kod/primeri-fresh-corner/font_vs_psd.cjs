// Iscrtaj PSD tekstove poslatim fontom (Chromium canvas, sa i bez kerninga) i
// uporedi okvir mastila sa slojem iz PSD-a (materijali/_ref/ref-*.png).
// Pise materijali/_ref/font-<ime>-<kern>.png za vizuelno poredjenje.
//   npx electron tools/font_vs_psd.cjs
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

const ROOT = path.join(__dirname, "..");
const FONTS = path.join(ROOT, "public", "assets", "fonts").replace(/\\/g, "/");
const REF = path.join(ROOT, "materijali", "_ref");
// ime, tekst, px, okvir mastila iz PSD-a (x0,y0,x1,y1 bez konture)
const T = [
  ["50", "50", 207.5, [124, 616, 247, 716]],
  ["25", "25", 207.5, [807, 616, 935, 722]],
  ["85", "85", 207.5, [276, 1468, 395, 1569]],
  ["100", "100", 207.5, [644, 1459, 816, 1565]],
  ["a", "a) Espreso", 110.5, [389, 1111, 675, 1182]],
  ["b", "b) Bebićino", 110.5, [378, 1276, 667, 1352]],
  ["c", "c) Amerikano", 110.5, [363, 1432, 713, 1501]],
  ["q2", "na MOL servisnim stanicama?", 105.6, null],
];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 400, height: 400 });
  const file = path.join(app.getPath("temp"), "fc-font.html");
  fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:"Dans";src:url("file:///${FONTS}/DansHandWriting.otf")}</style><body></body>`);
  await win.loadFile(file);
  const res = await win.webContents.executeJavaScript(`(async () => {
    await document.fonts.load('100px "Dans"');
    const T = ${JSON.stringify(T)};
    const out = [];
    for (const [ime, txt, px] of T) for (const kern of ["normal", "none"]) {
      const cv = document.createElement("canvas"); cv.width = 1200; cv.height = 400;
      const c = cv.getContext("2d"); c.font = px + 'px "Dans"'; c.fontKerning = kern; c.fillStyle = "#5b3217";
      c.fillText(txt, 50, 300);
      const d = c.getImageData(0, 0, 1200, 400).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < 400; y++) for (let x = 0; x < 1200; x++) if (d[(y * 1200 + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      out.push({ ime, kern, ink: [x0 - 50, y0 - 300, x1 - 50 + 1, y1 - 300 + 1], w: x1 - x0 + 1, h: y1 - y0 + 1, png: cv.toDataURL() });
    }
    return out;
  })()`);
  for (const r of res) {
    const t = T.find((t) => t[0] === r.ime);
    const psd = t[3] ? { w: t[3][2] - t[3][0], h: t[3][3] - t[3][1] } : null;
    console.log(r.ime.padEnd(4), r.kern.padEnd(7), "mastilo w", r.w, "h", r.h, psd ? `| PSD w ${psd.w} h ${psd.h}` : "", "| od sidra", JSON.stringify(r.ink));
    fs.writeFileSync(path.join(REF, `font-${r.ime}-${r.kern}.png`), Buffer.from(r.png.split(",")[1], "base64"));
  }
  app.quit();
});
