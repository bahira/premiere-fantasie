// config.js — All game constants in one place
export const CONFIG = {
  // World
  WORLD_SIZE: 60,
  GROUND_COLOR: 0x4a7c3f,
  FOG_COLOR: 0x87ceeb,
  TREE_COUNT: 40,

  // Player
  PLAYER_SPEED: 8,
  PLAYER_HP: 100,
  PLAYER_SIZE: 0.6,
  PLAYER_COLOR: 0x3498db,
  ATTACK_RANGE: 2.5,
  ATTACK_DAMAGE: 25,
  ATTACK_COOLDOWN: 0.4,

  // Enemies
  ENEMY_SPEED: 3,
  ENEMY_HP: 50,
  ENEMY_SIZE: 0.5,
  ENEMY_DAMAGE: 10,
  ENEMY_Knockback: 3,
  SPAWN_DISTANCE: 25,
  ENEMIES_PER_WAVE: 5,

  // Gems
  GEM_SIZE: 0.3,
  GEM_COLOR: 0xf1c40f,
  GEM_SCORE: 100,
  GEM_HEAL: 15,
  GEM_COUNT: 3,

  // Day/Night
  DAY_DURATION: 60,
  NIGHT_FOG: 0x1a1a2e,

  // Combat
  FLOAT_TEXT_DURATION: 1.0,

  // Audio
  AUDIO: {
    master: 0.8,
    music: 0.5,
    sfx: 0.7,
  },

  // RPG
  ACTIVE_PARTY_MAX: 4,
};

// Re-export AUDIO + STATES for engine imports
export const AUDIO = CONFIG.AUDIO;
export const STATES = { TITLE:'title', FIELD:'field', TOWN:'town', BATTLE:'battle', MENU:'menu', GAMEOVER:'gameover', THEEND:'theend' };

// Also export the legacy constants used by old modules (kept for compatibility)
export const GROUND_COLOR = CONFIG.GROUND_COLOR;
export const FOG_COLOR = CONFIG.FOG_COLOR;
export const TREE_COUNT = CONFIG.TREE_COUNT;
export const PLAYER_HP = CONFIG.PLAYER_HP;
