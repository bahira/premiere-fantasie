// engine/assets.js — Central asset loader for images + fallback
// Loads hero sprites (4x2 animation sheets), enemy atlas (4x2 types), background images
// Returns cached canvas frames, falls back to procedural rendering if load fails

const _cache = {};
const _loading = {};

// Sliced animation frames (4 cols x 2 rows = 8 frames per hero sheet)
const HERO_FRAMES = {};   // { luan: [c0..c7], aldric: [...], ... }
const ENEMY_TYPES = {};   // { goblin: canvas, fuse: canvas, ... } — single frame per type
const SINGLE_SPRITES = {}; // { filename: Image } — loaded single-frame sprites for heroes/enemies

// hero id -> single sprite filename
const HERO_SPRITE_MAP = {
  zidane: 'thief_sprite.png',
  luan: 'thief_sprite.png',
  knight: 'knight_sprite.png',
  aldric: 'knight_sprite.png',
  mage: 'mage_sprite.png',
  mira: 'mage_sprite.png',
  healer: 'healer_sprite.png',
  selia: 'healer_sprite.png',
};

// enemy model -> single sprite filename
const ENEMY_SPRITE_MAP = {
  goblin: 'goblin.png', fuse: 'fuse.png', skeleton: 'skeleton.png',
  bomb: 'bomb.png', loup: 'loup.png', araignee: 'araignee.png',
  champignon: 'champignon.png', dryad: 'dryad.png', ironite: 'ironite.png',
  chauve_souris_geante: 'chauve_souris_geante.png', golem_terre: 'golem_terre.png',
  mimic: 'mimic.png', vautour: 'vautour.png', scorpion: 'scorpion.png',
  djinn: 'djinn.png', fantome: 'fantome.png', gargoyyle: 'gargoyyle.png',
  dragon_rouge: 'dragon_rouge.png', construct_mana: 'construct_mana.png',
  ombre_ancienne: 'ombre_ancienne.png',
  boss_plant: 'boss_plant.png',
  boss_steiner_dark: 'boss_steiner_dark.png',
  boss_kuja_echo: 'boss_kuja_echo.png',
  plant: 'boss_plant.png',
  darkknight: 'boss_steiner_dark.png',
  kuja: 'boss_kuja_echo.png',
};

// anim -> sheet cell index (4x2 grid: idx = row*4 + col) — used ONLY for hero sheets
export const ANIM_FRAME = {
  idle: 0, walk: 1, attack: 2, cast: 3,
  hit: 4, victory: 5, dying: 6, special: 7,
};

/**
 * Load an image and cache it
 */
export function loadImage(key, url) {
  if (_cache[key]) return Promise.resolve(_cache[key]);
  if (_loading[key]) return _loading[key];
  _loading[key] = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { _cache[key] = img; resolve(img); };
    img.onerror = () => { console.warn(`[Assets] Failed to load: ${url}`); _cache[key] = null; resolve(null); };
    img.src = url;
  });
  return _loading[key];
}

export function getImage(key) { return _cache[key] || null; }

/**
 * Slice a 4x2 sheet into 8 frame canvases
 * @param {HTMLImageElement} atlas
 * @param {Array} names — array of 8 names/indices for the 8 cells
 * @returns {Object} map of name -> canvas frame
 */
function sliceSheet(atlas, names) {
  const results = [];
  const w = atlas.width, h = atlas.height;
  const cols = 4, rows = 2;
  const cw = Math.floor(w / cols), ch = Math.floor(h / rows);
  for (let i = 0; i < cols * rows; i++) {
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d');
    ctx.drawImage(atlas, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch, 0, 0, cw, ch);
    results.push(c);
  }
  const map = {};
  names.forEach((n, i) => { if (n) map[n] = results[i]; });
  return map;
}

/** Background image map for battle biomes (static const — no per-call allocation) */
const BATTLE_BG_MAP = {
  forest: 'bg.forest', darkforest: 'bg.darkforest',
  desert: 'bg.desertland',
  palace: 'bg.palace', castle: 'bg.palace',
  steampunk: 'bg.steamtownmachina',
  town_steampunk: 'bg.steamtownmachina',
  void: 'bg.void',
  crystal_world: 'bg.crystal_world',
  cave: 'bg.cave',
  town_lindblum: 'bg.town_lindblum',
  town: 'bg.town_lindblum',
  magic_tree: 'bg.magic_tree',
  cityoflove: 'bg.cityoflove',
  ending: 'bg.ending',
};

export async function loadGameAssets() {
  console.log('[Assets] Loading game assets...');

  // Load ALL images in parallel (backgrounds + hero sheets + enemy atlas + single sprites)
  const allEntries = [
    ['bg.forest',           'backgrounds/forest.png'],
    ['bg.darkforest',       'backgrounds/darkforest.png'],
    ['bg.ending',           'backgrounds/ending.png'],
    ['bg.desertland',       'backgrounds/desertland.png'],
    ['bg.steamtownmachina', 'backgrounds/steamtownmachina.png'],
    ['bg.cityoflove',       'backgrounds/cityoflove.png'],
    ['bg.cave',             'backgrounds/cave.png'],
    ['bg.town_lindblum',    'backgrounds/town_lindblum.png'],
    ['bg.magic_tree',       'backgrounds/magic_tree.png'],
    ['bg.palace',           'backgrounds/palace.png'],
    ['bg.crystal_world',    'backgrounds/crystal_world.png'],
    ['bg.void',             'backgrounds/void.png'],
    // Hero sprite sheets (may fail if not 4x2 sheets — we have singles as fallback)
    ['hero.luan',   'sprites/heroes/luan.png'],
    ['hero.aldric', 'sprites/heroes/aldric.png'],
    ['hero.mira',   'sprites/heroes/mira.png'],
    ['hero.selia',  'sprites/heroes/selia.png'],
    // Enemy atlas removed — using individual sprites via ENEMY_SPRITE_MAP
  ];
  await Promise.all(allEntries.map(([k, u]) => loadImage(k, u)));

  // Slice hero sheets (4x2 = 8 animation frames each) — fallback to single sprites
  const heroIds = [['luan','hero.luan'],['aldric','hero.aldric'],['mira','hero.mira'],['selia','hero.selia']];
  for (const [id, key] of heroIds) {
    const img = _cache[key];
    if (img) HERO_FRAMES[id] = sliceSheet(img, [0,1,2,3,4,5,6,7]);
  }

  // Slice enemy atlas: 4x2 = 8 DIFFERENT enemy types (single static frame each)
  const atlas = _cache['enemies.basic'];
  if (atlas) {
    const sliced = sliceSheet(atlas, ['goblin','fuse','skeleton','bomb','ironite','plant','darkknight','kuja']);
    Object.assign(ENEMY_TYPES, sliced);
  }

  // Load single-frame sprites for heroes and enemies (new AI-generated assets)
  const singleEntries = [];
  for (const [id, fname] of Object.entries(HERO_SPRITE_MAP)) {
    const key = `sprite.hero.${fname}`;
    if (!_cache[key]) singleEntries.push([key, `sprites/heroes/${fname}`]);
  }
  for (const [model, fname] of Object.entries(ENEMY_SPRITE_MAP)) {
    const key = `sprite.enemy.${fname}`;
    if (!_cache[key]) singleEntries.push([key, `sprites/enemies/${fname}`]);
  }
  await Promise.all(singleEntries.map(([k, u]) => loadImage(k, u)));

  // Index single sprites into ENEMY_TYPES (overwrite if loaded)
  for (const [model, fname] of Object.entries(ENEMY_SPRITE_MAP)) {
    const key = `sprite.enemy.${fname}`;
    if (_cache[key]) ENEMY_TYPES[model] = _cache[key];
  }

  const loaded = Object.keys(_cache).filter(k => _cache[k] !== null).length;
  const total = Object.keys(_cache).length;
  console.log(`[Assets] ${loaded}/${total} image assets loaded`);
  console.log(`[Assets] Hero frames: ${Object.keys(HERO_FRAMES).map(k=>k+'='+(HERO_FRAMES[k]?8:0)).join(' ')}`);
  console.log(`[Assets] Enemy types: ${Object.keys(ENEMY_TYPES).join(' ')}`);
}

/** Get a hero animation frame canvas (8 frames per hero) */
export function getHeroFrame(heroId, anim) {
  const frames = HERO_FRAMES[heroId];
  if (frames) {
    const idx = ANIM_FRAME[anim] ?? 0;
    return frames[idx] || frames[0] || null;
  }
  // Fallback: return single sprite image
  const fname = HERO_SPRITE_MAP[heroId];
  if (fname) {
    const single = _cache[`sprite.hero.${fname}`];
    if (single) return single;
  }
  return null;
}

/** Get an enemy type canvas or Image (single static frame per enemy type) */
export function getEnemyFrame(model) {
  return ENEMY_TYPES[model] || null;
}

/** Background image for a battle biome */
export function getBattleBg(biome) {
  const key = BATTLE_BG_MAP[biome];
  return key ? getImage(key) : null;
}
