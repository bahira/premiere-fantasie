// data/jobs.js — Job/Class system (Golden Sun/FF/Bravely Default style)
// Each character can equip a job that modifies stats, grants unique skills,
// and provides passive abilities. Jobs level up with JP (Job Points).

export const JOBS = {
  // ─── Base Classes (available from start) ────────────────────────────
  voleur: {
    id: 'voleur', name: 'Voleur', icon: '🗡️',
    desc: 'Vif et rusé. Maître de l\'esquive et du vol.',
    statMod: { str: 0, mag: 0, vit: -1, spd: 3, luck: 5, def: 0, mdef: 0 },
    passive: 'esquive',       // 20% dodge chance
    passiveDesc: 'Esquive: 20% de chances d\'esquiver les attaques physiques',
    skills: [
      { id: 'vol', name: 'Vol', jpCost: 0, type: 'steal', desc: 'Voler un objet' },
      { id: 'poignard_rapide', name: 'Poignard Rapide', jpCost: 20, type: 'physical', power: 1.3, desc: 'Double frappe rapide' },
      { id: 'furtif', name: 'Furtif', jpCost: 50, type: 'buff', stat: 'spd', value: 1.5, desc: '+50% Vitesse pendant 3 tours' },
      { id: 'assassinat', name: 'Assassinat', jpCost: 120, type: 'physical', power: 3.0, critBonus: 30, desc: 'Coup fatal (crit+30%)' },
    ],
  },

  chevalier: {
    id: 'chevalier', name: 'Chevalier', icon: '🛡️',
    desc: 'Gardien solide. Protège les alliés et frappe fort.',
    statMod: { str: 2, mag: 0, vit: 3, spd: 0, luck: 0, def: 4, mdef: 1 },
    passive: 'provocation',   // enemies 30% more likely to target this unit
    passiveDesc: 'Provocation: Les ennemis ciblent préférentiellement le Chevalier',
    skills: [
      { id: 'protect', name: 'Protéger', jpCost: 0, type: 'buff', stat: 'def', value: 1.5, target: 'ally', desc: 'Boost défense d\'un allié' },
      { id: 'cri_guerre', name: 'Cri de Guerre', jpCost: 25, type: 'debuff', stat: 'def', value: 0.7, target: 'all_enemies', desc: '-30% défense tous les ennemis' },
      { id: 'taille', name: 'Taille', jpCost: 60, type: 'physical', power: 2.0, desc: 'Coup dévastateur à un ennemi' },
      { id: 'bastion', name: 'Bastion', jpCost: 150, type: 'buff', stat: 'def', value: 2.0, target: 'all_allies', desc: 'Double défense de l\'équipe' },
    ],
  },

  mage_noir: {
    id: 'mage_noir', name: 'Mage Noir', icon: '🔮',
    desc: 'Maître des éléments offensifs. Dégâts de masse.',
    statMod: { str: -1, mag: 4, vit: 0, spd: 1, luck: 0, def: 0, mdef: 3 },
    passive: 'concentration',  // +15% magic damage when HP > 80%
    passiveDesc: 'Concentration: +15% dégâts magiques quand PV > 80%',
    skills: [
      { id: 'feu_grand', name: 'Feu Grand', jpCost: 0, type: 'magic', element: 'fire', power: 1.4, desc: 'Feu ardent sur un ennemi' },
      { id: 'glace', name: 'Glace', jpCost: 20, type: 'magic', element: 'ice', power: 1.3, desc: 'Glace sur un ennemi' },
      { id: 'foudre', name: 'Foudre', jpCost: 45, type: 'magic', element: 'thunder', power: 1.5, desc: 'Foudre sur tous les ennemis' },
      { id: 'meteo', name: 'Météo', jpCost: 150, type: 'magic', element: 'none', power: 2.5, target: 'all_enemies', desc: 'Météorite sur tous les ennemis' },
    ],
  },

  pretre: {
    id: 'prestre', name: 'Prêtre', icon: '✝️',
    desc: 'Guérisseur sacré. Soigne et protège.',
    statMod: { str: 0, mag: 3, vit: 1, spd: 0, luck: 2, def: 1, mdef: 4 },
    passive: 'foi',           // +20% healing power
    passiveDesc: 'Foi: +20% efficacité des soins',
    skills: [
      { id: 'soin', name: 'Soin', jpCost: 0, type: 'heal', power: 1.5, target: 'ally', desc: 'Soigner un allié' },
      { id: 'soin_groupe', name: 'Soin de Groupe', jpCost: 30, type: 'heal', power: 1.0, target: 'all_allies', desc: 'Soigner toute l\'équipe' },
      { id: 'resurrection', name: 'Résurrection', jpCost: 80, type: 'revive', desc: 'Ressusciter un allié KO' },
      { id: 'sanctuaire', name: 'Sanctuaire', jpCost: 200, type: 'heal', power: 2.0, target: 'all_allies', desc: 'Soin puissant + purifie tous les alliés' },
    ],
  },

  // ─── Advanced Classes (unlock at job level 10) ─────────────────────
  assassin: {
    id: 'assassin', name: 'Assassin', icon: '💀',
    desc: 'Ombre mortelle. Crits garantis et poison.',
    statMod: { str: 2, mag: 0, vit: -2, spd: 6, luck: 8, def: -1, mdef: 0 },
    passive: 'crit_vie',      // +25% crit against targets below 30% HP
    passiveDesc: 'Coup de Grâce: +25% critique contre les cibles sous 30% PV',
    requires: { job: 'voleur', level: 10 },
    skills: [
      { id: 'poison_d', name: 'Poison Mortel', jpCost: 40, type: 'status', status: 'poison', power: 0.8, desc: 'Empoisonne + dégâts' },
      { id: 'triple_lame', name: 'Triple Lame', jpCost: 80, type: 'physical', power: 1.2, hits: 3, desc: '3 frappes consécutives' },
      { id: 'ombre', name: 'Ombre', jpCost: 150, type: 'physical', power: 4.0, desc: 'Coup d\'ombre (ignore défense)' },
    ],
  },

  paladin: {
    id: 'paladin', name: 'Paladin', icon: '⚔️',
    desc: 'Guerrier saint. Mêlée + lumière + soin.',
    statMod: { str: 3, mag: 2, vit: 2, spd: 0, luck: 1, def: 3, mdef: 2 },
    passive: 'sainte_armure', // -15% magic damage taken
    passiveDesc: 'Sainte Armure: -15% dégâts magiques reçus',
    requires: { job: 'chevalier', level: 10 },
    skills: [
      { id: 'lumiere', name: 'Lumière', jpCost: 30, type: 'magic', element: 'holy', power: 1.5, desc: 'Lumière sainte' },
      { id: 'main_guerison', name: 'Main Guérisseuse', jpCost: 60, type: 'heal', power: 1.8, target: 'ally', desc: 'Soin + cure status' },
      { id: 'jugement', name: 'Jugement', jpCost: 180, type: 'magic', element: 'holy', power: 2.5, target: 'all_enemies', desc: 'Jugement divin sur tous' },
    ],
  },

  archimage: {
    id: 'archimage', name: 'Archimage', icon: '🌟',
    desc: 'Maître absolu des éléments. Sorts dévastateurs.',
    statMod: { str: -2, mag: 6, vit: -1, spd: 2, luck: 0, def: 0, mdef: 5 },
    passive: 'elemental_mastery', // +25% magic damage, -25% MP cost
    passiveDesc: 'Maîtrise Élémentaire: +25% dégâts magiques, -25% coût PM',
    requires: { job: 'mage_noir', level: 10 },
    skills: [
      { id: 'chaos', name: 'Chaos', jpCost: 50, type: 'magic', element: 'dark', power: 1.8, desc: 'Ténèbres dévorantes' },
      { id: 'temete', name: 'Tempête', jpCost: 100, type: 'magic', element: 'thunder', power: 2.0, target: 'all_enemies', desc: 'Tempête sur tous les ennemis' },
      { id: 'nadir', name: 'Nadir', jpCost: 250, type: 'magic', element: 'dark', power: 3.5, target: 'all_enemies', desc: 'Le néant absolu' },
    ],
  },

  pretre_noir: {
    id: 'pretre_noir', name: 'Prêtre Noir', icon: '🌑',
    desc: 'Soin interdit. Soigne par les ténèbres.',
    statMod: { str: 0, mag: 4, vit: 1, spd: 1, luck: 1, def: 1, mdef: 5 },
    passive: 'sang_maudite', // sacrifices 10% HP to double healing power
    passiveDesc: 'Sang Maudit: sacrifie 10% PV pour doubler les soins',
    requires: { job: 'prestre', level: 10 },
    skills: [
      { id: 'sang_soin', name: 'Soin Sanguin', jpCost: 40, type: 'heal', power: 2.5, selfDamage: 0.1, desc: 'Soin puissant (coûte 10% PV)' },
      { id: 'absorption', name: 'Absorption', jpCost: 80, type: 'magic', element: 'dark', power: 1.2, drain: true, desc: 'Draine PV d\'un ennemi' },
      { id: 'resurrection_noir', name: 'Résurrection Noire', jpCost: 180, type: 'revive', healPct: 1.0, desc: 'Ressuscite avec PV max' },
    ],
  },
};

// ─── Job Progression ─────────────────────────────────────────────────

/** XP required for job level */
export function jobXpForLevel(level) {
  return Math.floor(30 * Math.pow(level, 1.6) + 10);
}

/** Get all jobs available to a character */
export function getAvailableJobs(characterId) {
  return Object.values(JOBS).filter(job => {
    if (!job.requires) return true; // base job, always available
    // Check if character has the prerequisite job at required level
    return false; // will be checked at runtime with character state
  });
}

/** Get job stat bonuses at a given level */
export function getJobStatBonus(jobId, level) {
  const job = JOBS[jobId];
  if (!job) return {};
  const bonus = {};
  const scale = 1 + (level - 1) * 0.15; // +15% per level
  for (const [stat, base] of Object.entries(job.statMod)) {
    bonus[stat] = Math.floor(base * scale);
  }
  return bonus;
}

/** Get unlocked skills at job level */
export function getJobSkills(jobId, level) {
  const job = JOBS[jobId];
  if (!job) return [];
  return job.skills.filter(s => s.jpCost <= level * 10);
}
