// data/colosseum_cups.js — PURE DATA: 4 tournament cups + story gating + betting tiers
// Imported by js/scenes/colosseum.js. No logic, no imports of colosseum.js (avoid circular dep).

export const COLOSSEUM_ACCESS = {
  fromMenu: true,
  fromChapter: 1,
  note: "Accessible from main menu after Ch1, limited to apprentice_cup until story progresses",
};

// Each cup: unlockChapter, maxBet, ranks[] (each rank: name, entryFee, enemies[], rewards)
export const COLOSSEUM_CUPS = {
  apprentice_cup: {
    id: 'apprentice_cup',
    name: 'Coupe de l\'Apprenti',
    unlockChapter: 1,
    maxBet: 500,
    music: 'Clockwork Duel',
    ranks: [
      {
        id: 'wood', name: 'Rang Bois', entryFee: 0,
        enemies: ['goblin', 'wolf'],
        rewards: { gold: 100, items: [{ id: 'potion', count: 3 }], title: 'Bois' },
      },
      {
        id: 'iron', name: 'Rang Fer', entryFee: 50,
        enemies: ['goblin', 'wolf', 'bat'],
        rewards: { gold: 200, items: [{ id: 'antidote', count: 3 }], title: 'Fer' },
      },
      {
        id: 'bronze', name: 'Rang Bronze', entryFee: 100,
        enemies: ['skeleton', 'goblin', 'wolf'],
        rewards: { gold: 400, items: [{ id: 'leather_vest', count: 1 }], title: 'Bronze' },
      },
      {
        id: 'steel', name: 'Rang Acier', entryFee: 200,
        enemies: ['skeleton', 'bat', 'wolf', 'goblin'],
        rewards: { gold: 800, items: [{ id: 'bronze_armor', count: 1 }, { id: 'potion', count: 5 }], title: 'Acier', flags: { set: 'apprentice_champion' } },
      },
    ],
  },

  warrior_cup: {
    id: 'warrior_cup',
    name: 'Coupe du Guerrier',
    unlockChapter: 4,
    maxBet: 2000,
    music: 'Crystal Panic GAME',
    ranks: [
      {
        id: 'copper', name: 'Rang Cuivre', entryFee: 300,
        enemies: ['skeleton', 'orc', 'bat'],
        rewards: { gold: 1000, items: [{ id: 'ether', count: 2 }], title: 'Cuivre' },
      },
      {
        id: 'silver', name: 'Rang Argent', entryFee: 500,
        enemies: ['orc', 'skeleton', 'wolf', 'bat'],
        rewards: { gold: 1500, items: [{ id: 'silver_armor', count: 1 }], title: 'Argent' },
      },
      {
        id: 'gold', name: 'Rang Or', entryFee: 800,
        enemies: ['orc', 'skeleton', 'goblin', 'bat'],
        rewards: { gold: 2500, items: [{ id: 'flame_rod', count: 1 }], title: 'Or' },
      },
      {
        id: 'platinum', name: 'Rang Platine', entryFee: 1200,
        enemies: ['orc', 'skeleton', 'wolf', 'bat', 'goblin'],
        rewards: { gold: 3500, items: [{ id: 'ninja_vest', count: 1 }], title: 'Platine' },
      },
      {
        id: 'mithril', name: 'Rang Mythril', entryFee: 1800,
        enemies: ['orc', 'skeleton', 'bat', 'wolf'],
        rewards: { gold: 5000, items: [{ id: 'mythril_blade', count: 1 }], title: 'Mythril', flags: { set: 'warrior_champion' } },
      },
    ],
  },

  champion_cup: {
    id: 'champion_cup',
    name: 'Coupe du Champion',
    unlockChapter: 9,
    maxBet: 10000,
    music: 'Djinn in My Veins',
    ranks: [
      {
        id: 'diamond', name: 'Rang Diamant', entryFee: 2500,
        enemies: ['orc', 'skeleton', 'wolf', 'bat'],
        rewards: { gold: 6000, items: [{ id: 'elixir', count: 1 }], title: 'Diamant' },
      },
      {
        id: 'master', name: 'Rang Maître', entryFee: 3500,
        enemies: ['orc', 'skeleton', 'goblin', 'bat', 'wolf'],
        rewards: { gold: 8000, items: [{ id: 'plate_mail', count: 1 }], title: 'Maître' },
      },
      {
        id: 'grandmaster', name: 'Rang Grand Maître', entryFee: 5000,
        enemies: ['orc', 'skeleton', 'wolf', 'bat'],
        rewards: { gold: 12000, items: [{ id: 'dragon_crest', count: 1 }], title: 'Grand Maître' },
      },
      {
        id: 'legend', name: 'Rang Légende', entryFee: 7000,
        enemies: ['corrupt_knight', 'orc', 'skeleton'],
        rewards: { gold: 18000, items: [{ id: 'holy_sword', count: 1 }], title: 'Légende' },
      },
      {
        id: 'mythic', name: 'Rang Mythique', entryFee: 10000,
        enemies: ['sand_lord', 'corrupt_knight', 'orc'],
        rewards: { gold: 25000, items: [{ id: 'crown_of_lindblum', count: 1 }], title: 'Mythique', flags: { set: 'champion_champion', lore: 'lore_unlock_colosseum' } },
      },
    ],
  },

  mythic_cup: {
    id: 'mythic_cup',
    name: 'Coupe Mythique',
    unlockChapter: 15,
    maxBet: 50000,
    music: 'The Descent into Ruin',
    ranks: [
      {
        id: 'divine', name: 'Rang Divin', entryFee: 15000,
        enemies: ['corrupt_knight', 'sand_lord', 'orc'],
        rewards: { gold: 30000, items: [{ id: 'mega_elixir', count: 1 }], title: 'Divin' },
      },
      {
        id: 'celestial', name: 'Rang Céleste', entryFee: 20000,
        enemies: ['sand_lord', 'corrupt_knight', 'skeleton'],
        rewards: { gold: 40000, items: [{ id: 'assassin_dagger', count: 1 }], title: 'Céleste' },
      },
      {
        id: 'eternal', name: 'Rang Éternel', entryFee: 30000,
        enemies: ['corrupt_knight', 'sand_lord', 'orc', 'skeleton'],
        rewards: { gold: 60000, items: [{ id: 'moon_rod', count: 1 }], title: 'Éternel' },
      },
      {
        id: 'transcendent', name: 'Rang Transcendant', entryFee: 50000,
        enemies: ['sand_lord', 'corrupt_knight', 'corrupt_knight'],
        rewards: { gold: 100000, items: [{ id: 'collector_trophy', count: 1 }], title: 'Transcendant', flags: { set: 'mythic_champion', lore: 'lore_unlock_final' } },
      },
    ],
  },
};

// Payout multipliers
export const COLOSSEUM_BETTING = {
  ownMatchMultiplier: 2.0,
  spectateOddsMin: 1.5,
  spectateOddsMax: 4.0,
};
