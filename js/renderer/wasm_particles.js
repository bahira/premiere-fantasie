/**
 * WASM Particle Pool — High-performance particle system using Rust WASM
 * Falls back to JS when WASM is not available
 */
import { initWasm, isReady, createParticleSystem, addParticlesWasm, updateParticlesWasm, exportParticleRenderData, clearParticlesWasm } from '../engine/wasm_bridge.js';

let _wasmPool = null;
let _wasmAvailable = false;

/**
 * Initialize the WASM particle pool
 */
export async function initParticlePool() {
  const wasm = await initWasm();
  if (wasm) {
    _wasmPool = createParticleSystem(2000, 120); // 2000 particles, gravity 120
    _wasmAvailable = true;
    console.log('[Particles] WASM pool initialized (2000 max)');
  } else {
    console.log('[Particles] JS fallback');
  }
}

/**
 * Add particles to the pool
 * @param {Array} particles - [{x,y,vx,vy,life,decay,size,color:{r,g,b}}, ...]
 */
export function addParticles(particles) {
  if (!_wasmAvailable || !_wasmPool) return false;
  addParticlesWasm(_wasmPool, particles);
  return true;
}

/**
 * Update all particles (call each frame)
 * @param {number} dt - delta time in seconds
 */
export function updateParticles(dt) {
  if (!_wasmAvailable || !_wasmPool) return false;
  updateParticlesWasm(_wasmPool, dt);
  return true;
}

/**
 * Draw all particles to canvas
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawParticles(ctx) {
  if (!_wasmAvailable || !_wasmPool) return false;
  
  const renderData = exportParticleRenderData(_wasmPool);
  if (!renderData || renderData.length === 0) return true;
  
  ctx.save();
  const stride = 7; // x, y, size, r, g, b, alpha
  const n = renderData.length / stride;
  for (let i = 0, idx = 0; i < n; i++, idx += stride) {
    const x = renderData[idx];
    const y = renderData[idx + 1];
    const sz = renderData[idx + 2];
    const a = renderData[idx + 6];
    if (a < 0.05) continue; // skip nearly-invisible particles
    const r = Math.round(renderData[idx + 3] * 255);
    const g = Math.round(renderData[idx + 4] * 255);
    const b = Math.round(renderData[idx + 5] * 255);
    ctx.globalAlpha = a;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    if (sz < 4) {
      // fillRect is much cheaper than stroking a circle path for tiny particles
      ctx.fillRect(x - sz, y - sz, sz * 2, sz * 2);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, sz, 0, 6.2832);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  return true;
}

/**
 * Clear all particles
 */
export function clearParticles() {
  if (_wasmAvailable && _wasmPool) {
    clearParticlesWasm(_wasmPool);
  }
}

/**
 * Get particle count
 */
export function getParticleCount() {
  if (!_wasmAvailable || !_wasmPool) return 0;
  return _wasmPool.len();
}

/**
 * Is WASM available?
 */
export function isWasmReady() {
  return _wasmAvailable;
}
