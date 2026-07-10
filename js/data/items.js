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
};

export function getItem(id) { return ITEMS[id]; }
export function isEquipment(item) { return ["weapon","armor","accessory"].includes(item?.type); }