// Pokreni igru i vozi je kroz DevTools protokol (Node 22+: globalni fetch/WebSocket).
// Isti alat za dev build (electron .) i za INSTALIRANI .exe (zajednicko t.19/27).
// Preneto iz mts biz box/tools/cdp.mjs (izvorno wine vision reaktor).
//
// Ekran se emulira na tacno 1080x1920 (Emulation.setDeviceMetricsOverride), pa
// je skala 1 i koordinate dodira = koordinate dizajna, a snimak je u punoj
// rezoluciji bez obzira na visinu monitora.

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** @param {{ exe?: string, dataDir: string, desktopDir?: string, port?: number }} o */
export async function launch(o) {
  const port = o.port ?? 9334
  mkdirSync(o.dataDir, { recursive: true })
  const exe = o.exe ?? path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
  const args = o.exe ? [] : ['.']
  args.push(`--remote-debugging-port=${port}`)
  const env = { ...process.env, FC_WINDOWED: '1', FC_DATA: o.dataDir, FC_DESKTOP: o.desktopDir ?? path.join(o.dataDir, 'desktop') }
  mkdirSync(env.FC_DESKTOP, { recursive: true })
  delete env.ELECTRON_RUN_AS_NODE
  const proc = spawn(exe, args, { cwd: ROOT, env, stdio: 'ignore' })

  let page
  for (let i = 0; i < 60 && !page; i++) {
    await sleep(500)
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      page = list.find((t) => t.type === 'page')
    } catch {}
  }
  if (!page) throw new Error('igra se nije pokrenula')

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r, j) => {
    ws.addEventListener('open', r)
    ws.addEventListener('error', j)
  })
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
  })
  const send = (method, params = {}) =>
    new Promise((r, j) => {
      const i = ++id
      pending.set(i, (m) => (m.error ? j(new Error(method + ': ' + m.error.message)) : r(m.result)))
      ws.send(JSON.stringify({ id: i, method, params }))
    })

  await send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false })
  await send('Runtime.enable')

  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description ?? expr))
    return r.result.value
  }

  for (let i = 0; i < 60; i++) {
    if (await ev('!!(window.__fc && window.__fc.ready)').catch(() => false)) break
    await sleep(250)
  }
  if (!(await ev('!!(window.__fc && window.__fc.ready)'))) throw new Error('igra nije spremna (window.__fc.ready, boot pao?)')
  await ev('document.fonts.ready.then(() => true)')
  // Zapis svakog unosa - e2e ga ispise kad nesto ne valja (zajednicko t.28).
  await ev(`(() => { window.__e2eEv = []; for (const type of ['pointerdown', 'pointerup', 'keydown']) window.addEventListener(type, (e) => window.__e2eEv.push({ type, t: Math.round(performance.now()), x: Math.round(e.clientX), y: Math.round(e.clientY), key: e.key, id: e.pointerId }), true); return true })()`)

  const mouse = (type, x, y, buttons = 1) =>
    send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 })
  const tapXY = async (x, y) => {
    await mouse('mousePressed', x, y)
    await mouse('mouseReleased', x, y, 0)
  }
  /** Pravi dodir u sredinu pravougaonika {x,y,w,h}. */
  const tapRect = (r) => tapXY(r.x + r.w / 2, r.y + r.h / 2)
  const state = () => ev('({ screen: window.__fc.screen(), turn: window.__fc.turn(), scores: window.__fc.scores() })')
  const screen = () => ev('window.__fc.screen()')
  const waitScreen = async (name, ms = 10000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      if ((await screen()) === name) return Date.now() - t0
      await sleep(40)
    }
    throw new Error(`cekao ekran "${name}", a stoji "${await screen()}"`)
  }
  const shot = async (file) => {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, Buffer.from(r.data, 'base64'))
  }
  const close = async () => {
    try {
      ws.close()
    } catch {}
    proc.kill()
    await sleep(800)
  }
  return { ev, send, mouse, tapXY, tapRect, state, screen, waitScreen, shot, close, proc }
}

