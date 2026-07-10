// renderer/scenes.js — Atmospheric biome backgrounds (parallax, fog, light rays)
// Cel-shaded premium backgrounds with 3-plane parallax, animated light rays, environmental particles
import { fastSin, fastCos } from '../engine/wasm_bridge.js';
import { getBattleBg } from '../engine/assets.js';

// ─── Generic helpers ─────────────────────────────────────────────────────

// Module-level gradient cache: gradients are position-bound to a context, so we
// key by (ctx → key → {w,h,grad}) and rebuild only when the canvas resizes.
// This eliminates per-call createLinearGradient churn for static skies etc.
const _gradCache = new WeakMap();

function gradCached(ctx, key, x1, y1, x2, y2, stops) {
  let m = _gradCache.get(ctx);
  if (!m) { m = new Map(); _gradCache.set(ctx, m); }
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const e = m.get(key);
  if (e && e.w === W && e.h === H) return e.grad;
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  for (const s of stops) g.addColorStop(s[0], s[1]);
  m.set(key, { w: W, h: H, grad: g });
  return g;
}

function grad(ctx, x1, y1, x2, y2, stops) {
  // Stable key from geometry + stop colors so identical gradients are reused.
  const key = `${x1},${y1},${x2},${y2}|${stops.map(s => s[0] + s[1]).join(',')}`;
  return gradCached(ctx, key, x1, y1, x2, y2, stops);
}

function drawMountains(ctx, W, H, color, alt = 0.6, layer = 0) {
  const off = layer * 20;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 12) {
    const y = H * (1 - alt) + fastSin(x * 0.003 + off) * 40
      + fastSin(x * 0.008 + off * 0.5 + 1.3) * 20 + fastSin(x * 0.015 + 0.7) * 8;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}

function drawTrees(ctx, W, H, count, color, trunkColor, sway = 0) {
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const tx = (W / count) * i + fastSin(i * 2.7) * 30 + 20;
    const ty = H - 60 - fastSin(i * 1.3) * 30;
    // Trunk
    ctx.fillStyle = trunkColor;
    ctx.fillRect(tx - 3, ty - 10, 6, 60);
    // Canopy
    ctx.fillStyle = color;
    for (let j = 0; j < 3; j++) {
      const cx = tx + fastSin(i * 0.7 + j * 2.1) * 14 + fastSin(sway * 0.02 + j) * 3;
      const cy = ty - 15 + j * 8;
      ctx.beginPath(); ctx.arc(cx, cy, 16 - j * 3, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawStars(ctx, W, H, count, frame = 0) {
  // Batch: single beginPath, single fill for all stars (5-10x fewer draw calls)
  ctx.save();
  const f5 = frame * 0.005;
  for (let i = 0; i < count; i++) {
    const sx = (i * 107.5 + i * i * 3.13) % W;
    const sy = (i * 73.1 + i * 7.7) % (H * 0.6);
    const twinkle = 0.3 + 0.7 * fastSin(f5 + i * 2.3);
    const r = Math.max(0.3, 0.5 + fastSin(i * 0.9));
    ctx.globalAlpha = twinkle * 0.6;
    ctx.fillStyle = '#fffef0';
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawLightRays(ctx, W, H, color, time = 0) {
  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 4; i++) {
    const angle = 0.3 + i * 0.05 + fastSin(time * 0.003 + i) * 0.04;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(W * (0.2 + i * 0.2), 0);
    ctx.lineTo(fastCos(angle) * W * 0.8 + W * (0.05 + i * 0.25), H + 40);
    ctx.lineTo(fastCos(angle + 0.08) * W * 0.8 + W * (0.07 + i * 0.23), H + 40);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ─── Enhanced God Rays (volumetric light shafts) ───────────────────────

function drawGodRays(ctx, W, H, originX, originY, color, time = 0, count = 6) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const t15 = time * 0.0015;
  const t3 = time * 0.003;
  for (let i = 0; i < count; i++) {
    const baseAngle = (i / count) * 1.885 - 0.942;
    const angle = baseAngle + fastSin(t15 + i * 1.7) * 0.06;
    const len = H * (1.2 + fastSin(i * 0.8) * 0.3);
    const width = 15 + fastSin(i * 1.3) * 8;
    const flicker = 0.03 + 0.02 * fastSin(t3 + i * 2.1);
    const cosA = fastCos(angle);
    const sinA = fastSin(angle);
    // Gradients cached per ray index (geometry is frame-independent; subtle flicker freezes)
    const g = gradCached(ctx, 'godray_' + i, originX, originY,
      originX + cosA * len, originY + sinA * len, [
        [0, `rgba(155,89,182,${(flicker * 1.5).toFixed(3)})`],
        [0.3, `rgba(155,89,182,${flicker.toFixed(3)})`],
        [1, 'rgba(0,0,0,0)']
      ]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(originX - width * 0.3, originY);
    ctx.lineTo(originX + cosA * len - width, originY + sinA * len);
    ctx.lineTo(originX + cosA * len + width, originY + sinA * len);
    ctx.lineTo(originX + width * 0.3, originY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ─── Weather overlay system ─────────────────────────────────────────────
// Supported: 'rain', 'snow', 'sandstorm', 'embers', 'none'

const _weatherParticles = {};

function initWeather(type, W, H) {
  if (!_weatherParticles[type] || _weatherParticles[type]._w !== W) {
    _weatherParticles[type] = { _w: W, _h: H, drops: [] };
    const count = type === 'rain' ? 120 : type === 'snow' ? 80 : type === 'sandstorm' ? 60 : 40;
    for (let i = 0; i < count; i++) {
      _weatherParticles[type].drops.push({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: 2 + Math.random() * 6,
        size: 1 + Math.random() * 2,
        wobble: Math.random() * Math.PI * 2,
        opacity: 0.2 + Math.random() * 0.5,
      });
    }
  }
}

// Offscreen half-res weather cache. The moving particle sets are precomputed once
// (initWeather) and re-rendered into a small offscreen canvas only every few frames,
// then blitted (scaled) to the main context — avoiding 60-120 stroke() calls per frame.
const _weatherCache = {};
const _WEATHER_THROTTLE = 3;

function _renderWeather(ctx, W, H, frame, type) {
  const t = frame * 0.001;
  if (type === 'rain') {
    initWeather('rain', W, H);
    const drops = _weatherParticles.rain.drops;
    ctx.strokeStyle = 'rgba(150,180,220,0.35)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (const d of drops) {
      d.y += d.speed * 3;
      d.x += fastSin(d.wobble + t) * 0.5;
      if (d.y > H) { d.y = -10; d.x = Math.random() * W; }
      const len = 8 + d.speed * 2;
      ctx.globalAlpha = d.opacity * 0.4;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 1, d.y + len);
      ctx.stroke();
    }
    // Splash ripples on ground
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#a0b8d0';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const rx = (i * 137 + frame * 2) % W;
      const ry = H * 0.75 + fastSin(i * 1.3) * 20;
      const rs = 3 + ((frame + i * 7) % 30) * 0.3;
      ctx.beginPath(); ctx.ellipse(rx, ry, rs, rs * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (type === 'snow') {
    initWeather('snow', W, H);
    const drops = _weatherParticles.snow.drops;
    for (const d of drops) {
      d.y += d.speed * 0.6;
      d.x += fastSin(d.wobble + t * 0.5) * 1.2;
      if (d.y > H) { d.y = -5; d.x = Math.random() * W; }
      ctx.globalAlpha = d.opacity * 0.6;
      ctx.fillStyle = '#e8f0ff';
      ctx.shadowColor = '#c0d8ff'; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.size * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  } else if (type === 'sandstorm') {
    initWeather('sandstorm', W, H);
    const drops = _weatherParticles.sandstorm.drops;
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#c8a060';
    for (const d of drops) {
      d.x += d.speed * 2;
      d.y += fastSin(d.wobble + t) * 1.5;
      if (d.x > W + 20) { d.x = -20; d.y = Math.random() * H; }
      const stretch = 4 + d.speed * 3;
      ctx.fillRect(d.x, d.y, stretch, d.size);
    }
    // Horizontal haze bands
    ctx.globalAlpha = 0.04;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#d4a860';
      ctx.fillRect(0, H * (0.3 + i * 0.12) + fastSin(t * 0.8 + i) * 8, W, 20);
    }
  } else if (type === 'embers') {
    initWeather('embers', W, H);
    const drops = _weatherParticles.embers.drops;
    for (const d of drops) {
      d.y -= d.speed * 0.8;
      d.x += fastSin(d.wobble + t * 0.7) * 0.8;
      if (d.y < -10) { d.y = H + 10; d.x = Math.random() * W; }
      const glow = d.opacity * (0.5 + 0.5 * fastSin(frame * 0.04 + d.wobble));
      ctx.globalAlpha = glow;
      ctx.fillStyle = d.size > 2 ? '#ff6030' : '#f1c40f';
      ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}

export function drawWeatherOverlay(ctx, W, H, frame, type = 'none') {
  if (!type || type === 'none') return;
  const w2 = Math.max(1, W >> 1), h2 = Math.max(1, H >> 1);
  let entry = _weatherCache[type];
  if (!entry || entry.w !== w2 || entry.h !== h2) {
    const c = document.createElement('canvas');
    c.width = w2; c.height = h2;
    entry = _weatherCache[type] = { canvas: c, w: w2, h: h2, lastFrame: -999 };
  }
  // Only re-render the half-res buffer every few frames; blit every call.
  if (frame - entry.lastFrame >= _WEATHER_THROTTLE || entry.lastFrame < 0) {
    const octx = entry.canvas.getContext('2d');
    octx.clearRect(0, 0, w2, h2);
    _renderWeather(octx, w2, h2, frame, type);
    entry.lastFrame = frame;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 1;
  ctx.drawImage(entry.canvas, 0, 0, w2, h2, 0, 0, W, H);
  ctx.restore();
}

// Returns the weather type for a given biome
export function getBiomeWeather(biome) {
  switch (biome) {
    case 'desert': return 'sandstorm';
    case 'cave': return 'embers';
    case 'crystal_world': return 'embers';
    case 'void': return 'embers';
    case 'forest': return 'rain';
    case 'plains': return 'rain';
    case 'town_lindblum': return 'rain';
    default: return 'none';
  }
}

// ─── Ambient field particles ─────────────────────────────────────────────
const _ambientParticles = {};

function initAmbient(type, W, H) {
  if (_ambientParticles[type] && _ambientParticles[type].w === W && _ambientParticles[type].h === H) return;
  const count = type === 'fireflies' ? 30 : type === 'dust' ? 40 : type === 'mist' ? 20 : type === 'pollen' ? 25 : 0;
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: type === 'fireflies' ? 1.5 + Math.random() * 2 : 1 + Math.random() * 2,
      speed: type === 'fireflies' ? 0.2 + Math.random() * 0.4 : 0.1 + Math.random() * 0.3,
      drift: (Math.random() - 0.5) * 0.5,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.01 + Math.random() * 0.03,
      opacity: 0.2 + Math.random() * 0.5,
    });
  }
  _ambientParticles[type] = { drops: particles, w: W, h: H };
}

export function drawAmbientParticles(ctx, W, H, frame, biome) {
  const t = frame * 0.001;
  // Forest: fireflies — batched into 2 paths (glow + core) to avoid per-particle state changes
  if (biome === 'forest' || biome === 'plains') {
    initAmbient('fireflies', W, H);
    const drops = _ambientParticles.fireflies.drops;
    const glows = [], cores = [];
    for (const d of drops) {
      d.phase += d.phaseSpeed;
      d.x += fastSin(d.phase) * d.speed * 0.5 + d.drift * 0.3;
      d.y += fastCos(d.phase * 0.7) * d.speed * 0.3;
      if (d.x < -10) d.x = W + 10;
      if (d.x > W + 10) d.x = -10;
      if (d.y < -10) d.y = H + 10;
      if (d.y > H + 10) d.y = -10;
      const glow = d.opacity * (0.4 + 0.6 * fastSin(d.phase * 2));
      glows.push([d.x, d.y, d.size * 4, glow * 0.3]);
      cores.push([d.x, d.y, d.size, glow]);
    }
    ctx.save();
    ctx.fillStyle = '#a0e060';
    ctx.beginPath();
    for (const [x, y, r, a] of glows) { ctx.globalAlpha = a; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832); }
    ctx.fill();
    ctx.fillStyle = '#d0ff80';
    ctx.beginPath();
    for (const [x, y, r, a] of cores) { ctx.globalAlpha = a; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832); }
    ctx.fill();
    ctx.restore();
  }
  // Desert: dust motes — single batched path
  if (biome === 'desert') {
    initAmbient('dust', W, H);
    const drops = _ambientParticles.dust.drops;
    ctx.save();
    ctx.fillStyle = '#d4a860';
    ctx.beginPath();
    for (const d of drops) {
      d.x += d.speed * 0.8;
      d.y += fastSin(d.phase + t) * 0.5;
      d.phase += d.phaseSpeed;
      if (d.x > W + 10) { d.x = -10; d.y = Math.random() * H; }
      ctx.globalAlpha = d.opacity * 0.25;
      ctx.moveTo(d.x + d.size, d.y);
      ctx.arc(d.x, d.y, d.size, 0, 6.2832);
    }
    ctx.fill();
    ctx.restore();
  }
  // Cave / Crystal: mist wisps — single batched path
  if (biome === 'cave' || biome === 'crystal_world' || biome === 'void') {
    initAmbient('mist', W, H);
    const drops = _ambientParticles.mist.drops;
    ctx.save();
    ctx.fillStyle = biome === 'crystal_world' ? '#a0c0ff' : '#e0e8f0';
    ctx.beginPath();
    for (const d of drops) {
      d.phase += d.phaseSpeed;
      d.x += fastSin(d.phase) * d.speed;
      d.y -= d.speed * 0.2;
      if (d.y < -20) { d.y = H + 20; d.x = Math.random() * W; }
      const alpha = d.opacity * (0.15 + 0.1 * fastSin(d.phase));
      ctx.globalAlpha = alpha;
      const rx = d.size * 4, ry = d.size * 2, rot = fastSin(d.phase) * 0.5;
      ctx.ellipse(d.x, d.y, rx, ry, rot, 0, 6.2832);
    }
    ctx.fill();
    ctx.restore();
  }
  // Magic tree: pollen / spores — single batched path
  if (biome === 'magic_tree') {
    initAmbient('pollen', W, H);
    const drops = _ambientParticles.pollen.drops;
    ctx.save();
    ctx.fillStyle = '#f0d060';
    ctx.beginPath();
    for (const d of drops) {
      d.phase += d.phaseSpeed;
      d.x += fastSin(d.phase) * d.speed * 0.4;
      d.y -= d.speed * 0.5;
      if (d.y < -10) { d.y = H + 10; d.x = Math.random() * W; }
      const glow = d.opacity * (0.3 + 0.3 * fastSin(d.phase * 1.5));
      ctx.globalAlpha = glow;
      ctx.moveTo(d.x + d.size, d.y);
      ctx.arc(d.x, d.y, d.size, 0, 6.2832);
    }
    ctx.fill();
    ctx.restore();
  }
}

function drawFog(ctx, W, H, color, time = 0) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  const ox = fastSin(time * 0.005) * 30;
  const ox2 = fastCos(time * 0.007) * 40;
  ctx.beginPath(); ctx.moveTo(0, H * 0.75);
  for (let x = 0; x <= W; x += 6) {
    const y = H * 0.72 + fastSin(x * 0.02 + ox) * 8 + fastSin(x * 0.04 + ox2) * 4;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ─── Biome backgrounds ──────────────────────────────────────────────────

function bgPrevillage(ctx, W, H, frame = 0) {
  // Sky gradient
  const sky = grad(ctx, 0, 0, 0, H, [[0,'#1a1a3e'],[0.4,'#2d3a6a'],[0.7,'#4a6a9a'],[1,'#6a8aaa']]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  drawStars(ctx, W, H, 120, frame);
  // Moon
  ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.arc(W*0.78, H*0.15, 35, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#f0e8d8'; ctx.beginPath(); ctx.arc(W*0.78-12, H*0.15-8, 30, 0, Math.PI*2); ctx.fill();
  drawLightRays(ctx, W, H, '#a0c0f0', frame);
  // Mountains (3 layers)
  drawMountains(ctx, W, H, '#1a1a30', 0.55, 0);
  drawMountains(ctx, W, H, '#252545', 0.50, 1);
  drawMountains(ctx, W, H, '#30305a', 0.42, 2);
  // Ground
  ctx.fillStyle = grad(ctx, 0, H*0.72, 0, H, [[0,'#2d3a1a'],[1,'#1a2010']]);
  ctx.fillRect(0, H*0.70, W, H*0.3);
  // Path
  ctx.fillStyle = '#3a3018'; ctx.fillRect(W*0.35, H*0.68, W*0.3, H*0.35);
  // Fence posts
  ctx.strokeStyle = '#4a3a1a'; ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const fx = W*0.2 + i * (W*0.08);
    const fy = H*0.68;
    ctx.strokeRect(fx, fy, 3, 20);
    ctx.moveTo(fx-5, fy+5); ctx.lineTo(fx+8, fy+5);
  }
  ctx.stroke();
  // Cottages
  for (let i = 0; i < 4; i++) {
    const cx = W*0.1 + i * W*0.25;
    const cy = H*0.58;
    // Roof
    ctx.fillStyle = '#5a3a1a'; ctx.beginPath();
    ctx.moveTo(cx-20, cy); ctx.lineTo(cx, cy-18); ctx.lineTo(cx+20, cy); ctx.closePath(); ctx.fill();
    // Walls
    ctx.fillStyle = '#6a5a3a'; ctx.fillRect(cx-14, cy, 28, 24);
    // Window glow
    ctx.fillStyle = `rgba(241,196,15,${0.3 + 0.2 * fastSin(frame*0.02 + i)})`;
    ctx.fillRect(cx-6, cy+6, 4, 4);
    ctx.fillRect(cx+2, cy+6, 4, 4);
  }
  drawFog(ctx, W, H, '#a0b8d0', frame);
}

function bgPlains(ctx, W, H, frame = 0) {
  const sky = grad(ctx, 0, 0, 0, H, [[0,'#4a90d0'],[0.5,'#70b8e0'],[0.7,'#90d8a0'],[1,'#b0e8b0']]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // Sun
  ctx.fillStyle = '#fef4d0'; ctx.beginPath(); ctx.arc(W*0.85, H*0.1, 50, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff8e0'; ctx.beginPath(); ctx.arc(W*0.85, H*0.1, 38, 0, Math.PI*2); ctx.fill();
  drawLightRays(ctx, W, H, '#fef4d0', frame);
  // Clouds
  ctx.fillStyle = 'rgba(200,220,240,0.35)';
  for (let i = 0; i < 4; i++) {
    const cx = (W * 0.18 * i + fastSin(frame * 0.003 + i * 1.5) * 40 + 30) % (W + 60) - 30;
    const cy = H * (0.05 + i * 0.04);
    ctx.beginPath(); ctx.arc(cx, cy, 28 + i * 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+16, cy-6, 24, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx-14, cy+2, 20, 0, Math.PI*2); ctx.fill();
  }
  // Distant mountains
  drawMountains(ctx, W, H, '#5a8a5a', 0.45, 0);
  drawMountains(ctx, W, H, '#4a7a4a', 0.38, 1);
  // Hills
  ctx.fillStyle = '#6aaa5a';
  ctx.beginPath(); ctx.moveTo(0, H*0.7);
  for (let x = 0; x <= W; x += 6) {
    ctx.lineTo(x, H*0.65 + fastSin(x*0.01) * 30 + fastSin(x*0.025) * 12);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  // Grass layer
  ctx.fillStyle = '#5a9a4a';
  ctx.beginPath(); ctx.moveTo(0, H*0.73);
  for (let x = 0; x <= W; x += 4) {
    ctx.lineTo(x, H*0.70 + fastSin(x*0.015+0.5) * 12 + fastSin(x*0.03) * 6);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  // Grass blades
  ctx.strokeStyle = '#4a8a3a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const gx = (i * 47.3) % W;
    const gy = H * 0.70 + fastSin(gx * 0.015) * 12;
    const sway = fastSin(frame * 0.02 + i * 0.7) * 4;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx + sway, gy - 12, gx + sway * 0.5, gy - 20); ctx.stroke();
  }
  drawTrees(ctx, W, H, 6, '#3a7a2a', '#3a2a1a', frame);
  drawFog(ctx, W, H, '#b0d8b0', frame);
}

function bgForest(ctx, W, H, frame = 0) {
  const sky = grad(ctx, 0, 0, 0, H, [[0,'#1a3a1a'],[0.4,'#2a4a2a'],[0.7,'#3a5a2a'],[1,'#4a6a3a']]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // Light shafts through canopy
  drawLightRays(ctx, W, H, '#80d080', frame);
  // Far trees
  for (let i = 0; i < 8; i++) {
    const tx = (W / 7) * i - 20;
    const sway = fastSin(frame * 0.01 + i * 0.7) * 8;
    ctx.fillStyle = '#1a3a1a';
    ctx.beginPath(); ctx.arc(tx + sway, H * 0.4 + fastSin(i * 0.5) * 30, 50 + fastSin(i * 0.9) * 15, 0, Math.PI * 2); ctx.fill();
  }
  // Mid trees
  for (let i = 0; i < 6; i++) {
    const tx = W * 0.1 + i * W * 0.16;
    const sway = fastSin(frame * 0.015 + i * 1.1) * 6;
    ctx.fillStyle = '#2a4a1a';
    ctx.beginPath(); ctx.arc(tx + sway, H * 0.5 + 10, 40 + fastSin(i) * 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(tx - 4, H * 0.5 + 8, 8, 40);
  }
  // Ground with leaf layer
  ctx.fillStyle = '#3a5a2a';
  ctx.beginPath(); ctx.moveTo(0, H * 0.65);
  for (let x = 0; x <= W; x += 4) {
    ctx.lineTo(x, H * 0.62 + fastSin(x * 0.02) * 10 + fastSin(x * 0.05) * 4);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a4a1a';
  ctx.beginPath(); ctx.moveTo(0, H * 0.68);
  for (let x = 0; x <= W; x += 4) {
    ctx.lineTo(x, H * 0.65 + fastSin(x * 0.025 + 1) * 8 + fastSin(x * 0.06) * 3);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  // Fireflies
  for (let i = 0; i < 20; i++) {
    const fx = (i * 83.7 + i * i * 2.1) % W;
    const fy = H * 0.4 + (i * 61.3) % (H * 0.35);
    const fa = 0.3 + 0.7 * fastSin(frame * 0.04 + i * 5.7);
    ctx.fillStyle = `rgba(200,255,100,${fa * 0.5})`;
    ctx.beginPath(); ctx.arc(fx, fy, 2 + fastSin(i) * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  drawFog(ctx, W, H, '#4a6a3a', frame);
}

function bgCave(ctx, W, H, frame = 0) {
  const dark = grad(ctx, 0, 0, 0, H, [[0,'#0a0a12'],[0.3,'#14141e'],[0.7,'#1e1e2a'],[1,'#2a1a1a']]);
  ctx.fillStyle = dark; ctx.fillRect(0, 0, W, H);
  // Stalactites
  ctx.fillStyle = '#1a1a2a';
  for (let i = 0; i < 10; i++) {
    const sx = (W / 9) * i + fastSin(i * 1.3) * 20;
    const sh = 40 + fastSin(i * 0.7) * 25;
    ctx.beginPath(); ctx.moveTo(sx - 12, 0); ctx.lineTo(sx, sh); ctx.lineTo(sx + 12, 0); ctx.closePath(); ctx.fill();
  }
  // Crystal clusters (glowing)
  for (let i = 0; i < 6; i++) {
    const cx = W * 0.1 + i * W * 0.16;
    const cy = H * 0.55 + fastSin(i * 1.1) * 30;
    const glow = 0.4 + 0.6 * fastSin(frame * 0.03 + i * 1.7);
    // Glow aura
    ctx.fillStyle = `rgba(100,200,255,${0.08 * glow})`;
    ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(100,200,255,${0.15 * glow})`;
    ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2); ctx.fill();
    // Crystal shapes
    ctx.fillStyle = '#50a8d0';
    ctx.beginPath(); ctx.moveTo(cx, cy - 30); ctx.lineTo(cx - 6, cy); ctx.lineTo(cx, cy + 8); ctx.lineTo(cx + 6, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#80c8f0';
    ctx.beginPath(); ctx.moveTo(cx - 5, cy - 20); ctx.lineTo(cx - 10, cy + 4); ctx.lineTo(cx - 5, cy + 10); ctx.lineTo(cx - 2, cy + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a0d8ff';
    ctx.beginPath(); ctx.moveTo(cx + 4, cy - 22); ctx.lineTo(cx + 8, cy + 2); ctx.lineTo(cx + 4, cy + 8); ctx.lineTo(cx + 1, cy); ctx.closePath(); ctx.fill();
  }
  // Ground
  ctx.fillStyle = '#1e1e28';
  ctx.beginPath(); ctx.moveTo(0, H * 0.65);
  for (let x = 0; x <= W; x += 4) {
    ctx.lineTo(x, H * 0.62 + fastSin(x * 0.015) * 8);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  // Lava crack
  ctx.fillStyle = `rgba(200,80,0,${0.3 + 0.2 * fastSin(frame * 0.02)})`;
  ctx.beginPath(); ctx.moveTo(0, H * 0.8);
  for (let x = 0; x <= W; x += 4) {
    ctx.lineTo(x, H * 0.78 + fastSin(x * 0.03) * 4);
  }
  ctx.lineTo(W, H * 0.82); ctx.lineTo(0, H * 0.84); ctx.closePath(); ctx.fill();
  // Floating particles
  for (let i = 0; i < 15; i++) {
    const px = (i * 97.3 + frame * 0.2 * i) % W;
    const py = (H * 0.2 + (i * 73.1 + frame * 0.5) % (H * 0.5));
    ctx.fillStyle = `rgba(200,220,255,${0.08 + fastSin(frame * 0.02 + i) * 0.05})`;
    ctx.beginPath(); ctx.arc(px, py, 1.5 + fastSin(i) * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  drawFog(ctx, W, H, '#202030', frame);
}

function bgPalace(ctx, W, H, frame = 0) {
  const sky = grad(ctx, 0, 0, 0, H, [[0,'#1a1040'],[0.3,'#2a2060'],[0.6,'#4a30a0'],[1,'#6a40c0']]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  drawStars(ctx, W, H, 100, frame);
  // Distant spires
  ctx.fillStyle = '#1a1050';
  for (let i = 0; i < 5; i++) {
    const sx = W * 0.1 + i * W * 0.2;
    ctx.beginPath();
    ctx.moveTo(sx - 20, H * 0.35);
    ctx.lineTo(sx, H * 0.1);
    ctx.lineTo(sx + 20, H * 0.35);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(sx - 18, H * 0.35, 36, H * 0.2);
  }
  // Palace main structure
  ctx.fillStyle = '#2a2080';
  ctx.fillRect(W * 0.2, H * 0.3, W * 0.6, H * 0.5);
  // Columns
  for (let i = 0; i < 6; i++) {
    const cx = W * 0.2 + i * (W * 0.6 / 5);
    ctx.fillStyle = '#3a30a0';
    ctx.fillRect(cx - 4, H * 0.3, 8, H * 0.35);
    ctx.fillStyle = '#4a40c0';
    ctx.fillRect(cx - 2, H * 0.3, 2, H * 0.35);
  }
  // Archway
  ctx.fillStyle = '#1a1060';
  ctx.beginPath(); ctx.moveTo(W * 0.4, H * 0.65); ctx.arc(W * 0.5, H * 0.65, W * 0.1, Math.PI, 0); ctx.lineTo(W * 0.6, H * 0.65); ctx.closePath(); ctx.fill();
  // Windows (glowing)
  for (let i = 0; i < 6; i++) {
    const wx = W * 0.25 + i * (W * 0.5 / 5);
    const wy = H * 0.38;
    ctx.fillStyle = `rgba(241,196,15,${0.3 + 0.2 * fastSin(frame * 0.015 + i)})`;
    ctx.fillRect(wx - 4, wy, 4, 10);
    // Window arch
    ctx.strokeStyle = '#4a40b0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(wx - 4, wy); ctx.arc(wx - 2, wy, 2, Math.PI, 0); ctx.stroke();
  }
  // Ground
  ctx.fillStyle = '#1a1050';
  ctx.fillRect(0, H * 0.78, W, H * 0.22);
  // Stones
  ctx.strokeStyle = '#2a2060'; ctx.lineWidth = 1.5;
  for (let sx = 0; sx < W; sx += 30) {
    ctx.beginPath(); ctx.moveTo(sx, H * 0.78); ctx.lineTo(sx, H); ctx.stroke();
  }
  for (let sy = H * 0.78; sy < H; sy += 16) {
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
  }
  drawFog(ctx, W, H, '#3a20a0', frame);
}

function bgVoid(ctx, W, H, frame = 0) {
  const bg = grad(ctx, 0, 0, 0, H, [[0,'#050508'],[0.5,'#0a0a14'],[1,'#14142a']]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // Nebula
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#6a2080';
  ctx.beginPath(); ctx.arc(W*0.3, H*0.3, 150 + fastSin(frame*0.005)*20, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#2040a0';
  ctx.beginPath(); ctx.arc(W*0.7, H*0.5, 120 + fastCos(frame*0.006)*15, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.arc(W*0.5, H*0.15, 80 + fastSin(frame*0.008)*10, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  drawStars(ctx, W, H, 200, frame);
  // Rift
  const riftGlow = 0.2 + 0.3 * fastSin(frame * 0.01);
  ctx.fillStyle = `rgba(200,50,200,${riftGlow * 0.15})`;
  ctx.beginPath();
  ctx.moveTo(W*0.3, 0);
  ctx.quadraticCurveTo(W*0.5 + fastSin(frame*0.03)*40, H*0.5, W*0.7, H);
  ctx.lineTo(W*0.5, H);
  ctx.quadraticCurveTo(W*0.3 + fastCos(frame*0.025)*30, H*0.5, W*0.1, 0);
  ctx.closePath(); ctx.fill();
  // Floating rocks
  for (let i = 0; i < 6; i++) {
    const rx = W*0.1 + i * W*0.16 + fastSin(frame*0.01 + i) * 20;
    const ry = H*0.2 + i * H*0.1 + fastCos(frame*0.012 + i*2) * 10;
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(rx, ry, 18 + fastSin(i)*6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2a2a3e';
    ctx.beginPath(); ctx.arc(rx-3, ry-3, 10 + fastSin(i)*3, 0, Math.PI*2); ctx.fill();
  }
}

function bgBattleArena(ctx, W, H, frame = 0) {
  // ─── AAAAAA Battle Arena — Ruined Colosseum with Volumetric Lighting ───
  const t = frame * 0.001;

  // ── Sky: dramatic aurora + dark storm clouds ──
  const sky = grad(ctx, 0, 0, 0, H, [
    [0, '#0a0818'], [0.2, '#1a1040'], [0.45, '#2a1860'], [0.7, '#3a2040'], [1, '#1a1020']
  ]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  // Aurora bands (shifting color)
  for (let i = 0; i < 4; i++) {
    const ay = H * (0.08 + i * 0.06) + fastSin(t * 0.4 + i * 1.5) * 15;
    const hue = (i * 60 + frame * 0.3) % 360;
    ctx.globalAlpha = 0.04 + 0.02 * fastSin(t * 0.6 + i);
    const ag = ctx.createLinearGradient(0, ay, W, ay);
    ag.addColorStop(0, 'transparent');
    ag.addColorStop(0.3, `hsla(${hue},70%,60%,0.3)`);
    ag.addColorStop(0.6, `hsla(${hue + 40},60%,50%,0.25)`);
    ag.addColorStop(1, 'transparent');
    ctx.fillStyle = ag;
    ctx.fillRect(0, ay - 15, W, 30);
  }
  ctx.globalAlpha = 1;

  // Stars (sparse, behind ruins)
  drawStars(ctx, W, H, 60, frame);

  // ── Distant ruined castle silhouettes ──
  ctx.fillStyle = '#0c0818';
  // Left fortress
  ctx.beginPath();
  ctx.moveTo(0, H * 0.5);
  ctx.lineTo(0, H * 0.2);
  ctx.lineTo(W * 0.08, H * 0.15);
  ctx.lineTo(W * 0.12, H * 0.25);
  ctx.lineTo(W * 0.15, H * 0.18);
  ctx.lineTo(W * 0.2, H * 0.3);
  ctx.lineTo(W * 0.22, H * 0.5);
  ctx.closePath(); ctx.fill();
  // Right fortress
  ctx.beginPath();
  ctx.moveTo(W, H * 0.5);
  ctx.lineTo(W, H * 0.22);
  ctx.lineTo(W * 0.85, H * 0.18);
  ctx.lineTo(W * 0.82, H * 0.28);
  ctx.lineTo(W * 0.78, H * 0.2);
  ctx.lineTo(W * 0.75, H * 0.32);
  ctx.lineTo(W * 0.73, H * 0.5);
  ctx.closePath(); ctx.fill();

  // ── Horizon glow (energy rift) ──
  const riftPulse = 0.15 + 0.12 * fastSin(t * 0.8);
  // Cached gradient (geometry frame-independent; slight pulse freezes)
  const riftGrad = gradCached(ctx, 'rift_arena', 0, H * 0.42, 0, H * 0.55, [
    [0, 'rgba(0,0,0,0)'],
    [0.4, `rgba(155,89,182,${riftPulse * 0.3})`],
    [0.5, `rgba(200,80,160,${riftPulse * 0.5})`],
    [0.6, `rgba(155,89,182,${riftPulse * 0.3})`],
    [1, 'rgba(0,0,0,0)']
  ]);
  ctx.fillStyle = riftGrad;
  ctx.fillRect(0, H * 0.4, W, H * 0.15);

  // ── Ruined pillars (parallax: far → near) ──
  function drawPillar(px, py, ph, pw, alpha, broken = false) {
    ctx.save();
    ctx.globalAlpha = alpha;
    // Pillar shadow
    ctx.fillStyle = '#080610';
    ctx.fillRect(px + 3, py - ph + 4, pw, ph);
    // Pillar body
    ctx.fillStyle = '#2a2240';
    ctx.fillRect(px, py - ph, pw, ph);
    // Pillar highlight (left edge)
    ctx.fillStyle = 'rgba(100,80,140,0.25)';
    ctx.fillRect(px, py - ph, 3, ph);
    // Pillar shadow (right edge)
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(px + pw - 3, py - ph, 3, ph);
    // Capital (top)
    if (!broken) {
      ctx.fillStyle = '#3a3060';
      ctx.fillRect(px - 4, py - ph - 8, pw + 8, 10);
      ctx.fillStyle = '#1a1030';
      ctx.fillRect(px - 2, py - ph - 12, pw + 4, 6);
    } else {
      // Broken jagged top
      ctx.fillStyle = '#2a2240';
      ctx.beginPath();
      ctx.moveTo(px, py - ph);
      ctx.lineTo(px + pw * 0.3, py - ph - 8);
      ctx.lineTo(px + pw * 0.5, py - ph - 3);
      ctx.lineTo(px + pw * 0.7, py - ph - 10);
      ctx.lineTo(px + pw, py - ph);
      ctx.closePath(); ctx.fill();
    }
    // Cracks
    ctx.strokeStyle = 'rgba(100,60,140,0.2)';
    ctx.lineWidth = 1;
    for (let c = 0; c < 3; c++) {
      const cy = py - ph * (0.3 + c * 0.2);
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.2, cy);
      ctx.lineTo(px + pw * 0.5 + fastSin(c) * 5, cy + 10);
      ctx.lineTo(px + pw * 0.3, cy + 20);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Far pillars (dim, small)
  drawPillar(W * 0.08, H * 0.52, 160, 14, 0.4, true);
  drawPillar(W * 0.22, H * 0.52, 130, 12, 0.35, false);
  drawPillar(W * 0.78, H * 0.52, 140, 12, 0.35, true);
  drawPillar(W * 0.92, H * 0.52, 155, 14, 0.4, false);
  // Mid pillars
  drawPillar(W * 0.15, H * 0.62, 200, 18, 0.6, false);
  drawPillar(W * 0.35, H * 0.62, 180, 16, 0.55, true);
  drawPillar(W * 0.65, H * 0.62, 175, 16, 0.55, true);
  drawPillar(W * 0.85, H * 0.62, 195, 18, 0.6, false);
  // Foreground pillars (large, dark, framing)
  drawPillar(W * 0.02, H * 0.85, 340, 28, 0.85, false);
  drawPillar(W * 0.93, H * 0.85, 330, 28, 0.85, false);

  // ── Perspective floor (broken stone tiles with glowing cracks) ──
  const vanishX = W * 0.5, vanishY = H * 0.48;
  ctx.fillStyle = '#12101a';
  ctx.fillRect(0, vanishY, W, H - vanishY);

  // Floor grid (perspective)
  ctx.strokeStyle = '#1e1a28';
  ctx.lineWidth = 1.2;
  for (let z = 0; z < 18; z++) {
    const scale = z / 18;
    const y = vanishY + (H - vanishY) * scale;
    if (y > H) break;
    ctx.globalAlpha = 0.3 + scale * 0.3;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let x = -8; x <= 8; x++) {
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(vanishX + x * 15, vanishY);
    ctx.lineTo(vanishX + x * 3, H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Glowing energy cracks in floor
  const crackGlow = 0.15 + 0.1 * fastSin(t * 1.2);
  ctx.strokeStyle = `rgba(155,89,182,${crackGlow})`;
  ctx.shadowColor = '#9b59b6';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2;
  // Central crack
  ctx.beginPath();
  ctx.moveTo(W * 0.35, H * 0.55);
  ctx.lineTo(W * 0.42, H * 0.65);
  ctx.lineTo(W * 0.48, H * 0.72);
  ctx.lineTo(W * 0.55, H * 0.82);
  ctx.lineTo(W * 0.6, H * 0.92);
  ctx.stroke();
  // Branch cracks
  ctx.beginPath();
  ctx.moveTo(W * 0.42, H * 0.65);
  ctx.lineTo(W * 0.38, H * 0.75);
  ctx.lineTo(W * 0.3, H * 0.88);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W * 0.55, H * 0.82);
  ctx.lineTo(W * 0.65, H * 0.88);
  ctx.lineTo(W * 0.75, H * 0.95);
  ctx.stroke();
  // Secondary cracks (gold)
  ctx.strokeStyle = `rgba(241,196,15,${crackGlow * 0.5})`;
  ctx.shadowColor = '#f1c40f';
  ctx.shadowBlur = 5;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W * 0.2, H * 0.6);
  ctx.lineTo(W * 0.28, H * 0.7);
  ctx.lineTo(W * 0.25, H * 0.82);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W * 0.72, H * 0.58);
  ctx.lineTo(W * 0.78, H * 0.68);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ── Central Altar (elevated platform) ──
  // Base platform
  ctx.fillStyle = '#1a1430';
  ctx.beginPath();
  ctx.moveTo(W * 0.35, H * 0.5);
  ctx.lineTo(W * 0.5, H * 0.44);
  ctx.lineTo(W * 0.65, H * 0.5);
  ctx.lineTo(W * 0.6, H * 0.52);
  ctx.lineTo(W * 0.4, H * 0.52);
  ctx.closePath(); ctx.fill();
  // Platform top
  ctx.fillStyle = '#2a2040';
  ctx.fillRect(W * 0.38, H * 0.42, W * 0.24, H * 0.04);
  // Platform edge highlight
  ctx.fillStyle = 'rgba(155,89,182,0.15)';
  ctx.fillRect(W * 0.38, H * 0.42, W * 0.24, 2);

  // Altar pedestal
  ctx.fillStyle = '#2a2050';
  ctx.fillRect(W * 0.44, H * 0.32, W * 0.12, H * 0.1);
  ctx.fillStyle = '#3a3068';
  ctx.fillRect(W * 0.46, H * 0.32, W * 0.08, H * 0.025);

  // Energy column (vertical beam from altar)
  const beamPulse = 0.08 + 0.06 * fastSin(t * 2);
  // Cached gradient (geometry frame-independent; slight pulse freezes)
  const beamGrad = gradCached(ctx, 'beam_arena', W * 0.5, H * 0.1, W * 0.5, H * 0.44, [
    [0, 'rgba(155,89,182,0)'],
    [0.3, `rgba(155,89,182,${beamPulse})`],
    [0.7, `rgba(200,100,255,${beamPulse * 1.5})`],
    [1, `rgba(155,89,182,${beamPulse * 2})`]
  ]);
  ctx.fillStyle = beamGrad;
  ctx.fillRect(W * 0.48, H * 0.1, W * 0.04, H * 0.34);
  // Beam core (brighter)
  ctx.fillStyle = `rgba(220,180,255,${beamPulse * 0.6})`;
  ctx.fillRect(W * 0.495, H * 0.15, W * 0.01, H * 0.28);

  // Altar glow aura
  const aGlow = 0.12 + 0.08 * fastSin(t * 1.5);
  ctx.fillStyle = `rgba(155,89,182,${aGlow})`;
  ctx.shadowColor = '#9b59b6'; ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.arc(W * 0.5, H * 0.36, 50, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // ── Floating runes (orbiting altar) ──
  const runeChars = '✧◈◇❖◆◇✦';
  ctx.font = 'bold 16px serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 7; i++) {
    const ang = t * 0.5 + i * (Math.PI * 2 / 7);
    const rx = W * 0.5 + fastCos(ang) * (65 + fastSin(t * 0.3 + i) * 10);
    const ry = H * 0.36 + fastSin(ang) * 22;
    const rAlpha = 0.3 + 0.25 * fastSin(t * 1.2 + i * 1.1);
    const colors = ['#9b59b6', '#f1c40f', '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#e74c3c'];
    ctx.fillStyle = colors[i].replace(')', `,${rAlpha})`).replace('#', 'rgba(').replace(/rgba\(#([0-9a-f]{6})/, (_, hex) => {
      const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r},${g},${b}`;
    });
    // Simplified: just set fillStyle directly
    ctx.globalAlpha = rAlpha;
    ctx.fillStyle = colors[i];
    ctx.shadowColor = colors[i]; ctx.shadowBlur = 8;
    ctx.fillText(runeChars[i], rx, ry);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // ── Floating crystal fragments ──
  for (let i = 0; i < 5; i++) {
    const cx = W * (0.15 + i * 0.18) + fastSin(t * 0.4 + i * 1.3) * 20;
    const cy = H * (0.25 + fastSin(t * 0.3 + i * 0.9) * 0.08);
    const cSize = 6 + fastSin(i * 1.7) * 3;
    const cGlow = 0.3 + 0.2 * fastSin(t * 1.5 + i * 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.3 + i * 1.2);
    ctx.globalAlpha = cGlow;
    ctx.fillStyle = ['#9b59b6', '#3498db', '#f1c40f', '#e74c3c', '#2ecc71'][i];
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -cSize); ctx.lineTo(cSize * 0.5, 0);
    ctx.lineTo(0, cSize); ctx.lineTo(-cSize * 0.5, 0);
    ctx.closePath(); ctx.fill();
    // Inner highlight
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = cGlow * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, -cSize * 0.5); ctx.lineTo(cSize * 0.2, 0);
    ctx.lineTo(0, cSize * 0.3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ── God rays from above ──
  drawGodRays(ctx, W, H, W * 0.5, -20, 'rgb(155,89,182)', frame, 5);

  // ── Floating dust/ember particles ──
  for (let i = 0; i < 30; i++) {
    const px = (i * 73.3 + frame * 0.15 * (0.5 + fastSin(i) * 0.5)) % W;
    const py = (H * 0.15 + (i * 91.7 + frame * 0.3) % (H * 0.7));
    const pAlpha = 0.15 + 0.15 * fastSin(frame * 0.03 + i * 1.7);
    const pColor = i % 3 === 0 ? '#f1c40f' : i % 3 === 1 ? '#9b59b6' : '#e0d0ff';
    ctx.globalAlpha = pAlpha;
    ctx.fillStyle = pColor;
    ctx.shadowColor = pColor; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(px, py, 1 + fastSin(i * 0.7) * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // ── Volumetric fog (bottom) ──
  drawFog(ctx, W, H, '#2a1840', frame);
  // Mid-height mist wisps
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = '#4a2870';
  for (let i = 0; i < 3; i++) {
    const wy = H * (0.45 + i * 0.08);
    const wx = fastSin(t * 0.5 + i * 2) * W * 0.1;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(W * 0.3 + wx, wy - 15, W * 0.5, wy);
    ctx.quadraticCurveTo(W * 0.7 + wx, wy + 15, W + wx, wy);
    ctx.lineTo(W, wy + 20);
    ctx.lineTo(0, wy + 20);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── Post-processing caches (module-level, created once) ──────────────
let _grainCanvas = null;           // 128x128 pre-generated noise tile
let _vignetteGrad = null;         // cached radial gradient object
let _vignetteW = 0, _vignetteH = 0;
let _bloomCanvas = null;          // reused downsample scratch
let _chromCanvas = null;          // reused chrom copy scratch

// ─── Post-processing layer (grain, bloom, chromatic, atmospheric tint) ────
// Cheap but effective. Call LAST on the topmost canvas (over everything).

export function applyPostFX(ctx, W, H, frame, opts = {}) {
  const grain = opts.grain ?? 0.04;
  const bloom = opts.bloom ?? 0.25;
  const chrom = opts.chrom ?? 0.6;
  const tint = opts.tint ?? null;
  const vig = opts.vignette ?? 0.35;

  // 1) Atmospheric color tint (warm/cool mood)
  if (tint) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = (tint.a ?? 0.18);
    ctx.fillStyle = tint.color || '#4060a0';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 2) Bloom: throttled to every 4 frames (18% scale copy is expensive)
  //    Reuses a single scratch canvas sized once per resolution.
  if (bloom > 0 && (frame & 3) === 0) {
    try {
      if (!_bloomCanvas) _bloomCanvas = document.createElement('canvas');
      const bw = Math.max(2, Math.floor(W * 0.18));
      const bh = Math.max(2, Math.floor(H * 0.18));
      if (_bloomCanvas.width !== bw) _bloomCanvas.width = bw;
      if (_bloomCanvas.height !== bh) _bloomCanvas.height = bh;
      const tctx = _bloomCanvas.getContext('2d');
      tctx.clearRect(0, 0, bw, bh);
      tctx.drawImage(ctx.canvas, 0, 0, bw, bh);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = bloom * 0.18;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(_bloomCanvas, 0, 0, W, H);
      ctx.restore();
    } catch (e) { /* ignore */ }
  }

  // 3) Chromatic aberration: skip entirely if chrom <= 0, throttle to every 4 frames
  if (chrom > 0 && (frame & 3) === 0) {
    try {
      if (!_chromCanvas) _chromCanvas = document.createElement('canvas');
      if (_chromCanvas.width !== W) _chromCanvas.width = W;
      if (_chromCanvas.height !== H) _chromCanvas.height = H;
      const cctx = _chromCanvas.getContext('2d');
      cctx.clearRect(0, 0, W, H);
      cctx.drawImage(ctx.canvas, 0, 0, W, H);
      const dx = chrom, dy = chrom * 0.3;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.08;
      ctx.drawImage(_chromCanvas, -dx, -dy, W, H);
      ctx.globalAlpha = 0.06;
      ctx.drawImage(_chromCanvas, dx, dy, W, H);
      ctx.restore();
    } catch (e) { /* ignore */ }
  }

  // 4) Film grain: pre-generated 128×128 tile, drawn once (no per-frame ImageData)
  //    Throttled to every 2 frames — grain flicker is imperceptible at 30Hz.
  if (grain > 0 && (frame & 1) === 0) {
    const gs = 128;
    if (!_grainCanvas) {
      _grainCanvas = document.createElement('canvas');
      _grainCanvas.width = gs;
      _grainCanvas.height = gs;
      const gctx = _grainCanvas.getContext('2d');
      const id = gctx.createImageData(gs, gs);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = ((fastSin(i * 12.9898) * 43758.5453) % 1) * 255;
        const v = (n < 0 ? n + 256 : n) | 0;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
      gctx.putImageData(id, 0, 0);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = grain;
    const ox = (frame * 3) % gs;
    const oy = (frame * 1.7) % gs;
    // Tile grain across the screen (single drawImage per tile, no per-pixel loop)
    for (let x = -ox; x < W; x += gs) {
      for (let y = -oy; y < H; y += gs) {
        ctx.drawImage(_grainCanvas, x, y);
      }
    }
    ctx.restore();
  }

  // 5) Cinematic vignette (radial) — cache gradient, recreate on resize only
  if (vig > 0) {
    if (!_vignetteGrad || _vignetteW !== W || _vignetteH !== H) {
      const r0 = Math.min(W, H) * 0.38;
      const r1 = Math.max(W, H) * 0.72;
      _vignetteGrad = ctx.createRadialGradient(W / 2, H / 2, r0, W / 2, H / 2, r1);
      _vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
      _vignetteGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
      _vignetteW = W;
      _vignetteH = H;
    }
    // Re-bind the outer stop with current vig value (gradient object is reused)
    _vignetteGrad.addColorStop(1, `rgba(0,0,0,${vig})`);
    ctx.fillStyle = _vignetteGrad;
    ctx.fillRect(0, 0, W, H);
  }

  // 6) Letterbox bars (cinematic 2.39:1 feel) — optional
  if (opts.letterbox) {
    const bar = Math.floor(H * 0.07);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
  }
}

// ─── Desert biome (Conde Petie / Kuja) ───────────────────────────────────

function bgDesert(ctx, W, H, frame = 0) {
  const sky = grad(ctx, 0, 0, 0, H, [[0,'#3a2860'],[0.35,'#7a4830'],[0.6,'#c08840'],[1,'#e0a850']]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // Sun haze
  ctx.fillStyle = `rgba(255,240,180,${0.25 + 0.1*fastSin(frame*0.01)})`;
  ctx.beginPath(); ctx.arc(W*0.7, H*0.22, 80, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff2c0'; ctx.beginPath(); ctx.arc(W*0.7, H*0.22, 48, 0, Math.PI*2); ctx.fill();
  // Heat shimmer waves
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = '#fff0c0';
    ctx.fillRect(0, H*(0.5+i*0.04) + fastSin(frame*0.04+i)*3, W, 2);
  }
  ctx.globalAlpha = 1;
  // Far mesas
  ctx.fillStyle = '#5a3a28';
  for (let i = 0; i < 5; i++) {
    const mx = W*0.1 + i*W*0.2 + fastSin(i)*10;
    ctx.beginPath();
    ctx.moveTo(mx-50, H*0.55); ctx.lineTo(mx-30, H*0.35); ctx.lineTo(mx-10, H*0.32);
    ctx.lineTo(mx+20, H*0.36); ctx.lineTo(mx+55, H*0.55); ctx.closePath(); ctx.fill();
  }
  // Dunes (3 layers)
  for (let l = 0; l < 3; l++) {
    const cols = ['#b07838','#9a6830','#7a5028'][l];
    const alt = 0.5 + l*0.06;
    ctx.fillStyle = cols;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) {
      const y = H*(1-alt) + fastSin(x*0.006 + l*2)*30 + fastSin(x*0.013 + l)*16;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  // Sand ripples
  ctx.strokeStyle = 'rgba(180,120,60,0.3)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 30; i++) {
    const rx = (i*53.1) % W;
    const ry = H*0.72 + fastSin(i*1.7)*10;
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo(rx+10, ry-3, rx+20, ry); ctx.stroke();
  }
  // Heat particles (dust)
  for (let i = 0; i < 25; i++) {
    const dx = (i*73.3 + frame*0.4) % W;
    const dy = (H*0.3 + (i*91.7 + frame*0.6) % (H*0.45));
    ctx.fillStyle = `rgba(255,220,160,${0.06+0.08*fastSin(frame*0.02+i)})`;
    ctx.beginPath(); ctx.arc(dx, dy, 1.2+fastSin(i)*0.4, 0, Math.PI*2); ctx.fill();
  }
  drawFog(ctx, W, H, '#c08840', frame);
}

// ─── Crystal World (Kuja finale) ────────────────────────────────────────

function bgCrystalWorld(ctx, W, H, frame = 0) {
  const sky = grad(ctx, 0, 0, 0, H, [[0,'#0a0030'],[0.4,'#2a1060'],[0.7,'#6020a0'],[1,'#a040d0']]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  drawStars(ctx, W, H, 200, frame);
  // Aurora bands
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.10 + 0.05*fastSin(frame*0.01+i);
    const ag = ctx.createLinearGradient(0, H*0.2, W, H*0.2);
    ag.addColorStop(0,'transparent');
    ag.addColorStop(0.5, ['#40d0c0','#8050e0','#e040a0'][i]);
    ag.addColorStop(1,'transparent');
    ctx.fillStyle = ag;
    ctx.fillRect(0, H*(0.2+i*0.1)+fastSin(frame*0.02+i)*10, W, 30);
  }
  ctx.globalAlpha = 1;
  // Giant crystal spires
  for (let i = 0; i < 7; i++) {
    const cx = W*0.08 + i*W*0.14;
    const ch = 200 + fastSin(i*1.3)*80;
    const glow = 0.4 + 0.4*fastSin(frame*0.03+i*1.7);
    ctx.fillStyle = `rgba(120,80,200,${0.10*glow})`;
    ctx.beginPath(); ctx.arc(cx, H*0.55, 60, 0, Math.PI*2); ctx.fill();
    // Crystal prism
    ctx.fillStyle = '#6028a0';
    ctx.beginPath();
    ctx.moveTo(cx, H*0.6 - ch); ctx.lineTo(cx+30, H*0.55);
    ctx.lineTo(cx+10, H*0.6); ctx.lineTo(cx-10, H*0.6);
    ctx.lineTo(cx-30, H*0.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a060e0';
    ctx.beginPath();
    ctx.moveTo(cx, H*0.6 - ch); ctx.lineTo(cx+8, H*0.6 - ch*0.4);
    ctx.lineTo(cx-12, H*0.6); ctx.lineTo(cx-30, H*0.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e0a0ff';
    ctx.beginPath();
    ctx.moveTo(cx, H*0.6 - ch); ctx.lineTo(cx-6, H*0.6 - ch*0.5);
    ctx.lineTo(cx-14, H*0.6 - ch*0.15); ctx.closePath(); ctx.fill();
  }
  // Crystal floor (reflective)
  ctx.fillStyle = '#1a0830';
  ctx.fillRect(0, H*0.6, W, H*0.4);
  // Floor shard grid
  ctx.strokeStyle = `rgba(180,100,255,${0.25+0.1*fastSin(frame*0.02)})`;
  ctx.lineWidth = 1.2;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, H*0.6);
    ctx.lineTo(x + (x < W/2 ? 30 : -30), H); ctx.stroke();
  }
  for (let y = H*0.6; y < H; y += 20) {
    const p = (y - H*0.6) / (H*0.4);
    ctx.globalAlpha = 0.3 - p*0.25;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Floating soul motes
  for (let i = 0; i < 30; i++) {
    const mx = (i*83.7 + frame*0.3*i*0.4) % W;
    const my = (H*0.2 + (i*61.3 + frame*0.8) % (H*0.6));
    ctx.fillStyle = `rgba(255,200,255,${0.2+0.4*fastSin(frame*0.04+i*3.1)})`;
    ctx.beginPath(); ctx.arc(mx, my, 1.5+fastSin(i)*0.7, 0, Math.PI*2); ctx.fill();
  }
  drawFog(ctx, W, H, '#6020a0', frame);
}

// ─── Town Lindblum (industrial city) ─────────────────────────────────────

function bgTownLindblum(ctx, W, H, frame = 0) {
  const sky = grad(ctx, 0, 0, 0, H, [[0,'#2a1a40'],[0.3,'#3a2860'],[0.6,'#5a4080'],[1,'#7a58a0']]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  drawStars(ctx, W, H, 100, frame);
  // Twin moons
  ctx.fillStyle = '#d0c8e0'; ctx.beginPath(); ctx.arc(W*0.2, H*0.15, 28, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#e0d8f0'; ctx.beginPath(); ctx.arc(W*0.78, H*0.12, 22, 0, Math.PI*2); ctx.fill();
  // Steam/industrial haze
  for (let i = 0; i < 5; i++) {
    const sx = (W * 0.15 * i + fastSin(frame * 0.008 + i) * 30) % (W + 60) - 30;
    ctx.globalAlpha = 0.05 + 0.03 * fastSin(frame * 0.01 + i);
    ctx.fillStyle = '#a0c0d0';
    ctx.fillRect(sx, H*0.2, 40, H*0.4);
  }
  ctx.globalAlpha = 1;
  // Gear silhouettes (distant)
  for (let i = 0; i < 4; i++) {
    const gx = W*0.1 + i*W*0.22;
    ctx.fillStyle = '#2a2040';
    ctx.beginPath(); ctx.arc(gx, H*0.55, 30, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a1030';
    ctx.beginPath(); ctx.arc(gx, H*0.55, 12, 0, Math.PI*2); ctx.fill();
  }
  // Airship docks (lit)
  for (let i = 0; i < 3; i++) {
    const dx = W*0.18 + i*W*0.3;
    ctx.fillStyle = '#1a1828';
    ctx.fillRect(dx-60, H*0.5, 120, H*0.3);
    // Dock lights
    ctx.fillStyle = `rgba(241,196,15,${0.4+0.2*fastSin(frame*0.02+i)})`;
    for (let l = 0; l < 5; l++) ctx.fillRect(dx-50, H*0.52+l*20, 8, 4);
  }
  // Ground streets (perspective)
  ctx.fillStyle = '#2a2240';
  ctx.fillRect(0, H*0.75, W, H*0.25);
  // Street grid
  ctx.strokeStyle = '#3a3050'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x, H*0.75); ctx.lineTo(x, H); ctx.stroke(); }
  // Steam vents
  for (let i = 0; i < 8; i++) {
    const vx = (i * 137 + frame * 0.3) % W;
    const vy = H*0.75 + fastSin(frame*0.03+i)*10;
    ctx.globalAlpha = 0.08; ctx.fillStyle = '#b0d0e0';
    ctx.fillRect(vx, vy, 12, 30); ctx.globalAlpha = 1;
  }
  drawFog(ctx, W, H, '#4a5070', frame);
}

// ─── Magic Tree (Iifa Tree) ────────────────────────────────────────────

function bgMagicTree(ctx, W, H, frame = 0) {
  const sky = grad(ctx, 0, 0, 0, H, [[0,'#0a2010'],[0.3,'#1a3020'],[0.6,'#2a4030'],[1,'#3a5040']]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // Mist rising
  for (let i = 0; i < 6; i++) {
    const mx = (W * 0.18 * i + fastSin(frame * 0.005 + i) * 20) % W;
    ctx.globalAlpha = 0.04 + 0.02 * fastSin(frame * 0.008 + i);
    ctx.fillStyle = '#60d080';
    ctx.fillRect(mx, 0, 60, H);
  }
  ctx.globalAlpha = 1;
  // Massive trunk (center)
  const tx = W * 0.5;
  const trunkW = 120 + fastSin(frame * 0.01) * 5;
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(tx - trunkW/2, H * 0.2, trunkW, H * 0.8);
  // Bark texture
  ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1;
  for (let y = H*0.2; y < H; y += 8) {
    const wob = fastSin(y * 0.05 + frame * 0.01) * 4;
    ctx.beginPath(); ctx.moveTo(tx - trunkW/2 + wob, y); ctx.lineTo(tx + trunkW/2 + wob, y); ctx.stroke();
  }
  // Glowing runes on trunk
  for (let i = 0; i < 5; i++) {
    const ry = H * 0.3 + i * 80;
    const glow = 0.3 + 0.4 * fastSin(frame * 0.03 + i * 1.5);
    ctx.fillStyle = `rgba(100,200,255,${0.15 * glow})`;
    ctx.beginPath(); ctx.arc(tx, ry, 40, 0, Math.PI * 2); ctx.fill();
  }
  // Branches spreading
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 - Math.PI/2;
    const len = 180 + fastSin(frame * 0.008 + i) * 15;
    const bx = tx + fastCos(ang) * 60;
    const by = H * 0.3 + fastSin(ang) * 60;
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 18 + Math.abs(fastCos(ang)) * 10;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tx, H*0.3); ctx.lineTo(bx + fastCos(ang)*len, by + fastSin(ang)*len); ctx.stroke();
  }
  // Canopy (glowing mist)
  ctx.fillStyle = `rgba(80,200,120,${0.08 + 0.05*fastSin(frame*0.01)})`;
  ctx.beginPath(); ctx.arc(tx, H*0.25, 220, 0, Math.PI*2); ctx.fill();
  // Floating spores/light
  for (let i = 0; i < 30; i++) {
    const fx = (i * 97.3 + frame * 0.15) % W;
    const fy = H*0.15 + (i * 61.3 + frame * 0.2) % (H*0.6);
    ctx.fillStyle = `rgba(120,255,160,${0.08+0.1*fastSin(frame*0.02+i)})`;
    ctx.beginPath(); ctx.arc(fx, fy, 1.5, 0, Math.PI*2); ctx.fill();
  }
  // Roots on ground
  ctx.fillStyle = '#1a0a08';
  for (let i = 0; i < 10; i++) {
    const rx = tx + fastSin(i * 1.3) * (trunkW/2 + 40);
    ctx.beginPath(); ctx.moveTo(rx, H*0.9); ctx.lineTo(rx + fastSin(i)*30, H*1.05); ctx.lineTo(rx - fastSin(i)*30, H*1.05); ctx.closePath(); ctx.fill();
  }
  drawFog(ctx, W, H, '#305040', frame);
}



// Module-level biome render cache (per biome + size). Procedural backgrounds are
// expensive, so we render once to an offscreen canvas and re-render only every 8
// frames (the same cadence callers already used) — blitting the rest of the time.
const _biomeCache = {};
const _BIOME_THROTTLE = 8;

function _drawBiomeProc(ctx, biome, w, h, frame) {
  ctx.save();
  // Procedural layer (always works, no external dependency)
  switch (biome) {
    case 'previllage':
    case 'village':
    case 'town':        bgPrevillage(ctx, w, h, frame); break;
    case 'town_lindblum': bgTownLindblum(ctx, w, h, frame); break;
    case 'field':
    case 'plains':      bgPlains(ctx, w, h, frame); break;
    case 'forest':      bgForest(ctx, w, h, frame); break;
    case 'cave':        bgCave(ctx, w, h, frame); break;
    case 'desert':      bgDesert(ctx, w, h, frame); break;
    case 'crystal_world': bgCrystalWorld(ctx, w, h, frame); break;
    case 'magic_tree':  bgMagicTree(ctx, w, h, frame); break;
    case 'palace':
    case 'castle':      bgPalace(ctx, w, h, frame); break;
    case 'void':        bgVoid(ctx, w, h, frame); break;
    case 'battle':      bgBattleArena(ctx, w, h, frame); break;
    default:            bgPlains(ctx, w, h, frame); break;
  }
  ctx.restore();
}

export function drawBiome(ctx, biome, w, h, frame = 0) {
  const key = `${biome}_${w}x${h}`;
  let entry = _biomeCache[key];
  if (!entry || entry.w !== w || entry.h !== h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    entry = _biomeCache[key] = { canvas: c, w, h, lastFrame: -999 };
  }
  if (frame - entry.lastFrame >= _BIOME_THROTTLE || entry.lastFrame < 0) {
    const bc = entry.canvas.getContext('2d');
    bc.clearRect(0, 0, w, h);
    _drawBiomeProc(bc, biome, w, h, frame);
    entry.lastFrame = frame;
  }
  ctx.drawImage(entry.canvas, 0, 0);
}

/**
 * Battle background — uses the high-res painted backdrop image (cover-fit)
 * with a dark gradient + vignette so sprites read clearly on top.
 * @param {string} biome — battle biome (forest, desert, palace, steampunk, void...)
 */
export function drawBattleBackground(ctx, biome, w, h, frame = 0) {
  ctx.save();
  // Base dark gradient (procedural safety net) — cached
  const g = grad(ctx, 0, 0, 0, h, [[0, '#0d0f1a'], [0.6, '#161a2e'], [1, '#070810']]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const img = getBattleBg(biome);
  if (img) {
    // Cover-fit the painted backdrop
    const ar = img.width / img.height;
    let dw = w, dh = w / ar;
    if (dh < h) { dh = h; dw = h * ar; }
    const dx = (w - dw) / 2, dy = (h - dh) / 2;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalAlpha = 1;
    // Darken bottom third so party sprites pop — cached
    const g2 = grad(ctx, 0, h * 0.55, 0, h, [[0, 'rgba(7,8,16,0)'], [1, 'rgba(7,8,16,0.85)']]);
    ctx.fillStyle = g2;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
  } else {
    // No image → procedural arena
    bgBattleArena(ctx, w, h, frame);
  }

  // Vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
