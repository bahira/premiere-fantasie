// ui/shop.js — Premium SSS-quality shop system (buy/sell, equipment comparison, quantity selector)
import { GAME } from '../state.js';
import { ITEMS, getItem, isEquipment } from '../data/items.js';
import { audio } from '../engine/audio.js';

const STAT_KEYS = ['atk', 'mag', 'def', 'mdef'];
const STAT_LABELS = { atk: 'ATQ', mag: 'MAG', def: 'DEF', mdef: 'MDF' };
const STAT_COLORS = { atk: '#e74c3c', mag: '#3498db', def: '#2ecc71', mdef: '#9b59b6' };
const DEFAULT_STOCK = ['potion','hi_potion','ether','elixir','antidote','eye_drops','phoenix_down','tent','dagger','mythril_dagger','broadsword','rod','healing_rod','flame_rod','leather_vest','mage_robe','bronze_armor','priest_robe','plate_mail','ninja_vest','sash','ribbon'];

export const shop = {
  _root: null,
  _mode: 'buy',        // 'buy' | 'sell'
  _stock: [],           // array of item IDs for buy tab
  _cursor: 0,          // keyboard cursor index
  _qty: 1,             // quantity selector
  _msgTimer: null,     // inline message timeout
  _keyHandler: null,   // bound key handler reference
  _focusRow: null,     // currently hovered row for equipment preview

  open(stockArray) {
    if (this._root) this.close();
    this._stock = stockArray && stockArray.length > 0 ? stockArray : DEFAULT_STOCK;
    this._mode = 'buy';
    this._cursor = 0;
    this._qty = 1;

    audio.sfx('menu_open');
    GAME.prevScene = GAME.scene;
    GAME.scene = 'menu';

    this._buildDOM();
    this._render();
    this._bindKeys();
  },

  close() {
    if (!this._root) return;
    audio.sfx('menu_close');
    document.removeEventListener('keydown', this._keyHandler);
    clearTimeout(this._msgTimer);
    GAME.scene = GAME.prevScene || 'field';
    this._root.remove();
    this._root = null;
  },

  // ─── DOM Construction ──────────────────────────────────────────────

  _buildDOM() {
    this._root = document.createElement('div');
    this._root.id = 'rpg-shop';
    this._root.innerHTML = `
      <div class="shop-frame">
        <div class="shop-header">
          <div class="shop-title">Boutique</div>
          <div class="shop-gold" id="shop-gold"></div>
        </div>
        <div class="shop-tabs">
          <button class="shop-tab active" data-tab="buy">Acheter</button>
          <button class="shop-tab" data-tab="sell">Vendre</button>
        </div>
        <div class="shop-preview" id="shop-preview">
          <div class="shop-preview-empty">Survolez un article pour voir les details</div>
        </div>
        <div class="shop-list" id="shop-list"></div>
        <div class="shop-qty" id="shop-qty">
          <span class="shop-qty-label">Quantite</span>
          <button class="shop-qty-btn" id="qty-down">−</button>
          <span class="shop-qty-val" id="qty-val">1</span>
          <button class="shop-qty-btn" id="qty-up">+</button>
        </div>
        <div class="shop-msg" id="shop-msg"></div>
        <button class="shop-close" id="shop-close">Fermer</button>
      </div>
    `;
    document.body.appendChild(this._root);

    // Tab click
    this._root.querySelectorAll('.shop-tab').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });

    // Quantity buttons
    this._root.querySelector('#qty-down').addEventListener('click', () => this._adjustQty(-1));
    this._root.querySelector('#qty-up').addEventListener('click', () => this._adjustQty(1));

    // Close
    this._root.querySelector('#shop-close').addEventListener('click', () => this.close());

    // Click outside panel
    this._root.addEventListener('click', (e) => {
      if (e.target === this._root) this.close();
    });

    this._updateGold();
  },

  // ─── Tab Switching ─────────────────────────────────────────────────

  _switchTab(mode) {
    if (mode === this._mode) return;
    audio.sfx('menu_cursor');
    this._mode = mode;
    this._cursor = 0;
    this._qty = 1;

    this._root.querySelectorAll('.shop-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === mode);
    });

    this._updateQtyVisibility();
    this._render();
    this._clearPreview();
  },

  // ─── Rendering ─────────────────────────────────────────────────────

  _render() {
    const list = this._root.querySelector('#shop-list');
    const items = this._mode === 'buy' ? this._buildBuyList() : this._buildSellList();

    if (items.length === 0) {
      list.innerHTML = `<div class="shop-empty">
        ${this._mode === 'buy' ? 'Aucun article en stock.' : 'Votre inventaire est vide.'}
      </div>`;
      this._updateQtyVisibility();
      return;
    }

    list.innerHTML = items.map((entry, i) => this._renderRow(entry, i)).join('');

    // Bind hover events for equipment preview
    list.querySelectorAll('.shop-row').forEach((row, i) => {
      row.addEventListener('mouseenter', () => {
        this._cursor = i;
        this._highlightRow(i);
        this._showPreview(items[i]);
      });
      row.addEventListener('mouseleave', () => {
        this._clearPreview();
      });
      row.addEventListener('click', () => {
        this._cursor = i;
        this._highlightRow(i);
        if (this._mode === 'buy') this._buy(items[i].id);
        else this._sell(items[i].id);
      });
    });

    this._updateQtyVisibility();
    this._highlightRow(this._cursor);
  },

  _buildBuyList() {
    return this._stock
      .map(id => {
        const it = ITEMS[id];
        if (!it) return null;
        return { id, ...it };
      })
      .filter(Boolean);
  },

  _buildSellList() {
    const inv = GAME.inventory;
    const out = [];
    for (const [id, count] of Object.entries(inv.items)) {
      if (count <= 0) continue;
      const it = ITEMS[id];
      if (!it) continue;
      out.push({ id, ...it, count, owned: count });
    }
    for (const [id, count] of Object.entries(inv.equipment)) {
      if (count <= 0) continue;
      const it = ITEMS[id];
      if (!it) continue;
      out.push({ id, ...it, count, owned: count });
    }
    return out;
  },

  _renderRow(entry, index) {
    const isActive = index === this._cursor;
    const sellPrice = Math.floor((entry.price || 0) * 0.5);
    const equippedCount = this._getEquippedCount(entry.id);
    const owned = entry.owned || 0;
    const canAfford = this._mode === 'buy'
      ? GAME.inventory.gold >= entry.price * this._qty
      : true;

    let badge = '';
    if (this._mode === 'sell' && equippedCount > 0) {
      badge = `<span class="shop-badge shop-badge-equipped">${equippedCount} equipee${equippedCount > 1 ? 's' : ''}</span>`;
    } else if (this._mode === 'sell' && owned > 1) {
      badge = `<span class="shop-badge">x${owned}</span>`;
    }

    const grantsText = entry.grants && entry.grants.length > 0
      ? `<span class="shop-grants">${entry.grants.length} competence${entry.grants.length > 1 ? 's' : ''}</span>`
      : '';

    return `<div class="shop-row${isActive ? ' active' : ''}" data-idx="${index}" data-id="${entry.id}">
      <div class="shop-row-main">
        <span class="shop-icon">${entry.icon || this._typeIcon(entry.type)}</span>
        <span class="shop-name">${entry.name}</span>
        ${badge}
        ${grantsText}
      </div>
      <span class="shop-price">${this._mode === 'buy' ? entry.price : sellPrice} G</span>
      <button class="shop-buy-btn" ${!canAfford ? 'disabled' : ''}>
        ${this._mode === 'buy' ? 'Acheter' : 'Vendre'}
      </button>
    </div>`;
  },

  _typeIcon(type) {
    const icons = { weapon: '⚔', armor: '🛡', accessory: '💎', consume: '🧪' };
    return icons[type] || '?';
  },

  _getEquippedCount(itemId) {
    let count = 0;
    for (const m of GAME.party) {
      if (!m.equipped) continue;
      for (const slot of ['weapon', 'armor', 'accessory']) {
        if (m.equipped[slot] === itemId) count++;
      }
    }
    return count;
  },

  _highlightRow(idx) {
    if (!this._root) return;
    this._root.querySelectorAll('.shop-row').forEach((r, i) => {
      r.classList.toggle('active', i === idx);
    });
  },

  // ─── Preview / Comparison ──────────────────────────────────────────

  _showPreview(entry) {
    const preview = this._root.querySelector('#shop-preview');
    if (!preview) return;

    const it = getItem(entry.id);
    if (!it) return;

    let html = `<div class="shop-preview-inner">`;
    html += `<div class="shop-preview-header">
      <span class="shop-preview-icon">${it.icon || this._typeIcon(it.type)}</span>
      <div>
        <div class="shop-preview-name">${it.name}</div>
        <div class="shop-preview-type">${this._typeName(it.type)}${it.slot ? ' · ' + this._slotName(it.slot) : ''}</div>
      </div>
    </div>`;

    if (it.desc) {
      html += `<div class="shop-preview-desc">${it.desc}</div>`;
    }

    // Stats block
    const stats = this._extractStats(it);
    if (stats.length > 0) {
      html += `<div class="shop-preview-stats">`;
      for (const s of stats) {
        html += `<div class="shop-stat">
          <span class="shop-stat-label">${s.label}</span>
          <span class="shop-stat-val" style="color:${s.color}">${s.value > 0 ? '+' : ''}${s.value}</span>
        </div>`;
      }
      html += `</div>`;
    }

    // Grants / abilities
    if (it.grants && it.grants.length > 0) {
      html += `<div class="shop-preview-grants">
        <div class="shop-preview-grants-title">Competences accordees</div>
        <div class="shop-preview-grants-list">${it.grants.join(', ')}</div>
      </div>`;
    }

    // Equipment comparison
    if (isEquipment(it) && this._mode === 'buy') {
      const comp = this._buildComparison(it);
      if (comp) {
        html += comp;
      }
    }

    html += `</div>`;
    preview.innerHTML = html;
    preview.classList.add('visible');
  },

  _clearPreview() {
    const preview = this._root?.querySelector('#shop-preview');
    if (!preview) return;
    preview.innerHTML = `<div class="shop-preview-empty">Survolez un article pour voir les details</div>`;
    preview.classList.remove('visible');
  },

  _extractStats(item) {
    const out = [];
    for (const key of STAT_KEYS) {
      if (item[key] !== undefined && item[key] !== 0) {
        out.push({
          key,
          label: STAT_LABELS[key],
          value: item[key],
          color: STAT_COLORS[key],
        });
      }
    }
    if (item.stat_spd) {
      out.push({ key: 'spd', label: 'VIT', value: item.stat_spd, color: '#f39c12' });
    }
    if (item.ap !== undefined) {
      out.push({ key: 'ap', label: 'PA', value: item.ap, color: '#1abc9c' });
    }
    return out;
  },

  _buildComparison(newItem) {
    const slot = newItem.slot;
    if (!slot) return null;

    // Find which party member can equip this
    let bestMember = null;
    let bestScore = -Infinity;
    for (const m of GAME.party) {
      const canEq = this._canMemberEquip(m, newItem);
      const score = this._equipScore(m, newItem);
      if (canEq && score > bestScore) {
        bestScore = score;
        bestMember = m;
      }
    }
    if (!bestMember) return null;

    const currentId = bestMember.equipped?.[slot];
    const currentItem = currentId ? getItem(currentId) : null;

    if (!currentItem && !newItem) return null;

    let html = `<div class="shop-compare">`;
    html += `<div class="shop-compare-title">Comparaison avec ${bestMember.name}</div>`;

    if (currentItem) {
      html += `<div class="shop-compare-current">
        <span class="shop-compare-current-name">${currentItem.icon || ''} ${currentItem.name}</span>
        <span class="shop-compare-current-label">(equipe)</span>
      </div>`;
    } else {
      html += `<div class="shop-compare-current shop-compare-empty">(vide)</div>`;
    }

    // Stat diffs
    const allKeys = new Set([...STAT_KEYS, 'spd']);
    let hasDiff = false;
    html += `<div class="shop-compare-diffs">`;

    for (const key of allKeys) {
      const newVal = newItem[key] || newItem.stat_spd && key === 'spd' ? newItem.stat_spd : 0;
      const oldVal = currentItem
        ? (currentItem[key] || (key === 'spd' ? currentItem.stat_spd : 0) || 0)
        : 0;
      if (newVal === 0 && oldVal === 0) continue;
      const diff = newVal - oldVal;
      if (diff === 0) {
        html += `<div class="shop-diff shop-diff-same">
          <span class="shop-diff-label">${STAT_LABELS[key] || key}</span>
          <span class="shop-diff-val">${newVal}</span>
        </div>`;
      } else {
        hasDiff = true;
        const cls = diff > 0 ? 'shop-diff-up' : 'shop-diff-down';
        html += `<div class="shop-diff ${cls}">
          <span class="shop-diff-label">${STAT_LABELS[key] || key}</span>
          <span class="shop-diff-val">${newVal} (${diff > 0 ? '+' : ''}${diff})</span>
        </div>`;
      }
    }

    html += `</div>`;

    // Skills comparison
    const newSkills = (newItem.grants || []).filter(s => s);
    const oldSkills = (currentItem?.grants || []).filter(s => s);
    if (newSkills.length > 0 || oldSkills.length > 0) {
      const onlyNew = newSkills.filter(s => !oldSkills.includes(s));
      const lost = oldSkills.filter(s => !newSkills.includes(s));
      if (onlyNew.length > 0 || lost.length > 0) {
        html += `<div class="shop-compare-skills">`;
        if (onlyNew.length > 0) {
          html += `<div class="shop-diff shop-diff-up">
            <span class="shop-diff-label">+ Skills</span>
            <span class="shop-diff-val">${onlyNew.join(', ')}</span>
          </div>`;
        }
        if (lost.length > 0) {
          html += `<div class="shop-diff shop-diff-down">
            <span class="shop-diff-label">− Skills</span>
            <span class="shop-diff-val">${lost.join(', ')}</span>
          </div>`;
        }
        html += `</div>`;
      }
    }

    // Overall verdict
    const totalOld = this._statTotal(currentItem);
    const totalNew = this._statTotal(newItem);
    const verdict = totalNew > totalOld ? 'upgrade' : totalNew < totalOld ? 'downgrade' : 'same';
    html += `<div class="shop-compare-verdict shop-verdict-${verdict}">
      ${verdict === 'upgrade' ? '▲ Amelioration' : verdict === 'downgrade' ? '▼ Degradation' : '— Equivalent'}
    </div>`;

    html += `</div>`;
    return html;
  },

  _statTotal(item) {
    if (!item) return 0;
    let t = 0;
    for (const key of STAT_KEYS) t += (item[key] || 0);
    t += (item.stat_spd || 0);
    return t;
  },

  _canMemberEquip(member, item) {
    if (!isEquipment(item)) return false;
    if (item.type === 'weapon') return member.weaponType === item.slot;
    if (item.type === 'armor') return member.armorType === item.slot;
    return true;
  },

  _equipScore(member, item) {
    let score = 0;
    for (const key of STAT_KEYS) score += (item[key] || 0) * (key === 'atk' ? 2 : 1);
    score += (item.stat_spd || 0);
    return score;
  },

  _typeName(type) {
    const names = { weapon: 'Arme', armor: 'Armure', accessory: 'Accessoire', consume: 'Consommable' };
    return names[type] || type;
  },

  _slotName(slot) {
    const names = {
      dagger: 'Dague', sword: 'Epee', staff: 'Baton', rod: 'Baton',
      light: 'Legere', heavy: 'Lourde', robe: 'Robe',
    };
    return names[slot] || slot;
  },

  // ─── Quantity ──────────────────────────────────────────────────────

  _adjustQty(delta) {
    const maxQty = this._mode === 'buy' ? this._maxBuyQty() : this._maxSellQty();
    this._qty = Math.max(1, Math.min(maxQty, this._qty + delta));
    this._root.querySelector('#qty-val').textContent = this._qty;
    audio.sfx('menu_cursor');
    this._render();
  },

  _maxBuyQty() {
    if (this._cursor < 0) return 1;
    const items = this._mode === 'buy' ? this._buildBuyList() : this._buildSellList();
    const entry = items[this._cursor];
    if (!entry || !entry.price) return 1;
    return Math.floor(GAME.inventory.gold / entry.price) || 1;
  },

  _maxSellQty() {
    if (this._cursor < 0) return 1;
    const items = this._buildSellList();
    const entry = items[this._cursor];
    if (!entry) return 1;
    return entry.owned || 1;
  },

  _updateQtyVisibility() {
    const qtyEl = this._root?.querySelector('#shop-qty');
    if (!qtyEl) return;
    const items = this._mode === 'buy' ? this._buildBuyList() : this._buildSellList();
    const entry = items[this._cursor];
    const isEquip = entry && isEquipment(entry);
    // Don't show qty for equipment (buy/sell one at a time)
    qtyEl.style.display = isEquip ? 'none' : 'flex';
    this._qty = 1;
    const valEl = this._root.querySelector('#qty-val');
    if (valEl) valEl.textContent = '1';
  },

  // ─── Buy / Sell Logic ─────────────────────────────────────────────

  _buy(id) {
    const it = ITEMS[id];
    if (!it) return;
    const totalCost = it.price * this._qty;

    if (GAME.inventory.gold < totalCost) {
      audio.sfx('cancel');
      this._showMsg('Or insuffisant !', 'error');
      return;
    }

    const isEquip = isEquipment(it);

    // For equipment, qty is always 1
    const qty = isEquip ? 1 : this._qty;

    GAME.inventory.gold -= totalCost;

    if (isEquip) {
      GAME.inventory.addEquipment(id, qty);
    } else {
      GAME.inventory.add(id, qty);
    }

    audio.sfx('coin');
    this._updateGold();
    this._showMsg(`${qty}x ${it.name} achete${qty > 1 ? 's' : ''} !`, 'success');
    this._qty = 1;
    this._render();
  },

  _sell(id) {
    const it = ITEMS[id];
    if (!it) return;

    const isEquip = isEquipment(it);
    const inv = GAME.inventory;
    const owned = isEquip ? (inv.equipment[id] || 0) : (inv.items[id] || 0);

    if (owned <= 0) {
      audio.sfx('cancel');
      this._showMsg('Article non disponible.', 'error');
      return;
    }

    // Prevent selling equipped items
    const equipped = this._getEquippedCount(id);
    if (equipped >= owned) {
      audio.sfx('cancel');
      this._showMsg('Impossible de vendre un objet equipe !', 'error');
      return;
    }

    const qty = isEquip ? 1 : Math.min(this._qty, owned - equipped);
    const sellPrice = Math.floor((it.price || 0) * 0.5) * qty;

    if (isEquip) {
      GAME.inventory.removeEquipment(id, qty);
    } else {
      GAME.inventory.remove(id, qty);
    }

    GAME.inventory.gold += sellPrice;
    audio.sfx('coin');
    this._updateGold();
    this._showMsg(`${qty}x ${it.name} vendu${qty > 1 ? 's' : ''} pour ${sellPrice} G !`, 'success');
    this._qty = 1;
    this._render();
  },

  // ─── UI Helpers ────────────────────────────────────────────────────

  _updateGold() {
    const el = this._root?.querySelector('#shop-gold');
    if (el) el.textContent = `Or : ${GAME.inventory.gold} G`;
  },

  _showMsg(text, type) {
    const el = this._root?.querySelector('#shop-msg');
    if (!el) return;
    el.textContent = text;
    el.className = `shop-msg shop-msg-${type} visible`;
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => {
      el.classList.remove('visible');
    }, 2000);
  },

  // ─── Keyboard Navigation ───────────────────────────────────────────

  _bindKeys() {
    this._keyHandler = (e) => {
      if (!this._root) return;
      const items = this._mode === 'buy' ? this._buildBuyList() : this._buildSellList();
      const max = items.length - 1;

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          audio.sfx('menu_cursor');
          this._cursor = Math.max(0, this._cursor - 1);
          this._highlightRow(this._cursor);
          this._showPreview(items[this._cursor]);
          this._updateQtyVisibility();
          break;

        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          audio.sfx('menu_cursor');
          this._cursor = Math.min(max, this._cursor + 1);
          this._highlightRow(this._cursor);
          this._showPreview(items[this._cursor]);
          this._updateQtyVisibility();
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          if (items[this._cursor]) {
            if (this._mode === 'buy') this._buy(items[this._cursor].id);
            else this._sell(items[this._cursor].id);
          }
          break;

        case 'Escape':
          e.preventDefault();
          this.close();
          break;

        case '+':
        case '=':
          e.preventDefault();
          if (this._root.querySelector('#shop-qty').style.display !== 'none') {
            this._adjustQty(1);
          }
          break;

        case '-':
        case '_':
          e.preventDefault();
          if (this._root.querySelector('#shop-qty').style.display !== 'none') {
            this._adjustQty(-1);
          }
          break;

        case 'Tab':
          e.preventDefault();
          this._switchTab(this._mode === 'buy' ? 'sell' : 'buy');
          break;
      }
    };

    document.addEventListener('keydown', this._keyHandler);
  },
};
