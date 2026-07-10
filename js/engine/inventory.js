// engine/inventory.js — Inventory, equipment, gold, synthesis (FFIX-style)
import { ITEMS, getItem, isEquipment } from '../data/items.js';
import { SKILLS } from '../data/skills.js';
import { CHARACTERS } from '../data/characters.js';
import { getJobStatBonus } from '../data/jobs.js';
import { getPetStatBonus } from '../data/pets.js';

export class Inventory {
  constructor() {
    this.gold = 500;
    this.items = {}; // id -> count (consumables)
    this.equipment = {}; // id -> count (equipment owned)
    this.starters();
  }
  starters() {
    this.add('potion', 5);
    this.add('phoenix_down', 2);
    this.add('antidote', 3);
    // weapons for each starter character
    this.addEquipment('dagger');
    this.addEquipment('rod');
    this.addEquipment('broadsword');
    this.addEquipment('healing_rod');
    this.addEquipment('leather_vest');
    this.addEquipment('mage_robe');
    this.addEquipment('bronze_armor');
    this.addEquipment('priest_robe');
  }

  add(id, n = 1) { this.items[id] = (this.items[id] || 0) + n; }
  addGold(n = 0) { this.gold = (this.gold || 0) + n; }
  addEquipment(id, n = 1) { this.equipment[id] = (this.equipment[id] || 0) + n; }
  remove(id, n = 1) {
    if (this.items[id]) { this.items[id] -= n; if (this.items[id] <= 0) delete this.items[id]; }
  }
  removeEquipment(id, n = 1) {
    if (this.equipment[id]) { this.equipment[id] -= n; if (this.equipment[id] <= 0) delete this.equipment[id]; }
  }

  getCount(id) { return this.items[id] || 0; }

  listItems() {
    return Object.keys(this.items).filter(id => this.items[id] > 0).map(id => ({ id, ...getItem(id), count: this.items[id] }));
  }
  listEquipment() {
    return Object.keys(this.equipment).filter(id => this.equipment[id] > 0).map(id => ({ id, ...getItem(id), count: this.equipment[id] }));
  }

  canEquip(memberId, itemId) {
    const item = getItem(itemId); if (!item || !isEquipment(item)) return false;
    const char = CHARACTERS[memberId]; if (!char) return false;
    if (item.type === 'weapon') return char.weaponType === item.slot;
    if (item.type === 'armor') return char.armorType === item.slot;
    return true; // accessories
  }

  equip(member, slot, itemId) {
    if (!this.canEquip(member.id, itemId)) return { ok: false, reason: ' Classe incompatible.' };
    // Return existing equip to stock
    const prev = member.equipped[slot];
    if (prev) this.addEquipment(prev);
    // Remove new from stock
    this.removeEquipment(itemId);
    member.equipped[slot] = itemId;
    this._recomputeStats(member);
    return { ok: true };
  }

  unequip(member, slot) {
    const prev = member.equipped[slot];
    if (!prev) return { ok: false };
    this.addEquipment(prev);
    member.equipped[slot] = null;
    this._recomputeStats(member);
    return { ok: true };
  }

  // Recompute effective stats based on base + level growth + equipment + job + pet
  _recomputeStats(member) {
    const char = CHARACTERS[member.id];
    const lv = member.level;
    const base = char.base;
    const g = char.growth;
    member.maxHp = Math.floor(base.hp + g.hp * (lv - 1));
    member.maxMp = Math.floor(base.mp + g.mp * (lv - 1));
    member.stats = {
      str: Math.floor(base.str + g.str * (lv - 1)),
      mag: Math.floor(base.mag + g.mag * (lv - 1)),
      vit: Math.floor(base.vit + g.vit * (lv - 1)),
      spd: Math.floor(base.spd + g.spd * (lv - 1)),
      luck: Math.floor(base.luck + g.luck * (lv - 1)),
      def: 0, mdef: 0,
    };
    let atk = 0, magBonus = 0, def = 0, mdef = 0;
    let weaponElement = 'none';
    const slots = ['weapon','armor','accessory'];
    for (const s of slots) {
      const id = member.equipped[s];
      if (!id) continue;
      const it = getItem(id);
      if (!it) continue;
      if (it.atk) atk += it.atk;
      if (it.mag) magBonus += it.mag;
      if (it.def) def += it.def;
      if (it.mdef) mdef += it.mdef;
      if (it.stat_spd) member.stats.spd += it.stat_spd;
      if (it.immun_all) { member._immunAll = true; }
      if (s === 'weapon' && it.element) weaponElement = it.element;
    }
    member.weaponElement = weaponElement;
    member.atk = atk; member.magBonus = magBonus;
    member.stats.def = def + Math.floor(member.stats.vit * 1.2);
    member.stats.mdef = mdef + Math.floor(member.stats.mag * 0.6);
    member.stats.str += Math.floor(atk * 0.3); // weapon contributes to phys
    member.stats.mag += Math.floor(magBonus * 0.5);
    // ─── Job stat bonus ────────────────────────────────────────────
    if (member._jobId && member._jobLevel) {
      const jobBonus = getJobStatBonus(member._jobId, member._jobLevel);
      for (const [stat, val] of Object.entries(jobBonus)) {
        if (member.stats[stat] !== undefined) member.stats[stat] += val;
      }
    }
    // ─── Pet stat bonus ────────────────────────────────────────────
    if (member._petId && member._petLevel) {
      const petBonus = getPetStatBonus(member._petId, member._petLevel);
      for (const [stat, val] of Object.entries(petBonus)) {
        if (member.stats[stat] !== undefined) member.stats[stat] += val;
      }
    }
  }

  // Returns list of skills granted by current equipment (for AP learning)
  currentEquipSkills(member) {
    const out = [];
    const slots = ['weapon','armor','accessory'];
    for (const s of slots) {
      const id = member.equipped[s]; if (!id) continue;
      const it = getItem(id); if (!it || !it.grants) continue;
      for (const skId of it.grants) out.push({ skillId: skId, ap: it.ap || 1 });
    }
    return out;
  }
}
