// scenes/colosseum.js — Colosseum tournament scene (FFIX-style)
// Ranked ladder, betting, leaderboard, endless mode. Story-gated cups.
// Reuses existing battle system (js/scenes/battle.js) without modifying it.

import { GAME } from '../state.js';
import { COLOSSEUM_CUPS, COLOSSEUM_ACCESS, COLOSSEUM_BETTING } from '../data/colosseum_cups.js';
import { audio } from '../engine/audio.js';
import { dialogue } from '../engine/dialogue.js';
import { ENEMIES } from '../data/enemies.js';

export class ColosseumScene {
  constructor(battleScene) {
    this.battleScene = battleScene; // reference to battle scene for launching fights
    this._layer = null;
    this._state = 'menu'; // menu | ladder | fight | result | betting
    this._cup = null;
    this._rankIdx = 0;
    this._selectedCupId = null;
    this._bet = 0;
    this._betOnSelf = true;
    this._leaderboard = GAME.flags.colosseum_leaderboard || [];
    this._endlessWave = 0;
    this._onExit = null;
  }

  show(onExit) {
    this._onExit = onExit || (() => {});
    this._state = 'menu';
    this._buildLayer();
    audio.playMusic('Clockwork Duel');
    this._render();
  }

  hide() {
    if (this._layer && this._layer.parentNode) this._layer.parentNode.removeChild(this._layer);
    this._layer = null;
  }

  _buildLayer() {
    if (this._layer) this.hide();
    const layer = document.createElement('div');
    layer.id = 'colosseum-layer';
    layer.className = 'colosseum-overlay';
    document.body.appendChild(layer);
    this._layer = layer;
  }

  // ─── Menu ────────────────────────────────────────────────────────
  _render() {
    if (!this._layer) return;
    if (this._state === 'menu') this._renderMenu();
    else if (this._state === 'ladder') this._renderLadder();
    else if (this._state === 'betting') this._renderBetting();
    else if (this._state === 'result') this._renderResult();
  }

  _renderMenu() {
    const cups = Object.values(COLOSSEUM_CUPS);
    let html = `<div class="colosseum-panel"><h1>⚔ COLISÉE</h1>`;
    html += `<p class="colosseum-sub">${COLOSSEUM_ACCESS.note}</p>`;
    html += `<div class="cup-list">`;
    for (const cup of cups) {
      const locked = GAME.chapterId < cup.unlockChapter;
      html += `<div class="cup-card ${locked ? 'locked' : ''}" data-cup="${cup.id}">
        <h3>${cup.name}</h3>
        <p>${locked ? '🔒 Débloqué au Chapitre ' + cup.unlockChapter : cup.ranks.length + ' rangs'}</p>
        <p class="cup-bet">Mise max: ${cup.maxBet}g</p>
      </div>`;
    }
    html += `</div>`;
    html += `<div class="colosseum-actions">
      <button data-act="endless">Mode Infini</button>
      <button data-act="leaderboard">Classement</button>
      <button data-act="exit">Quitter</button>
    </div></div>`;
    this._layer.innerHTML = html;
    this._layer.querySelectorAll('.cup-card:not(.locked)').forEach(el => {
      el.onclick = () => { this._selectedCupId = el.dataset.cup; this._enterCup(); };
    });
    this._layer.querySelector('[data-act="endless"]').onclick = () => this._startEndless();
    this._layer.querySelector('[data-act="leaderboard"]').onclick = () => this._showLeaderboard();
    this._layer.querySelector('[data-act="exit"]').onclick = () => this._exit();
  }

  _enterCup() {
    this._cup = COLOSSEUM_CUPS[this._selectedCupId];
    this._rankIdx = 0;
    // Skip already-cleared ranks
    const cleared = GAME.flags['colosseum_' + this._cup.id] || [];
    while (this._rankIdx < this._cup.ranks.length && cleared.includes(this._cup.ranks[this._rankIdx].id)) {
      this._rankIdx++;
    }
    if (this._rankIdx >= this._cup.ranks.length) {
      dialogue.show({ speaker: 'Colisée', lines: ['Tu as déjà conquis cette coupe !', 'Reviens plus tard pour le mode infini.'] });
      this._state = 'menu'; this._render();
      return;
    }
    this._state = 'betting';
    this._bet = 0;
    this._render();
  }

  // ─── Betting ────────────────────────────────────────────────────
  _renderBetting() {
    const rank = this._cup.ranks[this._rankIdx];
    const maxBet = Math.min(this._cup.maxBet, GAME.inventory.gold);
    let html = `<div class="colosseum-panel"><h2>${this._cup.name}</h2>`;
    html += `<h3>${rank.name}</h3>`;
    html += `<p>Ennemis: ${rank.enemies.map(e => ENEMIES[e]?.name || e).join(', ')}</p>`;
    html += `<p>Frais d'entrée: ${rank.entryFee}g | Or: ${GAME.inventory.gold}g</p>`;
    html += `<div class="bet-controls">
      <button data-bet="-100">-100</button>
      <button data-bet="-10">-10</button>
      <span class="bet-amount">Mise: ${this._bet}g</span>
      <button data-bet="10">+10</button>
      <button data-bet="100">+100</button>
    </div>`;
    html += `<p class="bet-odds">Gain potentiel: ${Math.floor(this._bet * COLOSSEUM_BETTING.ownMatchMultiplier)}g (x${COLOSSEUM_BETTING.ownMatchMultiplier})</p>`;
    html += `<div class="colosseum-actions">
      <button data-act="fight">Combattre</button>
      <button data-act="back">Retour</button>
    </div></div>`;
    this._layer.innerHTML = html;
    this._layer.querySelectorAll('[data-bet]').forEach(b => {
      b.onclick = () => {
        this._bet = Math.max(0, Math.min(maxBet, this._bet + parseInt(b.dataset.bet)));
        this._render();
      };
    });
    this._layer.querySelector('[data-act="fight"]').onclick = () => this._startFight();
    this._layer.querySelector('[data-act="back"]').onclick = () => { this._state = 'menu'; this._render(); };
  }

  // ─── Start Fight (reuse battle scene) ───────────────────────────
  _startFight() {
    const rank = this._cup.ranks[this._rankIdx];
    if (GAME.inventory.gold < rank.entryFee) {
      dialogue.show({ speaker: 'Colisée', lines: ['Or insuffisant pour le frais d\'entrée.'] });
      return;
    }
    GAME.inventory.gold -= rank.entryFee;
    if (this._bet > 0) GAME.inventory.gold -= this._bet;
    audio.sfx('battle_start');

    // Build enemy group from rank
    const group = rank.enemies.map(eid => ENEMIES[eid]).filter(Boolean);
    const onWin = () => this._onFightWin();
    const onLose = () => this._onFightLose();

    if (this.battleScene && this.battleScene.startColosseumFight) {
      this.battleScene.startColosseumFight(group, onWin, onLose);
    } else {
      // Fallback: simulate
      this._onFightWin();
    }
  }

  _onFightWin() {
    const rank = this._cup.ranks[this._rankIdx];
    // Payout bet
    if (this._bet > 0) GAME.inventory.gold += Math.floor(this._bet * COLOSSEUM_BETTING.ownMatchMultiplier);
    // Rewards
    if (rank.rewards.gold) GAME.inventory.gold += rank.rewards.gold;
    if (rank.rewards.items) for (const it of rank.rewards.items) GAME.inventory.add(it.id, it.count || 1);
    if (rank.rewards.flags) {
      if (rank.rewards.flags.set) GAME.flags[rank.rewards.flags.set] = true;
      if (rank.rewards.flags.lore) GAME.flags[rank.rewards.flags.lore] = true;
    }
    // Mark rank cleared
    const key = 'colosseum_' + this._cup.id;
    if (!GAME.flags[key]) GAME.flags[key] = [];
    GAME.flags[key].push(rank.id);
    // Leaderboard
    this._leaderboard.push({ cup: this._cup.name, rank: rank.name, chapter: GAME.chapterId, date: Date.now() });
    GAME.flags.colosseum_leaderboard = this._leaderboard;

    audio.sfx('quest_complete');
    this._lastResult = { win: true, rank, bet: this._bet };
    this._state = 'result';
    this._render();
  }

  _onFightLose() {
    this._lastResult = { win: false, rank: this._cup.ranks[this._rankIdx], bet: this._bet };
    this._state = 'result';
    this._render();
  }

  _renderResult() {
    const r = this._lastResult;
    let html = `<div class="colosseum-panel"><h2>${r.win ? 'VICTOIRE!' : 'DÉFAITE'}</h2>`;
    if (r.win) {
      html += `<p>Rang ${r.rank.name} conquis!</p>`;
      html += `<p>Or gagné: ${r.rank.rewards.gold}g${r.bet > 0 ? ' + mise ' + Math.floor(r.bet * 2) + 'g' : ''}</p>`;
      if (r.rank.rewards.items) html += `<p>Objets: ${r.rank.rewards.items.map(i => i.id + ' x' + i.count).join(', ')}</p>`;
    } else {
      html += `<p>Tu es tombé au rang ${r.rank.name}.</p>`;
      html += `<p>Mise perdue: ${r.bet}g</p>`;
    }
    html += `<div class="colosseum-actions">
      <button data-act="next">${r.win ? 'Rang Suivant' : 'Réessayer'}</button>
      <button data-act="menu">Menu</button>
    </div></div>`;
    this._layer.innerHTML = html;
    this._layer.querySelector('[data-act="next"]').onclick = () => {
      if (r.win) this._rankIdx++;
      if (this._rankIdx >= this._cup.ranks.length) { this._state = 'menu'; this._render(); return; }
      this._state = 'betting'; this._bet = 0; this._render();
    };
    this._layer.querySelector('[data-act="menu"]').onclick = () => { this._state = 'menu'; this._render(); };
  }

  // ─── Endless Mode ───────────────────────────────────────────────
  _startEndless() {
    this._endlessWave = 1;
    this._state = 'betting';
    this._bet = 0;
    this._cup = { name: 'Mode Infini', maxBet: 50000, ranks: [{ id: 'endless', name: 'Vague ' + this._endlessWave, entryFee: 0, enemies: this._endlessEnemies() }] };
    this._rankIdx = 0;
    this._renderEndlessBet();
  }

  _endlessEnemies() {
    const pool = Object.keys(ENEMIES);
    const n = Math.min(6, 2 + Math.floor(this._endlessWave / 2));
    const out = [];
    for (let i = 0; i < n; i++) out.push(pool[Math.floor(Math.random() * pool.length)]);
    return out;
  }

  _renderEndlessBet() {
    const rank = this._cup.ranks[0];
    rank.name = 'Vague ' + this._endlessWave;
    rank.enemies = this._endlessEnemies();
    let html = `<div class="colosseum-panel"><h2>Mode Infini</h2>`;
    html += `<h3>Vague ${this._endlessWave}</h3>`;
    html += `<p>Ennemis: ${rank.enemies.map(e => ENEMIES[e]?.name || e).join(', ')}</p>`;
    html += `<p>Or: ${GAME.inventory.gold}g</p>`;
    html += `<div class="colosseum-actions">
      <button data-act="fight">Combattre</button>
      <button data-act="exit">Quitter</button>
    </div></div>`;
    this._layer.innerHTML = html;
    this._layer.querySelector('[data-act="fight"]').onclick = () => {
      const group = rank.enemies.map(eid => ENEMIES[eid]).filter(Boolean);
      const onWin = () => { this._endlessWave++; GAME.inventory.gold += 500 * this._endlessWave; this._startEndless(); };
      const onLose = () => { this._state = 'menu'; this._render(); };
      if (this.battleScene && this.battleScene.startColosseumFight) this.battleScene.startColosseumFight(group, onWin, onLose);
      else { this._endlessWave++; this._startEndless(); }
    };
    this._layer.querySelector('[data-act="exit"]').onclick = () => this._exit();
  }

  _showLeaderboard() {
    let html = `<div class="colosseum-panel"><h2>Classement</h2>`;
    if (!this._leaderboard.length) html += `<p>Aucun combat enregistré.</p>`;
    else {
      html += `<ol class="leaderboard">`;
      for (const e of this._leaderboard.slice(-10).reverse()) {
        html += `<li>${e.cup} — ${e.rank} (Ch${e.chapter})</li>`;
      }
      html += `</ol>`;
    }
    html += `<div class="colosseum-actions"><button data-act="back">Retour</button></div></div>`;
    this._layer.innerHTML = html;
    this._layer.querySelector('[data-act="back"]').onclick = () => { this._state = 'menu'; this._render(); };
  }

  _exit() {
    audio.playMusic('Crystal Village');
    if (this._onExit) this._onExit();
    this.hide();
  }
}
