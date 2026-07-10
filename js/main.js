// main.js — FFIX-style RPG orchestrator (DOM-based, AAA runtime)
import { GAME } from './state.js';
import { audio } from './engine/audio.js';
import { TitleScene } from './scenes/title.js';
import { FieldScene } from './scenes/field.js';
import { dialogue } from './engine/dialogue.js';
import { initParticlePool } from './renderer/wasm_particles.js';
import { loadGameAssets } from './engine/assets.js';
import { battleUI } from './ui/battle_ui.js';
import { canvas } from './renderer/canvas.js';
import { juice } from './engine/juice.js';
import { ambiance } from './engine/ambiance.js';
import { quests } from './engine/quests.js';
import { ColosseumScene } from './scenes/colosseum.js';
import { TownScene } from './scenes/town.js';
import { CardGame } from './minigames/cardgame.js';
import { RacingGame } from './minigames/racing.js';
import { FishingGame } from './minigames/fishing.js';
import { COLISSEUM_CUPS } from './data/colosseum_cups.js';
import { SIDE_QUESTS } from './data/sidequests.js';
import { TOWNS } from './data/towns.js';

let titleScene, fieldScene;
let colosseumScene, townScene, cardGame, racingGame, fishingGame;

// Loading screen animation
function animateLoading() {
  const bar = document.getElementById('loading-bar');
  const screen = document.getElementById('loading-screen');
  if (!bar || !screen) return Promise.resolve();
  
  return new Promise(resolve => {
    let progress = 0;
    const steps = [15, 35, 55, 72, 88, 100];
    let i = 0;
    const tick = () => {
      if (i < steps.length) {
        progress = steps[i];
        bar.style.width = progress + '%';
        i++;
        setTimeout(tick, 300 + Math.random() * 200);
      } else {
        bar.classList.add('complete');
        setTimeout(() => {
          screen.classList.add('fade-out');
          setTimeout(resolve, 800);
        }, 500);
      }
    };
    setTimeout(tick, 400);
  });
}

async function boot() {
  // Animate loading screen
  await animateLoading();

  // Initialize WASM particle system (non-blocking)
  initParticlePool().catch(() => {});

  // Load game assets (images) — non-blocking
  loadGameAssets().catch(err => console.warn('[Assets] Load failed:', err));

  // Init engines
  juice.reset();
  ambiance.reset();

  // Idle title; music starts on first interaction (browser autoplay rules)
  titleScene = new TitleScene(go);
  titleScene.show();
  // Keyboard: Esc toggles menu out of battle scenes
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && GAME.scene === 'field') {
      import('./ui/menu.js').then(m => m.menu.open());
    }
  });
  // Quick-access shortcuts (field mode)
  window.addEventListener('keydown', (e) => {
    if (GAME.scene !== 'field') return;
    if (e.code === 'KeyC') openColosseum();
    else if (e.code === 'KeyQ') openQuests();
    else if (e.code === 'KeyT') openTown();
    else if (e.code === 'KeyG') openCardGame();
  });
  console.log('[FF] Première Fantasie loaded — FFIX-style runtime');
}

// ─── System launchers ────────────────────────────────────────────────
function _resumeField() { if (fieldScene) fieldScene.show(); }

function openColosseum() {
  audio.sfx('confirm');
  colosseumScene = new ColosseumScene(battleUI);
  colosseumScene.show(_resumeField);
}

function openTown(townId = 'lindblum') {
  audio.sfx('confirm');
  townScene = new TownScene(canvas, null);
  townScene.show(townId, _resumeField);
}

function openQuests() {
  audio.sfx('confirm');
  import('./ui/menu.js').then(m => { m.menu.open(); m.menu._panelQuests?.(); });
}

function openCardGame() {
  audio.sfx('confirm');
  cardGame = new CardGame();
  cardGame.show(_resumeField);
}

function openRacing() {
  audio.sfx('confirm');
  racingGame = new RacingGame();
  racingGame.show(_resumeField);
}

function openFishing() {
  audio.sfx('confirm');
  fishingGame = new FishingGame();
  fishingGame.show(_resumeField);
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

// Expose launchers for menu.js
window.__FF_LAUNCHERS__ = { openColosseum, openTown, openQuests, openCardGame, openRacing, openFishing };

boot();
