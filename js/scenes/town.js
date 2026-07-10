// scenes/town.js — Town/Hub scene (safe exploration, NPCs, shops, inns)
// Reuses FieldMap for movement. No encounter zones. Exits to field or travel.

import { GAME } from '../state.js';
import { TOWNS } from '../data/towns.js';
import { audio } from '../engine/audio.js';
import { dialogue } from '../engine/dialogue.js';
import { FieldMap } from '../engine/field_map.js';
import { shop } from '../ui/shop.js';
import { openQuestFromNPC } from '../engine/quests.js';

export class TownScene {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this._map = null;
    this._town = null;
    this._layer = null;
    this._onExit = null;
    this._raf = null;
    this._keys = {};
  }

  show(townId, onExit) {
    this._town = TOWNS[townId];
    if (!this._town) { if (onExit) onExit(); return; }
    this._onExit = onExit || (() => {});
    GAME.flags['reached_' + townId] = true;
    audio.playMusic(this._town.music);
    // Build FieldMap for movement (no encounter zones)
    this._map = new FieldMap({
      startX: this._town.pois[0]?.x || 400,
      startY: this._town.pois[0]?.y || 300,
      width: 800, height: 400,
      bounds: { top: 40, bottom: 360, left: 40, right: 760 },
      encounterZones: [], // safe hub
      pois: this._town.pois,
      npcs: this._town.npcs,
      speed: 3,
    });
    this._map.setCanvas(this.canvas);
    this._buildLayer();
    this._bindKeys();
    this._loop();
  }

  hide() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._map) this._map.destroy();
    if (this._layer && this._layer.parentNode) this._layer.parentNode.removeChild(this._layer);
    this._layer = null;
    this._unbindKeys();
  }

  _buildLayer() {
    if (this._layer) this.hide();
    const layer = document.createElement('div');
    layer.id = 'town-layer';
    layer.className = 'town-overlay';
    layer.innerHTML = `<div class="town-header"><h2>${this._town.name}</h2><span class="town-desc">${this._town.description}</span></div>`;
    document.body.appendChild(layer);
    this._layer = layer;
  }

  _bindKeys() {
    this._kd = (e) => {
      const k = e.key.toLowerCase();
      this._keys[k] = true;
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
      if (k === 'e' || k === ' ') this._interact();
    };
    this._ku = (e) => { this._keys[e.key.toLowerCase()] = false; };
    document.addEventListener('keydown', this._kd);
    document.addEventListener('keyup', this._ku);
  }
  _unbindKeys() {
    if (this._kd) document.removeEventListener('keydown', this._kd);
    if (this._ku) document.removeEventListener('keyup', this._ku);
  }

  _interact() {
    // Check NPC proximity
    for (const npc of this._town.npcs) {
      const d = Math.hypot(npc.x - this._map.player.x, npc.y - this._map.player.y);
      if (d < 40) { this._talkNPC(npc); return; }
    }
    // Check POI proximity
    for (const poi of this._town.pois) {
      const d = Math.hypot(poi.x - this._map.player.x, poi.y - this._map.player.y);
      if (d < 40) { this._usePOI(poi); return; }
    }
  }

  _talkNPC(npc) {
    audio.sfx('cursor');
    if (npc.role === 'quest') {
      const started = openQuestFromNPC(npc.id);
      if (!started) dialogue.show({ speaker: npc.name, portrait: npc.portrait, lines: npc.lines });
    } else {
      dialogue.show({ speaker: npc.name, portrait: npc.portrait, lines: npc.lines });
    }
  }

  _usePOI(poi) {
    if (poi.type === 'exit') { this._exit(); }
    else if (poi.type === 'shop') { this._openShop(poi.shop); }
    else if (poi.type === 'inn') { this._restInn(poi.inn); }
    else if (poi.type === 'minigame') { this._openMinigame(poi.game); }
  }

  _openShop(shopId) {
    const s = this._town.shops.find(x => x.id === shopId);
    if (!s) return;
    audio.sfx('menu');
    shop.open(s, () => {});
  }

  _restInn(innId) {
    const inn = this._town.inns.find(x => x.id === innId);
    if (!inn) return;
    if (GAME.inventory.gold < inn.price) {
      dialogue.show({ speaker: inn.name, lines: ['Or insuffisant (' + inn.price + 'g).'] });
      return;
    }
    GAME.inventory.gold -= inn.price;
    for (const m of GAME.party) { m.hp = m.maxHp; m.mp = m.maxMp; }
    audio.sfx('inn');
    dialogue.show({ speaker: inn.name, lines: ['Repos bien mérité.', 'PV/PM restaurés.'] });
  }

  _openMinigame(game) {
    import('../minigames/' + game + '.js').then(mod => {
      const cls = game === 'card' ? mod.CardGame : game === 'fishing' ? mod.FishingGame : mod.RacingGame;
      const inst = new cls();
      inst.show(() => { this.show(this._town.id, this._onExit); });
    });
  }

  _exit() {
    audio.playMusic('Afritt Rising');
    if (this._onExit) this._onExit();
    this.hide();
  }

  _loop() {
    // Sync keys to map
    for (const k of Object.keys(this._keys)) {
      if (this._keys[k]) this._map.keyDown(k);
      else this._map.keyUp(k);
    }
    this._map.update();
    this._draw();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _draw() {
    const ctx = this.ctx;
    // Background
    ctx.fillStyle = this._town.biome === 'desert' ? '#c9a227' : this._town.biome === 'forest' ? '#1a3d2e' : '#2a2a4e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // Buildings (simple facades)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (const poi of this._town.pois) {
      if (poi.type === 'shop' || poi.type === 'inn') {
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(poi.x - 30, poi.y - 50, 60, 50);
        ctx.fillStyle = '#8a7a5a';
        ctx.fillRect(poi.x - 30, poi.y - 50, 60, 10);
      }
    }
    // NPCs
    for (const npc of this._town.npcs) {
      ctx.font = '30px serif';
      ctx.fillText('🧑', npc.x - 15, npc.y);
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#fff';
      ctx.fillText(npc.name, npc.x - 20, npc.y + 20);
    }
    // Player
    ctx.font = '34px serif';
    ctx.fillText('🧝', this._map.player.x - 17, this._map.player.y);
    // POI labels
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#ffe08a';
    for (const poi of this._town.pois) {
      if (poi.label) ctx.fillText(poi.label, poi.x - 30, poi.y - 55);
    }
    // Interaction prompt
    let near = null;
    for (const npc of this._town.npcs) if (Math.hypot(npc.x - this._map.player.x, npc.y - this._map.player.y) < 40) near = 'E: Parler à ' + npc.name;
    for (const poi of this._town.pois) if (Math.hypot(poi.x - this._map.player.x, poi.y - this._map.player.y) < 40) near = 'E: ' + (poi.label || 'Interagir');
    if (near) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.canvas.width / 2 - 120, this.canvas.height - 50, 240, 30);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(near, this.canvas.width / 2, this.canvas.height - 30);
      ctx.textAlign = 'left';
    }
  }
}
