// engine/field_map.js — Field exploration with movement, encounters, POIs
// The player moves with WASD/arrows on a biome background.
// Walking through encounter zones triggers random battles.
// Walking near POIs shows interaction prompts.

import { fastSin, fastCos } from './wasm_bridge.js';

export class FieldMap {
  constructor(opts = {}) {
    this.player = { x: opts.startX || 400, y: opts.startY || 300 };
    this.width = opts.width || 800;
    this.height = opts.height || 600;
    this.bounds = opts.bounds || { top: 30, bottom: 570, left: 30, right: 770 };
    this.encounterZones = opts.encounterZones || [];
    this.pois = opts.pois || [];
    this.npcs = opts.npcs || [];
    this.speed = opts.speed || 3;
    this._stepCounter = 0;
    this._encounterCooldown = 0;
    this._keys = {};
    this._nearPOI = null;
    this._nearNPC = null;
    this._moveAnim = 0;
    this._npcTalkedTo = {};
    // Mouse click-to-move
    this._targetPos = null;
    this._clickRadius = 8; // stop distance
    this._canvas = null;
    this._mouseDown = false;
  }

  /** Set the canvas reference for mouse coordinate mapping */
  setCanvas(canvas) {
    this._canvas = canvas;
    if (!canvas) return;
    this._clickHandler = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;
      this._targetPos = { x: cx, y: cy };
    };
    this._mouseDownHandler = (e) => { this._mouseDown = true; };
    this._mouseUpHandler = (e) => { this._mouseDown = false; };
    canvas.addEventListener('click', this._clickHandler);
    canvas.addEventListener('mousedown', this._mouseDownHandler);
    canvas.addEventListener('mouseup', this._mouseUpHandler);
  }

  /** Remove mouse listeners */
  destroy() {
    if (this._canvas) {
      this._canvas.removeEventListener('click', this._clickHandler);
      this._canvas.removeEventListener('mousedown', this._mouseDownHandler);
      this._canvas.removeEventListener('mouseup', this._mouseUpHandler);
    }
  }

  // ─── Input ─────────────────────────────────────────────────────────
  keyDown(key) { this._keys[key] = true; }
  keyUp(key) { this._keys[key] = false; }
  isMoving() {
    return !!(this._keys['w'] || this._keys['arrowup'] ||
              this._keys['s'] || this._keys['arrowdown'] ||
              this._keys['a'] || this._keys['arrowleft'] ||
              this._keys['d'] || this._keys['arrowright']);
  }

  // ─── Per-frame update: returns encounter or null ────────────────────
  update() {
    let dx = 0, dy = 0;
    if (this._keys['w'] || this._keys['arrowup']) dy = -this.speed;
    if (this._keys['s'] || this._keys['arrowdown']) dy = this.speed;
    if (this._keys['a'] || this._keys['arrowleft']) dx = -this.speed;
    if (this._keys['d'] || this._keys['arrowright']) dx = this.speed;

    // Mouse click-to-move (only if no keyboard input)
    if (dx === 0 && dy === 0 && this._targetPos) {
      const t = this._targetPos;
      const pdx = t.x - this.player.x;
      const pdy = t.y - this.player.y;
      const dist = Math.sqrt(pdx * pdx + pdy * pdy);
      if (dist > this._clickRadius) {
        // Move toward target
        const nx = pdx / dist;
        const ny = pdy / dist;
        dx = nx * this.speed;
        dy = ny * this.speed;
      } else {
        this._targetPos = null; // arrived
      }
    }

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

    const moving = (dx !== 0 || dy !== 0);
    if (moving) {
      this._moveAnim += 0.15;
      const newX = this.player.x + dx;
      const newY = this.player.y + dy;
      if (newX >= this.bounds.left && newX <= this.bounds.right) this.player.x = newX;
      if (newY >= this.bounds.top && newY <= this.bounds.bottom) this.player.y = newY;
    }

    this._encounterCooldown = Math.max(0, this._encounterCooldown - 1);

    // Step-based random encounter check
    if (moving) {
      this._stepCounter++;
      for (const zone of this.encounterZones) {
        if (this._inZone(zone) && this._stepCounter >= (zone.stepThreshold || 12) && this._encounterCooldown <= 0) {
          if (Math.random() < (zone.rate || 0.05)) {
            this._stepCounter = 0;
            this._encounterCooldown = 90;
            const enemies = zone.enemies || ['goblin'];
            return { enemies, isBossFight: !!zone.isBoss, isFinalBoss: !!zone.isFinalBoss,
                     expReward: zone.expReward || 60, apReward: zone.apReward || 2, gilReward: zone.gilReward || 25 };
          }
        }
      }
    }

    // Check POI proximity
    this._nearPOI = null;
    for (const poi of this.pois) {
      const dist = Math.hypot(poi.x - this.player.x, poi.y - this.player.y);
      if (dist < (poi.radius || 45)) { this._nearPOI = poi; break; }
    }

    // Check NPC proximity
    this._nearNPC = null;
    for (const npc of this.npcs) {
      if (!npc.visible && npc.visible !== undefined) continue;
      const dist = Math.hypot(npc.x - this.player.x, npc.y - this.player.y);
      if (dist < (npc.radius || 50)) { this._nearNPC = npc; break; }
    }

    return null;
  }

  _inZone(zone) {
    return this.player.x >= zone.x && this.player.x <= zone.x + zone.w &&
           this.player.y >= zone.y && this.player.y <= zone.y + zone.h;
  }

  interact() { return this._nearPOI || null; }
  interactNPC() { return this._nearNPC || null; }
  markTalked(npcId) { this._npcTalkedTo[npcId] = (this._npcTalkedTo[npcId] || 0) + 1; }
  getTalkCount(npcId) { return this._npcTalkedTo[npcId] || 0; }

  // ─── Drawing ───────────────────────────────────────────────────────
  draw(ctx, frame) {
    // Draw encounter zone boundaries (subtle, nearly invisible)
    ctx.lineWidth = 1;
    for (const zone of this.encounterZones) {
      const pulse = 0.08 + 0.04 * fastSin(frame * 0.03 + zone.x);
      ctx.strokeStyle = `rgba(231,76,60,${pulse})`;
      ctx.setLineDash([4, 8]);
      ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
      ctx.setLineDash([]);
    }

    // Draw POI markers
    for (const poi of this.pois) {
      const pulse = 0.5 + 0.4 * fastSin(frame * 0.04 + poi.x * 0.1);
      // Outer glow ring
      ctx.beginPath();
      ctx.arc(poi.x, poi.y, 14 + fastSin(frame * 0.06) * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(241,196,15,${pulse * 0.2})`;
      ctx.fill();
      // Inner dot
      ctx.beginPath();
      ctx.arc(poi.x, poi.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(241,196,15,${pulse})`;
      ctx.fill();
      ctx.shadowColor = '#f1c40f';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      // Save point special: golden star aura
      if (poi.type === 'save') {
        const gp = 0.3 + 0.2 * fastSin(frame * 0.06);
        ctx.save();
        ctx.strokeStyle = `rgba(241,196,15,${gp})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 15;
        for (let r = 0; r < 3; r++) {
          const rad = 18 + r * 8 + fastSin(frame * 0.05 + r) * 3;
          ctx.globalAlpha = gp * (1 - r * 0.25);
          ctx.beginPath(); ctx.arc(poi.x, poi.y, rad, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
        // Save cross icon glow
        ctx.fillStyle = `rgba(241,196,15,${0.8 + 0.2 * fastSin(frame * 0.1)})`;
        ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 12;
        ctx.fillText('✦', poi.x, poi.y + 5);
        ctx.shadowBlur = 0;
      }
      // Label
      ctx.fillStyle = '#ecf0f1';
      ctx.font = 'bold 11px Outfit,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(poi.label || '', poi.x, poi.y - 20);
      // Icon
      ctx.font = '16px sans-serif';
      ctx.fillText(poi.icon || '📍', poi.x, poi.y + 4);
    }

    // Draw NPCs
    for (const npc of this.npcs) {
      const bob = fastSin(frame * 0.06 + npc.x * 0.01) * 2;
      const npx = npc.x;
      const npy = npc.y + bob;
      const near = (this._nearNPC === npc);
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(npx, npy + 18, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
      // Proximity glow (amber if near)
      if (near) {
        const gp = 0.3 + 0.2 * fastSin(frame * 0.1);
        ctx.fillStyle = `rgba(46,204,113,${gp * 0.5})`;
        ctx.beginPath(); ctx.arc(npx, npy, 28, 0, Math.PI * 2); ctx.fill();
      }
      // NPC color-coded body (by role)
      const roleColor = {
        villager: '#3a8c5a', merchant: '#c0392b', elder: '#9b59b6',
        hero: '#f1c40f', child: '#e67e22', guard: '#4a5a6a', chest: '#b7791f'
      }[npc.role || 'villager'] || '#3a8c5a';
      // Body
      ctx.fillStyle = roleColor;
      ctx.strokeStyle = '#0a0a1a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(npx, npy + 6, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Head
      ctx.fillStyle = roleColor;
      ctx.beginPath(); ctx.arc(npx, npy - 8, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Chest indicator (● for chest NPC)
      if (npc.role === 'chest') {
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath(); ctx.arc(npx, npy + 6, 4, 0, Math.PI * 2); ctx.fill();
      }
      // Name label
      ctx.fillStyle = '#ecf0f1';
      ctx.font = 'bold 11px Outfit,sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#0a0a1a';
      ctx.lineWidth = 3;
      ctx.strokeText(npc.name || 'Villageois', npx, npy - 22);
      ctx.fillText(npc.name || 'Villageois', npx, npy - 22);
      // Icon above (quest marker ! if questgiver, not yet talked to)
      if (npc.questgiver && (this._npcTalkedTo[npc.id] || 0) === 0) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 16px Outfit,sans-serif';
        ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 8;
        ctx.fillText('!', npx, npy - 35 - fastSin(frame * 0.1) * 2);
        ctx.shadowBlur = 0;
      }
    }

    // Draw player character (bobbing Luan)
    const bobY = fastSin(this._moveAnim) * 2;
    const px = this.player.x;
    const py = this.player.y + bobY;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(px, py + 14, 10, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Body glow
    ctx.fillStyle = 'rgba(241,196,15,0.15)';
    ctx.shadowColor = '#f1c40f';
    ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(px, py, 16, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Character dot
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚔', px, py + 1);
    ctx.textBaseline = 'alphabetic';

    // ─── Minimap (top-right corner) ─────────────────────────────────────
    this._drawMinimap(ctx, frame);

    // Interaction hint near POI or NPC (DOM-based, animated)
    const promptEl = document.getElementById('field-interact-prompt');
    if (this._nearPOI || this._nearNPC) {
      const isNPC = !!this._nearNPC;
      const text = isNPC
        ? `E · Parler à ${this._nearNPC.name || '...'}`
        : `E · ${this._nearPOI.action || 'Interagir'}`;
      const color = isNPC ? '#2ecc71' : '#f1c40f';
      if (!promptEl) {
        const el = document.createElement('div');
        el.id = 'field-interact-prompt';
        el.style.cssText = `
          position:fixed; bottom:120px; left:50%; transform:translateX(-50%) translateY(10px);
          z-index:30; pointer-events:none; padding:10px 24px;
          background:rgba(10,10,26,0.85); border:1px solid ${color}40;
          border-radius:6px; backdrop-filter:blur(6px);
          color:${color}; font-family:var(--sans); font-weight:700; font-size:0.95rem;
          letter-spacing:0.06em; opacity:0;
          transition:opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
          box-shadow:0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 ${color}20;
        `;
        el.textContent = text;
        document.body.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'; });
      } else {
        promptEl.textContent = text;
        promptEl.style.borderColor = color + '40';
        promptEl.style.color = color;
        promptEl.style.boxShadow = `0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 ${color}20`;
      }
    } else if (promptEl) {
      promptEl.style.opacity = '0';
      promptEl.style.transform = 'translateX(-50%) translateY(10px)';
      setTimeout(() => promptEl.remove(), 250);
    }
  }

  _drawMinimap(ctx, frame) {
    const mmW = 120, mmH = 90;
    const mmX = ctx.canvas.width - mmW - 12;
    const mmY = 12;
    const scaleX = mmW / this.width;
    const scaleY = mmH / this.height;

    ctx.save();
    // Background
    ctx.fillStyle = 'rgba(10,10,26,0.75)';
    ctx.strokeStyle = 'rgba(241,196,15,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4, 4);
    ctx.fill();
    ctx.stroke();

    // Encounter zones (subtle red tint)
    ctx.fillStyle = 'rgba(231,76,60,0.1)';
    for (const zone of this.encounterZones) {
      ctx.fillRect(
        mmX + zone.x * scaleX,
        mmY + zone.y * scaleY,
        zone.w * scaleX,
        zone.h * scaleY
      );
    }

    // POI dots
    for (const poi of this.pois) {
      const pulse = 0.5 + 0.5 * fastSin(frame * 0.06 + poi.x * 0.1);
      const colors = { save: '#f1c40f', chest: '#e67e22', rest: '#2ecc71', advance: '#3498db', shop: '#9b59b6' };
      ctx.fillStyle = colors[poi.type] || '#f1c40f';
      ctx.globalAlpha = 0.4 + pulse * 0.6;
      ctx.beginPath();
      ctx.arc(mmX + poi.x * scaleX, mmY + poi.y * scaleY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // NPC dots
    for (const npc of this.npcs) {
      ctx.fillStyle = '#2ecc71';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(mmX + npc.x * scaleX, mmY + npc.y * scaleY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Player dot (blinking)
    const blink = 0.6 + 0.4 * fastSin(frame * 0.1);
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = blink;
    ctx.beginPath();
    ctx.arc(mmX + this.player.x * scaleX, mmY + this.player.y * scaleY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Border
    ctx.strokeStyle = 'rgba(241,196,15,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4, 4);
    ctx.stroke();

    ctx.restore();
  }

  // ─── Cleanup ───────────────────────────────────────────────────────
  resetKeys() { this._keys = {}; }
  cleanup() {
    const p = document.getElementById('field-interact-prompt');
    if (p) p.remove();
  }
}
