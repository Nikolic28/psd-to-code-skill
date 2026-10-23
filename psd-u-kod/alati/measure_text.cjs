/**
 * Kalibracija velicine fonta kad NEMA .psd, samo JPEG mockup (iz Kleos
 * padalica projekta). Za svaku liniju teksta iz dizajna (izmerena sirina u
 * pikselima iz JPEG mockup-a preko System.Drawing/PowerShell) binarnom
 * pretragom nalazi tacnu px velicinu fonta u Canvas-u koja daje istu sirinu
 * (measureText, pravi font, pravi Chromium renderer preko Electrona - ne
 * procena/nagadjanje). Ispisuje i actualBoundingBoxAscent/Descent za tu
 * velicinu, da se baseline y moze tacno izracunati iz izmerenog gornjeg
 * ruba teksta u mockup-u (baselineY = topY + ascent).
 *
 * Ako klijent POSALJE .psd uz mockape, koristi ag-psd (npm paket) umesto
 * ovoga - direktno cita font-name/fontSize/poziciju iz layer podataka, jos
 * pouzdanije (vidi README.md tacka 9). Ovo je fallback kad postoji SAMO
 * flattened JPEG.
 *
 * Kako koristiti u novom app-u:
 * 1. Kopiraj oba fajla u <projekat>/electron/.
 * 2. U measure_text.html zameni @font-face na stvarni brend font projekta.
 * 3. Ispod popuni TARGETS: za svaku liniju teksta, izmeri njenu sirinu u
 *    pikselima direktno sa JPEG mockup-a (PowerShell + System.Drawing,
 *    pixel-scan levog/desnog ruba teksta - isti postupak kao za merenje
 *    layout koordinata).
 * 4. Pokreni:  npx electron electron/measure_text.cjs
 */

const { app, BrowserWindow } = require("electron");
const path = require("path");

const TARGETS = [
  // Primer - zameni stvarnim linijama teksta i sirinama izmerenim sa mockup-a.
  { line: "PRIMER TEKSTA", weight: 700, targetWidth: 600 },
];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadFile(path.join(__dirname, "measure_text.html"));

  const results = [];
  for (const t of TARGETS) {
    const r = await win.webContents.executeJavaScript(
      `window.fitFontSize(${JSON.stringify(t.line)}, ${t.weight}, ${t.targetWidth})`,
    );
    results.push({ ...t, ...r });
  }

  for (const r of results) {
    console.log(
      `${JSON.stringify(r.line).padEnd(46)} w${r.weight}  target=${r.targetWidth}px  ` +
        `fontSize=${r.fontSize}  ascent=${r.ascent.toFixed(1)}  descent=${r.descent.toFixed(1)}  capHeight=${(r.ascent + r.descent).toFixed(1)}`,
    );
  }

  app.quit();
});
