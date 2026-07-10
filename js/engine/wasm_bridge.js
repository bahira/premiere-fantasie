/**
 * WASM Bridge — High-performance Rust WASM acceleration layer
 * Provides particle physics, sin approximations, damage calc, and gradient rendering
 */
let _wasm = null;
let _ready = false;
let _initPromise = null;

/**
 * Initialize WASM module
 */
export async function initWasm() {
  if (_ready) return _wasm;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      // Dynamically load the wasm-bindgen glue code (it auto-resolves the
      // .wasm relative to its own location via import.meta.url)
      const mod = await import('../wasm/ff_wasm_core.js');
      await mod.default();
      _wasm = mod;
      _ready = true;
      console.log('[WASM] ✓ Loaded — 33KB binary');
      return _wasm;
    } catch (err) {
      console.warn('[WASM] ✗ Failed to load, falling back to JS:', err.message);
      _initPromise = null;
      return null;
    }
  })();

  return _initPromise;
}

/**
 * Is WASM available?
 */
export function isReady() {
  return _ready;
}

// ─── Particle System (WASM-accelerated) ─────────────────────────────────────

/**
 * Create a WASM particle system
 */
export function createParticleSystem(maxParticles = 2000, gravity = 120) {
  if (!_ready) return null;
  return new _wasm.ParticleSystem(maxParticles, gravity);
}

/**
 * Add particles from JS particle array to WASM system
 * @param {ParticleSystem} ps - WASM particle system
 * @param {Array} particles - JS particle array [{x,y,vx,vy,life,decay,size,color:{r,g,b}}, ...]
 */
export function addParticlesWasm(ps, particles) {
  if (!ps || !particles.length) return;
  const data = new Float32Array(particles.length * 10);
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const idx = i * 10;
    data[idx] = p.x;
    data[idx + 1] = p.y;
    data[idx + 2] = p.vx;
    data[idx + 3] = p.vy;
    data[idx + 4] = p.life;
    data[idx + 5] = p.decay;
    data[idx + 6] = p.size;
    data[idx + 7] = p.color ? p.color.r : 255;
    data[idx + 8] = p.color ? p.color.g : 255;
    data[idx + 9] = p.color ? p.color.b : 255;
  }
  ps.add_batch(data);
}

/**
 * Update all particles in WASM (bulk physics)
 */
export function updateParticlesWasm(ps, dt) {
  if (!ps) return;
  ps.update(dt);
}

/**
 * Export render-ready data from WASM particle system
 * Returns Float32Array: [x, y, size, r, g, b, alpha, ...] per particle
 */
export function exportParticleRenderData(ps) {
  if (!ps || ps.len() === 0) return null;
  return ps.export_render_data();
}

/**
 * Clear WASM particle system
 */
export function clearParticlesWasm(ps) {
  if (ps) ps.clear();
}

// ─── Math Acceleration ──────────────────────────────────────────────────────

/**
 * Fast sine approximation via WASM (Bhaskara I)
 * ~2.5x faster than Math.sin on Chrome
 */
export function fastSin(x) {
  if (!_ready) return Math.sin(x);
  return _wasm.fast_sin(x);
}

/**
 * Fast cosine approximation via WASM
 */
export function fastCos(x) {
  if (!_ready) return Math.cos(x);
  return _wasm.fast_cos(x);
}

/**
 * Batch compute sine values into pre-allocated output array
 */
export function batchSin(out, start, step) {
  if (!_ready) {
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.sin(start + step * i);
    }
    return;
  }
  _wasm.batch_sin(out, start, step);
}

// ─── Damage Calculation ─────────────────────────────────────────────────────

/**
 * Calculate battle damage via WASM
 */
export function calcDamage({
  str = 10, mag = 10, def = 5, mdef = 5,
  power = 1.0, level = 1, isMagic = false,
  elementBonus = 0, crit = false, combo = 0
} = {}) {
  if (!_ready) {
    // JS fallback
    const rnd = 0.85 + (Math.sin(level * 7.3) * 0.5 + 0.5) * 0.3;
    const atk = isMagic ? mag : str;
    const df = isMagic ? mdef : def;
    let dmg = ((20 + power * 25) * (1 + atk / 15) * level * rnd - df * 0.5) || 1;
    if (crit) dmg *= 2;
    if (combo > 0) dmg *= 1 + combo * 0.25;
    dmg *= 1 + elementBonus;
    return Math.floor(dmg);
  }
  return _wasm.calc_damage(str, mag, def, mdef, power, level, isMagic, elementBonus, crit, combo);
}

// ─── Pixel Buffer Rendering ─────────────────────────────────────────────────

/**
 * Render a gradient to an ImageData buffer via WASM
 */
export function renderGradient(buf, width, height, topColor, botColor) {
  if (!_ready) return false;
  _wasm.render_gradient(
    buf, width, height,
    topColor[0], topColor[1], topColor[2],
    botColor[0], botColor[1], botColor[2]
  );
  return true;
}

/**
 * Render stars to an ImageData buffer via WASM (additive blend)
 */
export function renderStars(buf, width, height, count, frame) {
  if (!_ready) return false;
  _wasm.render_stars(buf, width, height, count, frame);
  return true;
}
