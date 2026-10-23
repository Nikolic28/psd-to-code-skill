// Snimci svih ekrana u punoj rezoluciji (1080x1920, CDP) + poredjenje sa
// klijentovim mockupima (materijali/1-7.jpg) preko skill-a psd-u-kod/uporedi.ps1.
//   npm run shot                              (dev build)
//   node tools/shot.mjs --exe "C:\...\Fresh Corner Kviz.exe"   (instalirana kopija)
// Animacije su ugasene (mirno stanje = dizajn); ekrani 3-7 se postavljaju kao
// mockup preko window.__fc.mockup(n) (isto pitanje, bodovi 50 : 25, sat "30").
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { launch, ROOT, sleep } from './cdp.mjs'

const exeIdx = process.argv.indexOf('--exe')
const exe = exeIdx > 0 ? process.argv[exeIdx + 1] : undefined
const OUT = path.join(ROOT, 'snimci')
const UPOREDI = path.join(os.homedir(), '.claude', 'skills', 'psd-u-kod', 'uporedi.ps1')

const g = await launch({ exe, dataDir: mkdtempSync(path.join(os.tmpdir(), 'fc-shot-')) })
const rezultat = []
try {
  await g.ev(`(() => { const s = document.createElement('style'); s.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }'; document.head.appendChild(s); return true })()`)
  const snimi = async (ime, mockup) => {
    await sleep(500)
    const file = path.join(OUT, ime + '.png')
    await g.shot(file)
    const out = execFileSync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', UPOREDI, '-Mockup', path.join(ROOT, 'materijali', mockup), '-Snimak', file], { encoding: 'utf8' })
    const pct = /:\s*([\d.,]+)%/.exec(out)?.[1]
    rezultat.push(`${ime.padEnd(16)} vs ${mockup}: ${pct} % razlicitih piksela`)
  }
  await g.waitScreen('title')
  await snimi('1-naslovni', '1.jpg')
  await g.tapXY(540, 960)
  await g.waitScreen('start')
  await snimi('2-start', '2.jpg')
  for (const n of [3, 4, 5, 6, 7]) {
    await g.ev(`window.__fc.mockup(${n})`)
    await snimi(n === 7 ? '7-pobednik' : `${n}-pitanje`, `${n}.jpg`)
  }
} finally {
  await g.close()
}
console.log(rezultat.join('\n'))
