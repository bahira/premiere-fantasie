// ui/battle_ui.js — FFIX-style ATB battle UI (DOM + Canvas rendering)
import { GAME } from '../state.js';
import { ATBBattle } from '../engine/atb.js';
import { ENEMIES, getEnemy, getAttack } from '../data/enemies.js';
import { learnedSkills, getDragonSkill } from '../engine/progression.js';
import { grantBattleLoot, createMemberRuntime } from '../engine/progression.js';
import { audio } from '../engine/audio.js';
import { dialogue } from '../engine/dialogue.js';
import { menu } from './menu.js';
import { getBanter } from '../data/banter.js';
import { canvas } from '../renderer/canvas.js';
import { drawCharacter, drawEnemySprite } from '../renderer/sprites.js';
import { drawBattleBackground } from '../renderer/scenes.js';
import { applyPostFX } from '../renderer/scenes.js';
import { drawWeatherOverlay, getBiomeWeather } from '../renderer/scenes.js';
import { FX } from '../renderer/effects.js';

export class BattleUI {
  constructor() {
    this.root = null;
    this.battle = null;
    this.phase = 'idle'; // idle | command | target | skill | item | anim
    this.selectedSkill = null;
    this.targetList = [];
    this.targetIdx = 0;
    // Direct-click memory + keyboard state
    this._cmdIdx = 0;        // highlighted command index
    this._subMenu = null;    // null | 'skill' | 'item'
    this._keyHandler = null; // bound keydown listener
    // ─── Character animation system ──────────────────────────────────
    this._charAnims = {};
    // ─── Dynamic lighting ───────────────────────────────────────────
    this._vignetteIntensity = 0.5;
    this._elementTint = null; // { color, timer }
    this._lightningFlashes = []; // [{ timer, x, decay }]
    this._envDarkness = 0;
    // ─── Sprite cache (offscreenCanvas idle poses) ────────────────
    this._spriteCache = new Map();
    // ─── Boss intro ─────────────────────────────────────────────────
    this._bossIntroActive = false;
    this._bossIntroTimer = 0;
    this._bossIntroBoss = null;
  }

  // ─── Animation engine ──────────────────────────────────────────────
  _initAnim(unit) {
    const id = unit.id + '_' + this.battle?.enemies?.indexOf(unit) + '_' + this.battle?.party?.indexOf(unit);
    this._charAnims[id] = { state: 'idle', frame: 0, startX: 0, startY: 0, targetX: 0, targetY: 0, flashTimer: 0 };
    return id;
  }

  _getAnimId(unit) {
    if (!unit || !this.battle) return null;
    if (unit.isEnemy) { const i = this.battle.enemies.indexOf(unit); return i >= 0 ? unit.id + '_' + i + '_-1' : null; }
    else { const i = this.battle.party.indexOf(unit); return i >= 0 ? unit.id + '_' + i + '_' + i : null; }
  }

  _startAnim(unit, state, data = {}) {
    const id = this._getAnimId(unit);
    if (!id) return;
    const anim = this._charAnims[id] || (this._charAnims[id] = { state: 'idle', frame: 0, startX: 0, startY: 0, targetX: 0, targetY: 0, flashTimer: 0 });
    anim.state = state;
    anim.frame = 0;
    anim.startX = data.startX || anim.startX;
    anim.startY = data.startY || anim.startY;
    anim.targetX = data.targetX || anim.targetX;
    anim.targetY = data.targetY || anim.targetY;
    if (state === 'hit') anim.flashTimer = 8;
  }

  _tickAnims() {
    for (const id of Object.keys(this._charAnims)) {
      const a = this._charAnims[id];
      if (a.state === 'idle') continue;
      a.frame++;
      if (a.flashTimer > 0) a.flashTimer--;
      // Resolve animation durations
      if (a.state === 'attack' && a.frame > 20) { a.state = 'idle'; a.frame = 0; }
      else if (a.state === 'cast' && a.frame > 30) { a.state = 'idle'; a.frame = 0; }
      else if (a.state === 'hit' && a.frame > 12) { a.state = 'idle'; a.frame = 0; a.flashTimer = 0; }
      else if (a.state === 'victory' && a.frame > 60) { a.state = 'idle'; a.frame = 0; }
      else if (a.state === 'dying' && a.frame > 30) { a.frame = 30; } // hold
    }
  }

  _getAnimOffset(unit) {
    const id = this._getAnimId(unit);
    if (!id || !this._charAnims[id] || this._charAnims[id].state === 'idle') return { dx: 0, dy: 0, opacity: 1, flash: false, animState: 'idle' };
    const a = this._charAnims[id];
    let dx = 0, dy = 0;
    if (a.state === 'attack') {
      // Lunge forward (frames 0-8), hold (8-14), return (14-20)
      const progress = a.frame / 20;
      if (progress < 0.4) dx = (a.targetX - a.startX) * (progress / 0.4) * 0.6;
      else if (progress < 0.7) dx = (a.targetX - a.startX) * 0.6;
      else dx = (a.targetX - a.startX) * 0.6 * (1 - (progress - 0.7) / 0.3);
    } else if (a.state === 'cast') {
      // Subtle upward float
      dy = -Math.sin(a.frame * 0.1) * 4;
    } else if (a.state === 'hit') {
      // Knockback
      dx = -8 + Math.sin(a.frame * 0.4) * 4;
    } else if (a.state === 'dying') {
      // Fade out + fall
      dy = a.frame * 1.5;
    }
    return { dx, dy, opacity: a.state === 'dying' ? Math.max(0, 1 - a.frame / 30) : 1, flash: a.flashTimer > 0, animState: a.state };
  }

  start({ enemies, apReward = 2, expReward = 60, gilReward = 30, drops = [], reward = {}, isBossFight = false, isFinalBoss = false }) {
    audio.sfx('battle_start');
    audio.setIntensity(1);
    GAME.prevScene = GAME.scene;
    GAME.scene = 'battle';
    // Adaptive music per encounter type
    if (isFinalBoss) audio.playScene('battle', { boss: 'final' });
    else if (isBossFight) audio.playScene('battle', { boss: true });
    else audio.playScene('battle');
    // Element map for transition effects (inferred from enemy attacks)
    this._elemMap = this._buildElemMap(enemies);
    this._build();
    // Canvas layer for sprites (z-index 19, behind DOM battle UI at 20)
    this._battleCanvas = canvas.addLayer(19);
    canvas.start();
    this._frame = 0;
    // Build enemy runtime units
    const enemyUnits = enemies.map((id, i) => {
      const def = getEnemy(id); if (!def) return null;
      // Track bestiary discovery
      if (!GAME._bestiarySeen) GAME._bestiarySeen = [];
      if (!GAME._bestiarySeen.includes(def.id)) GAME._bestiarySeen.push(def.id);
      return {
        ...def, id: id + '_' + i, label: def.name,
        level: 1 + Math.floor(GAME.chapterId / 3), isEnemy: true,
        hp: def.hp, maxHp: def.hp, mp: def.mp || 0, alive: true,
        stats: { str: def.str, mag: def.mag, vit: def.vit, spd: def.spd, luck: 5, def: def.vit, mdef: def.mag },
        weak: def.element_weak || [], resist: def.element_resist || [],
        atb: Math.random() * 20, ready: false,
      };
    }).filter(Boolean);
    this.battle = new ATBBattle(GAME.party, enemyUnits, {
      atbScale: isBossFight ? 0.85 : 1.0,
      canFlee: !isBossFight,
      onResolve: () => this._tick(),
      onStateChange: (ev) => this._onState(ev),
    });
    this._spriteCache.clear();
    this._preRenderBattleSprites();
    this._render();
    // Register battle draw on the canvas engine's single RAF loop
    this._boundTick = this._onEngineTick.bind(this);
    this._battleCanvas._onTick(this._boundTick);
    // Keyboard: arrows navigate, Enter confirms, direct-click repeats last action
    this._keyHandler = (e) => this._onKeyboard(e);
    window.addEventListener('keydown', this._keyHandler);
    // Fade-in transition (remove any existing overlay first, element-aware)
    const existingFade = document.getElementById('scene-transition');
    if (existingFade) existingFade.remove();
    const elemColors = {
      fire: ['#e74c3c', '#f39c12', '#ff6b35'],
      ice: ['#3498db', '#a8d8ea', '#e0f0ff'],
      thunder: ['#f1c40f', '#ffe066', '#fff'],
      dark: ['#8e44ad', '#2c0a3a', '#1a0520'],
      holy: ['#f1c40f', '#fff', '#ffe066'],
      poison: ['#27ae60', '#7dcea0', '#a8e6cf'],
      wind: ['#1abc9c', '#a3e4d7', '#d5f5e3'],
      earth: ['#8b4513', '#d2b48c', '#f5deb3'],
    };
    const firstEnemy = this.battle?.enemies?.[0]?.id;
    const elem = this._elemMap?.[firstEnemy] || null;
    const colors = elemColors[elem] || null;
    const fadeIn = document.createElement('div');
    fadeIn.id = 'scene-transition';
    if (colors) {
      fadeIn.style.cssText = `position:fixed;inset:0;z-index:100;pointer-events:none;opacity:1;transition:opacity 0.4s cubic-bezier(0.32,0.72,0,1);`;
      const cvs = document.createElement('canvas');
      cvs.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
      cvs.width = window.innerWidth;
      cvs.height = window.innerHeight;
      fadeIn.appendChild(cvs);
      document.body.appendChild(fadeIn);
      const fCtx = cvs.getContext('2d');
      let fStart = 0;
      const fSwirl = (ts) => {
        if (!fStart) fStart = ts;
        const p = Math.min(1, (ts - fStart) / 400);
        const cx = cvs.width / 2, cy = cvs.height / 2;
        fCtx.clearRect(0, 0, cvs.width, cvs.height);
        const grad = fCtx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(cvs.width, cvs.height) * 0.7);
        grad.addColorStop(0, colors[0]);
        grad.addColorStop(0.5, colors[1]);
        grad.addColorStop(1, colors[2] || colors[0]);
        fCtx.globalAlpha = 1 - p;
        fCtx.fillStyle = grad;
        fCtx.fillRect(0, 0, cvs.width, cvs.height);
        fCtx.globalAlpha = 1;
        if (p < 1) requestAnimationFrame(fSwirl);
      };
      requestAnimationFrame(() => { fadeIn.style.opacity = '0'; requestAnimationFrame(fSwirl); });
    } else {
      fadeIn.style.cssText = 'position:fixed;inset:0;z-index:100;background:#000;pointer-events:none;opacity:1;transition:opacity 0.4s cubic-bezier(0.32,0.72,0,1);';
      document.body.appendChild(fadeIn);
      requestAnimationFrame(() => { fadeIn.style.opacity = '0'; });
    }
    setTimeout(() => fadeIn.remove(), 500);

    // Boss intro splash
    if (isBossFight || isFinalBoss) {
      const bossUnit = this.battle?.enemies?.find(e => e.isBoss || e.isFinalBoss);
      if (bossUnit) setTimeout(() => this._showBossIntro(bossUnit), 400);
    }
  }

  // ─── Dynamic battle lighting ────────────────────────────────────────────
  _tickLighting() {
    // Element tint decay
    if (this._elementTint) {
      this._elementTint.timer--;
      if (this._elementTint.timer <= 0) this._elementTint = null;
    }
    // Lightning flash decay + prune expired
    for (const fl of this._lightningFlashes) fl.timer--;
    this._lightningFlashes = this._lightningFlashes.filter(fl => fl.timer > 0);
    // Boss intro timer
    if (this._bossIntroActive) {
      this._bossIntroTimer--;
      if (this._bossIntroTimer <= 0) this._bossIntroActive = false;
    }
  }

  _drawLightingOverlay(ctx, w, h) {
    if (this._vignetteIntensity <= 0 && !this._elementTint && this._lightningFlashes.length === 0) return;

    // 1) Vignette — dark corners (cached radial gradient)
    if (this._vignetteIntensity > 0) {
      if (!this._vignetteGrad || this._vignetteW !== w || this._vignetteH !== h) {
        this._vignetteGrad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
        this._vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
        this._vignetteGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
        this._vignetteGrad.addColorStop(0.85, `rgba(0,0,0,${0.3 * this._vignetteIntensity})`);
        this._vignetteGrad.addColorStop(1, `rgba(0,0,0,${0.55 * this._vignetteIntensity})`);
        this._vignetteW = w;
        this._vignetteH = h;
      }
      ctx.fillStyle = this._vignetteGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // 2) Element tint overlay (brief flash on attack)
    if (this._elementTint) {
      const progress = this._elementTint.timer / 15;
      ctx.fillStyle = this._elementTint.color.replace(')', `,${progress * 0.15})`).replace('rgb', 'rgba');
      ctx.fillRect(0, 0, w, h);
    }

    // 3) Lightning flashes (for boss phases / dramatic moments)
    for (const fl of this._lightningFlashes) {
      const bright = Math.max(0, fl.timer / 10) * 0.08 * fl.decay;
      ctx.fillStyle = `rgba(255,255,255,${bright})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ─── Sprite cache: pre-render idle poses to OffscreenCanvas ────────────────
  _preRenderSprite(key, drawFn, scale) {
    const off = new OffscreenCanvas(128, 128);
    drawFn(off.getContext('2d'), 64, 80, scale, 0, { anim: 'idle', flash: false });
    this._spriteCache.set(key, off);
  }

  _preRenderBattleSprites() {
    const { party, enemies } = this.battle;
    for (const m of party) {
      if (!m.alive) continue;
      const key = `${m.id}_0.8`;
      if (!this._spriteCache.has(key)) {
        const fn = (ctx, x, y, s, frame, opts) => drawCharacter(ctx, m.id, x, y, s, frame, opts);
        this._preRenderSprite(key, fn, 0.8);
      }
    }
    for (const e of enemies) {
      if (!e.alive) continue;
      const model = e.model || e.id?.replace(/_\d+$/, '') || 'goblin';
      const scale = e.isBoss ? 1.5 : 1.2;
      const key = `${model}_${scale}`;
      if (!this._spriteCache.has(key)) {
        const fn = (ctx, x, y, s, frame, opts) => drawEnemySprite(ctx, model, x, y, s, frame, opts);
        this._preRenderSprite(key, fn, scale);
      }
    }
  }

  _triggerElementTint(element) {
    const colorMap = {
      fire: 'rgba(231,76,60,0.4)', ice: 'rgba(52,152,219,0.4)',
      thunder: 'rgba(241,196,15,0.4)', holy: 'rgba(255,255,255,0.3)',
      dark: 'rgba(74,20,140,0.4)', none: 'rgba(200,200,255,0.2)'
    };
    this._elementTint = { color: colorMap[element] || 'rgba(200,200,255,0.2)', timer: 15 };
    // Add a lightning flash for dramatic hits
    this._lightningFlashes.push({ timer: 6, x: 0, decay: 0.6 });
  }

  // ─── Boss Intro Splash ────────────────────────────────────────────────────
  _showBossIntro(boss) {
    if (!boss) return;
    this._bossIntroBoss = boss;
    this._bossIntroActive = true;
    this._bossIntroTimer = 100; // ~1.6s at 60fps
    // Full-screen flash (element-tinted)
    const bossElement = boss.element_weak?.[0] || 'none';
    const flashColors = { fire:'rgba(231,76,60,0.25)', ice:'rgba(52,152,219,0.25)', thunder:'rgba(241,196,15,0.25)', holy:'rgba(255,255,255,0.2)', dark:'rgba(74,20,140,0.25)', none:'rgba(0,0,0,0.6)' };
    const f = document.createElement('div'); f.id = 'hit-flash';
    f.style.background = flashColors[bossElement] || 'rgba(0,0,0,0.6)';
    document.body.appendChild(f);
    // Cinematic letterbox bars
    const letterTop = document.createElement('div');
    const letterBot = document.createElement('div');
    letterTop.style.cssText = 'position:fixed;top:0;left:0;right:0;height:8vh;background:#000;z-index:55;transition:height 0.8s cubic-bezier(0.32,0.72,0,1);';
    letterBot.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:8vh;background:#000;z-index:55;transition:height 0.8s cubic-bezier(0.32,0.72,0,1);';
    document.body.appendChild(letterTop);
    document.body.appendChild(letterBot);
    // Huge boss name reveal via DOM overlay
    const splash = document.createElement('div');
    splash.style.cssText = `
      position:fixed; inset:0; z-index:50; display:flex; flex-direction:column;
      align-items:center; justify-content:center; pointer-events:none;
      opacity:1; transition:opacity 0.6s cubic-bezier(0.32,0.72,0,1);`;
    const bossName = boss.label || boss.name || '???';
    const weakIcons = (boss.element_weak || []).map(w =>
      ({fire:'🔥',ice:'❄️',thunder:'⚡',holy:'🌟',dark:'🌑',water:'🌊',none:'⚔'})[w] || w
    ).join(' ');
    // Element-specific accent colors for the name
    const elemColors = { fire:'#e74c3c', ice:'#3498db', thunder:'#f1c40f', holy:'#fff', dark:'#9b59b6', none:'#f1c40f' };
    const nameColor = elemColors[bossElement] || '#f1c40f';
    splash.innerHTML = `
      <div style="
        font-family:'Cormorant Garamond',Georgia,serif;
        font-size:clamp(2.5rem,6vw,5rem); font-weight:700; color:#fff;
        text-shadow:0 0 40px ${nameColor}80,0 0 80px ${nameColor}40,0 4px 0 #0a0a1a;
        letter-spacing:0.08em; text-align:center;
        transform:scale(2.0); animation:bossIntroReveal 0.8s cubic-bezier(0.32,0.72,0,1) forwards;
      ">${bossName}</div>
      <div style="
        width:60%; height:2px; margin:8px auto;
        background:linear-gradient(90deg, transparent, ${nameColor}, transparent);
        transform:scaleX(0); animation:bossIntroUnderline 0.6s 0.3s cubic-bezier(0.32,0.72,0,1) forwards;
      "></div>
      <div style="
        font-size:1.2rem; color:${nameColor}; margin-top:4px;
        text-shadow:0 0 20px ${nameColor}60;
        opacity:0; animation:fadeInUp 0.6s 0.4s cubic-bezier(0.32,0.72,0,1) forwards;
      ">${weakIcons ? `Faiblesse: ${weakIcons}` : ''}</div>`;
    document.body.appendChild(splash);
    // Remove splash + letterbox after timer
    setTimeout(() => {
      splash.style.opacity = '0';
      letterTop.style.height = '0';
      letterBot.style.height = '0';
      setTimeout(() => { splash.remove(); letterTop.remove(); letterBot.remove(); }, 800);
      f.style.opacity = '0';
      setTimeout(() => f.remove(), 400);
    }, 1600);
    // Element-specific burst particles (more dramatic)
    const cw = this._battleCanvas?.canvas.width || window.innerWidth;
    const ch = this._battleCanvas?.canvas.height || window.innerHeight;
    const burstColors = { fire:['#e74c3c','#f39c12','#ff6b3d'], ice:['#3498db','#a0d8f0','#fff'], thunder:['#f1c40f','#fff','#f39c12'], holy:['#fff','#f1c40f','#ffe066'], dark:['#9b59b6','#4a148c','#e74c3c'], none:['#9b59b6','#f1c40f','#e74c3c'] };
    const colors = burstColors[bossElement] || burstColors.none;
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        canvas.addParticle(FX.burst.create(
          cw * (0.15 + Math.random() * 0.7), ch * (0.15 + Math.random() * 0.7),
          colors[i % colors.length]
        ));
        canvas.screenShake(3 + i * 0.5, 150 + i * 50);
      }, i * 150);
    }
    audio.sfx('boss_intro');
  }

  _onEngineTick(dt, ctx) {
    if (GAME.scene !== 'battle' || !this.battle) return;
    if (this._bossIntroActive) {
      this._tickLighting();
      this._drawBattle();
      return; // freeze ATB during boss intro
    }
    if (this.phase !== 'anim') this.battle.step(1 / 60);
    this._tickAnims();
    this._tickLighting();
    // Skip full redraw when idle: only redraw if any animation is active,
    // ATB is progressing (enemies/party moving), or FX are pending.
    const anyAnim = Object.values(this._charAnims).some(a => a.state !== 'idle');
    const atbMoving = this.battle.enemies.some(e => e.alive && (e.atb || 0) < 100) ||
                      this.battle.party.some(m => m.alive && (m.atb || 0) < 100);
    const fxPending = this._lightningFlashes.length > 0 || this._elementTint;
    if (anyAnim || atbMoving || fxPending || this._frame % 8 === 0) {
      this._drawBattle();
    }
  }

  _drawBattle() {
    this._frame = (this._frame || 0) + 1;
    const ctx = this._battleCanvas.ctx;
    const w = this._battleCanvas.canvas.width;
    const h = this._battleCanvas.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // ── Offscreen background cache (re-render every 8 frames) ──
    if (!this._bgCache || this._bgCacheW !== w || this._bgCacheH !== h) {
      this._bgCache = document.createElement('canvas');
      this._bgCache.width = w; this._bgCache.height = h;
      this._bgCacheW = w; this._bgCacheH = h;
      this._bgCacheFrame = 0;
    }
    if ((this._frame & 7) === 0 || !this._bgCacheCtx) {
      this._bgCacheCtx = this._bgCache.getContext('2d');
      this._bgCacheCtx.clearRect(0, 0, w, h);
      drawBattleBackground(this._bgCacheCtx, this.battle?.biome || 'battle', w, h, this._frame);
    }
    ctx.drawImage(this._bgCache, 0, 0);

    // Weather overlay (throttled: every 2 frames)
    if ((this._frame & 1) === 0) {
      const weatherType = this.battle?.weather || getBiomeWeather(this.battle?.biome || 'battle');
      drawWeatherOverlay(ctx, w, h, this._frame, weatherType);
    }

    // Draw enemies (sprite-cached idle, procedural non-idle)
    const enemies = this.battle.enemies;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      const animOff = this._getAnimOffset(e);
      if (animOff.opacity <= 0) continue;
      const ex = w * (0.2 + i * (0.6 / Math.max(enemies.length - 1, 1))) + animOff.dx;
      const ey = h * 0.3 + animOff.dy;
      const scale = e.isBoss ? 1.5 : 1.2;
      const model = e.model || e.id?.replace(/_\d+$/, '') || 'goblin';
      ctx.globalAlpha = animOff.opacity;
      const cacheKey = `${model}_${scale}`;
      if (animOff.animState === 'idle' && this._spriteCache.has(cacheKey)) {
        const cached = this._spriteCache.get(cacheKey);
        ctx.drawImage(cached, ex - 20, ey - 48, 128 * scale * 0.5, 128 * scale * 0.5);
      } else {
        drawEnemySprite(ctx, model, ex, ey, scale, this._frame, { anim: animOff.animState, flash: animOff.flash });
      }
      ctx.globalAlpha = 1;

      // HP bar below enemy
      const hpPct = e.hp / e.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(ex - 30, ey + 35, 60, 6);
      ctx.fillStyle = hpPct > 0.5 ? '#2ecc71' : hpPct > 0.25 ? '#f39c12' : '#e74c3c';
      ctx.fillRect(ex - 29, ey + 36, 58 * hpPct, 4);

      // Enemy name + elemental weakness hint
      ctx.fillStyle = '#ecf0f1';
      ctx.font = '12px Outfit,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.label || e.name, ex, ey - 48);
      if (e.element_weak && e.element_weak.length > 0) {
        ctx.fillStyle = 'rgba(255,200,100,0.5)';
        ctx.font = '9px Outfit,sans-serif';
        ctx.fillText('Faiblesse: ' + e.element_weak.join('/'), ex, ey - 36);
      }
      // Focus bar for enemies
      const focusPct = Math.min(1, (e.focus || 0) / (e.maxFocus || 100));
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(ex - 20, ey + 44, 40, 4);
      ctx.fillStyle = e.focusReady ? '#e74c3c' : '#8e44ad';
      ctx.fillRect(ex - 19, ey + 45, 38 * focusPct, 2);
    }

    // Draw party members at bottom (sprite-cached idle, procedural non-idle)
    const party = this.battle.party;
    for (let i = 0; i < party.length; i++) {
      const m = party[i];
      if (!m.alive) continue;
      const animOff = this._getAnimOffset(m);
      if (animOff.opacity <= 0) continue;
      const px = w * (0.15 + i * 0.2) + animOff.dx;
      const py = h * 0.75 + animOff.dy;
      ctx.globalAlpha = animOff.opacity;
      const cacheKey = `${m.id}_0.8`;
      if (animOff.animState === 'idle' && this._spriteCache.has(cacheKey)) {
        const cached = this._spriteCache.get(cacheKey);
        ctx.drawImage(cached, px - 20, py - 48, 128 * 0.8 * 0.5, 128 * 0.8 * 0.5);
      } else {
        drawCharacter(ctx, m.id, px, py, 0.8, this._frame, { anim: animOff.animState, flash: animOff.flash });
      }
      ctx.globalAlpha = 1;
      // Active glow
      if (this.battle.activeUnit === m) {
        ctx.fillStyle = 'rgba(241,196,15,0.2)';
        ctx.beginPath();
        ctx.arc(px, py - 10, 40, 0, Math.PI * 2);
        ctx.fill();
      }
      // Dragon Form aura
      if (m._dragonForm) {
        const dragonPulse = 0.15 + 0.1 * Math.sin(this._frame * 0.1);
        ctx.save();
        ctx.shadowColor = '#9b59b6';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = `rgba(155,89,182,${dragonPulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px, py - 10, 36 + Math.sin(this._frame * 0.08) * 4, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(241,196,15,${dragonPulse * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py - 10, 42 + Math.sin(this._frame * 0.06) * 3, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      // Breath of Fire: Focus bar (under character)
      const focusPct = Math.min(1, (m.focus || 0) / (m.maxFocus || 100));
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(px - 20, py + 30, 40, 5);
      ctx.fillStyle = m.focusReady ? '#f1c40f' : '#9b59b6';
      ctx.fillRect(px - 19, py + 31, 38 * focusPct, 3);
      if (m.focusReady) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 10px Outfit,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡FOCUS', px, py + 42);
      }
      // Dragon Affinity active buff indicator
      if (m._buffs && Object.keys(m._buffs).length > 0) {
        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 9px Outfit,sans-serif';
        ctx.textAlign = 'center';
        const buffText = Object.keys(m._buffs).map(k => `${k}↑`).join(' ');
        ctx.fillText('🐉 ' + buffText, px, py + 52);
      }
      // Dragon Form indicator
      if (m._dragonForm) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 10px Outfit,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🐉 FORME DRACONIQUE [${m._dragonForm}]`, px, py + 64);
      }
      // Status effect icons (poison, blind, curse, silence, etc.)
      if (m._status) {
        const statusIcons = { poison: '☠️', blind: '👁️‍🗨️', curse: '🔮', silence: '🔇', def_down: '🛡️⬇' };
        const entries = Object.entries(m._status).filter(([k, v]) => v > 0);
        if (entries.length > 0) {
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          let sx = px - (entries.length - 1) * 10;
          for (const [st, turns] of entries) {
            ctx.fillText(statusIcons[st] || '⚠️', sx, py - 60);
            sx += 20;
          }
        }
      }
    }
    

    // Draw particles (spell effects, death bursts, etc.)
    canvas.drawParticles(ctx);

    // Dynamic lighting overlay (vignette + element tint + lightning)
    this._drawLightingOverlay(ctx, w, h);

    // Post-FX (bloom, grain, chromatic, atmospheric tint per biome)
    const biome = this.battle?.biome || 'battle';
    applyPostFX(ctx, w, h, this._frame, { grain: 0.03, bloom: 0.18, chrom: 0.4, tint: { color: '#204060', a: 0.12 }, vignette: 0.3 });
  }

  // ─── Direct-click repeat: executes last action for this character ───────
  _executeLastAction(enemyIdx) {
    const m = this.battle?.activeUnit;
    if (!m || !this.battle.enemies[enemyIdx]?.alive) return;
    const last = m._lastAction || { type: 'attack', targetIsAlly: false };
    const target = this.battle.enemies[enemyIdx];
    this.phase = 'idle'; // don't block ATB
    if (last.type === 'attack') {
      this.battle.memberAttack(m, target);
    } else if (last.type === 'skill' && last.skillId) {
      this.battle.memberSkill(m, last.skillId, target);
    } else {
      this.battle.memberAttack(m, target);
    }
    canvas.screenShake(3, 120);
    audio.sfx('confirm');
  }

  // ─── Keyboard navigation ────────────────────────────────────────────────
  _onKeyboard(e) {
    if (GAME.scene !== 'battle' || this.phase === 'anim') return;

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        if (this.phase === 'target') this._cycleTarget(dir);
        else if (this._subMenu) this._cycleSkill(dir);
        else if (this.phase === 'command') this._cycleCommand(dir);
        break;
      }
      case 'ArrowUp':
      case 'ArrowDown': {
        e.preventDefault();
        if (this._subMenu) this._cycleSkill(e.key === 'ArrowDown' ? 1 : -1);
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        this._keyConfirm();
        break;
      }
      case 'Escape': {
        e.preventDefault();
        this._keyCancel();
        break;
      }
    }
  }

  _cycleCommand(dir) {
    if (!this.battle?.activeUnit) return;
    const btns = this.root?.querySelectorAll('.btl-cmd-grid button');
    if (!btns?.length) return;
    this._subMenu = null;
    // Hide skill list if visible
    const sl = document.getElementById('btl-skill-list');
    if (sl) sl.classList.add('hidden');
    this._cmdIdx = (this._cmdIdx + dir + btns.length) % btns.length;
    btns.forEach((b, i) => b.style.outline = i === this._cmdIdx ? '2px solid #f1c40f' : '');
    btns[this._cmdIdx]?.focus();
    audio.sfx('cursor');
  }

  _cycleTarget(dir) {
    const list = this.targetList;
    if (!list.length) return;
    this.targetIdx = (this.targetIdx + dir + list.length) % list.length;
    // Re-render target highlights
    if (this._targetSide === 'enemy') this._renderEnemies();
    else this._renderParty();
    audio.sfx('cursor');
  }

  _cycleSkill(dir) {
    const sl = document.getElementById('btl-skill-list');
    if (!sl || sl.classList.contains('hidden')) return;
    const btns = sl.querySelectorAll('button');
    if (!btns.length) return;
    // Track which skill is highlighted via dataset
    let cur = Array.from(btns).findIndex(b => b.style.outline);
    if (cur < 0) cur = 0;
    const next = (cur + dir + btns.length) % btns.length;
    btns.forEach((b, i) => b.style.outline = i === next ? '2px solid #f1c40f' : '');
    btns[next]?.focus();
    audio.sfx('cursor');
  }

  _keyConfirm() {
    if (this.phase === 'target') {
      const target = this.targetList[this.targetIdx];
      if (!target) return;
      if (target.isEnemy) this._selectEnemy(this.battle.enemies.indexOf(target));
      else this._selectAlly(this.targetList.indexOf(target));
    } else if (this._subMenu) {
      // Click highlighted skill button
      const sl = document.getElementById('btl-skill-list');
      if (!sl) return;
      const btn = sl.querySelector('button[style*="outline"]') || sl.querySelector('button');
      if (btn) btn.click();
    } else if (this.phase === 'command') {
      // Click highlighted command button
      const btn = this.root?.querySelector('.btl-cmd-grid button:nth-child(' + (this._cmdIdx + 1) + ')');
      if (btn) btn.click();
    }
  }

  _keyCancel() {
    if (this._subMenu) {
      // Close sub-menu
      const sl = document.getElementById('btl-skill-list');
      if (sl) { sl.classList.add('hidden'); this._subMenu = null; }
      this._cycleCommand(0); // re-highlight command
    } else if (this.phase === 'target') {
      this.phase = 'command';
      this._renderCommand();
      this._cycleCommand(0);
    }
  }

  _buildElemMap(enemyIds) {
    // Map enemy IDs to their primary element for transition effects
    const map = {};
    const defs = { goblin:'fire', fuse:'fire', skeleton:'dark', bomb:'fire', ironite:'earth', boss_plant:'poison', boss_steiner_dark:'dark', boss_kuja_echo:'dark' };
    for (const id of (Array.isArray(enemyIds) ? enemyIds : [enemyIds])) {
      const baseId = id.replace(/_\d+$/, '');
      if (defs[baseId]) map[id] = defs[baseId];
      else if (defs[baseId?.toLowerCase()]) map[id] = defs[baseId.toLowerCase()];
    }
    return map;
  }

  _build() {
    if (this.root) this.root.remove();
    this.root = document.createElement('div');
    this.root.id = 'battle-ui';
    this.root.innerHTML = `
      <div id="btl-boss-bar" class="hidden"></div>
      <div id="btl-enemies"></div>
      <div id="btl-float"></div>
      <div id="btl-party"></div>
      <div id="btl-panel">
        <div id="btl-cmd"></div>
        <div id="btl-log"></div>
      </div>`;
    document.body.appendChild(this.root);
    this.root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-enemy]');
      if (t) {
        const idx = +t.dataset.enemy;
        if (this.phase === 'target') {
          this._selectEnemy(idx);
        } else if (this.phase === 'command' && this.battle?.activeUnit) {
          // Direct-click repeat: execute last action on clicked enemy
          this._executeLastAction(idx);
        }
      }
    });
  }

  _render() {
    this._renderEnemies();
    this._renderParty();
    this._renderCommand();
    this._renderBossBar();
  }

  _renderBossBar() {
    const el = document.getElementById('btl-boss-bar'); if (!el) return;
    const boss = this.battle?.enemies?.find(e => e.alive && (e.isBoss || e.isFinalBoss));
    if (!boss) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
    const weakIcons = (boss.element_weak || []).map(w => ({fire:'🔥',ice:'❄️',thunder:'⚡',holy:'🌟',dark:'🌑',water:'🌊',none:'⚔'})[w] || w).join(' ');
    el.innerHTML = `
      <div class="btl-boss-name">
        <span>👑 ${boss.label || boss.name}</span>
        <span class="btl-boss-weak">Faiblesse: ${weakIcons || '—'}</span>
      </div>
      <div class="btl-boss-hp-track">
        <div class="btl-boss-hp-fill" style="width:${pct}%"></div>
        <div class="btl-boss-hp-text">${boss.hp} / ${boss.maxHp}</div>
      </div>`;
  }

  _renderEnemies() {
    const el = document.getElementById('btl-enemies'); if (!el) return;
    const live = this.battle.enemies;
    el.innerHTML = live.map((e, i) => {
      const weakIcons = (e.element_weak || []).map(w => ({fire:'🔥',ice:'❄️',thunder:'⚡',holy:'🌟',dark:'🌑',water:'🌊',none:'⚔'})[w] || w).join('');
      return `<div class="btl-enemy ${this.phase==='target' && this.targetIdx===i?'tgt':''} ${e.alive?'':'dead'}" data-enemy="${i}">
        <div class="btl-hpbar"><div style="width:${Math.max(0,e.hp/e.maxHp*100)}%"></div></div>
        <div class="btl-sprite">${enemyIcon(e.model)}</div>
        <div class="btl-name">${e.label}</div>
        ${weakIcons ? `<div class="btl-enemy-weak">${weakIcons}</div>` : ''}
      </div>`;
    }).join('');
  }
  // Portrait mapping for battle UI
  static BTL_PORTRAITS = {
    zidane: 'sprites/portraits/luan.png',
    knight: 'sprites/portraits/aldric.png',
    mage: 'sprites/portraits/mira.png',
    healer: 'sprites/portraits/selia.png',
  };

  _renderParty() {
    const el = document.getElementById('btl-party'); if (!el) return;
    el.innerHTML = this.battle.party.map((m, i) => {
      const at = Math.min(100, m.atb || 0);
      const isTarget = this.phase === 'target' && this._targetSide === 'ally' && this.targetIdx === i;
      const portraitSrc = BattleUI.BTL_PORTRAITS[m.id] || '';
      const portraitHtml = portraitSrc ? `<img src="${portraitSrc}" alt="${m.name}" class="btl-member-portrait">` : '';
      return `<div class="btl-member ${m.alive?'':'dead'} ${this.battle.activeUnit===m?'active':''} ${isTarget?'tgt':''}">
        ${portraitHtml}
        <div class="btl-char">${m.name}</div>
        <div class="btl-mhp">HP ${m.hp}/${m.maxHp}</div>
        <div class="btl-mmp">PM ${m.mp}/${m.maxMp}</div>
        <div class="btl-atb${at >= 100 ? ' ready' : ''}"><div style="width:${at}%"></div></div>
      </div>`;
    }).join('');
  }
  _renderCommand() {
    const el = document.getElementById('btl-cmd'); if (!el) return;
    if (!this.battle.activeUnit || this.battle.activeUnit.isEnemy) { el.innerHTML = '<i>…</i>'; return; }
    const m = this.battle.activeUnit;
    const skills = learnedSkills(m).filter(s => s.type !== 'support' || s.type === 'heal' || s.type === 'buff' || s.type === 'revive');
    const dragonSk = m._dragonForm ? getDragonSkill(m) : null;
    el.innerHTML = `
      <div class="btl-cmd-title">${m.name} — Action</div>
      <div class="btl-cmd-grid">
        <button data-c="attack"><img src="sprites/ui/icon_attack.png" class="btl-cmd-icon" alt="">Attaque</button>
        <button data-c="skill"><img src="sprites/ui/icon_skill.png" class="btl-cmd-icon" alt="">Capacités</button>
        <button data-c="item"><img src="sprites/ui/icon_item.png" class="btl-cmd-icon" alt="">Objets</button>
        <button data-c="defend"><img src="sprites/ui/icon_defend.png" class="btl-cmd-icon" alt="">Garde</button>
        <button data-c="flee" ${this.battle.canFlee?'':'disabled'}><img src="sprites/ui/icon_flee.png" class="btl-cmd-icon" alt="">Fuite</button>
        <button data-c="menu">Menu</button>
        ${dragonSk ? `<button data-c="dragon" class="btl-btn-dragon">🐉 ${dragonSk.name}</button>` : ''}
      </div>
      <div id="btl-skill-list" class="hidden"></div>`;
    el.querySelectorAll('button[data-c]').forEach((b, i) => {
      b.onclick = () => { this._subMenu = null; this._onCommand(b.dataset.c); };
      // Apply keyboard highlight if matches current index
      b.style.outline = (this.phase === 'command' && i === this._cmdIdx) ? '2px solid #f1c40f' : '';
    });
  }

  _onCommand(c) {
    audio.sfx('cursor');
    const m = this.battle.activeUnit;
    if (c === 'attack') {
      this._enterTarget('basic');
    } else if (c === 'skill') {
      this._showSkills(m);
    } else if (c === 'item') {
      this._showItems(m);
    } else if (c === 'defend') {
      this.battle.defend(m); this._render();
    } else if (c === 'flee') {
      this.battle.flee(m);
    } else if (c === 'dragon') {
      // Dragon skill — always targets enemies (single target, auto-select)
      const dragonSk = getDragonSkill(m);
      if (dragonSk) {
        if (m._dragonForm) {
          this.selectedSkill = dragonSk.id;
          // Make sure it's in attacker's skills map for executeAttack
          if (!m.skills) m.skills = {};
          m.skills[dragonSk.id] = dragonSk;
          this._enterTarget('skill', 'enemy', dragonSk.id);
        } else {
          this.battle.log.push(`${m.name} n'est plus en forme draconique !`);
          this.battle.onStateChange({ type: 'msg', text: 'Forme draconique dissipée...' });
        }
      }
    } else if (c === 'menu') {
      menu.open();
    }
  }

  _showSkills(m) {
    const sl = document.getElementById('btl-skill-list');
    if (!sl) return;
    const skills = learnedSkills(m);
    sl.classList.remove('hidden');
    this._subMenu = 'skill';
    this._cmdIdx = 0;
    // Reset outlines on skill buttons
    setTimeout(() => {
      const btns = sl.querySelectorAll('button');
      btns.forEach((b, i) => b.style.outline = i === 0 ? '2px solid #f1c40f' : '');
      btns[0]?.focus();
    }, 50);
    sl.innerHTML = skills.map((s, i) => {
      const canCast = (s.mp || 0) <= m.mp;
      return `<button data-sk="${s.id}" ${canCast?'':'disabled'}>${s.name} <small>(${s.mp||0} PM)</small></button>`;
    }).join('') + `<button data-sk="back">↩ Retour</button>`;
    sl.querySelectorAll('button[data-sk]').forEach(b => {
      b.onclick = () => {
        if (b.dataset.sk === 'back') { sl.classList.add('hidden'); this._subMenu = null; return; }
        this._subMenu = null;
        this.selectedSkill = b.dataset.sk;
        const sk = learnedSkills(m).find(s => s.id === this.selectedSkill);
        // target type: heal/revive/buff => ally; else enemy
        if (sk.type === 'heal' || sk.type === 'revive' || sk.type === 'buff') this._enterTarget('skill', 'ally', this.selectedSkill);
        else this._enterTarget('skill', 'enemy', this.selectedSkill);
      };
    });
  }
  _showItems(m) {
    const sl = document.getElementById('btl-skill-list');
    sl.classList.remove('hidden');
    this._subMenu = 'item';
    const items = GAME.inventory.listItems();
    sl.innerHTML = items.map(it => `<button data-it="${it.id}">${it.icon||''} ${it.name} ×${it.count}</button>`).join('') + `<button data-it="back">↩ Retour</button>`;
    sl.querySelectorAll('button[data-it]').forEach(b => b.onclick = () => {
      if (b.dataset.it === 'back') { sl.classList.add('hidden'); this._subMenu = null; return; }
      this._subMenu = null;
      // For simplicity, items target ally
      this._itemTarget = b.dataset.it;
      this._enterTarget('item', 'ally', b.dataset.it);
    });
  }

  _enterTarget(kind, side = 'enemy', skillId = null) {
    this.phase = 'target';
    this._targetKind = kind; this._targetSide = side; this._targetSkill = skillId; this._targetItem = skillId;
    if (side === 'enemy') this.targetList = this.battle.enemies.filter(e => e.alive);
    else this.targetList = this.battle.party.filter(p => p.alive || kind === 'revive');
    this.targetIdx = 0;
    this._renderTargets();
  }
  _renderTargets() {
    // highlight enemies
    if (this._targetSide === 'enemy') {
      this._renderEnemies();
    } else {
      this._renderParty();
    }
    // Show target info tooltip
    this._showTargetInfo();
  }

  _showTargetInfo() {
    const target = this.targetList[this.targetIdx];
    if (!target) return;
    const fl = document.getElementById('btl-float'); if (!fl) return;
    // Remove old tooltip
    const old = fl.querySelector('.btl-target-info');
    if (old) old.remove();
    const div = document.createElement('div');
    div.className = 'btl-target-info';
    div.style.cssText = `
      position:fixed; bottom:200px; left:50%; transform:translateX(-50%);
      background:rgba(6,8,14,0.92); border:1px solid var(--gold);
      border-radius:12px; padding:10px 18px;
      font-size:0.85rem; z-index:30;
      pointer-events:none;
      display:flex; gap:16px; align-items:center;`;
    const hpPct = Math.max(0, (target.hp / target.maxHp) * 100);
    const weakIcons = (target.element_weak || []).map(w => ({fire:'🔥',ice:'❄️',thunder:'⚡',holy:'🌟',dark:'🌑',water:'🌊'})[w] || w).join(' ');
    const statusIcons = target._status ? Object.keys(target._status).filter(k => target._status[k] > 0).map(k => ({poison:'☠️',blind:'👁️',curse:'🔮',silence:'🔇',def_down:'🛡️⬇'})[k] || '⚠️').join(' ') : '';
    div.innerHTML = `
      <span style="font-weight:700;color:var(--gold)">${target.label || target.name}</span>
      <span style="color:${hpPct > 50 ? 'var(--green)' : hpPct > 25 ? '#f39c12' : 'var(--red)'}">HP ${target.hp}/${target.maxHp}</span>
      ${weakIcons ? `<span style="color:var(--muted)">Faiblesse: ${weakIcons}</span>` : ''}
      ${statusIcons ? `<span>${statusIcons}</span>` : ''}`;
    fl.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }
  _selectEnemy(i) {
    audio.sfx('confirm');
    const m = this.battle.activeUnit;
    const target = this.battle.enemies[i];
    // Trigger attack animation
    if (m && target) this._triggerCombatAnim(m, target, this._targetKind);
    if (this._targetKind === 'basic') {
      this.battle.memberAttack(m, target);
      if (m) m._lastAction = { type: 'attack', skillId: null, itemId: null, targetIsAlly: false };
    } else if (this._targetKind === 'skill') {
      this.battle.memberSkill(m, this._targetSkill, target);
      if (m) m._lastAction = { type: 'skill', skillId: this._targetSkill, itemId: null, targetIsAlly: false };
    }
    this.phase = 'idle';
    this._render();
    this._cmdIdx = 0;
  }

  // Trigger character animations for attacks
  _triggerCombatAnim(attacker, target, kind) {
    const cw = this._battleCanvas?.canvas.width || window.innerWidth;
    const ch = this._battleCanvas?.canvas.height || window.innerHeight;
    // Attacker position
    let ax, ay, tx, ty;
    if (attacker.isEnemy) {
      const ai = this.battle?.enemies.indexOf(attacker) || 0;
      ax = cw * (0.2 + ai * 0.25); ay = ch * 0.3;
    } else {
      const ai = this.battle?.party.indexOf(attacker) || 0;
      ax = cw * (0.15 + ai * 0.2); ay = ch * 0.75;
    }
    if (target.isEnemy) {
      const ti = this.battle?.enemies.indexOf(target) || 0;
      tx = cw * (0.2 + ti * 0.25); ty = ch * 0.3;
    } else {
      const ti = this.battle?.party.indexOf(target) || 0;
      tx = cw * (0.15 + ti * 0.2); ty = ch * 0.75;
    }
    const isSkill = kind === 'skill';
    this._startAnim(attacker, isSkill ? 'cast' : 'attack', { startX: ax, startY: ay, targetX: tx, targetY: ty });
    this._startAnim(target, 'hit');
  }
  _selectAlly(i) {
    audio.sfx('confirm');
    const m = this.battle.activeUnit;
    const target = this.targetList[i];
    // Heal/buff animation
    if (m && target) this._triggerCombatAnim(m, target, 'skill');
    if (this._targetKind === 'skill') {
      this.battle.memberSkill(m, this._targetSkill, target);
      if (m) m._lastAction = { type: 'skill', skillId: this._targetSkill, itemId: null, targetIsAlly: true };
    } else if (this._targetKind === 'item') {
      // consume item (basic heal effect)
      const itDef = GAME.inventory.listItems().find(it => it.id === this._targetItem);
      GAME.inventory.remove(this._targetItem, 1);
      // Item visual FX
      if (itDef?.heal || itDef?.revive) {
        const cw = this._battleCanvas?.canvas.width || window.innerWidth;
        const ch = this._battleCanvas?.canvas.height || window.innerHeight;
        let tx = cw * 0.5, ty = ch * 0.5;
        if (this.battle?.party) {
          const idx = this.battle.party.indexOf(target);
          if (idx >= 0) { tx = cw * (0.15 + idx * 0.2); ty = ch * 0.75; }
        }
        canvas.addParticle(FX.spellHeal.create(tx, ty - 20));
        canvas.addParticle(FX.burst.create(tx, ty, '#2ecc71'));
        canvas.screenShake(3, 100);
      }
      if (itDef?.heal) target.hp = Math.min(target.maxHp, target.hp + itDef.heal);
      if (itDef?.revive && !target.alive) { target.alive = true; target.hp = itDef.heal || 100; }
      if (itDef?.cure) for (const st of itDef.cure) target._status?.[st] && (delete target._status[st]);
      this.battle.log.push(`${m.name} utilise ${itDef?.name}.`);
      this.battle.onStateChange({ type: 'heal', unit: target, amount: itDef?.heal || 0, skill: itDef?.name });
      audio.sfx('magic_cure');
      if (m) m._lastAction = { type: 'item', skillId: null, itemId: this._targetItem, targetIsAlly: true };
    }
    this.phase = 'idle';
    this._render();
    this._cmdIdx = 0; // reset command highlight for next character
  }

  // Helper: get enemy X position on canvas
  _drawEnemyX(e) {
    const enemies = this.battle?.enemies || [];
    const idx = enemies.indexOf(e);
    if (idx < 0) return 0;
    const w = this._battleCanvas?.canvas.width || window.innerWidth;
    return w * (0.2 + idx * (0.6 / Math.max(enemies.length - 1, 1)));
  }

  _onState(ev) {
    if (ev.type === 'ready') { /* nothing */ }
    else if (ev.type === 'command') { this.phase = 'command'; this._cmdIdx = 0; this._subMenu = null; this._render(); }
    else if (ev.type === 'damage') {
      const uid = ev.unit;
      let ux = 0, uy = 0;
      if (uid.isEnemy) {
        const idx = this.battle.enemies.indexOf(uid);
        ux = this._battleCanvas.canvas.width * (0.2 + idx * 0.25);
        uy = this._battleCanvas.canvas.height * 0.3;
      } else {
        const idx = this.battle.party.indexOf(uid);
        ux = this._battleCanvas.canvas.width * (0.15 + idx * 0.2);
        uy = this._battleCanvas.canvas.height * 0.75;
      }
      // Enemy attack anim (from attacker)
      if (ev.attacker && ev.attacker.isEnemy && uid) {
        this._triggerCombatAnim(ev.attacker, uid, 'attack');
      }
      // Hit reaction on target (if not already reacting)
      const hitId = this._getAnimId(uid);
      if (hitId && (!this._charAnims[hitId] || this._charAnims[hitId].state === 'idle')) {
        this._startAnim(uid, 'hit');
      }
      // Float label with priority stacking
      let floatLabel = `-${ev.amount}`;
      let floatClass = 'damage';
      if (ev.isCrit) {
        floatLabel = `CRIT! -${ev.amount}`;
        floatClass = 'crit';
      }
      if (ev.weaknessHit) {
        floatLabel = `-${ev.amount} ⚡FAIBLE`;
        floatClass = 'weakness';
      }
      if (ev.focusBreak) {
        floatLabel = `-${ev.amount} ☯FOCUS BREAK!`;
        floatClass = 'focus';
      }
      if (ev.comboCount > 1) {
        floatLabel += ` ×${ev.comboCount}`;
        // Dedicated combo chain popup
        this._showComboChain(ev.comboCount, ev.unit);
      }
      this._float(floatLabel, ev.unit, floatClass);
      audio.sfx(ev.isMagic ? 'magic_' + (ev.element || 'fire') : 'hit');
      this._spawnHitMark();
      // Element tint + rim flash on element attacks
      if (ev.element && ev.element !== 'none') this._triggerElementTint(ev.element);

      // Extra visuals
      const ch = this._battleCanvas?.canvas.height || window.innerHeight;
      if (ev.isCrit && this._battleCanvas) {
        // CRITICAL: giant star burst + heavy shake
        audio.sfx('crit');
        canvas.addParticle(FX.critImpact.create(ux, uy, '#f1c40f'));
        canvas.screenShake(8, 350);
        // Extra screen-wide flash
        const f = document.createElement('div'); f.id = 'hit-flash';
        f.style.background = `rgba(255,255,255,0.12)`;
        document.body.appendChild(f); setTimeout(() => f.remove(), 300);
        // Crit banter from attacker
        const attacker = ev.attacker;
        if (attacker && !attacker.isEnemy) this._say('crit_landed', attacker);
      } else if (ev.weaknessHit && this._battleCanvas) {
        canvas.addParticle(FX.burst.create(ux, uy, '#f1c40f'));
        canvas.screenShake(5, 200);
      }
      // Elemental spell effect
      if (ev.amount >= 80 && !ev.isCrit) {
        canvas.addParticle(FX.burst.create(ux, uy, ev.weaknessHit ? '#f1c40f' : '#e74c3c'));
        canvas.screenShake(6, 250);
      }
      if (ev.element === 'fire') canvas.addParticle(FX.spellFire.create(ux, uy - 20));
      else if (ev.element === 'ice') { canvas.addParticle(FX.spellIce.create(ux, uy - 20)); canvas.addParticle(FX.gel.create(ux, uy - 10)); }
      else if (ev.element === 'thunder') { canvas.addParticle(FX.spellThunder.create(ux, uy - 30)); canvas.addParticle(FX.zap.create(ux, uy)); }
      else if (ev.element === 'water') canvas.addParticle(FX.bulles.create(ux, uy));
      else if (ev.element === 'dark') { canvas.addParticle(FX.spellDark.create(ux, uy - 20)); canvas.addParticle(FX.ombre.create(ux, uy)); }
      else if (ev.element === 'poison') canvas.addParticle(FX.spellPoison.create(ux, uy));
      else if (ev.element === 'holy') canvas.addParticle(FX.spellHoly.create(ux, uy - 30));
      else if (!ev.isCrit) canvas.addParticle(FX.spellSlash.create(ux, uy, ux + 40, uy));
    }
    else if (ev.type === 'focus_ready') {
      const name = ev.unit?.name || 'Unité';
      this._float('⚡FOCUS! ' + name, ev.unit, 'focus');
      audio.sfx('magic_cure');
      if (!ev.unit?.isEnemy) this._say('focus_ready', ev.unit);
      // Dragon aura visual effect on the canvas
      if (this._battleCanvas) {
        const cw = this._battleCanvas.canvas.width;
        const ch = this._battleCanvas.canvas.height;
        let fx, fy;
        if (ev.unit.isEnemy) {
          const idx = this.battle?.enemies.indexOf(ev.unit) || 0;
          fx = cw * (0.2 + idx * 0.25);
          fy = ch * 0.3;
        } else {
          const idx = this.battle?.party.indexOf(ev.unit) || 0;
          fx = cw * (0.15 + idx * 0.2);
          fy = ch * 0.75;
        }
        canvas.addParticle(FX.burst.create(fx, fy, '#9b59b6'));
      }
    }
    else if (ev.type === 'dragon_form') {
      const name = ev.unit?.name || 'Unité';
      if (ev.active) {
        this._float(`🐉 DRAGON! ${name}`, ev.unit, 'focus');
        audio.sfx('dragon_transform');
        canvas.screenShake(6, 300);
        if (!ev.unit?.isEnemy) this._say('dragon_form', ev.unit);
        // Epic dragon transformation burst
        if (this._battleCanvas) {
          const cw = this._battleCanvas.canvas.width;
          const ch = this._battleCanvas.canvas.height;
          let fx, fy;
          if (ev.unit.isEnemy) {
            const idx = this.battle?.enemies.indexOf(ev.unit) || 0;
            fx = cw * (0.2 + idx * 0.25); fy = ch * 0.3;
          } else {
            const idx = this.battle?.party.indexOf(ev.unit) || 0;
            fx = cw * (0.15 + idx * 0.2); fy = ch * 0.75;
          }
          canvas.addParticle(FX.deathBurst.create(fx, fy, '#9b59b6'));
        }
      } else {
        this._float(`Dragon dissipé`, ev.unit, 'heal');
      }
    }
    else if (ev.type === 'heal') {
      const uid = ev.unit;
      const cw = this._battleCanvas?.canvas.width || window.innerWidth;
      const ch = this._battleCanvas?.canvas.height || window.innerHeight;
      let ux = cw * 0.5, uy = ch * 0.5;
      if (uid.isEnemy) {
        const idx = this.battle.enemies.indexOf(uid);
        ux = cw * (0.2 + idx * 0.25);
        uy = ch * 0.3;
      } else {
        const idx = this.battle.party.indexOf(uid);
        ux = cw * (0.15 + idx * 0.2);
        uy = ch * 0.75;
      }
      this._float(`+${ev.amount}`, ev.unit, 'heal'); audio.sfx('magic_cure');
      canvas.addParticle(FX.spellHeal.create(ux, uy - 20));
    }
    else if (ev.type === 'telegraph') {
      // Enemy attack telegraph: show attack name floating from enemy + impact flash
      const atkName = ev.attackName || 'Attaque';
      const elementIcon = { fire:'🔥', ice:'❄️', thunder:'⚡', holy:'🌟', dark:'🌑', none:'⚔' }[ev.element] || '⚔';
      this._float(`${elementIcon} ${atkName} !`, ev.unit, 'focus');
      // Screen flash tinted by element
      const elementColor = { fire:'rgba(231,76,60,0.12)', ice:'rgba(52,152,219,0.12)', thunder:'rgba(241,196,15,0.12)', holy:'rgba(255,255,255,0.10)', dark:'rgba(74,20,140,0.12)', none:'rgba(255,255,255,0.06)' };
      const f = document.createElement('div'); f.id = 'hit-flash';
      f.style.background = elementColor[ev.element] || 'rgba(255,255,255,0.06)';
      document.body.appendChild(f); setTimeout(() => f.remove(), 300);
      // Element tint for telegraph
      if (ev.element && ev.element !== 'none') this._triggerElementTint(ev.element);
    }
    else if (ev.type === 'msg' && ev.phaseChange) {
      // Boss phase change — screen shake + flash + party banter
      canvas.screenShake(8, 400);
      const f = document.createElement('div'); f.id = 'hit-flash';
      f.style.background = 'rgba(155,89,182,0.25)';
      document.body.appendChild(f); setTimeout(() => f.remove(), 400);
      // Party reacts to boss phase
      const alive = this.battle?.party?.filter(m => m.alive) || [];
      if (alive.length > 0) {
        const responder = alive[Math.floor(Math.random() * alive.length)];
        this._say('boss_phase', responder);
      }
    }
    else if (ev.type === 'msg' && ev.counter) {
      // Dragon Counter flash
      const f = document.createElement('div'); f.id = 'hit-flash';
      f.style.background = 'rgba(155,89,182,0.15)';
      document.body.appendChild(f); setTimeout(() => f.remove(), 300);
      canvas.screenShake(4, 150);
      // Get the countering character
      const txt = ev.text || '';
      const nameMatch = txt.match(/(\w+):/);
      if (nameMatch) {
        const counterUnit = this.battle?.party?.find(m => m.name === nameMatch[1]);
        if (counterUnit) this._say('counter', counterUnit);
      }
    }
    else if (ev.type === 'ko') {
      // Start dying animation
      this._startAnim(ev.unit, 'dying');
      if (ev.unit.isEnemy) {
        const idx = this.battle.enemies.indexOf(ev.unit);
        const ux = this._battleCanvas?.canvas.width * (0.2 + idx * 0.25) || 0;
        const uy = this._battleCanvas?.canvas.height * 0.3 || 0;
        // Element-matching death burst
        const e = ev.unit;
        const deathColor = e.element_weak?.[0]
          ? ({fire:'#e74c3c',ice:'#3498db',thunder:'#f1c40f',holy:'#ecf0f1',dark:'#4a148c',water:'#2980b9'})[e.element_weak[0]] || '#555'
          : '#555';
        // Multi-burst death dissolve (2-3 bursts with stagger)
        canvas.addParticle(FX.deathBurst.create(ux, uy, deathColor));
        setTimeout(() => canvas.addParticle(FX.deathBurst.create(ux - 15, uy + 20, deathColor)), 150);
        setTimeout(() => canvas.addParticle(FX.deathBurst.create(ux + 15, uy - 10, '#f1c40f')), 300);
        canvas.screenShake(6, 350);
        // Screen dim pulse on enemy death
        this._lightningFlashes.push({ timer: 8, x: 0, decay: 0.3 });
      } else {
        // Ally KO — party reacts
        const alive = this.battle?.party?.filter(m => m.alive && m !== ev.unit) || [];
        if (alive.length > 0) {
          const responder = alive[Math.floor(Math.random() * alive.length)];
          this._say('ally_ko', responder);
        }
      }
      audio.sfx(ev.unit.isEnemy ? 'enemy_die' : 'ally_die');
    }
    else if (ev.type === 'end') { this._endBattle(ev.result); }
    else if (ev.type === 'status_apply') {
      const icons = { poison: '☠️', blind: '👁️‍🗨️', curse: '🔮', silence: '🔇', def_down: '🛡️⬇' };
      this._float(`${icons[ev.status] || '⚠️'} ${ev.status.toUpperCase()} !`, ev.unit, 'status');
      audio.sfx('magic_dark');
    }
    else if (ev.type === 'status_tick') {
      if (ev.status === 'poison') {
        this._float(`☠️ -${ev.damage} (poison)`, ev.unit, 'poison_tick');
        // Red tint flash on poisoned unit
        const f = document.createElement('div');
        f.style.cssText = 'position:fixed;inset:0;z-index:55;background:rgba(39,174,96,0.1);pointer-events:none;';
        document.body.appendChild(f); setTimeout(() => f.remove(), 200);
      }
    }
    else if (ev.type === 'status_end') {
      const icons = { poison: '☠️', blind: '👁️‍🗨️', curse: '🔮', silence: '🔇', def_down: '🛡️⬇' };
      this._float(`${icons[ev.status] || '⚠️'} dissipé`, ev.unit, 'heal');
    }
    this._render();
  }

  _float(text, unit, cls) {
    const fl = document.getElementById('btl-float'); if (!fl) return;
    const span = document.createElement('span');
    span.className = 'btl-float-txt ' + cls;
    span.textContent = text;
    // position relative to unit slot (just party slot or enemy slot)
    let x = 50, y = 50;
    if (this.battle.party.includes(unit)) {
      x = (this.battle.party.indexOf(unit) + 0.5) * 200 + 60; y = window.innerHeight - 120;
    } else if (this.battle.enemies.some(e => e === unit ? true : e.id === unit.id)) {
      const idx = this.battle.enemies.findIndex(e => e === unit);
      x = (idx + 1) * (window.innerWidth / (this.battle.enemies.length + 1)); y = 180;
    }
    span.style.left = x + 'px'; span.style.top = y + 'px';
    fl.appendChild(span);
    span.animate([
      { transform: 'translateY(0)', opacity: 1 },
      { transform: 'translateY(-60px)', opacity: 0 },
    ], { duration: 900, easing: 'cubic-bezier(0.32,0.72,0,1)' });
    setTimeout(() => span.remove(), 1000);
  }

  _showComboChain(count, unit) {
    const container = document.getElementById('btl-float');
    if (!container) return;
    // Remove old chain popup if exists
    const old = document.getElementById('combo-chain-popup');
    if (old) old.remove();
    // Chain bonus text
    const bonus = Math.round((count - 1) * 25);
    const colors = ['#fff', '#f1c40f', '#e67e22', '#e74c3c', '#9b59b6', '#1abc9c'];
    const color = colors[Math.min(count, colors.length - 1)];
    const popup = document.createElement('div');
    popup.id = 'combo-chain-popup';
    popup.style.cssText = `
      position:fixed; left:50%; top:35%; transform:translate(-50%,-50%) scale(0.5);
      z-index:60; pointer-events:none; text-align:center;
      font-family:var(--serif); font-weight:900; color:${color};
      text-shadow:0 0 20px ${color}, 0 2px 4px rgba(0,0,0,0.8);
      transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease;
      opacity:0;
    `;
    popup.innerHTML = `
      <div style="font-size:clamp(1.8rem,4vw,3rem);letter-spacing:0.08em;">CHAIN ×${count}</div>
      <div style="font-size:clamp(0.9rem,2vw,1.3rem);color:#f1c40f;margin-top:4px;">+${bonus}% BONUS</div>
    `;
    document.body.appendChild(popup);
    // Animate in
    requestAnimationFrame(() => {
      popup.style.transform = 'translate(-50%,-50%) scale(1)';
      popup.style.opacity = '1';
    });
    // Screen shake on high chains
    if (count >= 3) canvas.screenShake(2 + count, 200);
    // Flash on 5-chain
    if (count >= 5) {
      const f = document.createElement('div');
      f.style.cssText = `position:fixed;inset:0;z-index:55;background:${color};opacity:0.15;pointer-events:none;`;
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 300);
    }
    // Fade out
    setTimeout(() => {
      popup.style.transform = 'translate(-50%,-60%) scale(0.8)';
      popup.style.opacity = '0';
      setTimeout(() => popup.remove(), 400);
    }, 1200);
  }

  _spawnHitMark() {
    // screen flash red
    const f = document.createElement('div'); f.id = 'hit-flash';
    document.body.appendChild(f); setTimeout(() => f.remove(), 250);
  }

  // ─── Battle banter ─────────────────────────────────────────────────
  _say(context, unit) {
    if (!unit) return;
    const charId = unit.id || 'narrator';
    const line = getBanter(charId, context);
    if (line) {
      const speaker = unit.name || '???';
      this._float(`💬 ${speaker}: "${line}"`, unit, 'focus');
    }
  }

  _endBattle(result) {
    if (result === 'win') {
      // Post-battle auto-regen (Breath of Fire style): 20% HP / 10% MP
      for (const m of this.battle?.party || []) {
        if (m.alive) {
          m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * 0.2));
          m.mp = Math.min(m.maxMp, m.mp + Math.floor(m.maxMp * 0.1));
        }
      }
      // distribute loot
      const reward = {
        exp: this._lastExp || 0,
        ap: this._lastAp || 0,
        gil: this._lastGil || 0,
        drops: this._lastDrops || [],
      };
      const reports = grantBattleLoot(GAME.party, reward, GAME.inventory);
      audio.sfx('victory');
      // Victory animation on all alive party members
      for (const m of (this.battle?.party || [])) {
        if (m.alive) this._startAnim(m, 'victory');
      }
      // Victory banter from alive party member
      const aliveForBanter = (this.battle?.party || []).filter(m => m.alive);
      if (aliveForBanter.length > 0) {
        const victor = aliveForBanter[Math.floor(Math.random() * aliveForBanter.length)];
        this._say('victory', victor);
      }
      // ─── PREMIUM VICTORY SCREEN ──────────────────────────────────────
      this._showVictoryScreen(reports, reward);
    } else if (result === 'lose') {
      audio.sfx('ally_die');
      setTimeout(() => { this._close(); GAME.scene = 'gameover'; this.onLose && this.onLose(); }, 1200);
    } else {
      // flee
      setTimeout(() => { this._close(); this.onFlee && this.onFlee(); }, 600);
    }
  }
  _showVictoryScreen(reports, reward) {
    // Remove the DOM battle UI but keep canvas showing
    if (this._keyHandler) { window.removeEventListener('keydown', this._keyHandler); this._keyHandler = null; }
    if (this.root) { this.root.remove(); this.root = null; }
    audio.setIntensity(0);
    // Build premium victory card
    const screen = document.createElement('div');
    screen.id = 'btl-victory';
    const totalExp = reward.exp || 0;
    const aliveMembers = this.battle?.party.filter(m => m.alive) || [];
    const perMember = Math.floor(totalExp / Math.max(1, aliveMembers.length));
    const lvlUps = reports.filter(r => r.type === 'levelup');
    const drops = reports.filter(r => r.type === 'drop');
    const skillLearns = reports.filter(r => r.type === 'skillLearned');

    // Build per-member EXP bars
    const memberBars = aliveMembers.map((m, i) => {
      const expForNext = m.nextLevelExp || 100;
      const prevExp = m.exp || 0;
      const newExp = prevExp + perMember;
      const pct = Math.min(100, (newExp % expForNext) / expForNext * 100);
      const prevPct = Math.min(100, (prevExp % expForNext) / expForNext * 100);
      const didLevel = lvlUps.some(l => l.member === m);
      return `
        <div class="btl-vic-member" style="animation-delay:${0.3 + i * 0.15}s">
          <div class="vic-member-name">${m.name} <span class="vic-member-lv">Lv.${m.level}</span></div>
          <div class="vic-exp-bar">
            <div class="vic-exp-fill" data-pct="${pct}" data-prev="${prevPct}" style="width:${prevPct}%"></div>
          </div>
          <div class="vic-exp-text">+${perMember} EXP</div>
          ${didLevel ? '<div class="vic-levelup-badge">⬆ LEVEL UP!</div>' : ''}
        </div>`;
    }).join('');

    screen.innerHTML = `
      <div class="go-bg" style="background:url('sprites/ui/victory_bg.png') center/cover no-repeat"></div>
      <div class="btl-victory-inner">
        <div class="vic-title-group">
          <h1 class="vic-title">⚔ VICTOIRE ⚔</h1>
          <p class="vic-subtitle">L'étreinte du dragon vous a rendu plus forts.</p>
        </div>
        <div class="btl-vic-grid">
          <div class="btl-vic-item" style="animation-delay:0.2s">
            <div class="vic-icon">⚡</div>
            <div class="vic-number" data-count="${totalExp}">0</div>
            <div class="vic-label">EXP</div>
          </div>
          <div class="btl-vic-item" style="animation-delay:0.3s">
            <div class="vic-icon">📖</div>
            <div class="vic-number" data-count="${reward.ap || 0}">0</div>
            <div class="vic-label">PA</div>
          </div>
          <div class="btl-vic-item" style="animation-delay:0.4s">
            <div class="vic-icon">💰</div>
            <div class="vic-number" data-count="${reward.gil || 0}">0</div>
            <div class="vic-label">GIL</div>
          </div>
        </div>
        <div class="btl-vic-members">${memberBars}</div>
        ${lvlUps.length > 0 ? lvlUps.map((l, i) => `
          <div class="btl-vic-lvlup" style="animation-delay:${0.8 + i * 0.2}s">
            <span class="lvlup-glow"></span>
            ⬆ ${l.member.name} monte au niveau <strong>${l.newLevel}</strong> !
          </div>
        `).join('') : ''}
        ${drops.length > 0 ? `<div class="btl-vic-loot">${drops.map((d, i) => `
          <span class="vic-drop-item" style="animation-delay:${1.0 + i * 0.15}s">
            <span class="drop-sparkle">✦</span>🎁 ${d.item}
          </span>
        `).join('')}</div>` : ''}
        ${skillLearns.length > 0 ? skillLearns.map((s, i) => `
          <div class="btl-vic-lvlup" style="border-color:rgba(155,89,182,0.3);background:rgba(155,89,182,0.08);color:#9b59b6;animation-delay:${1.2 + i * 0.2}s;">
            🌟 ${s.member.name} apprend une nouvelle compétence !
          </div>
        `).join('') : ''}
        <button class="btl-vic-continue" style="animation-delay:1.5s">Continuer</button>
      </div>`;
    document.body.appendChild(screen);

    // Animate EXP bars after a beat
    setTimeout(() => {
      screen.querySelectorAll('.vic-exp-fill').forEach(bar => {
        const target = bar.dataset.pct;
        bar.style.width = target + '%';
      });
    }, 600);

    // Animate counter numbers
    screen.querySelectorAll('.vic-number[data-count]').forEach(el => {
      const target = parseInt(el.dataset.count) || 0;
      if (target === 0) return;
      let current = 0;
      const step = Math.max(1, Math.ceil(target / 30));
      const iv = setInterval(() => {
        current = Math.min(target, current + step);
        el.textContent = current;
        if (current >= target) clearInterval(iv);
      }, 30);
    });

    // Click to continue
    screen.querySelector('.btl-vic-continue').onclick = () => {
      screen.remove();
      this._close();
      if (this.onWin) this.onWin(reports, reward);
    };
  }

  _close() {
    audio.setIntensity(0);
    // Restore previous scene music (field.js will also call playScene — redundant but harmless)
    const prev = GAME.prevScene || 'field';
    if (prev === 'field' || prev === 'town') audio.playScene(prev);
    if (this._keyHandler) { window.removeEventListener('keydown', this._keyHandler); this._keyHandler = null; }
    if (this.root) { this.root.remove(); this.root = null; }
    if (this._battleCanvas) {
      if (this._boundTick) this._battleCanvas._offTick(this._boundTick);
      canvas.removeLayer(this._battleCanvas);
      this._battleCanvas = null;
    }
    this._boundTick = null;
    GAME.scene = prev;
    this.battle = null;
  }
  _tick() {}
}

function enemyIcon(model) {
  const map = {
    goblin:'👺', fuse:'💥', skeleton:'💀', bomb:'💣', ironite:'⚙',
    plant:'🌿', darkknight:'⚔', kuja:'🌑',
  };
  return map[model] || '👾';
}

export const battleUI = new BattleUI();
