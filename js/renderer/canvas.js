// renderer/canvas.js — Core Canvas engine: layers, resize, animation loop, post-processing
// Provides a managed <canvas> with z-layer compositing, RAF loop, particles, screen shake,
// and premium post-processing (vignette + scanlines)

export class CanvasLayer {
  constructor(width, height, zIndex = 0) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.cssText = `position:fixed;inset:0;width:100%;height:100%;z-index:${zIndex};pointer-events:none;display:block;`;
    this.ctx = this.canvas.getContext('2d');
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  attach() {
    document.body.prepend(this.canvas);
  }

  detach() {
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}

export class CanvasEngine {
  constructor() {
    this.layers = [];
    this._raf = null;
    this._running = false;
    this._animations = [];
    this._particles = [];
    this._shakeTime = 0;
    this._shakeIntensity = 0;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this._ppLayer = null;        // post-processing layer (topmost)
    this.postProcess = true;     // enable/disable vignette + scanlines
    this._tickCallbacks = [];    // [{ layer, fn }] — called each frame for per-layer draw

    window.addEventListener('resize', () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      for (const L of this.layers) L.resize(this.width, this.height);
    });
  }

  addLayer(zIndex = 0) {
    const L = new CanvasLayer(this.width, this.height, zIndex);
    L.attach();
    this.layers.push(L);
    this.layers.sort((a, b) => {
      const za = parseInt(a.canvas.style.zIndex) || 0;
      const zb = parseInt(b.canvas.style.zIndex) || 0;
      return za - zb;
    });
    // Tick callbacks for this layer
    L._cbs = [];
    L._onTick = (fn) => { this._tickCallbacks.push({ layer: L, fn }); };
    L._offTick = (fn) => {
      this._tickCallbacks = this._tickCallbacks.filter(cb => cb.layer !== L || cb.fn !== fn);
    };
    return L;
  }

  removeLayer(L) {
    L.detach();
    this.layers = this.layers.filter(l => l !== L);
  }

  screenShake(intensity = 6, duration = 300) {
    this._shakeIntensity = intensity;
    this._shakeTime = duration;
  }

  // Unified particle system: handles both:
  //   - Traditional { alive, update(dt), draw(ctx) }
  //   - Effect objects { alive, active, frame, duration, update(dt), draw(ctx) }
  drawParticles(ctx) {
    for (const p of this._particles) {
      if (p.alive) p.draw(ctx);
    }
  }

  addParticle(p) { this._particles.push(p); }
  addParticles(arr) { for (const p of arr) this._particles.push(p); }

  addAnimation(fn, duration = 1000) {
    const a = { fn, start: performance.now(), duration };
    this._animations.push(a);
    return a;
  }

  // ── Post-processing (vignette + scanlines) ────────────────────────────

  _drawPostProcess() {
    if (!this.postProcess || !this._ppLayer) return;
    const ctx = this._ppLayer.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Cache vignette gradient (only recreate on resize)
    if (!this._vignetteGrad || this._vignetteW !== this.width) {
      this._vignetteGrad = ctx.createRadialGradient(
        this.width / 2, this.height / 2, this.height * 0.25,
        this.width / 2, this.height / 2, this.height * 0.85
      );
      this._vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
      this._vignetteGrad.addColorStop(0.6, 'rgba(0,0,0,0.05)');
      this._vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.40)');
      this._vignetteW = this.width;
    }
    ctx.fillStyle = this._vignetteGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Scanlines — cached offscreen canvas, only recreate on resize
    if (!this._scanlineCanvas || this._scanlineW !== this.width || this._scanlineH !== this.height) {
      this._scanlineCanvas = document.createElement('canvas');
      this._scanlineCanvas.width = this.width;
      this._scanlineCanvas.height = this.height;
      const sctx = this._scanlineCanvas.getContext('2d');
      sctx.fillStyle = 'rgba(0,0,0,0.045)';
      for (let y = 0; y < this.height; y += 3) {
        sctx.fillRect(0, y, this.width, 1);
      }
      this._scanlineW = this.width;
      this._scanlineH = this.height;
    }
    ctx.drawImage(this._scanlineCanvas, 0, 0);

    // Subtle film grain — single cached tile blitted (no per-frame random rect loop)
    if (!_filmGrain) _filmGrain = _makeFilmGrainTile();
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(_filmGrain, 0, 0, this.width, this.height);
    ctx.restore();
  }

  // ── Start / Stop ──────────────────────────────────────────────────────

  start() {
    if (this._running) return;
    // Create post-processing layer (topmost)
    if (!this._ppLayer) {
      this._ppLayer = this.addLayer(9999);
    }
    this._running = true;

    const loop = (now) => {
      if (!this._running) return;

      // Screen shake offset
      let sx = 0, sy = 0;
      if (this._shakeTime > 0) {
        const p = this._shakeTime / 300;
        sx = (Math.random() - 0.5) * this._shakeIntensity * p;
        sy = (Math.random() - 0.5) * this._shakeIntensity * p;
        this._shakeTime -= 16;
      }
      for (const L of this.layers) {
        if (L === this._ppLayer) continue; // never shake PP layer
        // Only write style.transform when it actually changes (avoids per-frame style recalc / layout thrash)
        const tf = sx || sy ? `translate(${sx}px,${sy}px)` : '';
        if (L._lastTf !== tf) {
          L.canvas.style.transform = tf;
          L._lastTf = tf;
        }
      }

      // Update particles (in-place filter, no allocation) — only alive particles remain after compaction
      let pi = 0;
      for (let i = 0; i < this._particles.length; i++) {
        const p = this._particles[i];
        if (p.alive && typeof p.update === 'function') p.update(16);
        if (p.alive) this._particles[pi++] = p;
      }
      this._particles.length = pi;

      // Update animations (in-place filter)
      let ai = 0;
      for (let i = 0; i < this._animations.length; i++) {
        const a = this._animations[i];
        const progress = Math.min(1, (now - a.start) / a.duration);
        if (a.fn(progress) !== false) this._animations[ai++] = a;
      }
      this._animations.length = ai;

      // Per-layer tick callbacks
      for (const cb of this._tickCallbacks) { cb.fn(16, cb.layer.ctx); }

      // Post-processing
      this._drawPostProcess();

      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    for (const L of this.layers) L.clear();
  }

  destroy() {
    this.stop();
    for (const L of this.layers) L.detach();
    this.layers = [];
    this._particles = [];
    this._animations = [];
    this._ppLayer = null;
  }
}

// Singleton for the game
export const canvas = new CanvasEngine();

// ── Cached film-grain tile (built once, stretched to full screen per frame) ──
let _filmGrain = null;
function _makeFilmGrainTile() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.random() < 0.5) {
      const v = (200 + Math.random() * 55) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 22; // ~0.086 alpha specks
    } else {
      d[i + 3] = 0;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
