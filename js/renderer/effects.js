// renderer/effects.js — Premium cel-shaded spell effects (glow, burst, impact)
// All effects: { alive, active, frame, duration, update(dt), draw(ctx) }
// Compatible with canvas particle system (update increments frame, draw renders)
import { fastSin, fastCos } from '../engine/wasm_bridge.js';
import { addParticles, updateParticles, drawParticles, isWasmReady } from './wasm_particles.js';

const OUTLINE = '#1a1a2e';

// ─── Particle object pool (reuse particle objects to avoid GC churn) ───────
const _freePool = [];
const _liveSet = new Set();
const MAX_PARTICLES = 400;

function obtainParticle(color) {
  // Recycle oldest live particle when at the cap (avoids unbounded growth / GC spikes)
  if (_liveSet.size >= MAX_PARTICLES) {
    const old = _liveSet.values().next().value;
    if (old) { old.life = 0; old._evicted = true; _liveSet.delete(old); }
  }
  let p = _freePool.pop();
  if (!p) p = { x: 0, y: 0, vx: 0, vy: 0, life: 0, decay: 0, size: 0, color: '', _evicted: false };
  _liveSet.add(p);
  return p;
}

function releaseParticle(p) {
  if (p._evicted) return; // evicted ones are recycled without re-pooling
  _liveSet.delete(p);
  _freePool.push(p);
}

// ─── Particle system helpers ────────────────────────────────────────────

function makeParticles(count, x, y, spread, color, size) {
  const p = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * spread;
    const o = obtainParticle(color);
    o.x = x; o.y = y;
    o.vx = fastCos(angle) * speed;
    o.vy = fastSin(angle) * speed - 1;
    o.life = 1; o.decay = 0.01 + Math.random() * 0.03;
    o.size = size * (0.4 + Math.random() * 0.6);
    o.color = color; o._evicted = false;
    p.push(o);
  }
  return p;
}

function drawParticleSet(ctx, particles) {
  // Use WASM particle pool if available
  if (isWasmReady() && particles.length > 0) {
    addParticles(particles);
    updateParticles(0.016); // ~60fps
    drawParticles(ctx);
    for (const p of particles) releaseParticle(p); // return JS objects to pool
    particles.length = 0; // Clear JS array since WASM handles them
    return particles;
  }
  
  // JS fallback
  ctx.save();
  for (let i = 0, len = particles.length; i < len; i++) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.05;
    p.life -= p.decay;
    if (p.life <= 0) { releaseParticle(p); continue; }
    const sz = p.size * p.life;
    if (sz < 0.5) continue; // skip sub-pixel particles
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    // fillRect is far cheaper than arc+fill for tiny particles
    if (sz < 4) {
      ctx.fillRect(p.x - sz, p.y - sz, sz * 2, sz * 2);
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, 6.2832); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // In-place filter (avoids allocating new array every frame)
  let j = 0;
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].life > 0) particles[j++] = particles[i];
  }
  particles.length = j;
  return particles;
}

// ─── Ring burst ────────────────────────────────────────────────────────

function ringBurst(ctx, x, y, frame, duration, color, size) {
  const progress = frame / duration;
  const radius = size * 1.5 * progress;
  const alpha = 1 - progress;
  ctx.save();
  ctx.globalAlpha = alpha * 0.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 * (1 - progress);
  ctx.shadowColor = color; ctx.shadowBlur = 5;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = alpha * 0.25;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ─── Glyph helpers ─────────────────────────────────────────────────────

function glyphCircle(ctx, x, y, radius, frame, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.shadowColor = color; ctx.shadowBlur = 4;
  ctx.globalAlpha = 0.5 + 0.3 * fastSin(frame * 0.15);
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function glyphCross(ctx, x, y, size, frame, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.shadowColor = color; ctx.shadowBlur = 4;
  ctx.globalAlpha = 0.6 + 0.3 * fastSin(frame * 0.12 + 1);
  ctx.save(); ctx.translate(x, y); ctx.rotate(frame * 0.08);
  ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(size, 0);
  ctx.moveTo(0, -size); ctx.lineTo(0, size);
  ctx.stroke(); ctx.restore();
  ctx.restore();
}

// ─── Base effect maker ─────────────────────────────────────────────────

function makeEffect(duration, drawFn) {
  return {
    alive: true, active: true, frame: 0, duration,
    update() { this.frame++; if (this.frame >= this.duration) { this.active = false; this.alive = false; } },
    draw(ctx) { drawFn.call(this, ctx, this.frame, this.duration); },
  };
}

// ─── Fire ──────────────────────────────────────────────────────────────

export const FX = {};

FX.spellFire = {
  create(x, y) {
    const particles = [
      ...makeParticles(25, x, y, 4, '#e74c3c', 4),
      ...makeParticles(15, x, y, 3, '#f39c12', 3),
      ...makeParticles(8, x, y, 2, '#fff', 2),
    ];
    return makeEffect(40, function(ctx, frame) {
      const p = frame / this.duration;
      // Heat haze aura
      ctx.fillStyle = `rgba(231,76,60,${0.15 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.fill();
      glyphCircle(ctx, x, y, 24, frame, '#e74c3c');
      drawParticleSet(ctx, particles);
      if (frame < 15) ringBurst(ctx, x, y, frame, 15, '#f39c12', 30);
      // Flame tongues
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + frame * 0.08;
        ctx.globalAlpha = 0.15 + 0.1 * fastSin(frame * 0.1 + i);
        ctx.fillStyle = '#e74c3c'; ctx.shadowColor = '#e74c3c'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(x + fastCos(a) * 16, y + fastSin(a) * 12, 5 + fastSin(frame * 0.15 + i) * 2, 0, Math.PI * 2); ctx.fill();
      }
    });
  }
};

// ─── Ice ───────────────────────────────────────────────────────────────

FX.spellIce = {
  create(x, y) {
    const shards = Array.from({length: 18}, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: 10 + Math.random() * 30,
      speed: 1 + Math.random() * 2,
      size: 3 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.1,
    }));
    return makeEffect(45, function(ctx, frame) {
      const p = frame / this.duration;
      ctx.fillStyle = `rgba(52,152,219,${0.15 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(x, y, 35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.075 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill();
      glyphCircle(ctx, x, y, 20, frame, '#3498db');
      glyphCross(ctx, x, y, 18, frame, '#85c1e9');
      for (const s of shards) {
        const p2 = Math.min(1, frame / 25);
        const sx = x + fastCos(s.angle) * s.dist * p2;
        const sy = y + fastSin(s.angle) * s.dist * p2;
        s.rot += s.rotSpeed;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(s.rot);
        ctx.globalAlpha = (1 - p) * (0.6 + 0.4 * fastSin(frame * 0.1 + s.angle));
        ctx.fillStyle = '#a0d8f0'; ctx.shadowColor = '#3498db'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(0, -s.size); ctx.lineTo(s.size*0.6, 0);
        ctx.lineTo(0, s.size); ctx.lineTo(-s.size*0.6, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#85c1e9'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      }
      if (frame < 12) ringBurst(ctx, x, y, frame, 12, '#85c1e9', 25);
    });
  }
};

// ─── Thunder ───────────────────────────────────────────────────────────

FX.spellThunder = {
  create(x, y) {
    return makeEffect(35, function(ctx, frame) {
      const p = frame / this.duration;
      glyphCircle(ctx, x, y, 28, frame, '#f1c40f');
      const boltCount = frame < 8 ? 6 : 3;
      for (let b = 0; b < boltCount; b++) {
        const flash = Math.random() > 0.6;
        if (!flash && frame > 5) continue;
        ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2 + Math.random() * 2;
        ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 12 + Math.random() * 8;
        ctx.globalAlpha = flash ? (0.4 + Math.random() * 0.6) : (0.15 + Math.random() * 0.2);
        ctx.beginPath();
        let lx = x + (Math.random() - 0.5) * 20;
        let ly = y - 30;
        ctx.moveTo(lx, ly);
        const segments = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < segments; i++) {
          lx += (Math.random() - 0.5) * 25;
          ly += 40 / segments + Math.random() * 10;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }
      if (frame < 8) {
        const fa = (1 - frame / 8) * 0.3;
        ctx.fillStyle = `rgba(241,196,15,${fa})`;
        ctx.beginPath(); ctx.arc(x, y, 40 + Math.random() * 10, 0, Math.PI * 2); ctx.fill();
      }
      if (frame < 10) ringBurst(ctx, x, y, frame, 10, '#f1c40f', 35);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + frame * 0.06;
        const ra = 18 + fastSin(frame * 0.08 + i) * 6;
        ctx.fillStyle = `rgba(241,196,15,${0.2 + 0.2 * fastSin(frame * 0.1 + i)})`;
        ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(x + fastCos(a) * ra, y + fastSin(a) * ra, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    });
  }
};

// ─── Holy ──────────────────────────────────────────────────────────────

FX.spellHoly = {
  create(x, y) {
    const beams = Array.from({length: 12}, (_, i) => ({
      angle: (i / 12) * Math.PI * 2,
      length: 30 + Math.random() * 40,
      width: 2 + Math.random() * 3,
      phase: Math.random() * Math.PI * 2,
    }));
    return makeEffect(50, function(ctx, frame) {
      const p = frame / this.duration;
      const ra = (1 - p) * 0.2;
      ctx.fillStyle = `rgba(241,196,15,${ra})`;
      ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.arc(x, y, 30 + frame * 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.3 * (1 - p);
      for (const b of beams) {
        const flicker = 0.5 + 0.5 * fastSin(frame * 0.08 + b.phase);
        ctx.strokeStyle = '#ffe066'; ctx.lineWidth = b.width * flicker;
        ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.2 * flicker * (1 - p);
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + fastCos(b.angle) * b.length * (1 + frame * 0.01),
                    y + fastSin(b.angle) * b.length * (1 + frame * 0.01));
        ctx.stroke();
      }
      ctx.globalAlpha = 0.5 + 0.3 * fastSin(frame * 0.1);
      ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(x, y, 18 + fastSin(frame * 0.08) * 4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x-8, y); ctx.lineTo(x+8, y);
      ctx.moveTo(x, y-8); ctx.lineTo(x, y+8); ctx.stroke();
      ctx.globalAlpha = 0.4 * (1 - p);
      ctx.fillStyle = '#ffe066';
      for (let i = 0; i < 10; i++) {
        ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(x + fastSin(frame * 0.03 + i*7.3) * 20, y - frame*2 + i*6, 2, 0, Math.PI*2); ctx.fill();
      }
    });
  }
};

// ─── Heal ──────────────────────────────────────────────────────────────

FX.spellHeal = {
  create(x, y) {
    const particles = [
      ...makeParticles(20, x, y, 3, '#2ecc71', 3),
      ...makeParticles(10, x, y, 2, '#a8e6cf', 2),
    ];
    return makeEffect(40, function(ctx, frame) {
      const p = frame / this.duration;
      const aura = 0.15 * (1 - p);
      ctx.fillStyle = `rgba(46,204,113,${aura})`;
      ctx.shadowColor = '#2ecc71'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(x, y, 25 + frame * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.5 * (1 - p);
      ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 3;
      ctx.shadowColor = '#2ecc71'; ctx.shadowBlur = 8;
      ctx.save(); ctx.translate(x, y); ctx.rotate(frame * 0.05);
      const s = 12 + fastSin(frame * 0.1) * 3;
      ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0);
      ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke(); ctx.restore();
      drawParticleSet(ctx, particles);
      if (frame < 10) ringBurst(ctx, x, y, frame, 10, '#2ecc71', 20);
    });
  }
};

// ─── Slash ─────────────────────────────────────────────────────────────

FX.spellSlash = {
  create(x, y, targetX, targetY, color = '#e74c3c') {
    const dx = (targetX || x + 40) - x;
    const dy = (targetY || y) - y;
    const angle = Math.atan2(dy, dx);
    const impactParticles = makeParticles(12, x + fastCos(angle) * 40, y + fastSin(angle) * 40, 3, '#fff', 3);
    return makeEffect(20, function(ctx, frame) {
      const p = frame / this.duration;
      const len = 50 + frame * 4;
      const alpha = 1 - p;
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = color; ctx.lineWidth = 6 * (1 - p * 0.5);
      ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, len * 0.6, -0.6, 0.6); ctx.stroke();
      ctx.globalAlpha = alpha * 0.3; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, len * 0.4, -0.8, 0.8); ctx.stroke();
      ctx.restore();
      drawParticleSet(ctx, impactParticles);
    });
  }
};

// ─── Death burst ───────────────────────────────────────────────────────

FX.deathBurst = {
  create(x, y, color = '#e74c3c') {
    const particles = [
      ...makeParticles(30, x, y, 5, color, 5),
      ...makeParticles(20, x, y, 6, '#f39c12', 3),
      ...makeParticles(15, x, y, 7, '#fff', 2),
    ];
    return makeEffect(50, function(ctx, frame) {
      const p = frame / this.duration;
      const aura = 0.2 * (1 - p);
      ctx.fillStyle = `rgba(0,0,0,${aura})`;
      ctx.beginPath(); ctx.arc(x, y, 20 + frame * 3, 0, Math.PI * 2); ctx.fill();
      const ba = 0.1 * (1 - p);
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 20;
      ctx.globalAlpha = ba;
      ctx.beginPath(); ctx.arc(x, y, 30 + frame * 2.5, 0, Math.PI * 2); ctx.fill();
      drawParticleSet(ctx, particles);
      if (frame > 10) {
        ctx.globalAlpha = 0.3 * (1 - (frame - 10) / 40);
        ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 6;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath(); ctx.arc(x + fastSin(frame*0.05 + i*2.3)*20, y - frame*1.5 + i*10, 2.5, 0, Math.PI*2); ctx.fill();
        }
      }
    });
  }
};

// ─── Critical hit impact ──────────────────────────────────────────────

FX.critImpact = {
  create(x, y, color = '#f1c40f') {
    const particles = [
      ...makeParticles(30, x, y, 6, color, 5),
      ...makeParticles(20, x, y, 5, '#fff', 4),
      ...makeParticles(15, x, y, 4, '#e74c3c', 3),
    ];
    const starAngles = [0, 1.256, 2.513, 3.769, 5.026]; // 5-pointed star
    return makeEffect(35, function(ctx, frame) {
      const p = frame / this.duration;
      // Large flash aura
      const flash = 0.4 * (1 - p);
      ctx.fillStyle = `rgba(241,196,15,${flash})`;
      ctx.shadowColor = color; ctx.shadowBlur = 40;
      ctx.beginPath(); ctx.arc(x, y, 35 + frame * 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Star burst
      ctx.save(); ctx.translate(x, y); ctx.rotate(frame * 0.05);
      ctx.globalAlpha = 1 - p;
      for (const a of starAngles) {
        const len = 20 + frame * 1.5;
        ctx.strokeStyle = color; ctx.lineWidth = 4 * (1 - p);
        ctx.shadowColor = color; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(fastCos(a) * len, fastSin(a) * len);
        ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * (1 - p);
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(fastCos(a) * len * 0.5, fastSin(a) * len * 0.5);
        ctx.lineTo(fastCos(a) * len * 1.2, fastSin(a) * len * 1.2);
        ctx.stroke();
      }
      ctx.restore();
      // Ring burst
      if (frame < 12) ringBurst(ctx, x, y, frame, 12, color, 40);
      if (frame < 8) ringBurst(ctx, x, y, frame, 8, '#fff', 30);
      drawParticleSet(ctx, particles);
      // Screen flash on first frames
      if (frame < 4) {
        ctx.fillStyle = `rgba(255,255,255,${0.15 * (1 - frame/4)})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
    });
  }
};

// ─── Generic burst (for heavy hits) ────────────────────────────────────

FX.burst = {
  create(x, y, color = '#f1c40f') {
    const particles = [
      ...makeParticles(20, x, y, 4, color, 4),
      ...makeParticles(10, x, y, 3, '#fff', 3),
    ];
    return makeEffect(25, function(ctx, frame) {
      const p = frame / this.duration;
      const ba = 0.18 * (1 - p);
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 15;
      ctx.globalAlpha = ba;
      ctx.beginPath(); ctx.arc(x, y, 25 + frame * 2, 0, Math.PI * 2); ctx.fill();
      drawParticleSet(ctx, particles);
      if (frame < 8) ringBurst(ctx, x, y, frame, 8, color, 30);
    });
  }
};

// ─── Gel (crystallize / freeze) ──────────────────────────────────────────

FX.gel = {
  create(x, y) {
    const crystals = Array.from({length: 12}, (_, i) => {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      return { angle: a, dist: 5 + Math.random() * 25, size: 3 + Math.random() * 8, speed: 0.5 + Math.random() * 1.5, phase: Math.random() * 6 };
    });
    return makeEffect(50, function(ctx, frame) {
      const p = frame / this.duration;
      const alpha = 1 - p;
      ctx.fillStyle = `rgba(200,240,255,${alpha * 0.08})`;
      ctx.beginPath(); ctx.arc(x, y, 35 + frame * 0.5 + fastSin(frame * 0.05) * 5, 0, Math.PI * 2); ctx.fill();
      for (const c of crystals) {
        const grow = Math.min(1, frame / (c.phase || 1));
        const cx = x + fastCos(c.angle) * c.dist * grow;
        const cy = y + fastSin(c.angle) * c.dist * grow;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(c.angle + frame * 0.02);
        ctx.globalAlpha = alpha * (0.5 + 0.5 * fastSin(frame * 0.07 + c.angle));
        ctx.fillStyle = '#a8d8f0'; ctx.shadowColor = '#3498db'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(0, -c.size * grow); ctx.lineTo(c.size * 0.4 * grow, 0);
        ctx.lineTo(0, c.size * grow); ctx.lineTo(-c.size * 0.4 * grow, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#85c1e9'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      }
      if (frame < 8) ringBurst(ctx, x, y, frame, 8, '#a8d8f0', 30);
      ctx.globalAlpha = alpha * 0.3;
      ctx.strokeStyle = '#85c1e9'; ctx.lineWidth = 2; ctx.shadowColor = '#3498db'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y, 18 + fastSin(frame * 0.06) * 3, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const ix = x + fastSin(frame * 0.04 + i * 1.2) * 22;
        const iy = y - frame * 1.2 + i * 8;
        ctx.globalAlpha = alpha * (0.3 + 0.3 * fastSin(frame * 0.08 + i));
        ctx.fillStyle = '#d0e8ff'; ctx.shadowColor = '#3498db'; ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.arc(ix, iy, 2 + fastSin(frame * 0.1 + i) * 0.5, 0, Math.PI * 2); ctx.fill();
      }
    });
  }
};

// ─── Zap (thunder chain / spark) ──────────────────────────────────────

FX.zap = {
  create(x, y) {
    const arcs = Array.from({length: 4}, () => ({
      targets: Array.from({length: 3 + Math.floor(Math.random() * 3)}, () => ({
        x: x + (Math.random() - 0.5) * 80, y: y + (Math.random() - 0.5) * 80
      })),
    }));
    return makeEffect(30, function(ctx, frame) {
      const p = frame / this.duration;
      const alpha = 1 - p;
      ctx.globalAlpha = alpha;
      for (const arc of arcs) {
        let lx = x, ly = y;
        for (const t of arc.targets) {
          const zig = (Math.random() - 0.5) * 12;
          ctx.strokeStyle = `rgba(241,196,15,${alpha * (0.3 + 0.3 * Math.random())})`;
          ctx.lineWidth = 2 + Math.random() * 3; ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 8;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(lx, ly);
          ctx.lineTo(t.x + zig, t.y + zig * 0.5); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(t.x, t.y, 2 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
          lx = t.x; ly = t.y;
        }
      }
      ctx.globalAlpha = alpha * 0.2;
      ctx.fillStyle = '#f1c40f'; ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.arc(x, y, 20 + frame * 2, 0, Math.PI * 2); ctx.fill();
      if (frame < 6) ringBurst(ctx, x, y, frame, 6, '#f1c40f', 35);
    });
  }
};

// ─── Bulles (water bubbles) ──────────────────────────────────────────────

FX.bulles = {
  create(x, y) {
    const bubbles = Array.from({length: 15}, () => ({
      dx: (Math.random() - 0.5) * 50, dy: Math.random() * -40,
      size: 2 + Math.random() * 6, speed: 0.5 + Math.random() * 1.5, wobble: Math.random() * Math.PI * 2,
    }));
    return makeEffect(45, function(ctx, frame) {
      const p = frame / this.duration;
      const alpha = 1 - p;
      ctx.fillStyle = `rgba(52,152,219,${alpha * 0.06})`;
      ctx.beginPath(); ctx.arc(x, y, 30 + fastSin(frame * 0.04) * 8, 0, Math.PI * 2); ctx.fill();
      for (const b of bubbles) {
        const bx = x + b.dx + fastSin(frame * 0.06 + b.wobble) * 5;
        const by = y + b.dy + (frame * b.speed) % 60;
        const ba = alpha * (0.3 + 0.3 * fastSin(frame * 0.08 + b.wobble));
        ctx.globalAlpha = ba;
        ctx.strokeStyle = 'rgba(100,180,255,0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx, by, b.size, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(bx - b.size * 0.2, by - b.size * 0.2, b.size * 0.2, 0, Math.PI * 2); ctx.fill();
      }
      if (frame < 10) ringBurst(ctx, x, y, frame, 10, '#3498db', 25);
    });
  }
};

// ─── Ombre (dark shadow tendrils) ────────────────────────────────────────

FX.ombre = {
  create(x, y) {
    const tendrils = Array.from({length: 8}, (_, i) => ({
      angle: (i / 8) * Math.PI * 2, length: 25 + Math.random() * 30,
      width: 3 + Math.random() * 4, phase: 2 + Math.random() * 8,
    }));
    return makeEffect(40, function(ctx, frame) {
      const p = frame / this.duration;
      const alpha = 1 - p;
      ctx.fillStyle = `rgba(40,0,60,${alpha * 0.12})`;
      ctx.beginPath(); ctx.arc(x, y, 35 + frame * 1.5, 0, Math.PI * 2); ctx.fill();
      for (const t of tendrils) {
        const reach = Math.min(1, frame / t.phase);
        const tx = x + fastCos(t.angle) * t.length * reach * (1 + fastSin(frame * 0.05 + t.phase) * 0.2);
        const ty = y + fastSin(t.angle) * t.length * reach * (1 + fastCos(frame * 0.04 + t.phase) * 0.2);
        ctx.globalAlpha = alpha * (0.4 + 0.3 * fastSin(frame * 0.06 + t.angle));
        ctx.strokeStyle = '#4a148c'; ctx.lineWidth = t.width * (1 - p * 0.5);
        ctx.shadowColor = '#4a148c'; ctx.shadowBlur = 10;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 1; s <= 5; s++) {
          const sx = x + (tx - x) * (s / 5) + fastSin(frame * 0.08 + t.angle + s) * 6 * (1 - p);
          ctx.lineTo(sx, y + (ty - y) * (s / 5));
        }
        ctx.stroke();
        ctx.fillStyle = `rgba(106,27,154,${alpha * 0.5})`;
        ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(tx, ty, 3 + fastSin(frame * 0.1 + t.angle) * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      if (frame < 8) ringBurst(ctx, x, y, frame, 8, '#4a148c', 25);
    });
  }
};

// ─── Spell Dark (dark void orb) ──────────────────────────────────────────

FX.spellDark = {
  create(x, y) {
    const orbs = Array.from({length: 6}, (_, i) => ({
      angle: (i / 6) * Math.PI * 2, dist: 15 + Math.random() * 20,
      size: 4 + Math.random() * 6, phase: Math.random() * 4,
    }));
    return makeEffect(45, function(ctx, frame) {
      const p = frame / this.duration;
      const alpha = 1 - p;
      // Dark void core
      ctx.fillStyle = `rgba(20,0,40,${alpha * 0.3})`;
      ctx.beginPath(); ctx.arc(x, y, 30 + frame * 1.2, 0, Math.PI * 2); ctx.fill();
      // Swirling dark orbs
      for (const o of orbs) {
        const reach = Math.min(1, frame / o.phase);
        const ox = x + fastCos(o.angle + frame * 0.04) * o.dist * reach;
        const oy = y + fastSin(o.angle + frame * 0.04) * o.dist * reach;
        ctx.globalAlpha = alpha * (0.5 + 0.3 * fastSin(frame * 0.08 + o.angle));
        ctx.fillStyle = '#2c0a3a'; ctx.shadowColor = '#6a1b9a'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(ox, oy, o.size * reach, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a0520';
        ctx.beginPath(); ctx.arc(ox, oy, o.size * 0.5 * reach, 0, Math.PI * 2); ctx.fill();
      }
      // Dark energy ring
      ctx.globalAlpha = alpha * 0.4;
      ctx.strokeStyle = '#6a1b9a'; ctx.lineWidth = 2; ctx.shadowColor = '#6a1b9a'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(x, y, 18 + fastSin(frame * 0.06) * 4, 0, Math.PI * 2); ctx.stroke();
      // Core glow
      ctx.globalAlpha = alpha * 0.2;
      ctx.fillStyle = '#4a148c';
      ctx.beginPath(); ctx.arc(x, y, 10 + fastSin(frame * 0.1) * 3, 0, Math.PI * 2); ctx.fill();
      if (frame < 8) ringBurst(ctx, x, y, frame, 8, '#6a1b9a', 30);
    });
  }
};

// ─── Spell Poison (toxic cloud) ──────────────────────────────────────────

FX.spellPoison = {
  create(x, y) {
    const bubbles = Array.from({length: 12}, () => ({
      dx: (Math.random() - 0.5) * 60, dy: Math.random() * -50,
      size: 3 + Math.random() * 6, speed: 0.5 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
    }));
    return makeEffect(45, function(ctx, frame) {
      const p = frame / this.duration;
      const alpha = 1 - p;
      // Toxic cloud
      ctx.fillStyle = `rgba(39,174,96,${alpha * 0.1})`;
      ctx.beginPath(); ctx.arc(x, y, 25 + frame * 1.5, 0, Math.PI * 2); ctx.fill();
      // Bubbling toxins
      for (const b of bubbles) {
        const bx = x + b.dx * Math.min(1, frame / 15) + fastSin(frame * 0.04 + b.phase) * 5;
        const by = y + b.dy * Math.min(1, frame / 15) + fastCos(frame * 0.03 + b.phase) * 3;
        const pulse = 0.4 + 0.4 * fastSin(frame * 0.08 + b.phase);
        ctx.globalAlpha = alpha * pulse;
        ctx.fillStyle = '#27ae60'; ctx.shadowColor = '#1a8a4a'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(bx, by, b.size * Math.min(1, frame / 10), 0, Math.PI * 2); ctx.fill();
        // Bubble highlight
        ctx.fillStyle = '#7dcea0'; ctx.globalAlpha = alpha * pulse * 0.3;
        ctx.beginPath(); ctx.arc(bx - 1, by - 1, b.size * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      // Toxic mist wisps
      for (let i = 0; i < 4; i++) {
        const wx = x + fastSin(frame * 0.03 + i * 1.5) * 20;
        const wy = y - frame * 0.8 + i * 10;
        ctx.globalAlpha = alpha * 0.15;
        ctx.fillStyle = '#a8e6cf';
        ctx.beginPath(); ctx.ellipse(wx, wy, 8, 4, fastSin(frame * 0.02 + i) * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      if (frame < 8) ringBurst(ctx, x, y, frame, 8, '#27ae60', 25);
    });
  }
};

// ─── Star (sparkle glow for save points, treasures) ─────────────────────

FX.star = {
  create(x, y, color = '#f1c40f') {
    const sparkles = Array.from({length: 10}, (_, i) => ({
      angle: (i / 10) * Math.PI * 2, dist: 8 + Math.random() * 16,
      size: 1.5 + Math.random() * 3, phase: Math.random() * 6,
    }));
    return makeEffect(999, function(ctx, frame) {
      const pulse = 0.6 + 0.4 * fastSin(frame * 0.05);
      ctx.save(); ctx.translate(x, y); ctx.rotate(frame * 0.02);
      for (const s of sparkles) {
        const alpha = 0.3 + 0.4 * fastSin(frame * 0.04 + s.phase);
        const sx = fastCos(s.angle) * s.dist * pulse;
        const sy = fastSin(s.angle) * s.dist * pulse;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(sx, sy, s.size * (0.5 + 0.5 * fastSin(frame * 0.06 + s.phase)), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = alpha * 0.4;
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.moveTo(sx - s.size, sy); ctx.lineTo(sx + s.size, sy);
        ctx.moveTo(sx, sy - s.size); ctx.lineTo(sx, sy + s.size); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = `rgba(241,196,15,${0.1 + 0.08 * fastSin(frame * 0.06)})`;
      ctx.shadowColor = color; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(x, y, 12 + fastSin(frame * 0.07) * 3, 0, Math.PI * 2); ctx.fill();
    });
  }
};

// ─── Job System Spell Effects ─────────────────────────────────────────

/** Assassin: Triple Lame — 3 slash arcs */
FX.tripleSlash = {
  create(x, y) {
    const arcs = [0, 1.2, 2.4];
    return makeEffect(25, function(ctx, frame) {
      ctx.save(); ctx.translate(x, y);
      for (let i = 0; i < arcs.length; i++) {
        const t = Math.max(0, frame - i * 4) / 18;
        if (t <= 0 || t > 1) continue;
        const angle = arcs[i] + frame * 0.05;
        const radius = 30 + t * 40;
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 3 * (1 - t);
        ctx.beginPath(); ctx.arc(0, 0, radius, angle, angle + 1.2); ctx.stroke();
        const sx = fastCos(angle + 0.6) * radius;
        const sy = fastSin(angle + 0.6) * radius;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(sx, sy, 3 * (1 - t), 0, 6.2832); ctx.fill();
      }
      ctx.restore();
    });
  }
};

/** Paladin: Lumière — holy pillar of light */
FX.holyLight = {
  create(x, y) {
    return makeEffect(45, function(ctx, frame) {
      const t = frame / 45;
      ctx.save();
      const grad = ctx.createLinearGradient(x, y + 50, x, y - 100);
      grad.addColorStop(0, `rgba(241,196,15,${0.8 * (1 - t * 0.3)})`);
      grad.addColorStop(0.5, `rgba(255,255,200,${0.6 * (1 - t * 0.3)})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = Math.min(1, t * 4) * (1 - t);
      ctx.fillRect(x - 15, y - 100, 30, 150);
      ctx.fillStyle = `rgba(255,255,240,${0.5 * (1 - t)})`;
      ctx.fillRect(x - 2, y - 80, 4, 60);
      ctx.fillRect(x - 20, y - 60, 40, 4);
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * 6.2832 + frame * 0.03;
        const dist = 20 + fastSin(frame * 0.1 + i) * 10;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x + fastCos(angle) * dist, y - 40 + fastSin(angle) * dist * 0.5, 2, 0, 6.2832); ctx.fill();
      }
      ctx.restore();
    });
  }
};

/** Archimage: Nadir — void sphere */
FX.voidSphere = {
  create(x, y) {
    const orbs = Array.from({length: 8}, (_, i) => ({
      angle: (i / 8) * 6.2832, dist: 40, speed: 0.03 + i * 0.005,
    }));
    return makeEffect(50, function(ctx, frame) {
      const t = frame / 50;
      ctx.save(); ctx.translate(x, y);
      const coreAlpha = Math.min(1, t * 3) * (1 - t);
      ctx.globalAlpha = coreAlpha;
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
      coreGrad.addColorStop(0, 'rgba(0,0,0,0.9)');
      coreGrad.addColorStop(0.6, 'rgba(80,20,120,0.6)');
      coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath(); ctx.arc(0, 0, 30 + t * 20, 0, 6.2832); ctx.fill();
      for (const o of orbs) {
        o.angle += o.speed;
        const ox = fastCos(o.angle) * o.dist * (1 + t);
        const oy = fastSin(o.angle) * o.dist * 0.6 * (1 + t);
        ctx.globalAlpha = coreAlpha * 0.7;
        ctx.fillStyle = '#2c0a3a';
        ctx.beginPath(); ctx.arc(ox, oy, 5 * (1 - t), 0, 6.2832); ctx.fill();
        ctx.fillStyle = '#6a1b9a';
        ctx.beginPath(); ctx.arc(ox, oy, 3 * (1 - t), 0, 6.2832); ctx.fill();
      }
      ctx.restore();
    });
  }
};

/** Pet Assist: Phoenix Rebirth */
FX.petRebirth = {
  create(x, y) {
    const feathers = Array.from({length: 12}, (_, i) => ({
      angle: (i / 12) * 6.2832, speed: 0.02 + Math.random() * 0.02,
      dist: 5 + Math.random() * 10, size: 3 + Math.random() * 4,
    }));
    return makeEffect(60, function(ctx, frame) {
      const t = frame / 60;
      ctx.save(); ctx.translate(x, y);
      for (const f of feathers) {
        f.angle += f.speed;
        const fx = fastCos(f.angle) * (f.dist + t * 30);
        const fy = fastSin(f.angle) * (f.dist + t * 30) * 0.5 - t * 20;
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath(); ctx.arc(fx, fy, f.size * (1 - t), 0, 6.2832); ctx.fill();
        ctx.fillStyle = '#f39c12';
        ctx.beginPath(); ctx.arc(fx, fy, f.size * 0.5 * (1 - t), 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = (1 - t) * 0.5;
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.quadraticCurveTo(15, -10, 0, 5);
      ctx.quadraticCurveTo(-15, -10, 0, -20);
      ctx.fill();
      ctx.restore();
    });
  }
};

/** Pet Assist: Wolf Shadow Bite */
FX.shadowBite = {
  create(x, y) {
    return makeEffect(30, function(ctx, frame) {
      const t = frame / 30;
      ctx.save(); ctx.translate(x, y);
      ctx.globalAlpha = (1 - t) * 0.6;
      ctx.fillStyle = '#1a0520';
      ctx.beginPath();
      ctx.moveTo(-20, -10 + t * 15);
      ctx.lineTo(0, 5 + t * 10);
      ctx.lineTo(20, -10 + t * 15);
      ctx.lineTo(15, -5 + t * 15);
      ctx.lineTo(0, 0 + t * 10);
      ctx.lineTo(-15, -5 + t * 15);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = (1 - t) * 0.4;
      ctx.fillStyle = '#6a1b9a';
      ctx.beginPath(); ctx.arc(0, 0, 25 * t, 0, 6.2832); ctx.fill();
      ctx.restore();
    });
  }
};
