// Composites a screen (top-level PSD group) from its layers WITH layer effects:
// solidFill, stroke (outside), dropShadow, clipping masks, group masks.
// Not drawn: inner bevel / emboss, inner shadow, gradients - patch those from the
// client's JPEG export (tools/patch_from_jpeg.ps1).
//
//   node composite.cjs <file.psd> <outDir> [group:skipIdx,skipIdx:outName;...]
//   (no spec = every top-level group, full)
// From code:  const { renderGroup, png, agp } = require("./composite.cjs")
//             renderGroup(psd, "Start", { skip: new Set([3, 4]) })   -> RGBA pixels
//             renderGroup(psd, "Start", { only: new Set([3]) })      -> just that layer, with effects
// Layer indices = order from tools/psd_layers.cjs (leaf layers inside the group, counted top-down
// in file order, hidden groups included in the count).
const fs = require("fs"), path = require("path"), zlib = require("zlib");
// works from the skill folder and when copied into <project>/tools/
const agp = require(fs.existsSync(path.join(__dirname, "agpsd.cjs")) ? path.join(__dirname, "agpsd.cjs") : path.join(require("os").homedir(), ".claude/skills/psd-to-code/agpsd.cjs"));
agp.initializeCanvas(() => { throw new Error("no canvas"); }, (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }));

// Canvas size; set from the PSD on every renderGroup call.
let W = 1080, H = 1920, N = W * H;

const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
/** RGBA pixels -> PNG file bytes (no native dependencies). */
function png(w, h, data) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const blank = () => ({ R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N), A: new Float32Array(N) });
function applyMask(A, m) {
  if (!m || !m.imageData || m.disabled) return;
  const mi = m.imageData, def = (m.defaultColor || 0) / 255;
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const x = X - m.left, y = Y - m.top; let v = def;
    if (x >= 0 && y >= 0 && x < mi.width && y < mi.height) v = mi.data[(y * mi.width + x) * 4] / 255;
    A[Y * W + X] *= v;
  }
}
function layerToCanvas(l) {
  const L = blank(), im = l.imageData;
  if (!im) return L;
  for (let y = 0; y < im.height; y++) { const Y = y + l.top; if (Y < 0 || Y >= H) continue;
    for (let x = 0; x < im.width; x++) { const X = x + l.left; if (X < 0 || X >= W) continue;
      const s = (y * im.width + x) * 4, t = Y * W + X;
      L.A[t] = im.data[s + 3] / 255; L.R[t] = im.data[s] / 255; L.G[t] = im.data[s + 1] / 255; L.B[t] = im.data[s + 2] / 255; } }
  applyMask(L.A, l.mask);
  return L;
}
function bounds(A) { let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let i = 0; i < N; i++) if (A[i] > 0) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1 }; }
function dilate(A, r) {
  const out = new Float32Array(N), ri = Math.ceil(r) + 1, offs = [];
  for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) { const d = Math.hypot(dx, dy); if (d <= r + 0.5) offs.push([dx, dy, Math.min(1, r + 0.5 - d)]); }
  const b = bounds(A); if (b.x1 < 0) return out;
  for (let y = Math.max(0, b.y0 - ri); y <= Math.min(H - 1, b.y1 + ri); y++) for (let x = Math.max(0, b.x0 - ri); x <= Math.min(W - 1, b.x1 + ri); x++) {
    let m = 0; for (const [dx, dy, w] of offs) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const v = A[Y * W + X] * w; if (v > m) { m = v; if (m >= 1) break; } }
    out[y * W + x] = m; }
  return out;
}
function blur(A, r) {
  const k = Math.max(0, Math.round(r)); if (!k) return A;
  const t = new Float32Array(N), o = new Float32Array(N), n = 2 * k + 1;
  for (let y = 0; y < H; y++) { let s = 0; for (let x = -k; x <= k; x++) s += A[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) { t[y * W + x] = s / n; s += A[y * W + Math.min(W - 1, x + k + 1)] - A[y * W + Math.max(0, x - k)]; } }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = -k; y <= k; y++) s += t[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) { o[y * W + x] = s / n; s += t[Math.min(H - 1, y + k + 1) * W + x] - t[Math.max(0, y - k) * W + x]; } }
  return o;
}
function composite(dst, L, mul, mode) {
  for (let i = 0; i < N; i++) {
    const a = L.A[i] * (mul == null ? 1 : typeof mul === "number" ? mul : mul[i]); if (a <= 0) continue;
    let r = L.R[i], g = L.G[i], b = L.B[i];
    const da = dst.A[i];
    // Photoshop: the blend B(src, dst) applies only as much as there are pixels below;
    // over transparency the source color stays (a multiply shadow is NOT black there).
    if (mode === "multiply") { r = r * (1 - da) + r * dst.R[i] * da; g = g * (1 - da) + g * dst.G[i] * da; b = b * (1 - da) + b * dst.B[i] * da; }
    const oa = a + da * (1 - a);
    dst.R[i] = (r * a + dst.R[i] * da * (1 - a)) / oa; dst.G[i] = (g * a + dst.G[i] * da * (1 - a)) / oa; dst.B[i] = (b * a + dst.B[i] * da * (1 - a)) / oa; dst.A[i] = oa;
  }
}
const solid = (A, c) => ({ A, R: new Float32Array(N).fill(c.r / 255), G: new Float32Array(N).fill(c.g / 255), B: new Float32Array(N).fill(c.b / 255) });
function effects(l) { const fx = l.effects && !l.effects.disabled ? l.effects : null; return (k) => (fx && fx[k] ? (Array.isArray(fx[k]) ? fx[k] : [fx[k]]).filter((e) => e.enabled) : []); }
function renderLayer(dst, l, clipA) {
  const L = layerToCanvas(l), en = effects(l), op = l.opacity ?? 1, fop = l.fillOpacity ?? 1;
  if (clipA) for (let i = 0; i < N; i++) L.A[i] *= clipA[i];
  for (const e of en("dropShadow")) {
    const ang = (e.useGlobalLight ? 90 : e.angle) * Math.PI / 180, d = e.distance.value;
    const dx = Math.round(-Math.cos(ang) * d), dy = Math.round(Math.sin(ang) * d), S = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const X = x - dx, Y = y - dy; if (X >= 0 && Y >= 0 && X < W && Y < H) S[y * W + x] = L.A[Y * W + X]; }
    composite(dst, solid(blur(S, e.size.value / 2), e.color), e.opacity * op, e.blendMode);
  }
  for (const e of en("stroke")) composite(dst, solid(dilate(L.A, e.size.value), e.color), e.opacity * op);
  let F = L; const sf = en("solidFill")[0];
  if (sf) { const c = sf.color, o = sf.opacity; F = { A: L.A, R: L.R.map((v) => v * (1 - o) + c.r / 255 * o), G: L.G.map((v) => v * (1 - o) + c.g / 255 * o), B: L.B.map((v) => v * (1 - o) + c.b / 255 * o) }; }
  composite(dst, F, op * fop);
  return L.A;
}
/**
 * skip: Set of layer indices to leave out; only: Set of indices to draw (nothing else).
 * Returns RGBA pixels (Uint8ClampedArray) of size psd.width x psd.height.
 */
function renderGroup(psd, groupName, { skip = new Set(), only = null } = {}) {
  W = psd.width; H = psd.height; N = W * H;
  const g = psd.children.find((c) => c.name === groupName);
  if (!g) throw new Error(`no top-level group "${groupName}" (have: ${psd.children.map((c) => c.name).join(", ")})`);
  const dst = blank(); let idx = 0;
  const rec = (list, cur) => {
    let base = null;
    for (const l of list) {
      if (l.children) {
        if (l.hidden) { const cnt = (ll) => ll.reduce((s, x) => s + (x.children ? cnt(x.children) : 1), 0); idx += cnt(l.children); continue; }
        const tmp = blank(); rec(l.children, tmp); applyMask(tmp.A, l.mask); composite(cur, tmp, null); base = null; continue;
      }
      const my = idx++;
      const draw = !l.hidden && !skip.has(my) && (!only || only.has(my));
      if (l.clipping) { if (base && draw) renderLayer(cur, l, base); continue; }
      base = null;
      // a layer left out by `only` still acts as the clipping base for layers clipped to it
      if (!draw) { if (!l.hidden && !skip.has(my) && only) base = layerToCanvas(l).A; continue; }
      base = renderLayer(cur, l, null);
    }
  };
  rec(g.children || [g], dst);
  const out = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) { out[i * 4] = dst.R[i] * 255 + 0.5; out[i * 4 + 1] = dst.G[i] * 255 + 0.5; out[i * 4 + 2] = dst.B[i] * 255 + 0.5; out[i * 4 + 3] = dst.A[i] * 255 + 0.5; }
  return out;
}
module.exports = { png, renderGroup, agp };
if (require.main === module) {
  const [file, out, spec] = process.argv.slice(2);
  if (!file || !out) { console.error("Usage: node composite.cjs <file.psd> <outDir> [group:skipIdx,skipIdx:outName;...]"); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  const psd = agp.readPsd(fs.readFileSync(file), { useImageData: true, skipThumbnail: true });
  const groups = spec ? spec.split(";").map((s) => { const [g, ex, name] = s.split(":"); return { g, skip: new Set((ex || "").split(",").filter(Boolean).map(Number)), name: name || g }; })
    : psd.children.filter((c) => c.children).map((c) => ({ g: c.name, skip: new Set(), name: c.name }));
  for (const { g, skip, name } of groups) {
    const safe = name.replace(/[\/\\:*?"<>|]/g, "_");
    fs.writeFileSync(path.join(out, safe + ".png"), png(psd.width, psd.height, renderGroup(psd, g, { skip })));
    console.log("ok", safe);
  }
}
