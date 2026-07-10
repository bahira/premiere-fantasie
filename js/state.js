// state.js — Global game state (FFIX runtime)
import { Inventory } from './engine/inventory.js';
import { createMemberRuntime } from './engine/progression.js';
import { PARTY_ORDER } from './data/characters.js';
import { getChapter } from './data/story.js';

export const GAME = {
  // Game flow
  scene: 'title', // title | field | town | battle | menu | gameover | theend
  chapterId: 1,
  prevScene: null,

  // Party & inventory
  party: [],
  inventory: new Inventory(),

  // Battle state
  battle: null,
  pendingFormation: null,

  // Job system: { characterId: { jobId, level, xp } }
  jobs: {},

  // Pet system: { characterId: { petId, level, xp } }
  pets: {},

  // Flags
  flags: {},

  // Audio intensity target
  intensity: 0,
};

export function initParty() {
  GAME.party = PARTY_ORDER.slice(0, 4).map(id => createMemberRuntime(id, 1, GAME.inventory));

  // Assign starter jobs
  const starterJobs = {
    zidane: 'voleur',
    mage: 'mage_noir',
    knight: 'chevalier',
    healer: 'prestre',
  };
  for (const m of GAME.party) {
    if (starterJobs[m.id]) {
      GAME.jobs[m.id] = { jobId: starterJobs[m.id], level: 1, xp: 0 };
    }
  }

  // Equip starter equipment
  const defaults = {
    zidane: { weapon: 'dagger', armor: 'leather_vest' },
    mage:   { weapon: 'rod',    armor: 'mage_robe' },
    knight: { weapon: 'broadsword', armor: 'bronze_armor' },
    healer: { weapon: 'healing_rod', armor: 'priest_robe' },
  };
  for (const m of GAME.party) {
    const d = defaults[m.id]; if (!d) continue;
    if (d.weapon && GAME.inventory.equipment[d.weapon]) {
      GAME.inventory.equip(m, 'weapon', d.weapon);
    }
    if (d.armor && GAME.inventory.equipment[d.armor]) {
      GAME.inventory.equip(m, 'armor', d.armor);
    }
  }
}

/** Get current job for a character */
export function getCharacterJob(characterId) {
  const jobState = GAME.jobs[characterId];
  if (!jobState) return null;
  return jobState;
}

/** Get equipped pet for a character */
export function getCharacterPet(characterId) {
  const petState = GAME.pets[characterId];
  if (!petState) return null;
  return petState;
}

/** Award job XP to a character */
export function awardJobXP(characterId, amount) {
  const jobState = GAME.jobs[characterId];
  if (!jobState) return false;
  jobState.xp += amount;
  const nextLevelXp = Math.floor(30 * Math.pow(jobState.level + 1, 1.6) + 10);
  if (jobState.xp >= nextLevelXp) {
    jobState.level++;
    jobState.xp -= nextLevelXp;
    return true; // leveled up
  }
  return false;
}

export function currentChapter() { return getChapter(GAME.chapterId); }
export function advanceChapter() {
  GAME.chapterId += 1;
  return currentChapter();
}
