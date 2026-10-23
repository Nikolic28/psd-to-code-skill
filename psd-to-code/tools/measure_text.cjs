/**
 * Font size calibration when there is NO .psd, only a flattened JPEG mockup.
 * For every line of text in the design (its pixel width measured on the JPEG with a
 * PowerShell/System.Drawing pixel scan of the left/right ink edges) a binary search
 * finds the exact px font size whose Canvas measureText width matches - real font,
 * real Chromium renderer through Electron, no guessing. Also prints
 * actualBoundingBoxAscent/Descent at that size, so the baseline can be computed from
 * the measured top edge of the text in the mockup (baselineY = topY + ascent).
 *
 * With a .psd, use read_psd.cjs instead - it reads font name/size/position directly.
 *
 * How to use in a project:
 * 1. Copy both files (measure_text.cjs + measure_text.html) into <project>/electron/.
 * 2. In measure_text.html replace the @font-face rules with the project's brand font.
 * 3. Fill TARGETS below: for each line, the width in px measured on the JPEG mockup.
 * 4. Run:  npx electron electron/measure_text.cjs
 */

const { app, BrowserWindow } = require("electron");
const path = require("path");

const TARGETS = [
  // Example - replace with the real lines of text and widths measured on the mockup.
  { line: "SAMPLE TEXT", weight: 700, targetWidth: 600 },
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
