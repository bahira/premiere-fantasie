// minigames/cardgame.js — "Brume" card game (Triple Triad-inspired)
// 3x3 grid, capture by adjacent edge comparison. Collectible cards, deck building, AI opponent.

import { GAME } from '../state.js';
import { audio } from '../engine/audio.js';
import { dialogue } from '../engine/dialogue.js';
import { ENEMIES } from '../data/enemies.js';
import { CHARACTERS } from '../data/characters.js';

// Card pool: heroes + monsters
export const CARD_POOL = {};
function addCard(id, name, n, e, s, w, rarity) {
  CARD_POOL[id] = { id, name, n, e, s, w, rarity: rarity || 'common' };
}
// Heroes
addCard('c_luan', 'Luan', 8, 7, 6, 9, 'rare');
addCard('c_aldric', 'Aldric', 9, 6, 7, 8, 'rare');
addCard('c_mira', 'Mira', 7, 9, 8, 6, 'rare');
addCard('c_selia', 'Selia', 6, 8, 9, 7, 'rare');
// Monsters (from enemies)
for (const [eid, e] of Object.entries(ENEMIES)) {
  if (e.card) continue;
  const base = Math.max(2, Math.min(10, Math.floor((e.str + e.mag) / 12)));
  addCard('c_' + eid, e.name, base, base + 1, base - 1, base + 2, e.boss ? 'legendary' : 'common');
}

export class CardGame {
  constructor() {
    this._layer = null;
    this._state = 'menu';
    this._board = []; // 9 cells, null or {card, owner}
    this._playerHand = [];
    this._aiHand = [];
    this._turn = 'player';
    this._onExit = null;
    this._bet = 0;
  }

  show(onExit) {
    this._onExit = onExit || (() => {});
    this._ensureCollection();
    this._state = 'menu';
    this._buildLayer();
    audio.playMusic('Lanterns of Ashenvale');
    this._render();
  }

  hide() { if (this._layer && this._layer.parentNode) this._layer.parentNode.removeChild(this._layer); this._layer = null; }

  _ensureCollection() {
    if (!GAME.flags.card_collection) GAME.flags.card_collection = Object.keys(CARD_POOL).slice(0, 5);
    if (!GAME.flags.card_deck) GAME.flags.card_deck = GAME.flags.card_collection.slice(0, 5);
  }

  _buildLayer() {
    if (this._layer) this.hide();
    const layer = document.createElement('div');
    layer.id = 'cardgame-layer';
    layer.className = 'minigame-overlay card-game';
    document.body.appendChild(layer);
    this._layer = layer;
  }

  _render() {
    if (this._state === 'menu') this._renderMenu();
    else if (this._state === 'play') this._renderPlay();
  }

  _renderMenu() {
    const owned = GAME.flags.card_collection.length;
    let html = `<div class="minigame-panel"><h1>🃏 BRUME</h1>`;
    html += `<p>Cartes: ${owned}/${Object.keys(CARD_POOL).length}</p>`;
    html += `<div class="colosseum-actions">
      <button data-act="play">Jouer (mise 50g)</button>
      <button data-act="deck">Deck</button>
      <button data-act="album">Album</button>
      <button data-act="exit">Quitter</button>
    </div></div>`;
    this._layer.innerHTML = html;
    this._layer.querySelector('[data-act="play"]').onclick = () => this._startMatch();
    this._layer.querySelector('[data-act="deck"]').onclick = () => this._renderDeck();
    this._layer.querySelector('[data-act="album"]').onclick = () => this._renderAlbum();
    this._layer.querySelector('[data-act="exit"]').onclick = () => this._exit();
  }

  _renderDeck() {
    const deck = GAME.flags.card_deck;
    const coll = GAME.flags.card_collection;
    let html = `<div class="minigame-panel"><h2>Deck (${deck.length}/5)</h2><div class="card-grid">`;
    for (const id of coll) {
      const c = CARD_POOL[id];
      const inDeck = deck.includes(id);
      html += `<div class="card ${inDeck ? 'indeck' : ''}" data-card="${id}">
        <div class="card-name">${c.name}</div>
        <div class="card-stats">N${c.n} E${c.e} S${c.s} O${c.w}</div>
      </div>`;
    }
    html += `</div><div class="colosseum-actions"><button data-act="back">Retour</button></div></div>`;
    this._layer.innerHTML = html;
    this._layer.querySelectorAll('.card').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.card;
        const d = GAME.flags.card_deck;
        if (d.includes(id)) { if (d.length > 1) GAME.flags.card_deck = d.filter(x => x !== id); }
        else if (d.length < 5) GAME.flags.card_deck = [...d, id];
        this._renderDeck();
      };
    });
    this._layer.querySelector('[data-act="back"]').onclick = () => this._render();
  }

  _renderAlbum() {
    let html = `<div class="minigame-panel"><h2>Album des Cartes</h2><div class="card-grid">`;
    for (const id of Object.keys(CARD_POOL)) {
      const c = CARD_POOL[id];
      const owned = GAME.flags.card_collection.includes(id);
      html += `<div class="card ${owned ? '' : 'locked'}">
        <div class="card-name">${owned ? c.name : '???'}</div>
        ${owned ? `<div class="card-stats">N${c.n} E${c.e} S${c.s} O${c.w}</div>` : ''}
      </div>`;
    }
    html += `</div><div class="colosseum-actions"><button data-act="back">Retour</button></div></div>`;
    this._layer.innerHTML = html;
    this._layer.querySelector('[data-act="back"]').onclick = () => this._render();
  }

  _startMatch() {
    if (GAME.inventory.gold < 50) { dialogue.show({ speaker: 'Brume', lines: ['Or insuffisant (50g).'] }); return; }
    this._bet = 50; GAME.inventory.gold -= 50;
    this._board = new Array(9).fill(null);
    const deck = GAME.flags.card_deck.slice();
    const aiPool = Object.keys(CARD_POOL).filter(id => !deck.includes(id));
    this._playerHand = this._drawHand(deck, 5);
    this._aiHand = this._drawHand(aiPool, 5);
    this._turn = 'player';
    this._state = 'play';
    this._render();
  }

  _drawHand(pool, n) {
    const out = [];
    const copy = [...pool];
    for (let i = 0; i < n && copy.length; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  }

  _renderPlay() {
    let html = `<div class="minigame-panel"><h2>Brume — Tour: ${this._turn === 'player' ? 'Toi' : 'IA'}</h2>`;
    html += `<div class="card-board">`;
    for (let i = 0; i < 9; i++) {
      const cell = this._board[i];
      html += `<div class="board-cell ${cell ? (cell.owner === 'player' ? 'p' : 'a') : ''}" data-cell="${i}">`;
      if (cell) {
        const c = CARD_POOL[cell.card];
        html += `<div class="bc-name">${c.name}</div>
          <div class="bc-stats">${c.n}<br>${c.w} ${c.e}<br>${c.s}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    html += `<div class="hand-row">`;
    for (let i = 0; i < this._playerHand.length; i++) {
      const c = CARD_POOL[this._playerHand[i]];
      html += `<div class="hand-card" data-hand="${i}">${c.name}<br>N${c.n} E${c.e} S${c.s} O${c.w}</div>`;
    }
    html += `</div>`;
    html += `<div class="colosseum-actions"><button data-act="quit">Abandon</button></div></div>`;
    this._layer.innerHTML = html;
    this._layer.querySelectorAll('.hand-card').forEach(el => {
      el.onclick = () => this._playerPlace(parseInt(el.dataset.hand));
    });
    this._layer.querySelector('[data-act="quit"]').onclick = () => { this._exit(); };
  }

  _playerPlace(handIdx) {
    if (this._turn !== 'player') return;
    const cardId = this._playerHand[handIdx];
    // Find first empty cell (simple: pick center if empty else first empty)
    let cell = this._board[4] ? this._board.findIndex(c => !c) : 4;
    if (cell < 0) return;
    this._place(cardId, 'player', cell);
    this._playerHand.splice(handIdx, 1);
    audio.sfx('card_place');
    if (this._playerHand.length === 0 || this._aiHand.length === 0) { this._endMatch(); return; }
    this._turn = 'ai';
    this._render();
    setTimeout(() => this._aiTurn(), 700);
  }

  _aiTurn() {
    if (this._aiHand.length === 0) { this._endMatch(); return; }
    const cardId = this._aiHand[0];
    let cell = this._board.findIndex(c => !c);
    if (cell < 0) { this._endMatch(); return; }
    this._place(cardId, 'ai', cell);
    this._aiHand.shift();
    audio.sfx('card_place');
    if (this._playerHand.length === 0 || this._aiHand.length === 0) { this._endMatch(); return; }
    this._turn = 'player';
    this._render();
  }

  _place(cardId, owner, cell) {
    this._board[cell] = { card: cardId, owner };
    // Capture logic: compare adjacent edges
    const adj = [
      [cell - 3, 'n', 's'], [cell + 3, 's', 'n'],
      [cell % 3 !== 0 ? cell - 1 : -1, 'w', 'e'], [cell % 3 !== 2 ? cell + 1 : -1, 'e', 'w'],
    ];
    const c = CARD_POOL[cardId];
    for (const [ncell, mySide, oppSide] of adj) {
      if (ncell < 0 || ncell > 8 || !this._board[ncell] || this._board[ncell].owner === owner) continue;
      const opp = CARD_POOL[this._board[ncell].card];
      if (c[mySide] > opp[oppSide]) {
        this._board[ncell].owner = owner; // captured
        audio.sfx('capture');
      }
    }
  }

  _endMatch() {
    const pCount = this._board.filter(c => c && c.owner === 'player').length;
    const aCount = this._board.filter(c => c && c.owner === 'ai').length;
    const win = pCount > aCount;
    if (win) {
      GAME.inventory.gold += this._bet * 2;
      // Reward a random new card
      const unowned = Object.keys(CARD_POOL).filter(id => !GAME.flags.card_collection.includes(id));
      if (unowned.length) {
        const newCard = unowned[Math.floor(Math.random() * unowned.length)];
        GAME.flags.card_collection.push(newCard);
      }
      // Quest hooks
      if (GAME.quests) {
        import('../engine/quests.js').then(q => {
          q.onEvent('card_win', {});
        });
      }
      audio.sfx('quest_complete');
      dialogue.show({ speaker: 'Brume', lines: ['Victoire! +' + (this._bet * 2) + 'g', 'Nouvelle carte obtenue!'] });
    } else {
      dialogue.show({ speaker: 'Brume', lines: ['Défaite. Mise perdue.'] });
    }
    this._state = 'menu';
    this._render();
  }

  _exit() {
    audio.playMusic('Crystal Village');
    if (this._onExit) this._onExit();
    this.hide();
  }
}
