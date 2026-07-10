// engine/save.js — Save/Load via localStorage (FFIX save crystals)
import { STORY } from '../data/story.js';

const SAVE_KEY = 'firstFantasy_save_v1';

export function saveGame(state) {
  try {
    const payload = {
      chapterId: state.chapterId,
      party: state.party.map(m => ({
        id: m.id, level: m.level, xp: m.xp,
        hp: m.hp, mp: m.mp, alive: m.alive,
        equipped: m.equipped,
        ap: m.ap,
        learned: [...m.learned],
      })),
      gold: state.inventory.gold,
      items: state.inventory.items,
      equipment: state.inventory.equipment,
      flags: state.flags || {},
      timestamp: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) { console.warn('save failed', e); return false; }
}

export function loadGame(state) {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
    const p = JSON.parse(raw);
    state.chapterId = p.chapterId;
    state.inventory.gold = p.gold;
    state.inventory.items = p.items || {};
    state.inventory.equipment = p.equipment || {};
    state.flags = p.flags || {};
    // Rebuild party with persisted level/xp/equip/learned
    import('./progression.js').then(({ createMemberRuntime }) => {
      state.party = p.party.map(saved => {
        const m = createMemberRuntime(saved.id, saved.level, state.inventory);
        m.xp = saved.xp; m.hp = saved.hp; m.mp = saved.mp; m.alive = saved.alive;
        m.equipped = saved.equipped || m.equipped;
        // equip persisted ids (consumables already in inventory — re-equip reduces counts)
        for (const slot of ['weapon','armor','accessory']) {
          if (m.equipped[slot]) state.inventory.removeEquipment(m.equipped[slot]);
        }
        state.inventory._recomputeStats(m);
        m.ap = saved.ap || {};
        m.learned = new Set(saved.learned || []);
        return m;
      });
    });
    return p.timestamp;
  } catch (e) { console.warn('load failed', e); return null; }
}

export function hasSave() { return !!localStorage.getItem(SAVE_KEY); }
export function clearSave() { localStorage.removeItem(SAVE_KEY); }
