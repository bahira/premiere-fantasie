// minigames/racing.js — Chocobo-style racing mini-game
// Side-scroll race, dodge obstacles, stamina sprint, 3 tracks, betting, best times.

import { GAME } from '../state.js';
import { audio } from '../engine/audio.js';
import { dialogue } from '../engine/dialogue.js';

const TRACKS = {
  forest: { name: 'Piste Forêt', bg: '#1a3d2e', obstacles: ['log', 'rock', 'bush'], speed: 4, length: 3000 },
  desert: { name: 'Piste Désert', bg: '#c9a227', obstacles: ['cactus', 'dune', 'skull'], speed: 5, length: 3500 },
  crystal: { name: 'Piste Cristal', bg: '#3a2a5e', obstacles: ['shard', 'pillar', 'rift'], speed: 6, length: 4000 },
};

export class RacingGame {
  constructor() {
    this._layer = null;
    this._state = 'menu';
    this._track = 'forest';
    this._canvas = null;
    this._ctx = null;
    this._raf = null;
    this._onExit = null;
    this._bet = 0;
  }

  show(onExit) {
    this._onExit = onExit || (() => {});
    this._state = 'menu';
    this._buildLayer();
    audio.playMusic('Skybound Phase');
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
    layer.id = 'racing-layer';
    layer.className = 'minigame-overlay racing-game';
    document.body.appendChild(layer);
    this._layer = layer;
  }

  _render() {
    if (this._state === 'menu') this._renderMenu();
  }

  _renderMenu() {
    let html = `<div class="minigame-panel"><h1>🐤 COURSE</h1>`;
    html += `<p>Or: ${GAME.inventory.gold}g</p>`;
    html += `<div class="track-list">`;
    for (const [id, t] of Object.entries(TRACKS)) {
      const best = GAME.flags['race_best_' + id];
      html += `<div class="track-card" data-track="${id}">
        <h3>${t.name}</h3>
        <p>${best ? 'Record: ' + (best / 1000).toFixed(2) + 's' : 'Pas de record'}</p>
      </div>`;
    }
    html += `</div>`;
    html += `<div class="colosseum-actions">
      <button data-act="start">Course (mise 100g)</button>
      <button data-act="exit">Quitter</button>
    </div></div>`;
    this._layer.innerHTML = html;
    this._layer.querySelectorAll('.track-card').forEach(el => {
      el.onclick = () => { this._track = el.dataset.track; this._startRace(); };
    });
    this._layer.querySelector('[data-act="start"]').onclick = () => this._startRace();
    this._layer.querySelector('[data-act="exit"]').onclick = () => this._exit();
  }

  _startRace() {
    if (GAME.inventory.gold < 100) { dialogue.show({ speaker: 'Course', lines: ['Or insuffisant (100g).'] }); return; }
    this._bet = 100; GAME.inventory.gold -= 100;
    const t = TRACKS[this._track];
    this._state = 'race';
    this._layer.innerHTML = `<canvas id="race-canvas" width="800" height="400" class="race-canvas"></canvas>
      <div class="race-hud">
        <span id="race-dist">0m</span>
        <span id="race-stam">Endurance: ████████</span>
        <span id="race-time">0.0s</span>
      </div>
      <div class="race-controls">
        <button data-act="sprint">SPRINT (Espace)</button>
        <button data-act="quit">Abandon</button>
      </div>`;
    this._canvas = document.getElementById('race-canvas');
    this._ctx = this._canvas.getContext('2d');
    this._race = {
      x: 0, dist: 0, length: t.length, speed: t.speed, stamina: 100, sprinting: false,
      obstacles: [], frame: 0, time: 0, finished: false, won: false,
      playerY: 200, obstacleTimer: 0,
    };
    this._layer.querySelector('[data-act="sprint"]').onclick = () => this._sprint(true);
    this._layer.querySelector('[data-act="quit"]').onclick = () => { this._exit(); };
    document.addEventListener('keydown', this._keyHandler = (e) => { if (e.code === 'Space') this._sprint(true); });
    document.addEventListener('keyup', this._keyUpHandler = (e) => { if (e.code === 'Space') this._sprint(false); });
    this._loop();
  }

  _sprint(on) { if (this._race) this._race.sprinting = on; }

  _loop() {
    const r = this._race;
    if (!r || r.finished) return;
    r.frame++;
    r.time += 16;
    // Stamina
    if (r.sprinting && r.stamina > 0) { r.stamina -= 0.8; r.speed = TRACKS[this._track].speed * 1.8; }
    else { r.stamina = Math.min(100, r.stamina + 0.3); r.speed = TRACKS[this._track].speed; }
    r.dist += r.speed;
    // Obstacles
    r.obstacleTimer--;
    if (r.obstacleTimer <= 0) {
      r.obstacleTimer = 40 + Math.floor(Math.random() * 40);
      const obs = TRACKS[this._track].obstacles;
      r.obstacles.push({ x: 800, y: 150 + Math.random() * 150, type: obs[Math.floor(Math.random() * obs.length)] });
    }
    for (const o of r.obstacles) o.x -= r.speed * 1.2;
    r.obstacles = r.obstacles.filter(o => o.x > -50);
    // Collision
    for (const o of r.obstacles) {
      if (o.x < 120 && o.x > 60 && Math.abs(o.y - r.playerY) < 40) {
        r.speed *= 0.4; r.stamina -= 10;
      }
    }
    // HUD
    document.getElementById('race-dist').textContent = Math.floor(r.dist / 10) + 'm';
    document.getElementById('race-time').textContent = (r.time / 1000).toFixed(1) + 's';
    document.getElementById('race-stam').textContent = 'Endurance: ' + '█'.repeat(Math.floor(r.stamina / 12)) + '░'.repeat(8 - Math.floor(r.stamina / 12));
    // Draw
    this._draw();
    if (r.dist >= r.length) { this._finish(); return; }
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _draw() {
    const ctx = this._ctx, r = this._race, t = TRACKS[this._track];
    ctx.fillStyle = t.bg; ctx.fillRect(0, 0, 800, 400);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0, 340, 800, 60);
    // Player chocobo
    ctx.font = '40px serif'; ctx.fillText('🐤', 80, r.playerY);
    // Obstacles
    for (const o of r.obstacles) {
      ctx.font = '30px serif';
      const icon = o.type === 'log' ? '🪵' : o.type === 'rock' ? '🪨' : o.type === 'bush' ? '🌿' :
        o.type === 'cactus' ? '🌵' : o.type === 'dune' ? '⛰' : o.type === 'skull' ? '💀' :
        o.type === 'shard' ? '💎' : o.type === 'pillar' ? '🏛' : '🌀';
      ctx.fillText(icon, o.x, o.y);
    }
  }

  _finish() {
    const r = this._race;
    r.finished = true;
    const best = GAME.flags['race_best_' + this._track];
    const win = !best || r.time < best;
    if (win) {
      GAME.flags['race_best_' + this._track] = r.time;
      GAME.inventory.gold += this._bet * 3;
      audio.sfx('quest_complete');
      dialogue.show({ speaker: 'Course', lines: ['NOUVEAU RECORD! +' + (this._bet * 3) + 'g', (r.time / 1000).toFixed(2) + 's'] });
      if (GAME.quests) import('../engine/quests.js').then(q => q.onEvent('race_win', { track: this._track }));
    } else {
      dialogue.show({ speaker: 'Course', lines: ['Terminé en ' + (r.time / 1000).toFixed(2) + 's', 'Pas de record.'] });
    }
    document.removeEventListener('keydown', this._keyHandler);
    document.removeEventListener('keyup', this._keyUpHandler);
    this._state = 'menu';
    setTimeout(() => this._render(), 1500);
  }

  _exit() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this._keyUpHandler) document.removeEventListener('keyup', this._keyUpHandler);
    audio.playMusic('Crystal Village');
    if (this._onExit) this._onExit();
    this.hide();
  }
}
