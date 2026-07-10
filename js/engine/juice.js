// engine/juice.js — Game Feel / Juice engine (AAA polish)
// Screen shake, hitstop, damage numbers, impact flash, combo counter, zoom punch.
// Pooled, capped at 50 active effects. Hooked by battle_ui + sprites + audio.

import { audio } from './audio.js';

const MAX_FLOATERS = 50;
const MAX_SHAKES = 4;

class Juice {
  constructor() {
    this._floaterPool = [];
    this._activeFloaters = [];
    this._shake = { mag: 0, decay: 0.9, x: 0, y: 0 };
    this._hitstop = 0; // frames remaining
    this._flash = { a: 0, color: '255,255,255' };
    this._zoom = 1;
    this._zoomTarget = 1;
    this._combo = 0;
    this._comboTimer = 0;
    this._lastHitTime = 0;
    this._enabled = true;
    this._onCombo = null; // callback(comboCount)
  }

  reset() {
    this._activeFloaters.length = 0;
    this._shake.mag = 0; this._shake.x = 0; this._shake.y = 0;
    this._hitstop = 0; this._flash.a = 0; this._zoom = 1; this._zoomTarget = 1;
    this._combo = 0; this._comboTimer = 0;
  }

  setEnabled(v) { this._enabled = v; }
  setComboCallback(cb) { this._onCombo = cb; }

  // ─── Screen Shake ────────────────────────────────────────────────
  shake(mag = 6) {
    if (!this._enabled) return;
    this._shake.mag = Math.min(20, this._shake.mag + mag);
  }

  // ─── Hitstop (freeze frames) ────────────────────────────────────
  hitstop(frames = 4) {
    if (!this._enabled) return;
    this._hitstop = Math.max(this._hitstop, frames);
  }

  // ─── Flash ──────────────────────────────────────────────────────
  flash(color = '255,255,255', a = 0.5) {
    if (!this._enabled) return;
    this._flash.color = color;
    this._flash.a = Math.max(this._flash.a, a);
  }

  // ─── Zoom punch ─────────────────────────────────────────────────
  zoomPunch(amount = 0.06) {
    if (!this._enabled) return;
    this._zoomTarget = 1 + amount;
  }

  // ─── Damage / Heal / Status numbers ────────────────────────────
  floater(x, y, text, kind = 'damage') {
    if (!this._enabled) return;
    if (this._activeFloaters.length >= MAX_FLOATERS) {
      const old = this._activeFloaters.shift();
      if (old) this._floaterPool.push(old);
    }
    let f = this._floaterPool.pop();
    if (!f) f = { x: 0, y: 0, text: '', kind: '', life: 0, vy: 0, scale: 1, color: '' };
    f.x = x; f.y = y; f.text = String(text); f.kind = kind;
    f.life = 1; f.vy = -1.1; f.scale = kind === 'crit' ? 1.5 : 1;
    f.color = this._floaterColor(kind);
    this._activeFloaters.push(f);
  }

  _floaterColor(kind) {
    switch (kind) {
      case 'heal': return '#5cff8f';
      case 'crit': return '#ffd23f';
      case 'miss': return '#bbbbbb';
      case 'mp': return '#5cc8ff';
      case 'status': return '#c77dff';
      case 'exp': return '#ffe08a';
      default: return '#ffffff';
    }
  }

  // ─── Combo ──────────────────────────────────────────────────────
  registerHit() {
    const now = performance.now();
    if (now - this._lastHitTime > 1500) this._combo = 0;
    this._combo++;
    this._lastHitTime = now;
    this._comboTimer = 90;
    if (this._onCombo) this._onCombo(this._combo);
    if (this._combo > 1) audio.sfx('combo');
  }
  getCombo() { return this._combo; }

  // ─── Per-frame update (call from battle tick) ───────────────────
  update() {
    // Hitstop freezes everything else
    if (this._hitstop > 0) { this._hitstop--; return; }

    // Shake decay
    if (this._shake.mag > 0.2) {
      this._shake.mag *= this._shake.decay;
      this._shake.x = (Math.random() * 2 - 1) * this._shake.mag;
      this._shake.y = (Math.random() * 2 - 1) * this._shake.mag;
    } else { this._shake.mag = 0; this._shake.x = 0; this._shake.y = 0; }

    // Flash decay
    if (this._flash.a > 0) this._flash.a = Math.max(0, this._flash.a - 0.04);

    // Zoom ease
    this._zoom += (this._zoomTarget - this._zoom) * 0.2;
    this._zoomTarget += (1 - this._zoomTarget) * 0.1;

    // Combo timer
    if (this._comboTimer > 0) { this._comboTimer--; if (this._comboTimer === 0) this._combo = 0; }

    // Floaters
    for (let i = this._activeFloaters.length - 1; i >= 0; i--) {
      const f = this._activeFloaters[i];
      f.y += f.vy; f.vy *= 0.96; f.life -= 0.018;
      if (f.life <= 0) {
        this._activeFloaters.splice(i, 1);
        this._floaterPool.push(f);
      }
    }
  }

  // ─── Apply transforms (call before drawing battle) ──────────────
  applyCamera(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx + this._shake.x, cy + this._shake.y);
    ctx.scale(this._zoom, this._zoom);
    ctx.translate(-cx, -cy);
  }
  restoreCamera(ctx) { ctx.restore(); }

  // ─── Draw overlays (call after battle draw) ─────────────────────
  drawOverlay(ctx, w, h) {
    if (this._flash.a > 0) {
      ctx.fillStyle = `rgba(${this._flash.color},${this._flash.a})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this._activeFloaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.font = `bold ${Math.floor(22 * f.scale)}px "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // ─── Combo HUD ──────────────────────────────────────────────────
  drawCombo(ctx, w, h) {
    if (this._combo < 2) return;
    const scale = 1 + Math.min(0.5, this._comboTimer / 180);
    ctx.save();
    ctx.translate(w / 2, 90);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 40px "Trebuchet MS", sans-serif';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(this._combo + ' COMBO', 0, 0);
    const hue = (this._combo * 20) % 360;
    ctx.fillStyle = `hsl(${hue},90%,65%)`;
    ctx.fillText(this._combo + ' COMBO', 0, 0);
    ctx.restore();
  }
}

export const juice = new Juice();
