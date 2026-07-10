// engine/progression.js — XP/Levels, AP/skill learning, stats growth (FFIX)
import { CHARACTERS } from '../data/characters.js';
import { SKILLS, DRAGON_SKILL_MAP } from '../data/skills.js';

// Member runtime shape:
// { id, name, level, xp, hp, mp, alive, stats, equipped: {weapon,armor,accessory},
//   ap: {skillId: count}, learned: Set[skillId], atb, ready }

// `inventory` is passed as a parameter by callers in state.js / battle UI to avoid a circular import.

export function createMemberRuntime(charId, level = 1, inventory = null) {
  const c = CHARACTERS[charId]; if (!c) return null;
  const m = {
    id: c.id, name: c.name, level,
    xp: xpForLevel(level),
    maxHp: 0, maxMp: 0, hp: 1, mp: 0, alive: true,
    stats: { str:0, mag:0, vit:0, spd:0, luck:0, def:0, mdef:0 },
    equipped: { weapon: null, armor: null, accessory: null },
    ap: {}, learned: new Set(),
    atb: 0, ready: false, isEnemy: false,
    _lastAction: { type: 'attack', skillId: null, itemId: null, targetIsAlly: false }, // memory for direct-click repeat
    skills: {}, // runtime skill map (populated by dragon skills, etc.)
  };
  if (c.innate) m.learned.add(c.innate);
  if (inventory) inventory._recomputeStats(m);
  m.hp = m.maxHp || (CHARACTERS[charId].base.hp + (level-1) * CHARACTERS[charId].growth.hp);
  m.mp = m.maxMp || (CHARACTERS[charId].base.mp + (level-1) * CHARACTERS[charId].growth.mp);
  return m;
}

export function xpForLevel(level) {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) total += Math.floor(40 * Math.pow(l, 1.7) + 20);
  return total;
}
export function levelFromXp(xp) {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
}

// Grant battle loot (exp, ap, gil, drops). Pass inventory from caller.
// jobXpCallback: optional function(characterId, amount) to award job XP
export function grantBattleLoot(party, reward, inventory, jobXpCallback) {
  const reports = [];
  const aliveMembers = party.filter(m => m.alive);
  const perExp = Math.floor((reward.exp || 0) / Math.max(1, aliveMembers.length));
  for (const m of aliveMembers) {
    const before = m.level;
    m.xp += perExp;
    const newLv = levelFromXp(m.xp);
    if (newLv > before) {
      m.level = newLv;
      if (inventory) inventory._recomputeStats(m);
      m.hp = m.maxHp; m.mp = m.maxMp;
      reports.push({ type: 'levelup', member: m, oldLevel: before, newLevel: newLv });
    }
    // ─── Award Job XP ──────────────────────────────────────────────
    if (jobXpCallback && m._jobId) {
      const jobLeveled = jobXpCallback(m.id, perExp);
      if (jobLeveled) {
        reports.push({ type: 'jobLevelup', member: m, jobId: m._jobId, newLevel: m._jobLevel });
        if (inventory) inventory._recomputeStats(m);
      }
    }
  }

  const apReward = reward.ap || 0;
  for (const m of party) {
    if (!m.alive) continue;
    const granted = inventory ? inventory.currentEquipSkills(m) : [];
    for (const g of granted) {
      m.ap[g.skillId] = (m.ap[g.skillId] || 0) + g.ap + apReward;
      const req = SKILLS[g.skillId]?.ap;
      if (req && m.ap[g.skillId] >= req && !m.learned.has(g.skillId)) {
        m.learned.add(g.skillId);
        reports.push({ type: 'skillLearned', member: m, skillId: g.skillId });
      }
    }
  }

  if (reward.gil && inventory) inventory.gold += reward.gil;
  if (reward.drops && inventory) for (const d of reward.drops) {
    if (Math.random() < (d.chance || 1)) {
      inventory.add(d.item, 1);
      reports.push({ type: 'drop', item: d.item });
    }
  }
  return reports;
}

export function learnedSkills(member) {
  if (!member || !member.learned) return [];
  return [...member.learned].map(id => ({ id, ...SKILLS[id] })).filter(Boolean);
}

// Dragon Skills (unique per character, usable only in Dragon Form)
export function getDragonSkill(member) {
  if (!member) return null;
  const skillId = DRAGON_SKILL_MAP?.[member.id] || null;
  if (!skillId) return null;
  const def = SKILLS[skillId];
  if (!def) return null;
  return { id: skillId, ...def };
}
