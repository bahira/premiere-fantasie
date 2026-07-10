// data/characters.js — Playable party members (FFIX-style)
// Each character: base stats, growth curve, innate ability, learnable skills via equip
// ALL strings use double quotes to avoid JS parse errors with French apostrophes.

export const CHARACTERS = {
  zidane: {
    id: "zidane",
    name: "Luan",
    class: "Voleur",
    color: 0xf1c40f,
    portrait: "🗡",
    bio: "Un jeune voleur Tantalus a la recherche de ses origines. Agile, charmeur, mortel dans le dos.",
    base: { hp: 220, mp: 60, str: 18, mag: 10, vit: 14, spd: 18, luck: 20 },
    growth: { hp: 22, mp: 8, str: 2.4, mag: 1.2, vit: 1.8, spd: 2.6, luck: 2.0 },
    innate: "flee",
    weaponType: "dagger",
    armorType: "light",
    skills: ["steal", "flee", "soul_blade", "thievery", "solution"],
  },
  knight: {
    id: "knight",
    name: "Sir Aldric",
    class: "Chevalier",
    color: 0x3498db,
    portrait: "🛡",
    bio: "Chevalier loyal du royaume. Sa lame ne tremble jamais, son coeur non plus.",
    base: { hp: 320, mp: 40, str: 22, mag: 8, vit: 24, spd: 10, luck: 6 },
    growth: { hp: 34, mp: 5, str: 3.0, mag: 0.8, vit: 3.2, spd: 1.2, luck: 0.6 },
    innate: "cover",
    weaponType: "sword",
    armorType: "heavy",
    skills: ["power_break", "guard", "stock_break", "shock", "darkside"],
  },
  mage: {
    id: "mage",
    name: "Mira",
    class: "Magicienne Noire",
    color: 0x9b59b6,
    portrait: "🔮",
    bio: "Jeune magicienne nee de la brume. Manipule le feu et la glace, ignore pourquoi elle existe.",
    base: { hp: 160, mp: 140, str: 8, mag: 24, vit: 10, spd: 14, luck: 10 },
    growth: { hp: 15, mp: 18, str: 0.8, mag: 3.4, vit: 1.2, spd: 1.8, luck: 1.0 },
    innate: "mp_bonus",
    weaponType: "staff",
    armorType: "robe",
    skills: ["fire","blizzard","thunder","fira","blizzara","thundara","firaga","bio","meteor"],
  },
  healer: {
    id: "healer",
    name: "Selia",
    class: "Pretresse",
    color: 0xe91e63,
    portrait: "✨",
    bio: "Princesse en fuite. Entend les Esprits et soigne les blessures de l'ame.",
    base: { hp: 200, mp: 120, str: 12, mag: 18, vit: 16, spd: 12, luck: 12 },
    growth: { hp: 20, mp: 16, str: 1.2, mag: 2.6, vit: 2.0, spd: 1.6, luck: 1.4 },
    innate: "summon_essence",
    weaponType: "rod",
    armorType: "robe",
    skills: ["cure","cura","life","esuna","shell","protect","holy","curaga"],
  },
};

export const PARTY_ORDER = ["zidane", "mage", "knight", "healer"];
export const ACTIVE_PARTY_MAX = 4;

export function getCharacter(id) { return CHARACTERS[id]; }