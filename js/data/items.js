// data/items.js — Items, equipment, and AP-grant mapping (FFIX-style)
// All strings use double quotes to avoid JS parse errors with French apostrophes.

export const ITEMS = {
  // === Consumables ===
  potion:     { name: "Potion",         type: "consume", heal: 100, desc: "Restaure 100 HP.", price: 50,  icon: "🧪" },
  hi_potion:  { name: "Super-Potion",   type: "consume", heal: 400, desc: "Restaure 400 HP.", price: 200, icon: "🧴" },
  ether:      { name: "Ether",          type: "consume", heal_mp: 40, desc: "Restaure 40 MP.", price: 150, icon: "🔵" },
  elixir:     { name: "Elixir",         type: "consume", heal: 999, heal_mp: 999, desc: "Restaure tout.", price: 1000, icon: "✨" },
  phoenix_down:{ name:"Plume Phoenix",  type: "consume", revive: true, heal: 100, desc: "Ranime un allie K.O.", price: 300, icon: "🪶" },
  antidote:   { name: "Antidote",       type: "consume", cure: ["poison"], desc: "Guerit le poison.", price: 40, icon: "🌿" },
  eye_drops:  { name: "Collyre",        type: "consume", cure: ["blind"], desc: "Guerit la cecite.", price: 40, icon: "👁" },
  tent:       { name: "Tente",          type: "consume", heal: 999, heal_mp: 999, desc: "Soigne tout hors combat.", price: 500, icon: "⛺" },

  // === Daggers (Luan) — grants thief skills ===
  dagger:         { name: "Dague",           type: "weapon", atk: 12, slot: "dagger",
                    grants: ["steal"], ap: 5, desc: "Dague simple, permet de voler.", price: 120 },
  mythril_dagger: { name: "Dague Mythril",   type: "weapon", atk: 28, slot: "dagger",
                    grants: ["soul_blade"], ap: 8, desc: "Dague enchantee.", price: 600 },
  butterfly_edge: { name: "Lame-Papillon",   type: "weapon", atk: 45, slot: "dagger",
                    grants: ["thievery"], ap: 10, desc: "Dague rare, lame courbe.", price: 1800 },
  ultima_weapon:  { name: "Arme Ultime",     type: "weapon", atk: 75, slot: "dagger",
                    grants: ["solution"], ap: 15, desc: "Legende des voleurs.", price: 9999 },

  // === Swords (Aldric) — grants knight skills ===
  broadsword:     { name: "Glaive",           type: "weapon", atk: 15, slot: "sword",
                    grants: ["power_break"], ap: 5, desc: "Epee large.", price: 180 },
  mythril_sword:  { name: "Glaive Mythril",   type: "weapon", atk: 30, slot: "sword",
                    grants: ["stock_break"], ap: 8, desc: "Epee mythril.", price: 700 },
  saves_the_queen:{ name: "Sauve-la-Reine",   type: "weapon", atk: 52, slot: "sword",
                    grants: ["shock"], ap: 10, desc: "Lame royale benie.", price: 2200 },
  ragnarok:       { name: "Ragnarok",         type: "weapon", atk: 85, slot: "sword",
                    grants: ["darkside"], ap: 15, desc: "Lame legendaire.", price: 12000 },

  // === Staves (Mira) — grants black magic ===
  rod:         { name: "Baton",            type: "weapon", atk: 6, mag: 8, slot: "staff",
                 grants: ["fire","blizzard","thunder"], ap: 3, desc: "Baton de base.", price: 150 },
  flame_rod:   { name: "Baton de Feu",     type: "weapon", atk: 10, mag: 14, slot: "staff", element: "fire",
                 grants: ["fira"], ap: 8, desc: "Baton ardent.", price: 700 },
  glacial_rod: { name: "Baton Glacial",    type: "weapon", atk: 10, mag: 14, slot: "staff", element: "ice",
                 grants: ["blizzara"], ap: 8, desc: "Baton glace.", price: 700 },
  thunder_rod: { name: "Baton de Foudre",  type: "weapon", atk: 10, mag: 14, slot: "staff", element: "thunder",
                 grants: ["thundara"], ap: 8, desc: "Baton charge.", price: 700 },
  oak_staff:   { name: "Baton de Chene",   type: "weapon", atk: 18, mag: 26, slot: "staff",
                 grants: ["firaga","bio"], ap: 10, desc: "Baton ancestral.", price: 2500 },
  wizard_rod:  { name: "Baton Mage",       type: "weapon", atk: 28, mag: 38, slot: "staff",
                 grants: ["meteor"], ap: 15, desc: "Baton archimage.", price: 8000 },

  // === Rods (Selia) — grants white magic ===
  healing_rod:  { name: "Baton de Soin",   type: "weapon", atk: 6, mag: 10, slot: "rod",
                  grants: ["cure"], ap: 4, desc: "Baton de pretre.", price: 180 },
  silver_rod:   { name: "Baton Argent",    type: "weapon", atk: 12, mag: 18, slot: "rod",
                  grants: ["cura","esuna"], ap: 6, desc: "Baton beni.", price: 600 },
  holy_rod:     { name: "Baton Saint",     type: "weapon", atk: 20, mag: 30, slot: "rod",
                  grants: ["life","shell","protect"], ap: 8, desc: "Baton sacre.", price: 2000 },
  mythical_rod: { name: "Baton Mythique",  type: "weapon", atk: 30, mag: 45, slot: "rod",
                  grants: ["holy","curaga"], ap: 12, desc: "Baton legendaire.", price: 7000 },

  // === Armor pieces ===
  leather_vest: { name: "Gilet Cuir",     type: "armor", def: 8,  slot: "light", grants: [], ap: 2, price: 100 },
  bronze_armor: { name: "Armure Bronze",  type: "armor", def: 14, slot: "heavy", grants: [], ap: 2, price: 250 },
  mage_robe:    { name: "Robe Mage",      type: "armor", def: 6,  mdef: 10, slot: "robe", grants: ["mp_bonus"], ap: 5, price: 300 },
  priest_robe:  { name: "Robe Pretre",    type: "armor", def: 8,  mdef: 14, slot: "robe", grants: [], ap: 3, price: 500 },
  plate_mail:   { name: "Harnois",        type: "armor", def: 28, slot: "heavy", grants: [], ap: 3, price: 1200 },
  ninja_vest:   { name: "Gilet Ninja",    type: "armor", def: 20, slot: "light", grants: [], ap: 4, price: 1100 },

  // === Accessories ===
  power_belt:     { name: "Ceinture Force", type: "accessory", grants: ["power_break"], ap: 5, price: 600 },
  sash:           { name: "Echarpe",        type: "accessory", grants: [], stat_spd: 3, ap: 2, price: 400 },
  ribbon:         { name: "Ruban",          type: "accessory", grants: [], immun_all: true, ap: 0, price: 5000 },
  feather_earring:{ name: "Boucle Plume",   type: "accessory", grants: [], ap_spd: 2, price: 800 },

  // === New consumables (40+ total) ===
  mega_potion: { name: "Méga-Potion", type: "consume", heal: 800, desc: "Restaure 800 HP.", price: 400, icon: "🧪" },
  x_potion: { name: "X-Potion", type: "consume", heal: 1500, desc: "Restaure 1500 HP.", price: 800, icon: "🧪" },
  mega_ether: { name: "Méga-Ether", type: "consume", heal_mp: 120, desc: "Restaure 120 MP.", price: 500, icon: "🔵" },
  turbo_ether: { name: "Turbo-Ether", type: "consume", heal_mp: 999, desc: "Restaure tout MP.", price: 1500, icon: "🔵" },
  mega_elixir: { name: "Méga-Elixir", type: "consume", heal: 9999, heal_mp: 9999, desc: "Restaure tout le groupe.", price: 3000, icon: "✨" },
  remedy: { name: "Remede", type: "consume", cure: ["poison","blind","silence","confuse","curse"], desc: "Guérit tout statut.", price: 300, icon: "🌿" },
  gold_needle: { name: "Aiguille d'Or", type: "consume", cure: ["petrify"], desc: "Dépétrifie.", price: 200, icon: "🪡" },
  revive: { name: "Revival", type: "consume", revive: true, heal: 500, desc: "Ranime + 500 HP.", price: 800, icon: "🪶" },
  megalixir: { name: "Mégalixir", type: "consume", heal: 99999, heal_mp: 99999, desc: "Restauration totale.", price: 9999, icon: "💎" },

  // === Equipment (new) ===
  mythril_blade: { name: "Lame Mythril", type: "weapon", atk: 40, slot: "sword", grants: ["soul_blade"], ap: 10, desc: "Lame en mythril.", price: 1500 },
  holy_sword: { name: "Épée Sainte", type: "weapon", atk: 60, mag: 10, slot: "sword", element: "holy", grants: ["holy"], ap: 12, desc: "Lame bénie.", price: 4000 },
  assassin_dagger: { name: "Dague Assassin", type: "weapon", atk: 55, slot: "dagger", grants: ["assassinate"], ap: 12, desc: "Dague empoisonnée.", price: 3500 },
  moon_rod: { name: "Bâton de Lune", type: "weapon", atk: 30, mag: 50, slot: "staff", element: "holy", grants: ["curaga","holy"], ap: 15, desc: "Bâton lunaire.", price: 5000 },
  dragon_crest: { name: "Crête de Dragon", type: "weapon", atk: 70, mag: 30, slot: "sword", grants: ["dragon_luan"], ap: 15, desc: "Relique dragon.", price: 8000 },
  silver_armor: { name: "Armure d'Argent", type: "armor", def: 35, mdef: 20, slot: "armor", desc: "Armure argentée.", price: 1200 },
  plate_mail: { name: "Cotte de Plates", type: "armor", def: 55, mdef: 15, slot: "armor", desc: "Protection lourde.", price: 2500 },
  ninja_vest: { name: "Veste Ninja", type: "armor", def: 25, mdef: 30, spd: 10, slot: "armor", desc: "Légère et rapide.", price: 1800 },
  priest_robe: { name: "Robe de Prêtre", type: "armor", def: 15, mdef: 40, slot: "armor", grants: ["cura"], ap: 8, desc: "Robe sainte.", price: 900 },
  dark_armor: { name: "Armure Sombre", type: "armor", def: 45, mdef: 25, slot: "armor", element: "dark", desc: "Armure maudite.", price: 3000 },
  crown_of_lindblum: { name: "Couronne de Lindblum", type: "accessory", grants: [], immun_all: true, ap: 0, price: 9999, desc: "Symbole royal." },
  collector_trophy: { name: "Trophée Collectionneur", type: "accessory", grants: [], ap_spd: 5, price: 5000, desc: "Chance accrue." },
  gold_chocobo: { name: "Chocobo d'Or", type: "accessory", grants: [], spd: 20, price: 8000, desc: "Vitesse légendaire." },
  king_scale: { name: "Écaille de Roi", type: "accessory", grants: [], def: 20, mdef: 20, price: 4000, desc: "Protection aquatique." },

  // === Key items (quest) ===
  woodcutter_axe: { name: "Hache du Bûcheron", type: "key", desc: "Hache perdue.", price: 0 },
  mithril_ore: { name: "Minerai de Mythril", type: "key", desc: "Minerai rare.", price: 0 },
  prophecy_fragment: { name: "Fragment de Prophétie", type: "key", desc: "Morceau d'un texte ancien.", price: 0 },
  life_root: { name: "Racine de Vie", type: "key", desc: "Racine curative.", price: 0 },
  moonstone: { name: "Pierre de Lune", type: "key", desc: "Pierre brillante.", price: 0 },
  royal_relic: { name: "Relique Royale", type: "key", desc: "Relique de Lindblum.", price: 0 },
  void_shard: { name: "Éclat du Vide", type: "key", desc: "Fragment de vide.", price: 0 },
  crystal_core: { name: "Noyau de Cristal", type: "key", desc: "Énergie cristallisée.", price: 0 },
  omega_core: { name: "Noyau Omega", type: "key", desc: "Technologie ancienne.", price: 0 },
  raziel_essence: { name: "Essence de Raziel", type: "key", desc: "Le secret de la création.", price: 0 },
};

export function getItem(id) { return ITEMS[id]; }
export function isEquipment(item) { return ["weapon","armor","accessory"].includes(item?.type); }