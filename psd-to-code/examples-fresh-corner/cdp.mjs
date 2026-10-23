// REAL PROJECT EXAMPLE (Fresh Corner quiz, 2026-10): launch the game and drive it through
// the Chrome DevTools Protocol (Node 22+: global fetch/WebSocket).
// Same tool for the dev build (electron .) and for the INSTALLED .exe.
//
// The screen is emulated at exactly 1080x1920 (Emulation.setDeviceMetricsOverride), so the
// scale is 1, tap coordinates = design coordinates, and screenshots are full resolution
// regardless of the monitor height.
//
// Adapt to your game: the env variables (FC_*) are read by that project's electron/main.cjs
// (windowed test mode, separate data folder), and window.__fc is a small test hook object
// the game exposes (ready, screen(), turn(), scores(), mockup(n)).

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
  if (!page) throw new Error('the game did not start')

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
  if (!(await ev('!!(window.__fc && window.__fc.ready)'))) throw new Error('game not ready (window.__fc.ready - did boot fail?)')
  await ev('document.fonts.ready.then(() => true)')
  // Log of every input - an e2e test prints it when a measurement looks wrong
  // (a visible test window can receive real clicks from the person at the computer).
  await ev(`(() => { window.__e2eEv = []; for (const type of ['pointerdown', 'pointerup', 'keydown']) window.addEventListener(type, (e) => window.__e2eEv.push({ type, t: Math.round(performance.now()), x: Math.round(e.clientX), y: Math.round(e.clientY), key: e.key, id: e.pointerId }), true); return true })()`)

  const mouse = (type, x, y, buttons = 1) =>
    send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 })
  const tapXY = async (x, y) => {
    await mouse('mousePressed', x, y)
    await mouse('mouseReleased', x, y, 0)
  }
  /** Real tap in the middle of a rectangle {x,y,w,h}. */
  const tapRect = (r) => tapXY(r.x + r.w / 2, r.y + r.h / 2)
  const state = () => ev('({ screen: window.__fc.screen(), turn: window.__fc.turn(), scores: window.__fc.scores() })')
  const screen = () => ev('window.__fc.screen()')
  const waitScreen = async (name, ms = 10000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      if ((await screen()) === name) return Date.now() - t0
      await sleep(40)
    }
    throw new Error(`waited for screen "${name}", but it is "${await screen()}"`)
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
