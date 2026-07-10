// minigames/fishing.js — Fishing mini-game (timing + tension bar)
// Cast, wait for bite, reel in green zone. 8+ species, cook for buffs or sell.

import { GAME } from '../state.js';
import { audio } from '../engine/audio.js';
import { dialogue } from '../engine/dialogue.js';

const SPECIES = [
  { id: 'minnow', name: 'Vairon', rarity: 'common', min: 1, max: 3, zone: 'any' },
  { id: 'bass', name: 'Bar', rarity: 'common', min: 3, max: 8, zone: 'any' },
  { id: 'trout', name: 'Truite', rarity: 'common', min: 5, max: 12, zone: 'forest' },
  { id: 'carp', name: 'Carpe', rarity: 'uncommon', min: 8, max: 20, zone: 'any' },
  { id: 'eel', name: 'Anguille', rarity: 'uncommon', min: 10, max: 25, zone: 'cave' },
  { id: 'swordfish', name: 'Espadon', rarity: 'rare', min: 20, max: 50, zone: 'desert' },
  { id: 'leviathan', name: 'Léviathan', rarity: 'epic', min: 50, max: 120, zone: 'crystal' },
  { id: 'king_fish', name: 'Poisson-Roi', rarity: 'legendary', min: 100, max: 300, zone: 'desert' },
];

export class FishingGame {
  constructor() {
    this._layer = null;
    this._state = 'menu';
    this._phase = 'idle'; // idle | cast | wait | bite | reel | result
    this._onExit = null;
    this._biteTimer = 0;
    this._tension = 50;
    this._tensionDir = 1;
    this._fish = null;
    this._raf = null;
  }

  show(onExit) {
    this._onExit = onExit || (() => {});
    this._state = 'menu';
    this._buildLayer();
    audio.playMusic('Lanterns Over Brine');
    this._render();
  }

  hide() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._layer && this._layer.parentNode) this._layer.parentNode.removeChild(this._layer);
    this._layer = null;
  }

  _buildLayer() {
    if (this._layer) this.hide();
    const layer = document.createElement('div');
    layer.id = 'fishing-layer';
    layer.className = 'minigame-overlay fishing-game';
    document.body.appendChild(layer);
    this._layer = layer;
  }

  _render() {
    if (this._state === 'menu') this._renderMenu();
  }

  _renderMenu() {
    let html = `<div class="minigame-panel"><h1>🎣 PÊCHE</h1>`;
    html += `<p>Or: ${GAME.inventory.gold}g</p>`;
    const caught = Object.keys(GAME.flags).filter(k => k.startsWith('fish_caught_'));
    html += `<p>Espèces: ${caught.length}/${SPECIES.length}</p>`;
    html += `<div class="colosseum-actions">
      <button data-act="cast">Lancer (Espace)</button>
      <button data-act="cook">Cuisiner</button>
      <button data-act="exit">Quitter</button>
    </div></div>`;
    this._layer.innerHTML = html;
    this._layer.querySelector('[data-act="cast"]').onclick = () => this._cast();
    this._layer.querySelector('[data-act="cook"]').onclick = () => this._renderCook();
    this._layer.querySelector('[data-act="exit"]').onclick = () => this._exit();
    document.addEventListener('keydown', this._keyHandler = (e) => {
      if (e.code === 'Space') {
        if (this._phase === 'idle') this._cast();
        else if (this._phase === 'bite') this._startReel();
      }
    });
  }

  _cast() {
    this._phase = 'wait';
    this._biteTimer = 60 + Math.floor(Math.random() * 180);
    audio.sfx('cast');
    this._layer.innerHTML = `<div class="minigame-panel"><h2>🎣 Lancer...</h2>
      <p class="fish-status">Attends le poisson... (Espace pour ferrer à la touche!)</p></div>`;
    this._loop();
  }

  _loop() {
    if (this._phase === 'wait') {
      this._biteTimer--;
      if (this._biteTimer <= 0) {
        this._phase = 'bite';
        audio.sfx('bite');
        this._layer.innerHTML = `<div class="minigame-panel"><h2>🎣 !!! TOUCHE !!!</h2>
          <p class="fish-status bite">ESPACE MAINTENANT!</p></div>`;
        // Auto-miss if no reaction in 40 frames
        this._missTimer = 40;
        this._missLoop();
      }
    }
  }

  _missLoop() {
    if (this._phase !== 'bite') return;
    this._missTimer--;
    if (this._missTimer <= 0) {
      this._phase = 'idle';
      dialogue.show({ speaker: 'Pêche', lines: ['Il a filé...'] });
      this._state = 'menu'; this._render();
      return;
    }
    setTimeout(() => this._missLoop(), 50);
  }

  _startReel() {
    this._phase = 'reel';
    // Pick fish by rarity roll
    const roll = Math.random();
    let pool = SPECIES;
    if (roll > 0.95) pool = SPECIES.filter(s => s.rarity === 'legendary' || s.rarity === 'epic');
    else if (roll > 0.8) pool = SPECIES.filter(s => s.rarity === 'rare' || s.rarity === 'epic');
    else if (roll > 0.5) pool = SPECIES.filter(s => s.rarity === 'uncommon' || s.rarity === 'rare');
    else pool = SPECIES.filter(s => s.rarity === 'common' || s.rarity === 'uncommon');
    this._fish = pool[Math.floor(Math.random() * pool.length)] || SPECIES[0];
    this._tension = 50; this._tensionDir = 1;
    audio.sfx('reel');
    this._layer.innerHTML = `<div class="minigame-panel"><h2>🎣 Rentre la ligne!</h2>
      <div class="fishing-bar"><div class="fish-zone" id="fish-zone"></div><div class="fish-marker" id="fish-marker"></div></div>
      <p class="fish-status">Espace pour maintenir dans la zone verte!</p>
      <button data-act="stop">Relâcher</button></div>`;
    this._layer.querySelector('[data-act="stop"]').onclick = () => this._finishReel();
    this._reeling = true;
    this._reelLoop();
  }

  _reelLoop() {
    if (this._phase !== 'reel') return;
    // Tension moves, player must keep marker in green zone
    if (this._reeling) this._tension += this._tensionDir * 1.5;
    else this._tension -= this._tensionDir * 0.8;
    if (this._tension > 100) { this._tension = 100; this._tensionDir = -1; }
    if (this._tension < 0) { this._tension = 0; this._tensionDir = 1; }
    const marker = document.getElementById('fish-marker');
    const zone = document.getElementById('fish-zone');
    if (marker) marker.style.left = this._tension + '%';
    if (zone) {
      const z = 35 + Math.sin(Date.now() / 300) * 15;
      zone.style.left = z + '%'; zone.style.width = '30%';
      // In zone?
      if (Math.abs(this._tension - (z + 15)) < 15) this._tension = Math.min(100, this._tension + 0.5);
    }
    this._raf = requestAnimationFrame(() => this._reelLoop());
  }

  _finishReel() {
    this._phase = 'result';
    if (this._raf) cancelAnimationFrame(this._raf);
    const size = this._fish.min + Math.floor(Math.random() * (this._fish.max - this._fish.min));
    const key = 'fish_caught_' + this._fish.id;
    GAME.flags[key] = (GAME.flags[key] || 0) + 1;
    const value = Math.floor(size / 2);
    GAME.inventory.gold += value;
    audio.sfx('quest_complete');
    dialogue.show({ speaker: 'Pêche', lines: [`${this._fish.name} (${size}cm)!`, `+${value}g` ] });
    if (GAME.quests) import('../engine/quests.js').then(q => q.onEvent('fish_catch', { species: this._fish.id }));
    this._state = 'menu';
    setTimeout(() => this._render(), 1200);
  }

  _renderCook() {
    let html = `<div class="minigame-panel"><h2>Cuisiner</h2>`;
    const caught = SPECIES.filter(s => GAME.flags['fish_caught_' + s.id]);
    if (!caught.length) html += `<p>Aucun poisson attrapé.</p>`;
    else {
      html += `<div class="cook-list">`;
      for (const s of caught) {
        html += `<div class="cook-item" data-fish="${s.id}">${s.name} → Buff (${s.rarity})</div>`;
      }
      html += `</div>`;
    }
    html += `<div class="colosseum-actions"><button data-act="back">Retour</button></div></div>`;
    this._layer.innerHTML = html;
    this._layer.querySelectorAll('.cook-item').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.fish;
        GAME.flags['cooked_' + id] = true;
        GAME.flags['buff_' + id] = true;
        dialogue.show({ speaker: 'Cuisine', lines: ['Plat préparé! Buff actif.'] });
        this._renderCook();
      };
    });
    this._layer.querySelector('[data-act="back"]').onclick = () => this._render();
  }

  _exit() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    audio.playMusic('Crystal Village');
    if (this._onExit) this._onExit();
    this.hide();
  }
}
