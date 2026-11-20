// ─── Is-effekter med PixiJS ───────────────────────────────────────────────────
// 1. mountIceSnow(el): iskristaller som singlar ner i bannern för nästa pass.
// 2. iceBurst(x, y):   isspray + pucks som sprutar ut, som när en skridsko
//                      tvärbromsar. Används när en vakt sparar sina tider.
// PixiJS laddas först när en effekt behövs, så adminvyn påverkas inte.
// Effekterna slås av/på med en knapp i vaktvyn (sparas i webbläsaren).
// Standard är på, oavsett systemets "minska rörelse".

const STORAGE_KEY = 'troja_effects'
export const EFFECTS_EVENT = 'troja-effects-change'

export function effectsEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) !== 'off' } catch (e) { return true }
}

export function setEffectsEnabled(on) {
  try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off') } catch (e) { /* ignoreras */ }
  window.dispatchEvent(new CustomEvent(EFFECTS_EVENT, { detail: on }))
}

const reducedMotion = () => false

let pixiPromise = null
const loadPixi = () => (pixiPromise ||= import('pixi.js'))

// Iskristall: sex armar med små grenar
function crystalTexture(PIXI, renderer, size = 12) {
  const g = new PIXI.Graphics()
  const r = size / 2
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i
    const x = Math.cos(a) * r, y = Math.sin(a) * r
    g.moveTo(0, 0).lineTo(x, y)
    const bx = Math.cos(a) * r * 0.55, by = Math.sin(a) * r * 0.55
    g.moveTo(bx, by).lineTo(bx + Math.cos(a + 0.7) * r * 0.3, by + Math.sin(a + 0.7) * r * 0.3)
    g.moveTo(bx, by).lineTo(bx + Math.cos(a - 0.7) * r * 0.3, by + Math.sin(a - 0.7) * r * 0.3)
  }
  g.stroke({ width: 1.4, color: 0xffffff, cap: 'round' })
  return renderer.generateTexture({ target: g, resolution: 2 })
}

function dotTexture(PIXI, renderer, radius = 3) {
  const g = new PIXI.Graphics().circle(0, 0, radius).fill({ color: 0xffffff })
  return renderer.generateTexture({ target: g, resolution: 2 })
}

function shardTexture(PIXI, renderer) {
  const g = new PIXI.Graphics()
    .poly([0, -6, 3, 0, 0, 7, -2.5, 1])
    .fill({ color: 0xffffff })
  return renderer.generateTexture({ target: g, resolution: 2 })
}

function puckTexture(PIXI, renderer) {
  const g = new PIXI.Graphics()
    .ellipse(0, 3, 13, 5).fill({ color: 0x0b0f14 })
    .rect(-13, -2, 26, 5).fill({ color: 0x0b0f14 })
    .ellipse(0, -2, 13, 5).fill({ color: 0x1f2937 })
    .ellipse(0, -2, 8, 3).stroke({ width: 1, color: 0x374151 })
  return renderer.generateTexture({ target: g, resolution: 2 })
}

// ─── Snöande iskristaller i ett element ───────────────────────────────────────

export function mountIceSnow(el, { count: countOpt = 34 } = {}) {
  let count = countOpt
  if (!el || !effectsEnabled()) return () => {}
  const calm = reducedMotion()
  if (calm) count = Math.round(count * 0.6)
  let destroyed = false
  let app = null

  loadPixi().then(async (PIXI) => {
    if (destroyed) return
    app = new PIXI.Application()
    await app.init({ backgroundAlpha: 0, resizeTo: el, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) })
    if (destroyed) { app.destroy(true); return }
    Object.assign(app.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' })
    el.prepend(app.canvas)

    const crystal = crystalTexture(PIXI, app.renderer)
    const dot = dotTexture(PIXI, app.renderer, 2)
    const flakes = []
    for (let i = 0; i < count; i++) {
      const speed = calm ? 0.4 : 1
      const isCrystal = Math.random() < 0.45
      const s = new PIXI.Sprite(isCrystal ? crystal : dot)
      s.anchor.set(0.5)
      const depth = 0.35 + Math.random() * 0.65 // 0.35 = långt bort, 1 = nära
      s.scale.set((isCrystal ? 0.7 : 0.8) * depth + 0.2)
      s.alpha = 0.25 + depth * 0.5
      s.x = Math.random() * app.screen.width
      s.y = Math.random() * app.screen.height
      flakes.push({ s, speed, depth, sway: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.02 })
      app.stage.addChild(s)
    }

    let t = 0
    app.ticker.add((tk) => {
      t += tk.deltaTime
      const w = app.screen.width, h = app.screen.height
      for (const f of flakes) {
        f.s.y += (0.25 + f.depth * 0.55) * f.speed * tk.deltaTime
        f.s.x += Math.sin(t * 0.015 + f.sway) * 0.25 * f.depth
        f.s.rotation += f.spin * tk.deltaTime
        if (f.s.y > h + 10) { f.s.y = -10; f.s.x = Math.random() * w }
        if (f.s.x < -10) f.s.x = w + 10
        if (f.s.x > w + 10) f.s.x = -10
      }
    })
  })

  return () => {
    destroyed = true
    if (app) { try { app.destroy(true, { children: true, texture: true }) } catch (e) { /* ignoreras */ } }
  }
}

// ─── Isspray + pucks över hela skärmen ────────────────────────────────────────

let burstApp = null
let burstReady = null

async function getBurstApp() {
  const PIXI = await loadPixi()
  if (burstApp) return { PIXI, app: burstApp }
  if (!burstReady) {
    burstReady = (async () => {
      const app = new PIXI.Application()
      await app.init({ backgroundAlpha: 0, resizeTo: window, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) })
      Object.assign(app.canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '9999' })
      document.body.appendChild(app.canvas)
      app.textures = {
        shard: shardTexture(PIXI, app.renderer),
        dot: dotTexture(PIXI, app.renderer, 3),
        crystal: crystalTexture(PIXI, app.renderer, 16),
        puck: puckTexture(PIXI, app.renderer),
      }
      app.particles = []
      app.ticker.add((tk) => {
        const dt = tk.deltaTime
        for (let i = app.particles.length - 1; i >= 0; i--) {
          const p = app.particles[i]
          p.life -= dt
          p.vy += p.g * dt
          p.vx *= p.drag
          p.vy *= p.drag
          p.s.x += p.vx * dt
          p.s.y += p.vy * dt
          p.s.rotation += p.vr * dt
          p.s.alpha = Math.max(0, Math.min(1, p.life / p.fade))
          if (p.life <= 0 || p.s.y > app.screen.height + 40) {
            app.stage.removeChild(p.s); p.s.destroy(); app.particles.splice(i, 1)
          }
        }
        app.canvas.style.display = app.particles.length ? 'block' : 'none'
      })
      burstApp = app
    })()
  }
  await burstReady
  return { PIXI, app: burstApp }
}

export async function iceBurst(x, y, { pucks = 3 } = {}) {
  if (!effectsEnabled()) return
  const calm = reducedMotion()
  if (calm) pucks = Math.min(pucks, 1)
  const { PIXI, app } = await getBurstApp()
  const T = app.textures
  const cx = x ?? app.screen.width / 2
  const cy = y ?? app.screen.height / 2

  const add = (tex, opts) => {
    const s = new PIXI.Sprite(tex)
    s.anchor.set(0.5)
    s.x = cx; s.y = cy
    s.tint = opts.tint ?? 0xffffff
    s.scale.set(opts.scale ?? 1)
    s.rotation = Math.random() * Math.PI * 2
    app.stage.addChild(s)
    app.particles.push({ s, life: opts.life, fade: opts.fade ?? 25, vx: opts.vx, vy: opts.vy, vr: opts.vr ?? 0, g: opts.g ?? 0.35, drag: opts.drag ?? 0.985 })
  }

  // Isspray: en solfjäder uppåt, som när en skridsko tvärbromsar
  const ice = [0xffffff, 0xe0f2fe, 0xbae6fd, 0x93c5fd]
  for (let i = 0; i < (calm ? 40 : 90); i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15
    const sp = 4 + Math.random() * 11
    const pick = Math.random()
    add(pick < 0.55 ? T.shard : pick < 0.85 ? T.dot : T.crystal, {
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      vr: (Math.random() - 0.5) * 0.3,
      scale: 0.5 + Math.random() * 0.9,
      tint: ice[(Math.random() * ice.length) | 0],
      life: 45 + Math.random() * 40, g: 0.32,
    })
  }
  // Pucks
  for (let i = 0; i < pucks; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4
    const sp = 9 + Math.random() * 5
    add(T.puck, {
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      vr: (Math.random() - 0.5) * 0.35,
      scale: 0.9 + Math.random() * 0.3,
      life: 90, fade: 20, g: 0.42, drag: 0.995,
    })
  }
}
