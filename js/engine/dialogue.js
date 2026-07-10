// engine/dialogue.js — FFIX-style dialogue box + scene playback
// Grounded Loop v9: full-screen overlay click, keyboard Enter/Space, RAF typewriter, cleanup
import { audio } from './audio.js';

export class Dialogue {
  constructor() {
    this.queue = [];
    this.active = null;
    this.boxEl = null;
    this.overlay = null;
    this.onComplete = null;
    this._twActive = false;
    this._twFrame = null;
    this._pendingKeyHandler = null;
    this._build();
  }

  _build() {
    if (this.overlay) return;

    // Full-screen invisible overlay — catches clicks anywhere
    const overlay = document.createElement('div');
    overlay.id = 'dialogue-overlay';
    overlay.className = 'hidden';

    // Dialogue box (centered at bottom)
    const box = document.createElement('div');
    box.id = 'dialogue-box';
    box.innerHTML = `
      <div id="dlg-portrait"><canvas id="dlg-portrait-canvas" width="90" height="90"></canvas></div>
      <div id="dlg-content">
        <div id="dlg-speaker"></div>
        <div id="dlg-text"></div>
        <div id="dlg-hint">▼ Clic / Espace pour continuer</div>
      </div>`;

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.boxEl = box;

    // Click ANYWHERE on screen = advance dialogue (FFIX style)
    overlay.addEventListener('click', (e) => {
      // Don't swallow clicks on interactive child elements (none currently, but safe)
      this.advance();
    });

    // Keyboard Enter / Space / Escape = advance
    this._pendingKeyHandler = (e) => {
      if (overlay.classList.contains('hidden')) return;
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.advance();
      }
    };
    document.addEventListener('keydown', this._pendingKeyHandler);
  }

  play(scenes, onComplete) {
    this.queue = [...scenes];
    this.onComplete = onComplete || (() => {});
    this._portraitOverride = null;
    this.overlay.classList.remove('hidden');
    this._next();
  }

  // Convenience: show({ speaker, portrait, lines, onDone })
  show({ speaker = '?', portrait = null, lines = [], onDone = null }) {
    const scenes = (Array.isArray(lines) ? lines : [lines]).map(text => ({ speaker, text, portrait }));
    this.play(scenes, onDone);
    if (portrait) this._portraitOverride = portrait;
  }

  _next() {
    if (this.queue.length === 0) {
      this.overlay.classList.add('hidden');
      const cb = this.onComplete;
      this.onComplete = null;
      this._portraitOverride = null;
      if (cb) cb();
      return;
    }
    this.active = this.queue.shift();
    audio.sfx('cursor');
    const p = document.getElementById('dlg-portrait');
    const sp = document.getElementById('dlg-speaker');
    const tx = document.getElementById('dlg-text');
    sp.textContent = this.active.speaker;
    tx.textContent = '';
    this._drawPortrait(p, this._portraitOverride || this.active.speaker);
    this._typewriter(tx, this.active.text);
  }

  _typewriter(el, text) {
    // Cancel any previous typewriter
    this._cancelTw();

    this._twActive = true;
    let i = 0;
    const len = text.length;

    const tick = () => {
      if (!this._twActive) return;
      if (i >= len) {
        this._twActive = false;
        this._twFrame = null;
        return;
      }
      el.textContent = text.slice(0, i + 1);
      if (i % 2 === 0) audio.beep(220 + (i % 6) * 30, 0.02, 'square', 0.05);
      i++;
      this._twFrame = requestAnimationFrame(() => {
        setTimeout(tick, 18); // ~55 chars/sec, smoother than 22ms raw setTimeout chain
      });
    };
    tick();
  }

  _cancelTw() {
    this._twActive = false;
    if (this._twFrame) {
      cancelAnimationFrame(this._twFrame);
      this._twFrame = null;
    }
  }

  advance() {
    if (this._twActive) {
      // Skip typewriter instantly
      this._cancelTw();
      const tx = document.getElementById('dlg-text');
      if (this.active) tx.textContent = this.active.text;
      return;
    }
    this._next();
  }

  // Portrait image mapping (name -> sprites/portraits/*.png)
  static PORTRAIT_MAP = {
    'Luan': 'sprites/portraits/luan.png',
    'Sir Aldric': 'sprites/portraits/aldric.png',
    'Aldric': 'sprites/portraits/aldric.png',
    'Mira': 'sprites/portraits/mira.png',
    'Selia': 'sprites/portraits/selia.png',
    'Voix': null,
    '???': null,
  };

  _drawPortrait(container, key) {
    if (!container) return;
    // Try real portrait image first
    const imgSrc = Dialogue.PORTRAIT_MAP[key];
    let img = container.querySelector('img');
    let cv = container.querySelector('canvas');
    if (imgSrc) {
      if (!img) {
        img = document.createElement('img');
        img.width = 100; img.height = 100;
        container.innerHTML = '';
        container.appendChild(img);
      }
      if (img.src !== new URL(imgSrc, location.href).href) {
        img.src = imgSrc;
        img.alt = key;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:12px;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.5));animation:dlgPortraitIn .3s var(--ease) both;';
      }
      // Hide canvas if present
      if (cv) cv.style.display = 'none';
      return;
    }
    // Fallback: procedural canvas portrait
    if (img) { img.style.display = 'none'; }
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = 90; cv.height = 90;
      container.appendChild(cv);
    }
    cv.style.display = '';
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 90, 90);
    // Resolve palette by key (speaker name or role)
    const P = this._facePalette(key);
    const cx = 45, cy = 48;
    // Background panel
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, 90, 90);
    // Neck
    ctx.fillStyle = P.skinS;
    ctx.fillRect(cx - 7, cy + 14, 14, 14);
    // Head
    ctx.fillStyle = P.skin;
    ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Hair (top)
    if (P.hair) {
      ctx.fillStyle = P.hair;
      ctx.beginPath(); ctx.arc(cx, cy - 4, 21, Math.PI * 1.04, Math.PI * 1.96); ctx.fill();
      ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2; ctx.stroke();
      // Spiky bits for some
      if (P.spiky) {
        ctx.beginPath();
        ctx.moveTo(cx - 16, cy - 14); ctx.lineTo(cx - 10, cy - 26); ctx.lineTo(cx - 4, cy - 16);
        ctx.moveTo(cx - 2, cy - 18); ctx.lineTo(cx, cy - 30); ctx.lineTo(cx + 2, cy - 18);
        ctx.moveTo(cx + 4, cy - 16); ctx.lineTo(cx + 10, cy - 26); ctx.lineTo(cx + 16, cy - 14);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    // Eyes
    if (P.eyeColor) {
      ctx.fillStyle = P.eyeColor;
      ctx.shadowColor = P.eyeColor; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(cx - 7, cy - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 7, cy - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath(); ctx.arc(cx - 7, cy - 2, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 7, cy - 2, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Mouth
    ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 5, cy + 9); ctx.lineTo(cx + 5, cy + 9); ctx.stroke();
    // Accessories
    if (P.crown) {
      ctx.fillStyle = '#f1c40f'; ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy - 18); ctx.lineTo(cx - 10, cy - 28); ctx.lineTo(cx - 4, cy - 18);
      ctx.lineTo(cx, cy - 30); ctx.lineTo(cx + 4, cy - 18); ctx.lineTo(cx + 10, cy - 28);
      ctx.lineTo(cx + 16, cy - 18); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (P.helmet) {
      ctx.fillStyle = P.armor || '#4a5a6a';
      ctx.beginPath(); ctx.arc(cx, cy - 4, 22, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 10, cy - 2); ctx.lineTo(cx - 4, cy + 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 4, cy + 1); ctx.lineTo(cx + 10, cy - 2); ctx.stroke();
    }
    if (P.tiara) {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(cx, cy - 19, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    if (P.hat) {
      ctx.fillStyle = P.hatColor || '#8b5e3c';
      ctx.beginPath(); ctx.ellipse(cx, cy - 14, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy - 22, 14, 10, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  _facePalette(key) {
    const map = {
      'Luan':    { skin:'#f5d6b8', skinS:'#d4b090', hair:'#8b5e3c', eyeColor:'#fff', spiky:true },
      'Selia':   { skin:'#f5dcc4', skinS:'#d4b49a', hair:'#e74c3c', eyeColor:'#fff', spiky:false, tiara:true },
      'Aldric':  { skin:'#f0d5b0', skinS:'#d0b490', armor:'#4a5a6a', helmet:true },
      'Mira':    { skin:'#e8c9a0', skinS:'#c8a880', hair:'#9b59b6', eyeColor:'#9b59b6', spiky:true },
      'Cid':     { skin:'#d5b8a0', skinS:'#b09078', hat:true, hatColor:'#1a5276' },
      'Kuja':    { skin:'#d5b8a0', skinS:'#b09078', hair:'#f1c40f', eyeColor:'#c0392b', spiky:true },
      'Dark Knight': { skin:'#c0a080', skinS:'#a08060', armor:'#2c3e50', helmet:true },
      '?':       { skin:'#cfcfcf', skinS:'#a0a0a0', hair:'#888', eyeColor:'#c0392b', spiky:true },
      'Narrateur': { skin:'#e8e0d0', skinS:'#c0b8a8', hat:true, hatColor:'#6a1b9a' },
      'villager': { skin:'#e0b890', skinS:'#c09870', hat:true, hatColor:'#5d4037' },
      'merchant': { skin:'#e8c9a0', skinS:'#c8a880', hat:true, hatColor:'#c0392b' },
      'elder':    { skin:'#d5c0a0', skinS:'#b0a080', hat:true, hatColor:'#9b59b6' },
      'hero':     { skin:'#f0d5b0', skinS:'#d0b490', armor:'#4a5a6a', helmet:true },
      'child':    { skin:'#f5dcc4', skinS:'#d4b49a', hair:'#e67e22', eyeColor:'#fff', spiky:false },
      'guard':    { skin:'#e0b890', skinS:'#c09870', armor:'#34495e', helmet:true },
      'chest':    { skin:'#b7791f', skinS:'#8a5a14', hat:true, hatColor:'#b7791f' },
      'sage':     { skin:'#d5c0a0', skinS:'#b0a080', hat:true, hatColor:'#27ae60' },
      'innkeeper': { skin:'#e8c9a0', skinS:'#c8a880', hat:true, hatColor:'#8e44ad' },
      'priest':   { skin:'#e0d0c0', skinS:'#c0b0a0', hat:true, hatColor:'#f1c40f' },
    };
    return map[key] || map['villager'];
  }

  isPlaying() { return this.overlay && !this.overlay.classList.contains('hidden'); }
}

export const dialogue = new Dialogue();
