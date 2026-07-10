// data/sidequests.js — 18 optional side quests (FFIX-style "active time events" feel)
// Each: { id, title, giver, giverName, description, objectives[], rewards, intro, requires?, onEvent? }
// Hooks: talkToNPC(npcId), onBattleWin(enemyId), onPickup(itemId), onPOI(poiId)

export const SIDE_QUESTS = {
  sq_woodcutter: {
    id: 'sq_woodcutter',
    title: 'La Hache Perdue',
    giver: 'old_woodcutter',
    giverName: 'Vieux Bûcheron',
    description: 'Retrouve la hache du bûcheron dans la Fôret de Brume.',
    objectives: [
      { key: 'find_axe', label: 'Trouver la hache', target: 1 },
    ],
    rewards: { gold: 200, items: [{ id: 'potion', count: 3 }], flags: ['helped_woodcutter'] },
    intro: ['Ma hache... elle est partie dans la brume.', 'Si tu la trouves, je te paierai bien.'],
    onEvent(event, p, api) {
      if (event === 'pickup' && p.itemId === 'woodcutter_axe') api.updateObjective('sq_woodcutter', 'find_axe', 1);
    },
  },

  sq_hunter: {
    id: 'sq_hunter',
    title: 'La Proie du Chasseur',
    giver: 'lost_hunter',
    giverName: 'Chasseur Égaré',
    description: 'Tue 5 Gobelins pour aider le chasseur à venger sa meute.',
    objectives: [
      { key: 'kill_goblin', label: 'Gobelins vaincus', target: 5 },
    ],
    rewards: { gold: 350, items: [{ id: 'antidote', count: 5 }], flags: ['helped_hunter'] },
    intro: ['Les gobelins ont décimé ma meute.', 'Tue-les. Tous.'],
    onEvent(event, p, api) {
      if (event === 'battle_win' && p.enemyId === 'goblin') api.updateObjective('sq_hunter', 'kill_goblin', 1);
    },
  },

  sq_spirit: {
    id: 'sq_spirit',
    title: 'Le Chant du Brume',
    giver: 'forest_spirit',
    giverName: 'Esprit de la Fôret',
    description: 'Réveille 3 esprits endormis en offrant des fleurs de brume.',
    objectives: [
      { key: 'wake_spirits', label: 'Esprits réveillés', target: 3 },
    ],
    rewards: { gold: 500, items: [{ id: 'ether', count: 2 }], flags: ['spirits_awoken'] },
    intro: ['Nous sommes le Brume. Nous oublions.', 'Aide-nous à nous souvenir.'],
    onEvent(event, p, api) {
      if (event === 'poi' && p.poiId === 'spirit_altar') api.updateObjective('sq_spirit', 'wake_spirits', 1);
    },
  },

  sq_blacksmith: {
    id: 'sq_blacksmith',
    title: 'L\'Acier Oublié',
    giver: 'town_smith',
    giverName: 'Forgeron de Lindblum',
    description: 'Rapporte 3 Minerais de Mythril pour forger une lame unique.',
    objectives: [
      { key: 'get_mithril', label: 'Minerais de Mythril', target: 3 },
    ],
    rewards: { gold: 800, items: [{ id: 'mythril_blade', count: 1 }], flags: ['got_mythril_blade'] },
    intro: ['Le mythril dort dans la montagne.', 'Rapporte-m\'en trois, et je forge ton destin.'],
    requires: (GAME) => GAME.flags.reached_lindblum,
    onEvent(event, p, api) {
      if (event === 'pickup' && p.itemId === 'mithril_ore') api.updateObjective('sq_blacksmith', 'get_mithril', 1);
    },
  },

  sq_oracle: {
    id: 'sq_oracle',
    title: 'Les Prophéties de Cleyra',
    giver: 'cleyra_oracle',
    giverName: 'Oracle de Cleyra',
    description: 'Collecte 4 fragments de prophétie dispersés dans le sanctuaire.',
    objectives: [
      { key: 'fragments', label: 'Fragments récupérés', target: 4 },
    ],
    rewards: { gold: 1000, items: [{ id: 'elixir', count: 1 }], flags: ['cleyra_prophecy'] },
    intro: ['L\'arbre se souvient de tout.', 'Mais les fragments se sont épars.'],
    requires: (GAME) => GAME.flags.reached_cleyra,
    onEvent(event, p, api) {
      if (event === 'pickup' && p.itemId === 'prophecy_fragment') api.updateObjective('sq_oracle', 'fragments', 1);
    },
  },

  sq_cat: {
    id: 'sq_cat',
    title: 'Le Chat du Bibliothécaire',
    giver: 'town_librarian',
    giverName: 'Bibliothécaire',
    description: 'Retrouve le chat disparu de la bibliothèque.',
    objectives: [
      { key: 'find_cat', label: 'Chat retrouvé', target: 1 },
    ],
    rewards: { gold: 150, items: [{ id: 'tent', count: 2 }], flags: ['cat_found'] },
    intro: ['Mon chat... Misty... partie.', 'Elle aime les rayons du fond.'],
    onEvent(event, p, api) {
      if (event === 'poi' && p.poiId === 'library_cat') api.updateObjective('sq_cat', 'find_cat', 1);
    },
  },

  sq_gambler: {
    id: 'sq_gambler',
    title: 'La Dette de Treno',
    giver: 'treno_gambler',
    giverName: 'Parieur de Treno',
    description: 'Gagne 3 parties de Brume (card game) pour effacer sa dette.',
    objectives: [
      { key: 'win_cards', label: 'Parties de cartes gagnées', target: 3 },
    ],
    rewards: { gold: 600, items: [{ id: 'gold_coin', count: 5 }], flags: ['gambler_freed'] },
    intro: ['J\'ai perdu gros. Trop gros.', 'Gagne pour moi, et on partage.'],
    requires: (GAME) => GAME.flags.reached_treno,
    onEvent(event, p, api) {
      if (event === 'card_win') api.updateObjective('sq_gambler', 'win_cards', 1);
    },
  },

  sq_fisher: {
    id: 'sq_fisher',
    title: 'Le Poisson Légendaire',
    giver: 'town_fisher',
    giverName: 'Pêcheur d\'Oeil',
    description: 'Pêche le Poisson-Roi légendaire des sables.',
    objectives: [
      { key: 'catch_king', label: 'Poisson-Roi pêché', target: 1 },
    ],
    rewards: { gold: 1200, items: [{ id: 'king_scale', count: 1 }], flags: ['caught_king_fish'] },
    intro: ['Ils disent qu\'il n\'existe pas.', 'Moi je l\'ai vu. Pêche-le.'],
    requires: (GAME) => GAME.flags.reached_oeil,
    onEvent(event, p, api) {
      if (event === 'fish_catch' && p.species === 'king_fish') api.updateObjective('sq_fisher', 'catch_king', 1);
    },
  },

  sq_knight: {
    id: 'sq_knight',
    title: 'L\'Honneur du Chevalier',
    giver: 'fallen_knight',
    giverName: 'Chevalier Déchu',
    description: 'Vaincs le Chevalier Corrompu pour libérer son âme.',
    objectives: [
      { key: 'kill_corrupt', label: 'Chevalier Corrompu vaincu', target: 1 },
    ],
    rewards: { gold: 1500, items: [{ id: 'holy_sword', count: 1 }], flags: ['knight_freed'] },
    intro: ['La brume m\'a pris.', 'Tue-moi, avant que je ne fasse pire.'],
    requires: (GAME) => GAME.chapterId >= 8,
    onEvent(event, p, api) {
      if (event === 'battle_win' && p.enemyId === 'corrupt_knight') api.updateObjective('sq_knight', 'kill_corrupt', 1);
    },
  },

  sq_alchemist: {
    id: 'sq_alchemist',
    title: 'L\'Élixir Parfait',
    giver: 'town_alchemist',
    giverName: 'Alchimiste',
    description: 'Récolte 5 Racines de Vie pour l\'élixir ultime.',
    objectives: [
      { key: 'get_roots', label: 'Racines de Vie', target: 5 },
    ],
    rewards: { gold: 700, items: [{ id: 'mega_elixir', count: 1 }], flags: ['got_mega_elixir'] },
    intro: ['La vie... c\'est de la chimie.', 'Apporte-moi des racines.'],
    onEvent(event, p, api) {
      if (event === 'pickup' && p.itemId === 'life_root') api.updateObjective('sq_alchemist', 'get_roots', 1);
    },
  },

  sq_bard: {
    id: 'sq_bard',
    title: 'La Ballade Perdue',
    giver: 'town_bard',
    giverName: 'Barde Errant',
    description: 'Trouve 3 strophes de la Ballade du Crépuscule.',
    objectives: [
      { key: 'verses', label: 'Strophes trouvées', target: 3 },
    ],
    rewards: { gold: 400, items: [{ id: 'silver_harp', count: 1 }], flags: ['ballad_complete'] },
    intro: ['Ma chanson... incomplète.', 'Les mots sont perdus dans le monde.'],
    onEvent(event, p, api) {
      if (event === 'poi' && p.poiId === 'bard_verse') api.updateObjective('sq_bard', 'verses', 1);
    },
  },

  sq_assassin: {
    id: 'sq_assassin',
    title: 'Contrat de l\'Ombre',
    giver: 'shadow_broker',
    giverName: 'Courtier de l\'Ombre',
    description: 'Élimine le Seigneur des Sables qui opprime Oeil.',
    objectives: [
      { key: 'kill_lord', label: 'Seigneur des Sables vaincu', target: 1 },
    ],
    rewards: { gold: 2000, items: [{ id: 'assassin_dagger', count: 1 }], flags: ['sand_lord_dead'] },
    intro: ['Un contrat. Sur la tête du Seigneur.', 'Le prix? La liberté d\'Oeil.'],
    requires: (GAME) => GAME.flags.reached_oeil && GAME.chapterId >= 10,
    onEvent(event, p, api) {
      if (event === 'battle_win' && p.enemyId === 'sand_lord') api.updateObjective('sq_assassin', 'kill_lord', 1);
    },
  },

  sq_dragon: {
    id: 'sq_dragon',
    title: 'L\'Œuf de Dragon',
    giver: 'dragon_keeper',
    giverName: 'Gardien des Dragons',
    description: 'Protège l\'Œuf de Dragon des voleurs (3 vagues).',
    objectives: [
      { key: 'defend', label: 'Vagues repoussées', target: 3 },
    ],
    rewards: { gold: 1800, items: [{ id: 'dragon_crest', count: 1 }], flags: ['dragon_safe'] },
    intro: ['Cet œuf... c\'est l\'espoir.', 'Défends-le.'],
    requires: (GAME) => GAME.chapterId >= 12,
    onEvent(event, p, api) {
      if (event === 'wave_clear') api.updateObjective('sq_dragon', 'defend', 1);
    },
  },

  sq_witch: {
    id: 'sq_witch',
    title: 'L\'Étoile de Minuit',
    giver: 'cave_witch',
    giverName: 'Sorcière des Grottes',
    description: 'Apporte-lui une Pierre de Lune pour son sort.',
    objectives: [
      { key: 'get_moonstone', label: 'Pierre de Lune', target: 1 },
    ],
    rewards: { gold: 900, items: [{ id: 'moon_rod', count: 1 }], flags: ['got_moon_rod'] },
    intro: ['La lune me parle.', 'Mais il me faut sa pierre.'],
    onEvent(event, p, api) {
      if (event === 'pickup' && p.itemId === 'moonstone') api.updateObjective('sq_witch', 'get_moonstone', 1);
    },
  },

  sq_ghost: {
    id: 'sq_ghost',
    title: 'Les Regrets du Roi',
    giver: 'king_ghost',
    giverName: 'Fantôme Royal',
    description: 'Réunis les 3 Reliques de Lindblum pour apaiser le roi.',
    objectives: [
      { key: 'relics', label: 'Reliques royales', target: 3 },
    ],
    rewards: { gold: 2500, items: [{ id: 'crown_of_lindblum', count: 1 }], flags: ['king_rested'] },
    intro: ['Je règne... sur le néant.', 'Rendez-moi mes reliques.'],
    requires: (GAME) => GAME.flags.reached_lindblum && GAME.chapterId >= 14,
    onEvent(event, p, api) {
      if (event === 'pickup' && p.itemId === 'royal_relic') api.updateObjective('sq_ghost', 'relics', 1);
    },
  },

  sq_collector: {
    id: 'sq_collector',
    title: 'Le Collectionneur',
    giver: 'artifact_collector',
    giverName: 'Collectionneur',
    description: 'Collecte 10 cartes Brume rares pour compléter son album.',
    objectives: [
      { key: 'cards', label: 'Cartes rares', target: 10 },
    ],
    rewards: { gold: 1500, items: [{ id: 'collector_trophy', count: 1 }], flags: ['album_complete'] },
    intro: ['Chaque carte... une âme.', 'Complète mon album.'],
    onEvent(event, p, api) {
      if (event === 'card_win') api.updateObjective('sq_collector', 'cards', 1);
    },
  },

  sq_racer: {
    id: 'sq_racer',
    title: 'La Légende de la Piste',
    giver: 'race_stableboy',
    giverName: 'Palefrenier',
    description: 'Gagne une course sur chaque piste (Forêt, Désert, Cristal).',
    objectives: [
      { key: 'win_forest', label: 'Piste Forêt gagnée', target: 1 },
      { key: 'win_desert', label: 'Piste Désert gagnée', target: 1 },
      { key: 'win_crystal', label: 'Piste Cristal gagnée', target: 1 },
    ],
    rewards: { gold: 3000, items: [{ id: 'gold_chocobo', count: 1 }], flags: ['race_legend'] },
    intro: ['Mon chocobo... le plus rapide.', 'Prouve-le. Gagne partout.'],
    onEvent(event, p, api) {
      if (event === 'race_win' && p.track === 'forest') api.updateObjective('sq_racer', 'win_forest', 1);
      if (event === 'race_win' && p.track === 'desert') api.updateObjective('sq_racer', 'win_desert', 1);
      if (event === 'race_win' && p.track === 'crystal') api.updateObjective('sq_racer', 'win_crystal', 1);
    },
  },
};
