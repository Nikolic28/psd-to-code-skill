// Merenje fontova u pravom Chromium-u (Electron, van ekrana):
//  - da li font ima srpska slova (sirina sa dva razlicita rezervna fonta mora biti ista)
//  - sirina "30" u Solido-u (centar broja na satu)
//  - mastilo (actualBoundingBox*) PSD tekstova -> baseline za SVG <text>
//   npx electron tools/merenje.cjs
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

const FONTS = path.join(__dirname, "..", "public", "assets", "fonts").replace(/\\/g, "/");
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:"DansHandWriting";src:url("file:///${FONTS}/DansHandWriting.otf")}
@font-face{font-family:"SolidoCompact";src:url("file:///${FONTS}/SolidoCompact-Medium.otf")}
</style><body>x</body>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, x: -3000, width: 400, height: 400, webPreferences: { offscreen: false } });
  const file = path.join(app.getPath("temp"), "fc-merenje.html");
  fs.writeFileSync(file, html);
  await win.loadFile(file);
  const r = await win.webContents.executeJavaScript(`(async () => {
    await document.fonts.load('100px "DansHandWriting"'); await document.fonts.load('100px "SolidoCompact"');
    const c = document.createElement("canvas").getContext("2d");
    const m = (font, t) => { c.font = font; const x = c.measureText(t); return { w: +x.width.toFixed(2), asc: +x.actualBoundingBoxAscent.toFixed(2), desc: +x.actualBoundingBoxDescent.toFixed(2), l: +x.actualBoundingBoxLeft.toFixed(2), r: +x.actualBoundingBoxRight.toFixed(2) }; };
    const cover = (fam, chars) => [...chars].filter((ch) => m('100px "' + fam + '", monospace', ch).w !== m('100px "' + fam + '", serif', ch).w);
    const slova = "abcčćdđefghijklmnoprsštuvzžABCČĆDĐEFGHIJKLMNOPRSŠTUVZŽ0123456789?!.,:;-–()'\\"%";
    return {
      fontsOK: [...document.fonts].map((f) => f.family + ":" + f.status),
      nedostajeDans: cover("DansHandWriting", slova),
      nedostajeSolido: cover("SolidoCompact", "0123456789"),
      solido30: m('289.418px "SolidoCompact"', "30"),
      solidoCifre: [..."0123456789"].map((d) => m('289.418px "SolidoCompact"', d).w),
      q1: m('105.6px "DansHandWriting"', "Koja je omiljena kafa kod kupaca "),
      q1bez: m('105.6px "DansHandWriting"', "Koja je omiljena kafa kod kupaca"),
      q2: m('105.6px "DansHandWriting"', "na MOL servisnim stanicama?"),
      a: m('110.5px "DansHandWriting"', "a) Espreso"),
      b: m('110.5px "DansHandWriting"', "b) Bebićino"),
      c: m('110.5px "DansHandWriting"', "c) Amerikano"),
      n50: m('207.5px "DansHandWriting"', "50"), n25: m('207.5px "DansHandWriting"', "25"),
      n85: m('207.5px "DansHandWriting"', "85"), n100: m('207.5px "DansHandWriting"', "100"),
      pob: m('83px "DansHandWriting"', "Pobednik!"),
      start: m('201.9px "DansHandWriting"', "Start!"),
    };
  })()`);
  console.log(JSON.stringify(r, null, 1));
  app.quit();
});
