// REAL PROJECT EXAMPLE (Fresh Corner quiz, 2026-10): screenshots of every screen at full
// resolution (1080x1920, via CDP) + comparison with the client's mockups (materials/1-7.jpg)
// through the skill's compare.ps1.
//   npm run shot                                             (dev build)
//   node tools/shot.mjs --exe "C:\...\Fresh Corner Kviz.exe"   (installed copy)
// Animations are turned off (the resting state = the design); screens 3-7 are set up to match
// the mockup through window.__fc.mockup(n) (same question, scores 50 : 25, clock "30").
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { launch, ROOT, sleep } from './cdp.mjs'

const exeIdx = process.argv.indexOf('--exe')
const exe = exeIdx > 0 ? process.argv[exeIdx + 1] : undefined
const OUT = path.join(ROOT, 'shots')
const COMPARE = path.join(os.homedir(), '.claude', 'skills', 'psd-to-code', 'compare.ps1')

const g = await launch({ exe, dataDir: mkdtempSync(path.join(os.tmpdir(), 'fc-shot-')) })
const results = []
try {
  await g.ev(`(() => { const s = document.createElement('style'); s.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }'; document.head.appendChild(s); return true })()`)
  const capture = async (name, mockup) => {
    await sleep(500)
    const file = path.join(OUT, name + '.png')
    await g.shot(file)
    const out = execFileSync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', COMPARE, '-Mockup', path.join(ROOT, 'materials', mockup), '-Shot', file], { encoding: 'utf8' })
    const pct = /:\s*([\d.,]+)%/.exec(out)?.[1]
    results.push(`${name.padEnd(16)} vs ${mockup}: ${pct} % differing pixels`)
  }
  await g.waitScreen('title')
  await capture('1-title', '1.jpg')
  await g.tapXY(540, 960)
  await g.waitScreen('start')
  await capture('2-start', '2.jpg')
  for (const n of [3, 4, 5, 6, 7]) {
    await g.ev(`window.__fc.mockup(${n})`)
    await capture(n === 7 ? '7-winner' : `${n}-question`, `${n}.jpg`)
  }
} finally {
  await g.close()
}
console.log(results.join('\n'))
