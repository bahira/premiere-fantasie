// scenes/field.js — Overworld / field scene (story mode + explore mode)
// EXPLORE MODE: WASD movement, encounter zones, POIs, transitions.
// STORY MODE: dialogue → battle → advance (classic mode).

import { fastSin, fastCos } from '../engine/wasm_bridge.js';
import { GAME, currentChapter, advanceChapter } from '../state.js';
import { dialogue } from '../engine/dialogue.js';
import { battleUI } from '../ui/battle_ui.js';
import { audio } from '../engine/audio.js';
import { STORY } from '../data/story.js';
import { canvas } from '../renderer/canvas.js';
import { drawBiome } from '../renderer/scenes.js';
import { applyPostFX } from '../renderer/scenes.js';
import { drawWeatherOverlay, getBiomeWeather, drawAmbientParticles } from '../renderer/scenes.js';
import { FieldMap } from '../engine/field_map.js';
import { FX } from '../renderer/effects.js';
import { keyboard } from '../engine/keyboard.js';
import { ExploreThree } from '../renderer/three_explore.js';

export class FieldScene {
  constructor() {
    this.root = null;
    this.mode = 'story'; // 'story' | 'explore'
    this.fieldMap = null;
    this._mapKeyHandler = null;
    this._mapUpHandler = null;
    this._savedMapState = null; // for re-entering map after flee
  }

  show() {
    GAME.scene = 'field';
    this._fieldCanvas = canvas.addLayer(1);
    canvas.start();
    this._frame = 0;
    this._build();
    this._playChapter();
  }

  _build() {
    if (this.root) this.root.remove();
    this.root = document.createElement('div');
    this.root.id = 'field-ui';
    this.root.innerHTML = `
      <div id="field-frame">
        <div id="field-scene-art"></div>
        <div id="field-overlay">
          <div id="field-hud-top">
            <span id="ff-hp"></span>
            <span id="ff-chap"></span>
          </div>
          <div id="field-actions"></div>
          <div id="field-explore-hud" class="hidden"></div>
        </div>
      </div>`;
    document.body.appendChild(this.root);
  }

  _playChapter() {
    const ch = currentChapter();
    audio.setIntensity(0);
    if (!ch) { this._theEnd(); return; }

    // Location → music scene mapping (all 16 tracks used)
    const biomeMusicMap = {
      forest:        'darkforest',       // Ashen Covenant — mystical forest
      cave:          'cave',             // Glass Trial — mysterious dungeon
      town_lindblum: 'town',             // Lanterns Over Brine — warm village
      desert:        'desert',           // Blackened Crown — desert exploration
      magic_tree:    'town_forest',      // Lanterns of Ashenvale — mystical forest town
      palace:        'town_royal',       // Shtetl Crown — royal palace
      crystal_world: 'boss_rift',        // Rift of Refantazio — dimension boss
      steampunk:     'town_steampunk',   // Machina Veil — industrial city
      void:          'boss_rift',        // Rift of Refantazio — alternate realm
    };

    // Boss chapters use special music
    const bossChapters = [9, 12]; // chapter IDs with boss fights
    const isBossChapter = bossChapters.includes(ch.id);

    let musicScene;
    if (isBossChapter) {
      musicScene = ch.id === 12 ? 'final_boss' : 'boss';
    } else {
      musicScene = ch.isTown ? 'town' : (biomeMusicMap[ch.location] || 'field');
    }

    audio.playScene(musicScene);
    this._render(ch);

    if (ch.map) {
      // ─── EXPLORE MODE ──────────────────────────────────────────────
      this.mode = 'explore';
      this._initMap(ch);
      if (ch.scenes?.length) {
        dialogue.play(ch.scenes.slice(), () => this._startExplore(ch));
      } else {
        this._startExplore(ch);
      }
    } else {
      // ─── STORY MODE (original flow) ─────────────────────────────────
      this.mode = 'story';
      if (ch.scenes?.length) {
        dialogue.play(ch.scenes.slice(), () => this._afterDialogue(ch));
      } else {
        this._afterDialogue(ch);
      }
    }
  }

  _render(ch) {
    const art = document.getElementById('field-scene-art');
    const chap = document.getElementById('ff-chap');
    if (art) art.dataset.biome = ch.location || 'forest';
    if (chap) chap.textContent = `Chapitre ${ch.id}/${STORY.chapters.length} — ${ch.title}`;
    this._updateHud();
  }

  _updateHud() {
    const hp = document.getElementById('ff-hp');
    if (hp && GAME.party.length) {
      hp.innerHTML = GAME.party.map(m => {
        const pMap = { zidane:'thief_sprite.png', luan:'thief_sprite.png', knight:'knight_sprite.png',
          aldric:'knight_sprite.png', mage:'mage_sprite.png', mira:'mage_sprite.png',
          healer:'healer_sprite.png', selia:'healer_sprite.png' };
        const sprite = pMap[m.id] || pMap[m.name?.toLowerCase()] || '';
        const portrait = sprite ? `<img src="sprites/heroes/${sprite}" class="hud-mini-portrait" alt="${m.name}">` : '';
        const hpPct = Math.max(0, (m.hp / (m.maxHp || 1)) * 100);
        const hpColor = hpPct > 60 ? '#2ecc71' : hpPct > 25 ? '#f39c12' : '#e74c3c';
        return `<span class="hud-party-member"><span class="hud-portrait-wrap">${portrait}</span><span class="hud-member-info"><span class="hud-member-name">${m.name}</span><span class="hud-hp-bar"><span class="hud-hp-fill" style="width:${hpPct}%;background:${hpColor}"></span></span><span class="hud-hp-text">${m.hp}/${m.maxHp || '?'}</span></span></span>`;
      }).join('');
    }
  }

  // ─── EXPLORE MODE ───────────────────────────────────────────────────
  _initMap(ch) {
    const md = ch.map;
    this.fieldMap = new FieldMap({
      startX: this._savedMapState?.x || md.startX || 100,
      startY: this._savedMapState?.y || md.startY || 300,
      width: md.width || 800, height: md.height || 600,
      bounds: md.bounds || { top: 30, bottom: 570, left: 30, right: 770 },
      encounterZones: md.encounterZones || [],
      pois: md.pois || [],
      speed: md.speed || 3,
    });
    this._savedMapState = null;

    // Set canvas for mouse click-to-move
    if (this._fieldCanvas) this.fieldMap.setCanvas(this._fieldCanvas.canvas);

    // Keyboard input via keyboard manager
    this._mapKeyHandler = (e) => {
      if (GAME.scene !== 'field') return;
      const key = e.key.toLowerCase();
      // Map physical keys to logical actions
      const action = keyboard.mapKey(e);
      if (key === 'e' || key === 'é') { // AZERTY also has É
        const poi = this.fieldMap?.interact();
        if (poi) { this._handlePOI(poi); return; }
        const npc = this.fieldMap?.interactNPC();
        if (npc) { this._handleNPC(npc); return; }
        return;
      }
      this.fieldMap?.keyDown(action);
    };
    this._mapUpHandler = (e) => {
      const action = keyboard.mapKey(e);
      this.fieldMap?.keyUp(action);
    };
    window.addEventListener('keydown', this._mapKeyHandler);
    window.addEventListener('keyup', this._mapUpHandler);

    // Show explore HUD with layout-aware labels
    const acts = document.getElementById('field-actions');
    const ehud = document.getElementById('field-explore-hud');
    if (acts) acts.classList.add('hidden');
    if (ehud) {
      ehud.classList.remove('hidden');
      const moveKey = keyboard.getLabel('up');
      const interactKey = keyboard.layout === 'azerty' ? 'É' : 'E';
      ehud.innerHTML = `
        <span style="color:var(--muted);font-size:0.8rem;">
          ${moveKey}/ZQSD: Déplacement &nbsp;|&nbsp; Clic: Se déplacer &nbsp;|&nbsp; ${interactKey}: Interagir
        </span>`;
    }

    // 3D low-poly character (Canvas 2D circle remains as fallback layer)
    this._initExplore3D();
  }

  _startExplore(ch) {
    this._fieldLoop();
  }

  // Build the Three.js low-poly character renderer (falls back to 2D circle
  // on the field canvas if WebGL init fails).
  _initExplore3D() {
    if (this._explore3d) return;
    this._exploreScale = (this._explore3d && this._exploreScale) || 0.12;
    try {
      this._explore3d = new ExploreThree(document.body, { scale: this._exploreScale });
      const leader = GAME.party[0];
      if (leader) this._explore3d.setCharacter(leader.id);
      this._explore3dOn = true;
    } catch (e) {
      // WebGL unavailable — keep the existing Canvas 2D circle fallback.
      console.warn('[field] ExploreThree disabled (WebGL init failed):', e);
      this._explore3d = null;
      this._explore3dOn = false;
    }
  }

  // Map the 2D field position to a Three.js world position.
  _exploreWorldPos() {
    if (!this.fieldMap) return { x: 0, y: 0 };
    const s = this._exploreScale;
    return {
      x: (this.fieldMap.player.x - this.fieldMap.width / 2) * s,
      y: (this.fieldMap.player.y - this.fieldMap.height / 2) * s,
    };
  }

  // Direction from current key state (-1..1 per axis) for facing + walk anim.
  _exploreInputDir() {
    const k = this.fieldMap._keys;
    let mx = 0, my = 0;
    if (k['w'] || k['arrowup']) my -= 1;
    if (k['s'] || k['arrowdown']) my += 1;
    if (k['a'] || k['arrowleft']) mx -= 1;
    if (k['d'] || k['arrowright']) mx += 1;
    if (mx !== 0 && my !== 0) { mx *= 0.7071; my *= 0.7071; }
    return { moveX: mx, moveY: my };
  }

  _fieldLoop() {
    if (GAME.scene !== 'field' || !this._fieldCanvas) return;
    this._frame = (this._frame || 0) + 1;
    const ctx = this._fieldCanvas.ctx;
    const w = this._fieldCanvas.canvas.width;
    const h = this._fieldCanvas.canvas.height;
    const ch = currentChapter();
    const biome = ch?.location || 'forest';
    const explore = this.mode === 'explore' && this.fieldMap;

    // Advance field map (movement + encounter check) BEFORE drawing so the
    // player is composited at its new position on dirty frames.
    let enc = null;
    if (explore) {
      enc = this.fieldMap.update();
      if (enc) { this._triggerBattle(enc); return; }
    }

    // 3D low-poly character: advance its world position + animation each frame
    // (the Canvas 2D circle below remains as a fallback layer).
    if (this._explore3dOn && this._explore3d) {
      const now = performance.now();
      const dt = Math.min(0.05, (this._lastT ? (now - this._lastT) : 16) / 1000);
      this._lastT = now;
      const wp = this._exploreWorldPos();
      const dir = this._exploreInputDir();
      this._explore3d.update(dt, { x: wp.x, y: wp.y, moveX: dir.moveX, moveY: dir.moveY });
    }

    // ── Caches (recreated only on resize) ────────────────────────────────
    if (!this._bgCache || this._bgCacheW !== w || this._bgCacheH !== h) {
      this._bgCache = document.createElement('canvas');
      this._bgCache.width = w; this._bgCache.height = h;
      this._bgCacheW = w; this._bgCacheH = h;
      this._compositeReady = false;
    }
    if (!this._frameCache || this._frameCacheW !== w || this._frameCacheH !== h) {
      this._frameCache = document.createElement('canvas');
      this._frameCache.width = w; this._frameCache.height = h;
      this._frameCacheW = w; this._frameCacheH = h;
      this._compositeReady = false;
    }

    // ── Dirty flag: only re-render when something actually changes ────────
    const redrawBg = (this._frame & 7) === 0;       // bg is expensive → every 8
    const inputActive = explore && this.fieldMap.isMoving();
    const dirty = redrawBg || inputActive || !this._compositeReady;

    if (redrawBg) {
      const bc = this._bgCache.getContext('2d');
      bc.clearRect(0, 0, w, h);
      drawBiome(bc, biome, w, h, this._frame);
    }

    if (dirty) {
      const fc = this._frameCache.getContext('2d');
      fc.clearRect(0, 0, w, h);

      // Subtle parallax: blit bg twice (tiny offset) for cheap depth.
      fc.drawImage(this._bgCache, 0, 0);
      fc.globalAlpha = 0.45;
      fc.drawImage(this._bgCache, 4, 3);
      fc.globalAlpha = 1;

      // Weather + ambient (cheap; particle state is cached in scenes.js).
      // Throttled to every 4 frames to shave cost on idle/static scenes.
      if ((this._frame & 3) === 0) {
        const weatherType = getBiomeWeather(biome);
        drawWeatherOverlay(fc, w, h, this._frame, weatherType);
        drawAmbientParticles(fc, w, h, this._frame, biome);
      }

      // Day/night tint (moonlight gradient is cached in _drawDayNightTint).
      this._drawDayNightTint(fc, w, h, this._frame);

      if (explore) this.fieldMap.draw(fc, this._frame);

      // Post-FX baked into the cache so idle frames are free of per-frame FX
      // (and never flicker between processed / unprocessed blits).
      applyPostFX(fc, w, h, this._frame, { grain: 0.02, bloom: 0.12, chrom: 0.15, vignette: 0.25 });

      this._compositeReady = true;
    }

    // Visible canvas: just blit the cached composite (no recompute when idle).
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this._frameCache, 0, 0);

    // 3D character renders on top of the 2D map (independent of cache dirty flag).
    if (this._explore3dOn && this._explore3d) this._explore3d.render();

    requestAnimationFrame(() => this._fieldLoop());
  }

  _drawDayNightTint(ctx, w, h, frame) {
    // Cycle: 0=day, 0.25=dusk, 0.5=night, 0.75=dawn, 1=day
    const cycle = (frame % 3000) / 3000;
    let nightFactor;
    if (cycle < 0.25) nightFactor = 0;
    else if (cycle < 0.35) nightFactor = (cycle - 0.25) / 0.1;
    else if (cycle < 0.65) nightFactor = 1;
    else if (cycle < 0.75) nightFactor = 1 - (cycle - 0.65) / 0.1;
    else nightFactor = 0;
    if (nightFactor <= 0) return;
    ctx.save();
    ctx.globalAlpha = nightFactor * 0.25;
    ctx.fillStyle = '#0a0a2e';
    ctx.fillRect(0, 0, w, h);
    // Cache moonlight gradient
    if (!this._moonGrad || this._moonW !== w || this._moonH !== h) {
      this._moonGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      this._moonGrad.addColorStop(0, 'rgba(100,120,180,0.15)');
      this._moonGrad.addColorStop(1, 'transparent');
      this._moonW = w; this._moonH = h;
    }
    ctx.globalAlpha = nightFactor;
    ctx.fillStyle = this._moonGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  _handlePOI(poi) {
    if (poi.type === 'advance') {
      this._cleanupMap();
      this._fadeTransition(() => {
        advanceChapter();
        this._playChapter();
      });
    } else if (poi.type === 'rest') {
      for (const m of GAME.party) { m.hp = m.maxHp; m.mp = m.maxMp; m.alive = true; }
      audio.sfx('magic_cure');
      this._updateHud();
      this._floatMsg('💤 Repos complet !');
    } else if (poi.type === 'shop') {
      import('../ui/shop.js').then(s => s.shop.open());
      } else if (poi.type === 'save') {
        import('../engine/save.js').then(s => {
          const ok = s.saveGame(GAME);
          audio.sfx(ok ? 'save' : 'cancel');
          this._floatMsg(ok ? '💾 Sauvegardé.' : '❌ Échec.');
        });
      } else if (poi.type === 'chest') {
        this._openChest(poi);
      }
  }

  _handleNPC(npc) {
    if (!npc) return;
    const talkCount = this.fieldMap?.getTalkCount(npc.id) || 0;
    // Pick dialogue line: quest intro first time, then normal lines
    let line;
    if (npc.questgiver && talkCount === 0 && npc.questIntro) {
      line = npc.questIntro;
      // Grant quest reward on first talk if defined
      if (npc.questReward) {
        const r = npc.questReward;
        if (r.gold && GAME.inventory) GAME.inventory.addGold?.(r.gold);
        if (r.item && GAME.inventory) GAME.inventory.add?.(r.item.id, r.item.count || 1);
      }
    } else if (npc.lines && npc.lines.length > 0) {
      line = npc.lines[talkCount % npc.lines.length];
    } else {
      line = npc.dialogue || 'Salut, voyageur !';
    }
    this.fieldMap?.markTalked(npc.id);
    // Use the dialogue system
    import('../engine/dialogue.js').then(d => {
      const dlg = d.dialogue;
      dlg.show({
        speaker: npc.name || 'Villageois',
        portrait: npc.portrait || npc.role || 'villager',
        lines: Array.isArray(line) ? line : [line],
        onDone: () => { /* stay on map */ },
      });
      audio.sfx('cursor');
    });
  }

  _openChest(poi) {
    if (poi.opened) { this._floatMsg('Le coffre est vide.'); return; }
    poi.opened = true;
    audio.sfx('treasure');
    canvas.addParticle(FX.star.create(this.fieldMap.player.x, this.fieldMap.player.y - 10, '#f1c40f'));
    canvas.screenShake(4, 200);
    // Grant contents
    const contents = poi.contents || { gold: 100 };
    if (contents.gold) { GAME.inventory.addGold?.(contents.gold); }
    if (contents.item) { GAME.inventory.add?.(contents.item.id, contents.item.count || 1); }
    if (contents.item) {
      this._floatMsg(`✨ ${contents.item.count || 1}× ${this._itemName(contents.item.id)} !`);
    } else if (contents.gold) {
      this._floatMsg(`💰 +${contents.gold} Gil !`);
    } else {
      this._floatMsg('Le coffre était piégé... vide !');
    }
    // Mark chest as opened visually
    poi.icon = '📭';
    poi.label = 'Coffre (vidé)';
  }

  _itemName(id) {
    const items = GAME.inventory?.listItems?.() || [];
    const it = items.find(i => i.id === id);
    return it?.name || id;
  }

  _floatMsg(text) {
    const ehud = document.getElementById('field-explore-hud');
    if (!ehud) return;
    const msg = document.createElement('div');
    msg.textContent = text;
    msg.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.8); padding:16px 32px; border-radius:12px;
      border:1px solid var(--gold); color:var(--gold);
      font-size:1.3rem; font-weight:700; z-index:100;
      animation:rise 0.5s cubic-bezier(0.32,0.72,0,1) both;`;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 1200);
  }

  _triggerBattle(enc) {
    this._cleanupMap();
    // Detect element from first enemy for transition effect
    const enemyId = Array.isArray(enc.enemies) ? enc.enemies[0] : enc.enemies;
    const elem = this._getEnemyElement(enemyId);
    this._fadeTransition(() => {
      battleUI._lastExp = enc.expReward || 60;
      battleUI._lastAp = enc.apReward || 2;
      battleUI._lastGil = enc.gilReward || 25;
      battleUI._lastDrops = [];
      battleUI.onWin = (reports, reward) => this._afterExploreBattleWin();
      battleUI.onLose = () => this._afterBattleLose();
      battleUI.onFlee = () => this._resumeExplore();
      battleUI.start({
        enemies: enc.enemies,
        isBossFight: !!enc.isBossFight,
        isFinalBoss: !!enc.isFinalBoss,
      });
    }, elem);
  }

  _getEnemyElement(id) {
    // Map enemy IDs to elements for transition effects
    const map = {
      goblin: null, skeleton: 'dark', bomb: 'fire', ironite: 'earth',
      plant: 'poison', fuse: 'fire', dark_knight: 'dark', kuja: 'dark',
      gel: 'ice', thunder: 'thunder', ombre: 'dark', dragon: 'fire',
    };
    return map[id] || null;
  }

  _resumeExplore() {
    // Save player position and restart explore
    if (this.fieldMap) this._savedMapState = { x: this.fieldMap.player.x, y: this.fieldMap.player.y };
    this.fieldMap = null;
    this._playChapter();
  }

  _afterExploreBattleWin() {
    // Auto-regen already done in battle UI, resume field
    this._fadeTransition(() => this._resumeExplore());
  }

  _cleanupMap() {
    if (this._mapKeyHandler) { window.removeEventListener('keydown', this._mapKeyHandler); this._mapKeyHandler = null; }
    if (this._mapUpHandler) { window.removeEventListener('keyup', this._mapUpHandler); this._mapUpHandler = null; }
    if (this.fieldMap) { this.fieldMap.cleanup(); this.fieldMap.resetKeys(); this.fieldMap = null; }
    // Tear down the 3D character so it can be rebuilt on re-entry.
    if (this._explore3d) { this._explore3d.dispose(); this._explore3d = null; }
    this._explore3dOn = false;
    this._lastT = 0;
    // Show actions again
    const acts = document.getElementById('field-actions');
    const ehud = document.getElementById('field-explore-hud');
    if (acts) acts.classList.remove('hidden');
    if (ehud) ehud.classList.add('hidden');
  }

  _fadeTransition(callback, element = null) {
    const overlay = document.getElementById('scene-transition');
    if (overlay) { overlay.remove(); }
    const f = document.createElement('div');
    f.id = 'scene-transition';
    // Element-specific colors
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
    const colors = elemColors[element] || ['#000', '#111', '#000'];
    f.style.cssText = `
      position:fixed; inset:0; z-index:100; pointer-events:none; opacity:0;
      transition:opacity 0.4s cubic-bezier(0.32,0.72,0,1);`;
    // Canvas for swirl effect
    const cvs = document.createElement('canvas');
    cvs.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
    f.appendChild(cvs);
    document.body.appendChild(f);
    // Animate swirl
    const ctx = cvs.getContext('2d');
    let start = 0;
    const swirl = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / 400); // 400ms transition
      const cx = cvs.width / 2, cy = cvs.height / 2;
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      // Radial gradient fill
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(cvs.width, cvs.height) * 0.7);
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(0.5, colors[1]);
      grad.addColorStop(1, colors[2] || colors[0]);
      ctx.globalAlpha = p;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      // Swirl lines (for non-black transitions)
      if (element) {
        ctx.strokeStyle = colors[1];
        ctx.lineWidth = 2;
        ctx.globalAlpha = p * 0.4;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + p * Math.PI * 4;
          const r1 = p * 100;
          const r2 = p * Math.max(cvs.width, cvs.height) * 0.6;
          ctx.beginPath();
          ctx.moveTo(cx + fastCos(angle) * r1, cy + fastSin(angle) * r1);
          ctx.lineTo(cx + fastCos(angle + 0.3) * r2, cy + fastSin(angle + 0.3) * r2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (p < 1) requestAnimationFrame(swirl);
    };
    requestAnimationFrame(() => {
      f.style.opacity = '1';
      requestAnimationFrame(swirl);
    });
    setTimeout(() => {
      f.style.opacity = '0';
      setTimeout(() => { f.remove(); callback(); }, 400);
    }, 400);
  }

  // ─── STORY MODE (original flow) ────────────────────────────────────
  _afterDialogue(ch) {
    if (ch.ending) { this._theEnd(); return; }
    if (ch.isTown) { this._showTownFeatures(ch); return; }
    if (ch.battle) this._startStoryBattle(ch);
    else this._showAdvance();
  }

  _startStoryBattle(ch) {
    const enemies = Array.isArray(ch.battle.enemies) ? ch.battle.enemies : [ch.battle.enemies];
    battleUI._lastExp = ch.battle.expReward || 0;
    battleUI._lastAp = ch.battle.apReward || 0;
    battleUI._lastGil = ch.battle.gilReward || ch.battle.gil || 0;
    battleUI._lastDrops = ch.battle.reward?.item ? [{ item: ch.battle.reward.item, chance: 1 }] : [];
    battleUI.onWin = (reports, reward) => this._afterBattleWin(ch, reports, reward);
    battleUI.onLose = () => this._afterBattleLose();
    battleUI.onFlee = () => this._showAdvance();
    battleUI.start({ enemies, isBossFight: !!ch.battle.isBossFight, isFinalBoss: !!ch.battle.isFinalBoss });
  }

  _afterBattleWin(ch, reports, reward) {
    if (ch.cutsceneAfter) {
      dialogue.play([ch.cutsceneAfter], () => this._postChapterComplete(ch, reports));
    } else {
      this._postChapterComplete(ch, reports);
    }
  }

  _postChapterComplete(ch, reports) {
    const list = reports.filter(r => r.type === 'levelup' || r.type === 'skillLearned' || r.type === 'drop');
    if (list.length) {
      const msgs = list.map(r => {
        if (r.type === 'levelup') return `${r.member.name} monte au niveau ${r.newLevel} !`;
        if (r.type === 'skillLearned') return `${r.member.name} apprend une nouvelle capacité.`;
        if (r.type === 'drop') return `Objet trouvé.`;
        return '';
      }).filter(Boolean);
      dialogue.play(msgs.map(t => ({ speaker: 'Narrateur', text: t })), () => this._advance(ch));
    } else {
      this._advance(ch);
    }
  }

  _advance(ch) {
    if (ch.unlock) { /* unlock handled via story data if needed */ }
    advanceChapter();
    this._showAdvance();
  }

  _showAdvance() {
    const acts = document.getElementById('field-actions');
    if (!acts) return;
    acts.innerHTML = `
      <button id="fa-fwd">Continuer ▸</button>
      <button id="fa-menu">Menu</button>
      <button id="fa-save">Sauvegarder</button>`;
    document.getElementById('fa-fwd').onclick = () => { audio.sfx('confirm'); this._playChapter(); };
    document.getElementById('fa-menu').onclick = () => { import('../ui/menu.js').then(m => m.menu.open()); };
    document.getElementById('fa-save').onclick = () => {
      import('../engine/save.js').then(s => { const ok = s.saveGame(GAME); audio.sfx(ok?'level_up':'cancel'); alert(ok?'Sauvegardé.':'Échec.'); });
    };
    this._updateHud();
  }

  _showTownFeatures(ch) {
    const acts = document.getElementById('field-actions');
    if (!acts) return;
    acts.innerHTML = `
      <button id="tw-aub">Auberge (50G — Repos)</button>
      <button id="tw-shop">Boutique</button>
      <button id="tw-save">Sauvegarder</button>
      <button id="tw-fwd">Partir ▸</button>`;
    document.getElementById('tw-aub').onclick = () => {
      if (GAME.inventory.gold >= 50) {
        GAME.inventory.gold -= 50;
        for (const m of GAME.party) { m.hp = m.maxHp; m.mp = m.maxMp; m.alive = true; }
        audio.sfx('magic_cure'); this._updateHud();
      } else { audio.sfx('cancel'); alert('Or insuffisant.'); }
    };
    document.getElementById('tw-shop').onclick = () => import('../ui/shop.js').then(s => s.shop.open());
    document.getElementById('tw-save').onclick = () => {
      import('../engine/save.js').then(s => { const ok = s.saveGame(GAME); audio.sfx(ok?'level_up':'cancel'); alert(ok?'Sauvegardé.':'Échec.'); });
    };
    document.getElementById('tw-fwd').onclick = () => { audio.sfx('confirm'); advanceChapter(); this._playChapter(); };
    this._updateHud();
  }

  _afterBattleLose() {
    GAME.scene = 'gameover';
    const ch = currentChapter();
    const isBoss = ch?.battle?.isBossFight || false;
    import('../scenes/gameover.js').then(g => g.gameover.show(isBoss));
  }

  _theEnd() {
    GAME.scene = 'theend';
    this.hide();
    import('../scenes/theend.js').then(s => s.theend.show());
  }

  hide() {
    this._cleanupMap();
    if (this.root) { this.root.remove(); this.root = null; }
    if (this._fieldCanvas) { canvas.removeLayer(this._fieldCanvas); this._fieldCanvas = null; }
    if (canvas.layers.length === 0) canvas.stop();
  }
}
