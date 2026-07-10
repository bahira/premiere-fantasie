// main.js — FFIX-style RPG orchestrator (DOM-based, AAA runtime)
import { GAME } from './state.js';
import { audio } from './engine/audio.js';
import { TitleScene } from './scenes/title.js';
import { FieldScene } from './scenes/field.js';
import { dialogue } from './engine/dialogue.js';
import { initParticlePool } from './renderer/wasm_particles.js';
import { loadGameAssets } from './engine/assets.js';

let titleScene, fieldScene;

async function boot() {
  // Initialize WASM particle system (non-blocking)
  initParticlePool().catch(() => {});
  
  // Load game assets (images) — non-blocking
  loadGameAssets().catch(err => console.warn('[Assets] Load failed:', err));
  
  // Idle title; music starts on first interaction (browser autoplay rules)
  titleScene = new TitleScene(go);
  titleScene.show();
  // Keyboard: Esc toggles menu out of battle scenes
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && GAME.scene === 'field') {
      import('./ui/menu.js').then(m => m.menu.open());
    }
  });
  console.log('[FF] Première Fantasie loaded — FFIX-style runtime');
}

async function go(target, opts = {}) {
  audio.sfx('confirm');
  if (titleScene) titleScene.hide();
  if (fieldScene) fieldScene.hide();
  if (target === 'field') {
    fieldScene = new FieldScene();
    fieldScene.show();
  } else if (target === 'title') {
    location.reload();
  }
}

boot();
