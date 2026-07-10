// data/pets.js — Pet/Companion system (Golden Sun Djinn / Pokémon style)
// Pets provide passive bonuses, battle assists, and unique abilities.
// Each pet has an element, personality, and growth path.

export const PETS = {
  // ─── Starter Pets (choose one at game start) ───────────────────────
  phoenix: {
    id: 'phoenix', name: 'Phénix', icon: '🔥',
    element: 'fire',
    desc: 'Oiseau de feu. Réduit les dégâts reçus, brûle les ennemis.',
    stats: { atk: 12, def: 8, mag: 15, spd: 10 },
    passive: { type: 'resist', element: 'fire', value: 0.3 }, // -30% fire damage taken
    battleAssist: {
      trigger: 'onHit',        // activates when owner takes damage
      chance: 0.25,            // 25% chance
      effect: 'burn',          // inflicts burn (5% maxHP/turn for 3 turns)
      power: 0.3,
    },
    growth: [
      { level: 5, bonus: { mag: 3 }, ability: 'rebirth', desc: 'Auto-res once per battle at 1 HP' },
      { level: 10, bonus: { mag: 5, spd: 3 }, ability: 'nova', desc: 'AoE fire on all enemies (passive)' },
      { level: 15, bonus: { mag: 8 }, ability: 'phoenix_wave', desc: 'Party heal 20% HP once per battle' },
    ],
  },

  griffon: {
    id: 'griffon', name: 'Griffon', icon: '🦅',
    element: 'wind',
    desc: 'Seigneur des cieux. Augmente la vitesse et esquive.',
    stats: { atk: 10, def: 10, mag: 8, spd: 18 },
    passive: { type: 'evasion', value: 0.15 }, // +15% dodge
    battleAssist: {
      trigger: 'onMiss',
      chance: 0.4,
      effect: 'counter',
      power: 1.5,
    },
    growth: [
      { level: 5, bonus: { spd: 4 }, ability: 'swift', desc: '+20% ATB fill rate' },
      { level: 10, bonus: { spd: 5, atk: 3 }, ability: 'dive_bomb', desc: 'First attack of battle always crits' },
      { level: 15, bonus: { spd: 8 }, ability: 'haste', desc: 'Party SPD +30% at battle start' },
    ],
  },

  loup_esprit: {
    id: 'loup_esprit', name: 'Loup-Esprit', icon: '🐺',
    element: 'dark',
    desc: 'Bête des ombres. Augmente les critiques et draine.',
    stats: { atk: 18, def: 12, mag: 6, spd: 12 },
    passive: { type: 'crit_boost', value: 0.12 }, // +12% crit chance
    battleAssist: {
      trigger: 'onCrit',
      chance: 0.3,
      effect: 'drain',
      power: 0.2, // drains 20% of crit damage
    },
    growth: [
      { level: 5, bonus: { atk: 4 }, ability: 'frenzy', desc: '+30% damage when HP < 30%' },
      { level: 10, bonus: { atk: 6, spd: 2 }, ability: 'shadow_bite', desc: 'Physical attacks ignore 20% defense' },
      { level: 15, bonus: { atk: 8 }, ability: 'alpha_wolf', desc: 'Party crit +15%' },
    ],
  },

  // ─── Sidequest Pets (found during exploration) ─────────────────────
  slime_dor: {
    id: 'slime_dor', name: 'Slime Doré', icon: '🟡',
    element: 'holy',
    desc: 'Slime maudit. Double les récompenses d\'or.',
    stats: { atk: 5, def: 15, mag: 10, spd: 5 },
    passive: { type: 'gold_bonus', value: 1.0 }, // +100% gold from battles
    battleAssist: {
      trigger: 'onVictory',
      chance: 0.5,
      effect: 'bonus_gold',
      power: 50,
    },
    growth: [
      { level: 5, bonus: { def: 3 }, ability: 'absorb', desc: 'Regen 2% HP per turn' },
      { level: 10, bonus: { def: 5, mag: 3 }, ability: 'gold_rush', desc: 'Chance to steal gold on hit' },
      { level: 15, bonus: { def: 8 }, ability: 'treasure_sense', desc: 'Reveals hidden chests on map' },
    ],
  },

  chauve_souris: {
    id: 'chauve_souris', name: 'Chauve-Souris', icon: '🦇',
    element: 'thunder',
    desc: 'Éclaireur nocturne. Augmente la chance de vol.',
    stats: { atk: 8, def: 6, mag: 12, spd: 16 },
    passive: { type: 'steal_chance', value: 0.25 }, // +25% steal success
    battleAssist: {
      trigger: 'onSteal',
      chance: 1.0,
      effect: 'bonus_steal',
      power: 1, // steal extra item
    },
    growth: [
      { level: 5, bonus: { spd: 4 }, ability: 'echolocation', desc: 'Enemies weaknesses always visible' },
      { level: 10, bonus: { spd: 4, mag: 4 }, ability: 'sonic_screech', desc: 'Chance to stun enemy for 1 turn' },
      { level: 15, bonus: { spd: 8 }, ability: 'night_stalker', desc: 'First strike always succeeds' },
    ],
  },

  golem: {
    id: 'golem', name: 'Golem', icon: '🪨',
    element: 'earth',
    desc: 'Gardien de pierre. Boost défense et absorbe dégâts.',
    stats: { atk: 14, def: 20, mag: 4, spd: 4 },
    passive: { type: 'damage_redirect', value: 0.1 }, // absorbs 10% of party damage
    battleAssist: {
      trigger: 'onAllyHit',
      chance: 0.2,
      effect: 'shield',
      power: 0.5, // reduces damage by 50%
    },
    growth: [
      { level: 5, bonus: { def: 5 }, ability: 'stone_skin', desc: '+20% physical defense' },
      { level: 10, bonus: { def: 8, atk: 3 }, ability: 'quake', desc: 'Earth AoE on all enemies' },
      { level: 15, bonus: { def: 12 }, ability: 'fortress', desc: 'Immune to critical hits' },
    ],
  },
};

// ─── Pet Progression ─────────────────────────────────────────────────

/** XP required for pet level */
export function petXpForLevel(level) {
  return Math.floor(25 * Math.pow(level, 1.5) + 5);
}

/** Get active pet abilities at level */
export function getPetAbilities(petId, level) {
  const pet = PETS[petId];
  if (!pet) return [];
  return pet.growth.filter(g => g.level <= level);
}

/** Get pet stat bonuses at level */
export function getPetStatBonus(petId, level) {
  const pet = PETS[petId];
  if (!pet) return {};
  const bonus = { atk: 0, def: 0, mag: 0, spd: 0 };
  for (const g of pet.growth) {
    if (g.level <= level) {
      for (const [stat, val] of Object.entries(g.bonus)) {
        bonus[stat] = (bonus[stat] || 0) + val;
      }
    }
  }
  return bonus;
}
