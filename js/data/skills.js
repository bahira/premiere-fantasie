// data/skills.js — Skill database with AP requirements (FFIX-style)
// Skills are learned by earning AP while equipping items that grant those skills.
// Once AP threshold met, skill is permanently learned (no longer needs equip).

export const SKILLS = {
  // === Thief skills (Luan) ===
  steal:    { name: 'Vol',       ap: 35,  mp: 0,  type: 'command', desc: 'Vole un objet à l\'ennemi.' },
  flee:     { name: 'Fuite',     ap: 10,  mp: 0,  type: 'support', desc: 'Tente de fuir le combat.' },
  soul_blade:{ name: 'Lame-Âme', ap: 40,  mp: 8,  type: 'attack',  power: 1.4, element: 'none', desc: 'Frappe qui ignore une partie de la DEF.' },
  thievery: { name: 'Larcin',   ap: 80,  mp: 16, type: 'attack',  power: 1.2, element: 'none', desc: 'Attaque volant aussi un objet rare.' },
  solution: { name: 'Solution', ap: 60,  mp: 12, type: 'support', desc: 'Soigne confusion/silence de l\'allié.' },

  // === Knight skills (Aldric) ===
  power_break:{ name: 'Briser-Puissance', ap: 30, mp: 6, type: 'debuff', stat: 'str', factor: 0.6, desc: 'Réduit la FOR ennemie.' },
  guard:     { name: 'Garde',    ap: 15,  mp: 0,  type: 'support', desc: 'Réduit les dégâts reçus ce tour.' },
  stock_break:{ name: 'Briser-Réserve', ap: 50, mp: 10, type: 'attack', power: 1.6, element: 'none', desc: 'Coup puissantpuisant dans les réserves.' },
  shock:     { name: 'Choc',     ap: 70,  mp: 20, type: 'attack', power: 2.2, element: 'thunder', desc: 'Décharge électrique massive.' },
  darkside:  { name: 'Côté Noir', ap: 90,  mp: 16, type: 'attack', power: 1.8, element: 'dark', desc: 'Frappe ombrée, sacrifie des HP.' },

  // === Black magic (Mira) ===
  fire:      { name: 'Feu',      ap: 20,  mp: 6,  type: 'magic', power: 1.0, element: 'fire',    desc: 'Boule de feu.' },
  blizzard:  { name: 'Glace',   ap: 20,  mp: 6,  type: 'magic', power: 1.0, element: 'ice',     desc: 'Éclat glacial.' },
  thunder:   { name: 'Foudre',  ap: 20,  mp: 6,  type: 'magic', power: 1.0, element: 'thunder', desc: 'Éclair.' },
  fira:      { name: 'Extra Feu',ap: 45,  mp: 12, type: 'magic', power: 1.7, element: 'fire',    desc: 'Feu supérieur.' },
  blizzara: { name: 'Extra Glace',ap: 45, mp: 12, type: 'magic', power: 1.7, element: 'ice',     desc: 'Glace supérieure.' },
  thundara:  { name: 'Extra Foudre',ap: 45,mp: 14, type: 'magic', power: 1.7, element: 'thunder', desc: 'Foudre supérieure.' },
  firaga:    { name: 'Méga Feu', ap: 80,  mp: 22, type: 'magic', power: 2.5, element: 'fire',    desc: 'Tempête de feu.' },
  bio:       { name: 'Bio',     ap: 65,  mp: 16, type: 'magic', power: 1.3, element: 'dark', status: 'poison', desc: 'Toxine mortelle.' },
  meteor:    { name: 'Météore', ap: 100, mp: 40, type: 'magic', power: 3.5, element: 'none',    desc: 'Pluie de météores.' },

  // === White magic (Selia) ===
  cure:      { name: 'Soin',     ap: 20,  mp: 5,  type: 'heal',  power: 1.0, element: 'none', desc: 'Restaure des HP.' },
  cura:      { name: 'Extra Soin',ap: 45, mp: 12, type: 'heal',  power: 2.0, element: 'none', desc: 'Soin supérieur.' },
  life:      { name: 'Vie',     ap: 50,  mp: 14, type: 'revive',power: 0.5, element: 'none', desc: 'Ranime un allié.' },
  esuna:     { name: 'Rétablit',ap: 35,  mp: 8,  type: 'support', desc: 'Guérit altérations.' },
  shell:     { name: 'Carapace',ap: 40,  mp: 10, type: 'buff', stat: 'mag_def', factor: 1.5, desc: 'Réduit dégâts magiques.' },
  protect:   { name: 'Protection',ap: 40,mp: 10, type: 'buff', stat: 'def', factor: 1.5, desc: 'Réduit dégâts physiques.' },
  holy:      { name: 'Saint',  ap: 90,  mp: 26, type: 'magic', power: 2.3, element: 'holy',    desc: 'Lumière sacrée blessant le mal.' },
  curaga:    { name: 'Méga Soin',ap: 90,  mp: 22, type: 'heal',  power: 4.0, element: 'none', desc: 'Restauration massive.' },

  // === Dragon Skills (Breath of Fire — unique per character, only in Dragon Form) ===
  dragon_luan:  { name: 'Queue du Dragon',  ap: 0, mp: 0, type: 'dragon', power: 4.5, element: 'none',  dragonChar: 'zidane', desc: '4 coups fulgurants en forme draconique.' },
  dragon_knight:{ name: 'Jugement Divin',   ap: 0, mp: 0, type: 'dragon', power: 5.0, element: 'holy',   dragonChar: 'knight', desc: 'Lame de justice absolue.' },
  dragon_mage:  { name: 'Apocalypse',       ap: 0, mp: 0, type: 'dragon', power: 3.5, element: 'fire',   dragonChar: 'mage', desc: 'Fureur élémentaire totale.' },
  dragon_healer:{ name: 'Aurore',           ap: 0, mp: 0, type: 'dragon', power: 6.0, element: 'holy',   dragonChar: 'healer', desc: 'Vague de vie régénératrice.' },

};

export const DRAGON_SKILL_MAP = { zidane: 'dragon_luan', knight: 'dragon_knight', mage: 'dragon_mage', healer: 'dragon_healer' };

export const ELEMENTS = {
  fire: { strong: ['ice'], weak: ['water'], color: 0xe74c3c, icon: '🔥' },
  ice:  { strong: ['thunder'], weak: ['fire'], color: 0x74b9ff, icon: '❄' },
  thunder: { strong: ['water'], weak: ['ice'], color: 0xf1c40f, icon: '⚡' },
  water: { strong: ['fire'], weak: ['thunder'], color: 0x3498db, icon: '🌊' },
  holy: { strong: ['dark'], weak: ['none'], color: 0xfff8e1, icon: '🌟' },
  dark: { strong: ['holy'], weak: ['holy'], color: 0x4a148c, icon: '🌑' },
  none: { strong: [], weak: [], color: 0xcccccc, icon: '⚔' },
};
// === Trance / Limit-break ultimates (per character) ===
luan_trance: { name: 'Combo Voleur', ap: 0, mp: 0, type: 'trance', power: 3.0, element: 'none', desc: 'Luan frappe 4x et vole tout.' },
aldric_trance: { name: 'Chevalier Roi', ap: 0, mp: 0, type: 'trance', power: 4.0, element: 'holy', desc: 'Aldric frappe avec lumiere sacree.' },
mira_trance: { name: 'Tempete Arcanique', ap: 0, mp: 0, type: 'trance', power: 3.5, element: 'none', desc: 'Mira lance tous ses sorts.' },
selia_trance: { name: 'Benediction', ap: 0, mp: 0, type: 'trance', power: 0, element: 'holy', desc: 'Selia soigne tout le groupe + buffs.' },
firaga_blizzaga: { name: 'Fusion Feu-Glace', ap: 0, mp: 40, type: 'magic', power: 4.0, element: 'fire', desc: 'Explosion thermique.' },
thundaga_holy: { name: 'Fusion Foudre-Saint', ap: 0, mp: 50, type: 'magic', power: 4.5, element: 'holy', desc: 'Jugement celeste.' },
meteor_bio: { name: 'Meteore Toxique', ap: 0, mp: 60, type: 'magic', power: 5.0, element: 'dark', status: 'poison', desc: 'Pluie mortelle.' },
curse: { name: 'Malediction', ap: 0, mp: 14, type: 'magic', power: 1.0, element: 'dark', status: 'curse', desc: 'Maudit la cible (stats -30%).' },
doom: { name: 'Destin', ap: 0, mp: 20, type: 'magic', power: 0, element: 'none', status: 'doom', desc: 'Compte a rebours mortel.' },
berserk: { name: 'Berserk', ap: 0, mp: 10, type: 'support', status: 'berserk', desc: 'Augmente ATK, perd controle.' },
confuse: { name: 'Confusion', ap: 0, mp: 8, type: 'magic', power: 0.5, element: 'none', status: 'confuse', desc: 'Desoriente la cible.' },
petrify: { name: 'Petrification', ap: 0, mp: 16, type: 'magic', power: 1.0, element: 'earth', status: 'petrify', desc: 'Pierre la cible.' },
silence: { name: 'Silence', ap: 0, mp: 6, type: 'magic', power: 0, element: 'none', status: 'silence', desc: 'Empeche magie.' },
grand_cross: { name: 'Grande Croisee', ap: 0, mp: 30, type: 'attack', power: 3.0, element: 'holy', desc: 'Frappe tous les ennemis.' },
assassinate: { name: 'Assassinat', ap: 0, mp: 18, type: 'attack', power: 2.5, element: 'none', desc: 'Coup critique garantie.' },
earthshaker: { name: 'Secousse', ap: 0, mp: 24, type: 'attack', power: 2.8, element: 'earth', desc: 'Frappe sol + etourdit.' },
void_cut: { name: 'Tranche du Vide', ap: 0, mp: 28, type: 'attack', power: 3.2, element: 'dark', desc: 'Dechire la realite.' },


export function getSkill(id) { return SKILLS[id]; }
