// data/towns.js — 4 town hubs (safe, no encounters)
// Each: { id, name, biome, music, npcs[], shops[], inns[], pois[], description }
// Reuses FieldMap for movement. NPCs have roles: shop / inn / quest / lore.

export const TOWNS = {
  lindblum: {
    id: 'lindblum',
    name: 'Lindblum',
    biome: 'city',
    music: 'Shtetl Crown',
    description: 'La cité-reine, joyau de la civilisation.',
    npcs: [
      { id: 'town_smith', name: 'Forgeron', role: 'quest', x: 200, y: 250, portrait: 'knight',
        lines: ['Mes lames chantent le mythril.', 'Apporte-m\'en et je forge ton destin.'] },
      { id: 'town_librarian', name: 'Bibliothécaire', role: 'quest', x: 400, y: 200, portrait: 'mage',
        lines: ['Mon chat... Misty... partie.', 'Elle aime les rayons du fond.'] },
      { id: 'king_ghost', name: 'Fantôme Royal', role: 'quest', x: 600, y: 300, portrait: 'healer',
        lines: ['Je règne sur le néant.', 'Rendez-moi mes reliques.'] },
      { id: 'artifact_collector', name: 'Collectionneur', role: 'quest', x: 300, y: 350, portrait: 'mage',
        lines: ['Chaque carte... une âme.', 'Complète mon album.'] },
    ],
    shops: [
      { id: 'lindblum_w', name: 'Armurerie', type: 'weapon', stock: ['dagger', 'broadsword', 'rod', 'flame_rod', 'mythril_blade'] },
      { id: 'lindblum_a', name: 'Tannerie', type: 'armor', stock: ['leather_vest', 'bronze_armor', 'mage_robe', 'plate_mail', 'ninja_vest'] },
      { id: 'lindblum_i', name: 'Herboristerie', type: 'item', stock: ['potion', 'antidote', 'ether', 'elixir', 'tent'] },
    ],
    inns: [{ id: 'lindblum_inn', name: 'Auberge de la Couronne', x: 500, y: 250, price: 50 }],
    pois: [
      { id: 'lindblum_exit', type: 'exit', x: 700, y: 400, label: 'Sortir' },
      { id: 'lindblum_shop_w', type: 'shop', shop: 'lindblum_w', x: 150, y: 200, label: 'Armurerie' },
      { id: 'lindblum_shop_a', type: 'shop', shop: 'lindblum_a', x: 250, y: 200, label: 'Tannerie' },
      { id: 'lindblum_shop_i', type: 'shop', shop: 'lindblum_i', x: 350, y: 200, label: 'Herboristerie' },
      { id: 'lindblum_inn_poi', type: 'inn', inn: 'lindblum_inn', x: 500, y: 250, label: 'Auberge' },
    ],
  },

  treno: {
    id: 'treno',
    name: 'Treno',
    biome: 'city',
    music: 'Lanterns of Ashenvale',
    description: 'La cité du plaisir, des ombres et des jeux.',
    npcs: [
      { id: 'treno_gambler', name: 'Parieur', role: 'quest', x: 300, y: 250, portrait: 'zidane',
        lines: ['J\'ai perdu gros. Trop gros.', 'Gagne pour moi.'] },
      { id: 'shadow_broker', name: 'Courtier de l\'Ombre', role: 'quest', x: 500, y: 300, portrait: 'mage',
        lines: ['Un contrat. Sur la tête du Seigneur.', 'Le prix? La liberté d\'Oeil.'] },
    ],
    shops: [
      { id: 'treno_w', name: 'Boutique de Luxe', type: 'weapon', stock: ['assassin_dagger', 'moon_rod', 'holy_sword'] },
      { id: 'treno_i', name: 'Marché Noir', type: 'item', stock: ['elixir', 'mega_elixir', 'gold_coin', 'phoenix_down'] },
    ],
    inns: [{ id: 'treno_inn', name: 'Hôtel du Léviathan', x: 400, y: 200, price: 100 }],
    pois: [
      { id: 'treno_exit', type: 'exit', x: 700, y: 400, label: 'Sortir' },
      { id: 'treno_card', type: 'minigame', game: 'card', x: 200, y: 250, label: 'Brume (Cartes)' },
      { id: 'treno_shop_w', type: 'shop', shop: 'treno_w', x: 350, y: 200, label: 'Luxe' },
      { id: 'treno_shop_i', type: 'shop', shop: 'treno_i', x: 450, y: 200, label: 'Marché Noir' },
      { id: 'treno_inn_poi', type: 'inn', inn: 'treno_inn', x: 400, y: 200, label: 'Hôtel' },
    ],
  },

  cleyra: {
    id: 'cleyra',
    name: 'Cleyra',
    biome: 'forest',
    music: 'Crystal Village',
    description: 'Le sanctuaire-arbre, berceau de la sagesse ancienne.',
    npcs: [
      { id: 'cleyra_oracle', name: 'Oracle', role: 'quest', x: 400, y: 200, portrait: 'healer',
        lines: ['L\'arbre se souvient de tout.', 'Mais les fragments se sont épars.'] },
      { id: 'dragon_keeper', name: 'Gardien des Dragons', role: 'quest', x: 300, y: 300, portrait: 'knight',
        lines: ['Cet œuf... c\'est l\'espoir.', 'Défends-le.'] },
    ],
    shops: [
      { id: 'cleyra_i', name: 'Temple des Soins', type: 'item', stock: ['potion', 'ether', 'elixir', 'tent', 'antidote'] },
      { id: 'cleyra_a', name: 'Atelier Druidique', type: 'armor', stock: ['mage_robe', 'priest_robe', 'leather_vest', 'silver_armor'] },
    ],
    inns: [{ id: 'cleyra_inn', name: 'Refuge de l\'Arbre', x: 500, y: 250, price: 30 }],
    pois: [
      { id: 'cleyra_exit', type: 'exit', x: 700, y: 400, label: 'Sortir' },
      { id: 'cleyra_shop_i', type: 'shop', shop: 'cleyra_i', x: 350, y: 200, label: 'Soins' },
      { id: 'cleyra_shop_a', type: 'shop', shop: 'cleyra_a', x: 450, y: 200, label: 'Atelier' },
      { id: 'cleyra_inn_poi', type: 'inn', inn: 'cleyra_inn', x: 500, y: 250, label: 'Refuge' },
    ],
  },

  oeil: {
    id: 'oeil',
    name: 'Oeil',
    biome: 'desert',
    music: 'Blackened Crown',
    description: 'La cité des sables, où le vent porte les secrets.',
    npcs: [
      { id: 'town_fisher', name: 'Pêcheur', role: 'quest', x: 300, y: 250, portrait: 'zidane',
        lines: ['Ils disent qu\'il n\'existe pas.', 'Moi je l\'ai vu. Pêche-le.'] },
      { id: 'town_alchemist', name: 'Alchimiste', role: 'quest', x: 400, y: 300, portrait: 'mage',
        lines: ['La vie... c\'est de la chimie.', 'Apporte-moi des racines.'] },
      { id: 'race_stableboy', name: 'Palefrenier', role: 'quest', x: 500, y: 200, portrait: 'knight',
        lines: ['Mon chocobo... le plus rapide.', 'Prouve-le. Gagne partout.'] },
      { id: 'cave_witch', name: 'Sorcière des Grottes', role: 'quest', x: 600, y: 350, portrait: 'mage',
        lines: ['La lune me parle.', 'Mais il me faut sa pierre.'] },
    ],
    shops: [
      { id: 'oeil_w', name: 'Forge du Désert', type: 'weapon', stock: ['broadsword', 'flame_rod', 'assassin_dagger', 'holy_sword'] },
      { id: 'oeil_i', name: 'Caravane', type: 'item', stock: ['potion', 'antidote', 'ether', 'elixir', 'tent', 'gold_coin'] },
    ],
    inns: [{ id: 'oeil_inn', name: 'Tente du Voyageur', x: 450, y: 250, price: 20 }],
    pois: [
      { id: 'oeil_exit', type: 'exit', x: 700, y: 400, label: 'Sortir' },
      { id: 'oeil_fish', type: 'minigame', game: 'fishing', x: 200, y: 250, label: 'Pêche' },
      { id: 'oeil_race', type: 'minigame', game: 'racing', x: 250, y: 300, label: 'Course' },
      { id: 'oeil_shop_w', type: 'shop', shop: 'oeil_w', x: 350, y: 200, label: 'Forge' },
      { id: 'oeil_shop_i', type: 'shop', shop: 'oeil_i', x: 450, y: 200, label: 'Caravane' },
      { id: 'oeil_inn_poi', type: 'inn', inn: 'oeil_inn', x: 450, y: 250, label: 'Tente' },
    ],
  },
};
