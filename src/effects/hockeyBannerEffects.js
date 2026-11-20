import * as PIXI from 'pixi.js';

// ─── Hockey-effekter för nedräkningsbannern (PixiJS v8) ───────────────────────
// Bokeh, kamerablixtar, parallax-snö, isdimma, isstänk efter pekaren och
// klick-fyrverkeri med studsande puckar. Portad från referenskoden (v7) till v8.

/**
 * Skapar GPU-accelererade hockey-effekter i en container.
 * Returnerar (asynkront) { celebrate, setOptions, destroy }.
 */
export async function createHockeyBannerEffects(bannerEl, userOptions = {}) {
  const options = {
    intensity: 0.7,
    speed: 1.0,
    enableBokeh: true,
    enableFlashes: true,
    enableSnow: true,
    enableFog: true,
    enableTrail: true,
    enableClickFireworks: true,
    respectReducedMotion: true,
    ...userOptions,
  };

  const prefersReducedMotion =
    options.respectReducedMotion &&
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    pointer: { active: false, x: -999, y: -999, vx: 0, vy: 0, lastX: -999, lastY: -999 },
    flashAlpha: 0,
    shakeIntensity: 0,
  };

  const pendingTimeouts = new Set();
  let destroyed = false;

  function scheduleTimeout(fn, ms) {
    const id = setTimeout(() => {
      pendingTimeouts.delete(id);
      if (!destroyed) fn();
    }, ms);
    pendingTimeouts.add(id);
  }

  // Skapa PixiJS-applikation (v8)
  const app = new PIXI.Application();
  await app.init({
    resizeTo: bannerEl,
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  const canvas = app.canvas;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '1';
  canvas.style.display = 'block';
  canvas.style.cursor = 'crosshair';
  bannerEl.appendChild(canvas);

  // Lager i djupordning (bakifrån -> framåt)
  const bokehLayer = new PIXI.Container();
  const flashPubLayer = new PIXI.Container();
  const snowBackLayer = new PIXI.Container();
  const fogLayer = new PIXI.Container();
  const snowFrontLayer = new PIXI.Container();
  const trailLayer = new PIXI.Container();
  const burstRingLayer = new PIXI.Graphics();
  burstRingLayer.blendMode = 'add';
  const burstLayer = new PIXI.Container();
  const fireworkLayer = new PIXI.Container();
  const screenFlashLayer = new PIXI.Graphics();

  app.stage.addChild(
    bokehLayer,
    flashPubLayer,
    snowBackLayer,
    fogLayer,
    snowFrontLayer,
    trailLayer,
    burstRingLayer,
    burstLayer,
    fireworkLayer,
    screenFlashLayer
  );

  // --------------------------------------------------------------------------
  // PROCEDURALA TEXTURER (inga externa bildfiler behövs)
  // --------------------------------------------------------------------------
  function createSoftGlowTexture(size = 64) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.55)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return PIXI.Texture.from(c);
  }

  function createSnowCrystalTexture(size = 64) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const half = size / 2;
    const r = size * 0.4;
    ctx.translate(half, half);
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';

    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((Math.PI / 3) * i);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -r);
      ctx.stroke();

      ctx.lineWidth = 1.6;
      const b1 = r * 0.52;
      ctx.beginPath();
      ctx.moveTo(0, -b1);
      ctx.lineTo(-r * 0.24, -b1 - r * 0.18);
      ctx.moveTo(0, -b1);
      ctx.lineTo(r * 0.24, -b1 - r * 0.18);
      ctx.stroke();

      const b2 = r * 0.78;
      ctx.beginPath();
      ctx.moveTo(0, -b2);
      ctx.lineTo(-r * 0.15, -b2 - r * 0.12);
      ctx.moveTo(0, -b2);
      ctx.lineTo(r * 0.15, -b2 - r * 0.12);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
    ctx.fill();
    return PIXI.Texture.from(c);
  }

  function createStarFlashTexture(size = 128) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const half = size / 2;

    const glow = ctx.createRadialGradient(half, half, 0, half, half, half * 0.55);
    glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
    glow.addColorStop(0.28, 'rgba(255, 255, 255, 0.55)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    const drawSpike = (angle, len, thickness) => {
      ctx.save();
      ctx.translate(half, half);
      ctx.rotate(angle);
      const g = ctx.createLinearGradient(-len, 0, len, 0);
      g.addColorStop(0, 'rgba(255, 255, 255, 0)');
      g.addColorStop(0.5, 'rgba(255, 255, 255, 0.96)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, len, thickness, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    drawSpike(0, half * 0.95, 2.4);
    drawSpike(Math.PI / 2, half * 0.95, 2.4);
    drawSpike(Math.PI / 4, half * 0.45, 1.4);
    drawSpike(-Math.PI / 4, half * 0.45, 1.4);
    return PIXI.Texture.from(c);
  }

  function createFogTexture(w = 420, h = 140) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const puffs = [
      { x: w * 0.25, y: h * 0.62, r: h * 0.52, a: 0.42 },
      { x: w * 0.48, y: h * 0.52, r: h * 0.64, a: 0.55 },
      { x: w * 0.72, y: h * 0.64, r: h * 0.5, a: 0.4 },
    ];
    puffs.forEach((p) => {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, `rgba(235, 246, 255, ${p.a})`);
      g.addColorStop(0.55, `rgba(224, 242, 254, ${p.a * 0.38})`);
      g.addColorStop(1, 'rgba(224, 242, 254, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    return PIXI.Texture.from(c);
  }

  function createSparkTexture(size = 32) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const half = size / 2;
    ctx.translate(half, half);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, half * 0.9);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.4, 'rgba(255, 255, 255, 0.72)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, half * 0.92, half * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    return PIXI.Texture.from(c);
  }

  function createBokehTexture(size = 128) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const half = size / 2;
    const r = half * 0.84;
    const g = ctx.createRadialGradient(half, half, r * 0.1, half, half, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    g.addColorStop(0.74, 'rgba(255, 255, 255, 0.42)');
    g.addColorStop(0.9, 'rgba(255, 255, 255, 0.68)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(half, half, r, 0, Math.PI * 2);
    ctx.fill();
    return PIXI.Texture.from(c);
  }

  function createPuckTexture(size = 96) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const rx = size * 0.36;
    const ry = size * 0.21;
    const thickness = size * 0.14;

    const glow = ctx.createRadialGradient(cx, cy + 2, rx * 0.3, cx, cy + 2, rx * 1.32);
    glow.addColorStop(0, 'rgba(224, 242, 254, 0.32)');
    glow.addColorStop(0.65, 'rgba(255, 255, 255, 0.10)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    const sideGrad = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
    sideGrad.addColorStop(0, '#090d16');
    sideGrad.addColorStop(0.28, '#1e293b');
    sideGrad.addColorStop(0.55, '#334155');
    sideGrad.addColorStop(0.85, '#0f172a');
    sideGrad.addColorStop(1, '#020617');
    ctx.fillStyle = sideGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + thickness * 0.5, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(cx - rx, cy - thickness * 0.5);
    ctx.ellipse(cx, cy - thickness * 0.5, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i++) {
      const px = cx + (i / 6) * rx * 0.92;
      const edgeY = Math.sqrt(Math.max(0, 1 - Math.pow((px - cx) / rx, 2))) * ry;
      ctx.beginPath();
      ctx.moveTo(px, cy - thickness * 0.5 + edgeY);
      ctx.lineTo(px, cy + thickness * 0.5 + edgeY);
      ctx.stroke();
    }

    const topGrad = ctx.createRadialGradient(cx - rx * 0.25, cy - thickness * 0.5 - ry * 0.25, 2, cx, cy - thickness * 0.5, rx);
    topGrad.addColorStop(0, '#475569');
    topGrad.addColorStop(0.45, '#1e293b');
    topGrad.addColorStop(1, '#0b1120');
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy - thickness * 0.5, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(224, 242, 254, 0.72)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy - thickness * 0.5, rx - 1, ry - 1, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(248, 250, 252, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy - thickness * 0.5, rx * 0.54, ry * 0.54, 0, 0, Math.PI * 2);
    ctx.stroke();

    return PIXI.Texture.from(c);
  }

  const textures = {
    softGlow: createSoftGlowTexture(64),
    crystal: createSnowCrystalTexture(64),
    starFlash: createStarFlashTexture(128),
    fog: createFogTexture(420, 140),
    spark: createSparkTexture(32),
    bokeh: createBokehTexture(128),
    puck: createPuckTexture(96),
  };

  // --------------------------------------------------------------------------
  // 1. BOKEH & ISSTOFT
  // --------------------------------------------------------------------------
  const bokehParticles = [];
  const BOKEH_COLORS = [0xffffff, 0xffe4e6, 0xe0f2fe, 0xfef3c7];
  for (let i = 0; i < 24; i++) {
    const sp = new PIXI.Sprite(textures.bokeh);
    sp.anchor.set(0.5);
    sp.blendMode = 'add';
    sp.scale.set(0.25 + Math.random() * 0.72);
    sp.x = Math.random() * app.screen.width;
    sp.y = Math.random() * app.screen.height;
    sp.tint = BOKEH_COLORS[Math.floor(Math.random() * BOKEH_COLORS.length)];
    const baseAlpha = 0.14 + Math.random() * 0.22;
    sp.alpha = baseAlpha;
    bokehLayer.addChild(sp);
    bokehParticles.push({
      sprite: sp,
      baseAlpha,
      vx: (Math.random() - 0.5) * 0.36,
      vy: (Math.random() - 0.5) * 0.24,
      pulseSpeed: 0.012 + Math.random() * 0.02,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // --------------------------------------------------------------------------
  // 2. KAMERABLIXTAR (PUBLIK)
  // --------------------------------------------------------------------------
  const cameraFlashes = [];
  let flashSpawnTimer = 0;

  function spawnCameraFlash() {
    const w = app.screen.width;
    const h = app.screen.height;
    const sp = new PIXI.Sprite(textures.starFlash);
    sp.anchor.set(0.5);
    sp.blendMode = 'add';

    let fx = Math.random() * w;
    const fy = 16 + Math.random() * Math.max(10, h - 32);
    if (Math.abs(fx - w * 0.5) < 120 && Math.random() < 0.55) {
      fx = Math.random() < 0.5 ? Math.random() * (w * 0.34) : w - Math.random() * (w * 0.34);
    }

    sp.x = fx;
    sp.y = fy;
    sp.rotation = (Math.random() - 0.5) * 0.4;
    const targetScale = 0.35 + Math.random() * 0.65;
    sp.scale.set(targetScale * 0.4);
    sp.alpha = 0;
    sp.tint = Math.random() > 0.2 ? 0xffffff : 0xe0f2fe;
    flashPubLayer.addChild(sp);

    cameraFlashes.push({
      sprite: sp,
      targetScale,
      age: 0,
      peakAge: 3 + Math.random() * 2.5,
      fadeSpeed: 0.055 + Math.random() * 0.055,
    });
  }

  // --------------------------------------------------------------------------
  // 3. PARALLAX-SNÖ (3 djuplager)
  // --------------------------------------------------------------------------
  const snowflakes = [];
  for (let i = 0; i < 82; i++) {
    const depth = i < 38 ? 0 : i < 66 ? 1 : 2;
    const isCrystal = depth === 2 || (depth === 1 && Math.random() > 0.45);
    const sp = new PIXI.Sprite(isCrystal ? textures.crystal : textures.softGlow);
    sp.anchor.set(0.5);
    const scale =
      depth === 0 ? 0.08 + Math.random() * 0.07 :
      depth === 1 ? 0.16 + Math.random() * 0.15 :
      0.22 + Math.random() * 0.20;
    sp.scale.set(scale);
    sp.x = Math.random() * app.screen.width;
    sp.y = Math.random() * app.screen.height;
    const baseAlpha =
      depth === 0 ? 0.24 + Math.random() * 0.22 :
      depth === 1 ? 0.45 + Math.random() * 0.28 :
      0.66 + Math.random() * 0.26;
    sp.alpha = baseAlpha;
    (depth === 0 ? snowBackLayer : snowFrontLayer).addChild(sp);

    snowflakes.push({
      sprite: sp,
      depth,
      baseAlpha,
      vy: (0.28 + depth * 0.3) * (0.75 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * 0.35,
      extraVx: 0,
      extraVy: 0,
      swayAmp: 0.25 + Math.random() * 0.45,
      swaySpeed: 0.008 + Math.random() * 0.015,
      swayPhase: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * (isCrystal ? 0.025 : 0.005),
    });
  }

  // --------------------------------------------------------------------------
  // 4. ISDIMMA
  // --------------------------------------------------------------------------
  const fogClouds = [];
  for (let i = 0; i < 7; i++) {
    const sp = new PIXI.Sprite(textures.fog);
    sp.anchor.set(0.5, 0.8);
    sp.blendMode = 'screen';
    sp.scale.set(0.9 + Math.random() * 0.7, 0.72 + Math.random() * 0.42);
    sp.x = (app.screen.width / 7) * i + Math.random() * 100;
    sp.y = app.screen.height + 16;
    const baseAlpha = 0.22 + Math.random() * 0.16;
    sp.alpha = baseAlpha;
    fogLayer.addChild(sp);
    fogClouds.push({
      sprite: sp,
      baseAlpha,
      speed: (0.22 + Math.random() * 0.34) * (i % 2 === 0 ? 1 : -0.7),
      bobPhase: Math.random() * Math.PI * 2,
    });
  }

  // --------------------------------------------------------------------------
  // 5. INTERAKTIVT ISSTÄNK (MUSSPÅR)
  // --------------------------------------------------------------------------
  const trailParticles = [];
  function spawnIceTrail(x, y, vx, vy) {
    const count = Math.max(1, Math.min(4, Math.round(1.5 * options.intensity)));
    for (let i = 0; i < count; i++) {
      const isCrystal = Math.random() > 0.55;
      const sp = new PIXI.Sprite(isCrystal ? textures.crystal : textures.softGlow);
      sp.anchor.set(0.5);
      sp.blendMode = 'add';
      sp.x = x + (Math.random() - 0.5) * 8;
      sp.y = y + (Math.random() - 0.5) * 8;
      sp.scale.set(isCrystal ? 0.12 + Math.random() * 0.16 : 0.10 + Math.random() * 0.14);
      sp.tint = Math.random() > 0.35 ? 0xffffff : 0xbae6fd;
      sp.alpha = 0.85;
      trailLayer.addChild(sp);

      trailParticles.push({
        sprite: sp,
        vx: -vx * 0.12 + (Math.random() - 0.5) * 1.4,
        vy: -vy * 0.12 + (Math.random() - 0.5) * 1.4 - 0.3,
        gravity: 0.03,
        spin: isCrystal ? (Math.random() - 0.5) * 0.12 : 0,
        life: 0.75 + Math.random() * 0.25,
        decay: 0.025 + Math.random() * 0.02,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 6. KLICK-FYRVERKERI (FÄRGSPRAKANDE GNISTOR, SNÖFLINGOR & STUDSANDE PUCKAR)
  // --------------------------------------------------------------------------
  const burstParticles = [];
  const burstPucks = [];
  const burstRings = [];
  const CLICK_COLORS = [0xffd700, 0xfef08a, 0x38bdf8, 0x22d3ee, 0xf472b6, 0x34d399, 0xfb923c, 0xc084fc, 0xffffff];
  const pickColor = (pal = CLICK_COLORS) => pal[Math.floor(Math.random() * pal.length)];

  function spawnMiniIceSpray(x, y, count = 10, accentColor = null) {
    for (let i = 0; i < count; i++) {
      const isCrystal = Math.random() > 0.55;
      const sp = new PIXI.Sprite(isCrystal ? textures.crystal : textures.spark);
      sp.anchor.set(0.5);
      sp.blendMode = 'add';
      sp.x = x;
      sp.y = y;
      const angle = -Math.PI * (0.12 + Math.random() * 0.76);
      const spd = 1.8 + Math.random() * 4.6;
      const vx = Math.cos(angle) * spd;
      const vy = Math.sin(angle) * spd;
      sp.scale.set(isCrystal ? 0.16 + Math.random() * 0.18 : 0.24 + Math.random() * 0.3);
      sp.tint = accentColor && Math.random() > 0.35 ? accentColor : Math.random() > 0.45 ? pickColor() : 0xffffff;
      if (!isCrystal) sp.rotation = Math.atan2(vy, vx);
      burstLayer.addChild(sp);

      burstParticles.push({
        sprite: sp,
        vx,
        vy,
        drag: 0.96,
        gravity: 0.09,
        life: 1.0,
        decay: 0.024 + Math.random() * 0.02,
        spin: isCrystal ? (Math.random() - 0.5) * 0.16 : 0,
        twinkle: Math.random() * Math.PI * 2,
        baseScale: sp.scale.x,
        isFlash: false,
        isStreak: !isCrystal,
      });
    }
  }

  function spawnColorfulSparks(x, y, count, power, palette) {
    for (let i = 0; i < count; i++) {
      const sp = new PIXI.Sprite(textures.spark);
      sp.anchor.set(0.5);
      sp.blendMode = 'add';
      sp.x = x + (Math.random() - 0.5) * 14;
      sp.y = y + (Math.random() - 0.5) * 10;
      const angle = Math.random() * Math.PI * 2;
      const spd = (2.4 + Math.random() * 8.8) * Math.sqrt(power);
      const vx = Math.cos(angle) * spd * 1.25;
      const vy = Math.sin(angle) * spd - 1.3;
      const scale = 0.32 + Math.random() * 0.52;
      sp.scale.set(scale);
      sp.tint = pickColor(palette);
      sp.rotation = Math.atan2(vy, vx);
      burstLayer.addChild(sp);

      burstParticles.push({
        sprite: sp,
        vx,
        vy,
        drag: 0.965 + Math.random() * 0.014,
        gravity: 0.088,
        life: 1.0,
        decay: 0.012 + Math.random() * 0.013,
        spin: 0,
        twinkle: Math.random() * Math.PI * 2,
        baseScale: scale,
        isFlash: false,
        isStreak: true,
      });
    }
  }

  function triggerClickExplosion(x, y) {
    const power = Math.max(0.75, Math.min(1.6, options.intensity * 1.25));
    const accentPalette = [pickColor(), pickColor(), pickColor(), 0xffd700, 0xffffff];

    state.flashAlpha = Math.max(state.flashAlpha, 0.22 * Math.min(1.3, power));
    state.shakeIntensity = Math.min(8.5, 5.0 * power);

    burstRings.push(
      { x, y, radius: 6, maxRadius: 130 * power, speed: 7.6, alpha: 0.92, width: 3.4, color: 0xffffff },
      { x, y, radius: 2, maxRadius: 185 * power, speed: 5.4, alpha: 0.65, width: 6.5, color: accentPalette[0] }
    );

    const flashSp = new PIXI.Sprite(textures.starFlash);
    flashSp.anchor.set(0.5);
    flashSp.blendMode = 'add';
    flashSp.x = x;
    flashSp.y = y;
    flashSp.scale.set(0.35);
    flashSp.rotation = Math.random() * Math.PI;
    burstLayer.addChild(flashSp);
    burstParticles.push({
      sprite: flashSp,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 1.0,
      decay: 0.075,
      spin: 0.04,
      twinkle: 0,
      baseScale: 1.55 * power,
      isFlash: true,
      isStreak: false,
    });

    spawnColorfulSparks(x, y, Math.round(52 * power), power, CLICK_COLORS);

    const flakeCount = Math.round(28 * power);
    for (let i = 0; i < flakeCount; i++) {
      const isCrystal = Math.random() < 0.72;
      const sp = new PIXI.Sprite(isCrystal ? textures.crystal : textures.starFlash);
      sp.anchor.set(0.5);
      sp.blendMode = 'add';
      sp.x = x + (Math.random() - 0.5) * 12;
      sp.y = y + (Math.random() - 0.5) * 12;
      const angle = (Math.PI * 2 * i) / flakeCount + (Math.random() - 0.5) * 0.35;
      const spd = (2.0 + Math.random() * 6.8) * Math.sqrt(power);
      const scale = isCrystal ? 0.22 + Math.random() * 0.36 : 0.18 + Math.random() * 0.26;
      sp.scale.set(scale);
      sp.tint = Math.random() < 0.45 ? 0xffffff : pickColor(accentPalette);
      burstLayer.addChild(sp);

      burstParticles.push({
        sprite: sp,
        vx: Math.cos(angle) * spd * 1.15,
        vy: Math.sin(angle) * spd - 1.1,
        drag: 0.948 + Math.random() * 0.022,
        gravity: 0.058,
        life: 1.0,
        decay: 0.011 + Math.random() * 0.013,
        spin: (Math.random() - 0.5) * 0.22,
        twinkle: Math.random() * Math.PI * 2,
        baseScale: scale,
        isFlash: false,
        isStreak: false,
      });
    }

    scheduleTimeout(() => {
      spawnColorfulSparks(
        x + (Math.random() - 0.5) * 28,
        y + (Math.random() - 0.5) * 18,
        Math.round(22 * power),
        power * 0.85,
        CLICK_COLORS
      );
    }, 115);

    const puckCount = power > 1.2 ? 4 : 3;
    for (let i = 0; i < puckCount; i++) {
      const sp = new PIXI.Sprite(textures.puck);
      sp.anchor.set(0.5);
      sp.x = x + (Math.random() - 0.5) * 14;
      sp.y = y + (Math.random() - 0.5) * 8;
      const spread = puckCount > 1 ? (i / (puckCount - 1)) * 2 - 1 : 0;
      const vx = spread * (4.6 + Math.random() * 2.8) + (Math.random() - 0.5) * 1.4;
      const vy = -(4.8 + Math.random() * 3.8);
      const baseScale = 0.54 + Math.random() * 0.22;
      sp.scale.set(baseScale);
      burstLayer.addChild(sp);

      burstPucks.push({
        sprite: sp,
        vx,
        vy,
        gravity: 0.23,
        rotSpeed: (vx >= 0 ? 1 : -1) * (0.14 + Math.random() * 0.14),
        tumblePhase: Math.random() * Math.PI * 2,
        tumbleSpeed: 0.18 + Math.random() * 0.12,
        baseScale,
        trailColor: pickColor(CLICK_COLORS),
        life: 1.0,
        decay: 0.008,
        bounces: 0,
        trailTimer: 0,
      });
    }

    const blastRadius = 220 * power;
    for (let i = 0; i < snowflakes.length; i++) {
      const flake = snowflakes[i];
      const dx = flake.sprite.x - x;
      const dy = flake.sprite.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < blastRadius && dist > 1) {
        const push = (1 - dist / blastRadius) * 7.5 * power;
        flake.extraVx += (dx / dist) * push;
        flake.extraVy += (dy / dist) * push - 1.2;
      }
    }
  }

  // --------------------------------------------------------------------------
  // VALFRI 00:00-FYRVERKERIFUNKTION
  // --------------------------------------------------------------------------
  const fireworks = [];
  const ZERO_COLORS = [0xffffff, 0xfef08a, 0xfca5a5, 0xef4444, 0xe0f2fe, 0xfde047];

  function spawnFireworkBurst(x, y, count = 48) {
    for (let i = 0; i < count; i++) {
      const isCrystal = Math.random() < 0.2;
      const sp = new PIXI.Sprite(isCrystal ? textures.crystal : textures.spark);
      sp.anchor.set(0.5);
      sp.blendMode = 'add';
      sp.x = x;
      sp.y = y;
      const angle = Math.random() * Math.PI * 2;
      const spd = 2.2 + Math.random() * 7.8;
      const vx = Math.cos(angle) * spd;
      const vy = Math.sin(angle) * spd - 1.2;
      sp.scale.set(isCrystal ? 0.2 + Math.random() * 0.25 : 0.34 + Math.random() * 0.52);
      sp.tint = ZERO_COLORS[Math.floor(Math.random() * ZERO_COLORS.length)];
      sp.rotation = Math.atan2(vy, vx);
      fireworkLayer.addChild(sp);

      fireworks.push({
        sprite: sp,
        vx,
        vy,
        drag: 0.968,
        gravity: 0.085,
        spin: isCrystal ? (Math.random() - 0.5) * 0.16 : 0,
        life: 1.0,
        decay: 0.011 + Math.random() * 0.012,
      });
    }
  }

  function celebrate() {
    const w = app.screen.width;
    const h = app.screen.height;
    state.flashAlpha = 0.34;
    [
      { x: w * 0.2, y: h * 0.42, delay: 0 },
      { x: w * 0.5, y: h * 0.32, delay: 90 },
      { x: w * 0.8, y: h * 0.42, delay: 180 },
      { x: w * 0.35, y: h * 0.55, delay: 340 },
      { x: w * 0.65, y: h * 0.55, delay: 440 },
    ].forEach((pt) => {
      scheduleTimeout(() => spawnFireworkBurst(pt.x, pt.y, Math.round(46 * Math.max(0.7, options.intensity))), pt.delay);
    });
  }

  // --------------------------------------------------------------------------
  // POINTER-HÄNDELSER
  // --------------------------------------------------------------------------
  function updatePointer(clientX, clientY) {
    const rect = bannerEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (state.pointer.active) {
      state.pointer.vx = Math.max(-25, Math.min(25, x - state.pointer.lastX));
      state.pointer.vy = Math.max(-25, Math.min(25, y - state.pointer.lastY));
    } else {
      state.pointer.vx = 0;
      state.pointer.vy = 0;
    }
    state.pointer.x = x;
    state.pointer.y = y;
    state.pointer.lastX = x;
    state.pointer.lastY = y;
    state.pointer.active = true;

    if (options.enableTrail && Math.hypot(state.pointer.vx, state.pointer.vy) > 1.2) {
      spawnIceTrail(x, y, state.pointer.vx, state.pointer.vy);
    }
  }

  const onPointerMove = (e) => updatePointer(e.clientX, e.clientY);
  const onPointerDown = (e) => {
    updatePointer(e.clientX, e.clientY);
    if (options.enableClickFireworks) triggerClickExplosion(state.pointer.x, state.pointer.y);
  };
  const onPointerLeave = () => {
    state.pointer.active = false;
    state.pointer.vx = 0;
    state.pointer.vy = 0;
  };

  bannerEl.addEventListener('pointermove', onPointerMove);
  bannerEl.addEventListener('pointerdown', onPointerDown);
  bannerEl.addEventListener('pointerleave', onPointerLeave);

  // --------------------------------------------------------------------------
  // ANIMATIONSLOOP
  // --------------------------------------------------------------------------
  let elapsed = 0;
  app.ticker.add((ticker) => {
    const rawDelta = ticker.deltaTime;
    const motionScale = prefersReducedMotion ? 0.25 : 1;
    const dt = rawDelta * options.speed * motionScale;
    elapsed += dt;

    const w = app.screen.width;
    const h = app.screen.height;
    const intensity = options.intensity;

    state.pointer.vx *= 0.88;
    state.pointer.vy *= 0.88;

    // 1. Bokeh
    bokehLayer.visible = options.enableBokeh;
    if (options.enableBokeh) {
      for (let i = 0; i < bokehParticles.length; i++) {
        const b = bokehParticles[i];
        b.sprite.x += b.vx * dt;
        b.sprite.y += b.vy * dt;
        const pulse = 0.65 + 0.35 * Math.sin(elapsed * b.pulseSpeed + b.phase);
        b.sprite.alpha = Math.min(0.65, b.baseAlpha * pulse * intensity);
        if (b.sprite.x > w + 65) b.sprite.x = -65;
        if (b.sprite.x < -65) b.sprite.x = w + 65;
        if (b.sprite.y > h + 65) b.sprite.y = -65;
        if (b.sprite.y < -65) b.sprite.y = h + 65;
      }
    }

    // 2. Kamerablixtar
    flashPubLayer.visible = options.enableFlashes && !prefersReducedMotion;
    if (flashPubLayer.visible) {
      flashSpawnTimer -= dt * Math.max(0.4, intensity);
      if (flashSpawnTimer <= 0) {
        spawnCameraFlash();
        if (Math.random() < 0.25) spawnCameraFlash();
        flashSpawnTimer = 16 + Math.random() * 28;
      }
    }
    for (let i = cameraFlashes.length - 1; i >= 0; i--) {
      const fl = cameraFlashes[i];
      fl.age += dt;
      if (fl.age < fl.peakAge) {
        const p = fl.age / fl.peakAge;
        fl.sprite.alpha = Math.min(1, p * 0.95 * Math.min(1.3, intensity));
        fl.sprite.scale.set(fl.targetScale * (0.45 + 0.55 * p));
      } else {
        fl.sprite.alpha -= fl.fadeSpeed * dt;
        fl.sprite.scale.x *= 0.985;
        fl.sprite.scale.y *= 0.985;
      }
      if (fl.sprite.alpha <= 0.005) {
        flashPubLayer.removeChild(fl.sprite);
        fl.sprite.destroy();
        cameraFlashes.splice(i, 1);
      }
    }

    // 3. Parallax-snö
    snowBackLayer.visible = options.enableSnow;
    snowFrontLayer.visible = options.enableSnow;
    if (options.enableSnow) {
      const windRadius = 110 * (0.85 + intensity * 0.2);
      for (let i = 0; i < snowflakes.length; i++) {
        const flake = snowflakes[i];
        const sp = flake.sprite;
        const sway = Math.sin(elapsed * flake.swaySpeed + flake.swayPhase) * flake.swayAmp;
        sp.x += (flake.vx + sway + flake.extraVx) * dt;
        sp.y += (flake.vy * (0.65 + intensity * 0.4) + flake.extraVy) * dt;
        sp.rotation += flake.rotSpeed * dt;
        sp.alpha = Math.min(1, flake.baseAlpha * (0.65 + intensity * 0.35));
        flake.extraVx *= 0.94;
        flake.extraVy *= 0.94;

        if (state.pointer.active) {
          const dx = sp.x - state.pointer.x;
          const dy = sp.y - state.pointer.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < windRadius * windRadius && distSq > 1) {
            const dist = Math.sqrt(distSq);
            const force = (1 - dist / windRadius) * (0.52 + flake.depth * 0.34) * intensity;
            const nx = dx / dist;
            const ny = dy / dist;
            flake.extraVx += (nx * 0.85 - ny * 0.32) * force + state.pointer.vx * force * 0.24;
            flake.extraVy += (ny * 0.85 + nx * 0.32) * force + state.pointer.vy * force * 0.24;
          }
        }
        if (sp.y > h + 18) { sp.y = -16; sp.x = Math.random() * w; flake.extraVx = 0; flake.extraVy = 0; }
        else if (sp.y < -22) sp.y = h + 14;
        if (sp.x > w + 22) sp.x = -18;
        if (sp.x < -22) sp.x = w + 18;
      }
    }

    // 4. Isdimma
    fogLayer.visible = options.enableFog;
    if (options.enableFog) {
      for (let i = 0; i < fogClouds.length; i++) {
        const f = fogClouds[i];
        f.sprite.x += f.speed * (0.65 + intensity * 0.35) * dt;
        f.sprite.y = h + 18 + Math.sin(elapsed * 0.015 + f.bobPhase) * 5;
        f.sprite.alpha = Math.min(0.65, f.baseAlpha * intensity);
        const margin = f.sprite.width * 0.6;
        if (f.speed > 0 && f.sprite.x > w + margin) f.sprite.x = -margin;
        else if (f.speed < 0 && f.sprite.x < -margin) f.sprite.x = w + margin;
      }
    }

    // 5. Interaktivt isstänk
    for (let i = trailParticles.length - 1; i >= 0; i--) {
      const p = trailParticles[i];
      p.vx *= 0.96;
      p.vy += p.gravity * rawDelta;
      p.sprite.x += p.vx * rawDelta;
      p.sprite.y += p.vy * rawDelta;
      p.sprite.rotation += p.spin * rawDelta;
      p.life -= p.decay * rawDelta;
      p.sprite.alpha = Math.max(0, p.life);
      if (p.life <= 0) {
        trailLayer.removeChild(p.sprite);
        p.sprite.destroy();
        trailParticles.splice(i, 1);
      }
    }

    // 6. Klick-fyrverkeri, puckar & chockvågor
    if (state.shakeIntensity > 0.15 && !prefersReducedMotion) {
      app.stage.x = (Math.random() - 0.5) * state.shakeIntensity * 2;
      app.stage.y = (Math.random() - 0.5) * state.shakeIntensity * 1.4;
      state.shakeIntensity *= Math.pow(0.82, rawDelta);
    } else if (app.stage.x !== 0 || app.stage.y !== 0) {
      state.shakeIntensity = 0;
      app.stage.x = 0;
      app.stage.y = 0;
    }

    burstRingLayer.clear();
    for (let i = burstRings.length - 1; i >= 0; i--) {
      const r = burstRings[i];
      r.radius += r.speed * rawDelta;
      const progress = r.radius / r.maxRadius;
      const alpha = r.alpha * Math.max(0, 1 - progress);
      if (progress >= 1 || alpha <= 0.01) { burstRings.splice(i, 1); continue; }
      burstRingLayer
        .circle(r.x, r.y, r.radius)
        .stroke({ width: Math.max(0.8, r.width * (1 - progress * 0.7)), color: r.color, alpha });
    }

    for (let i = burstParticles.length - 1; i >= 0; i--) {
      const p = burstParticles[i];
      p.life -= p.decay * rawDelta;
      if (p.life <= 0) { burstLayer.removeChild(p.sprite); p.sprite.destroy(); burstParticles.splice(i, 1); continue; }
      if (p.isFlash) {
        p.sprite.scale.set(p.baseScale * (1.25 - p.life * 0.75));
        p.sprite.alpha = 1 - Math.pow(1 - p.life, 2);
        p.sprite.rotation += p.spin * rawDelta;
      } else {
        p.vx *= Math.pow(p.drag, rawDelta);
        p.vy = p.vy * Math.pow(p.drag, rawDelta) + p.gravity * rawDelta;
        p.sprite.x += p.vx * rawDelta;
        p.sprite.y += p.vy * rawDelta;
        p.sprite.rotation = p.isStreak ? Math.atan2(p.vy, p.vx) : p.sprite.rotation + p.spin * rawDelta;
        const twinkle = 0.78 + 0.22 * Math.sin(elapsed * 0.35 + p.twinkle);
        p.sprite.alpha = Math.min(1, p.life * 1.25) * twinkle;
        p.sprite.scale.set(p.baseScale * (0.45 + 0.55 * Math.min(1, p.life * 1.4)));
      }
    }

    for (let i = burstPucks.length - 1; i >= 0; i--) {
      const pk = burstPucks[i];
      pk.vy += pk.gravity * rawDelta;
      pk.sprite.x += pk.vx * rawDelta;
      pk.sprite.y += pk.vy * rawDelta;
      pk.sprite.rotation += pk.rotSpeed * rawDelta;
      pk.tumblePhase += pk.tumbleSpeed * rawDelta;
      pk.sprite.scale.set(pk.baseScale, pk.baseScale * (0.78 + 0.22 * Math.abs(Math.cos(pk.tumblePhase))));

      const floorY = h - 16;
      if (pk.sprite.y > floorY && pk.vy > 0) {
        pk.sprite.y = floorY;
        pk.vy = -pk.vy * 0.56;
        pk.vx *= 0.86;
        pk.rotSpeed *= 0.82;
        if (pk.bounces < 2 && Math.abs(pk.vy) > 1.2) spawnMiniIceSpray(pk.sprite.x, floorY + 4, 10, pk.trailColor);
        pk.bounces += 1;
      }
      if ((pk.sprite.x < 16 && pk.vx < 0) || (pk.sprite.x > w - 16 && pk.vx > 0)) {
        pk.vx = -pk.vx * 0.72;
        spawnMiniIceSpray(pk.sprite.x, pk.sprite.y, 7, pk.trailColor);
      }

      pk.trailTimer -= rawDelta;
      if (pk.trailTimer <= 0 && pk.life > 0.25 && Math.hypot(pk.vx, pk.vy) > 1.5) {
        pk.trailTimer = 1.6;
        const isSpark = Math.random() > 0.35;
        const trailSp = new PIXI.Sprite(isSpark ? textures.spark : textures.crystal);
        trailSp.anchor.set(0.5);
        trailSp.blendMode = 'add';
        trailSp.x = pk.sprite.x + (Math.random() - 0.5) * 6;
        trailSp.y = pk.sprite.y + (Math.random() - 0.5) * 6;
        trailSp.scale.set(isSpark ? 0.22 + Math.random() * 0.16 : 0.14 + Math.random() * 0.12);
        trailSp.tint = Math.random() > 0.25 ? pk.trailColor : 0xffffff;
        burstLayer.addChild(trailSp);
        burstParticles.push({
          sprite: trailSp,
          vx: -pk.vx * 0.14 + (Math.random() - 0.5) * 0.8,
          vy: -pk.vy * 0.14 + (Math.random() - 0.5) * 0.8,
          drag: 0.93,
          gravity: 0.03,
          life: 0.75,
          decay: 0.032,
          spin: isSpark ? 0 : 0.06,
          twinkle: 0,
          baseScale: trailSp.scale.x,
          isFlash: false,
          isStreak: isSpark,
        });
      }

      pk.life -= pk.decay * rawDelta;
      pk.sprite.alpha = Math.min(1, pk.life * 2.4);
      if (pk.life <= 0) { burstLayer.removeChild(pk.sprite); pk.sprite.destroy(); burstPucks.splice(i, 1); }
    }

    // 00:00-fyrverkeri
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const p = fireworks[i];
      p.vx *= Math.pow(p.drag, rawDelta);
      p.vy = p.vy * Math.pow(p.drag, rawDelta) + p.gravity * rawDelta;
      p.sprite.x += p.vx * rawDelta;
      p.sprite.y += p.vy * rawDelta;
      p.sprite.rotation = p.spin !== 0 ? p.sprite.rotation + p.spin * rawDelta : Math.atan2(p.vy, p.vx);
      p.life -= p.decay * rawDelta;
      p.sprite.alpha = Math.max(0, p.life);
      if (p.life <= 0) { fireworkLayer.removeChild(p.sprite); p.sprite.destroy(); fireworks.splice(i, 1); }
    }

    // Skärmblixt
    if (state.flashAlpha > 0.005) {
      state.flashAlpha *= Math.pow(0.88, rawDelta);
      screenFlashLayer.clear();
      screenFlashLayer.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: state.flashAlpha });
    } else if (state.flashAlpha !== 0) {
      state.flashAlpha = 0;
      screenFlashLayer.clear();
    }
  });

  // Responsiv resize
  const handleResize = () => {
    if (!bannerEl.clientWidth || !bannerEl.clientHeight) return;
    app.resize();
    fogClouds.forEach((f) => { f.sprite.y = app.screen.height + 18; });
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
  if (ro) ro.observe(bannerEl);

  return {
    celebrate,
    setOptions(next) {
      Object.assign(options, next);
    },
    destroy() {
      destroyed = true;
      pendingTimeouts.forEach((id) => clearTimeout(id));
      pendingTimeouts.clear();
      if (ro) ro.disconnect();
      bannerEl.removeEventListener('pointermove', onPointerMove);
      bannerEl.removeEventListener('pointerdown', onPointerDown);
      bannerEl.removeEventListener('pointerleave', onPointerLeave);
      app.destroy(true, { children: true, texture: true, textureSource: true });
    },
  };
}
