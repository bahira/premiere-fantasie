// renderer/sprites.js — Cel-shaded premium sprites (thick outlines, 3-tone, drop shadows, ANIMATION POSES)
// Pure functions drawing on CanvasRenderingContext2D. Style: dark vector / cel-shaded.
// All draw functions accept: (ctx, x, y, scale, frame, opts)
// opts = { anim: 'idle'|'attack'|'cast'|'hit'|'victory'|'dying', flash: bool, rimColor: string }
import { fastSin, fastCos } from '../engine/wasm_bridge.js';
import { getHeroFrame, getEnemyFrame } from '../engine/assets.js';

// ─── Sprite render cache ────────────────────────────────────────────────
// Procedural sprites are expensive (many arcs/fills per draw). We render each
// visual variant (id/anim/flash/rim/scale) once into an offscreen canvas and
// re-render only when the frame bucket advances (animations step every 2 frames),
// then blit. Anchored so the cached image composites at exactly (x,y).
const _spriteCache = new Map();
const SPRITE_OFF = 320, SPRITE_AX = 160, SPRITE_AY = 200;
const SPRITE_BUCKET = 2;
const SPRITE_CACHE_MAX = 512;

function _evictSpriteCache() {
  if (_spriteCache.size > SPRITE_CACHE_MAX) {
    const k = _spriteCache.keys().next().value;
    _spriteCache.delete(k);
  }
}

// ─── Cel-shading helpers ───────────────────────────────────────────────────

const OUTLINE = '#1a1a2e';
const LW = 2.5;

/** Batch outlined shape — single save/restore for fill+stroke */
function outlined(ctx, drawFn, fillColor, lineWidth = LW) {
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.beginPath(); drawFn(ctx); ctx.fill();
  }
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath(); drawFn(ctx); ctx.stroke();
}

/** Draw multiple outlined shapes in a single save/restore block */
function outlinedBatch(ctx, shapes) {
  ctx.save();
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const s of shapes) {
    const [drawFn, fill, lw] = s;
    if (fill) {
      ctx.fillStyle = fill;
      ctx.beginPath(); drawFn(ctx); ctx.fill();
    }
    ctx.lineWidth = lw || LW;
    ctx.beginPath(); drawFn(ctx); ctx.stroke();
  }
  ctx.restore();
}

function shadow(ctx, x, y, rx, ry) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y - 2, rx, ry, 0, 0, 6.2832);
  ctx.fill();
}

function arc(ctx, x, y, r) { ctx.arc(x, y, r, 0, Math.PI * 2); }
function ellipse(ctx, x, y, rx, ry) { ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
function rect(ctx, x, y, w, h) { ctx.rect(x, y, w, h); }

function eyePoint(ctx, x, y, color = '#fff', pupil = '#1a1a2e') {
  outlined(ctx, c => arc(c, x, y, 4.5), color, 1.8);
  outlined(ctx, c => arc(c, x, y, 2.2), pupil, 1.2);
  // Eye highlight dot
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.arc(x + 1, y - 1.2, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function mouthLine(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

// Blade shine line (for swords, daggers)
function bladeShine(ctx, x, y, w, h, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-1, -h * 0.4, 2, h * 0.8);
  ctx.restore();
}

// Cloth flutter: returns dx offset based on frame
function clothFlutter(frame, seed = 0, intensity = 1) {
  return fastSin(frame * 0.04 + seed * 2.3) * 2 * intensity;
}

// ─── Color palettes (extended for 3-tone) ──────────────────────────────────

const PAL = {
  luan:     { skin:'#f5d6b8', skinS:'#d4b090', hair:'#8b5e3c', hairS:'#5d3a1a', coat:'#d4a840', coatS:'#9a7a2a', coatH:'#f0d870', pants:'#5d4e37', pantsS:'#3d2e1f', boots:'#3d2b1f' },
  alduin:   { skin:'#f0d5b0', skinS:'#d0b490', hair:'#4a3728', armor:'#5a7db3', armorS:'#3a4d7a', armorH:'#7a9dd3', cloak:'#c0392b', cloakS:'#8a1a1a', plate:'#8aa0d4' },
  mira:     { skin:'#e8c9a0', skinS:'#c8a880', hair:'#9b59b6', hairS:'#6a2070', robe:'#7b3fa0', robeS:'#4a2063', robeH:'#a060d0', sash:'#f1c40f' },
  selia:    { skin:'#f5dcc4', skinS:'#d4b49a', hair:'#e74c3c', hairS:'#a02020', dress:'#e8c840', dressS:'#b89820', dressH:'#f8e870', collar:'#fdf0d0', boots:'#7d6608' },
  goblin:   { body:'#5f7d3a', bodyS:'#3d5a1e', belly:'#8aab5a', skin:'#8a7030', eye:'#e74c3c' },
  skeleton: { bone:'#e8e0d0', boneS:'#b0a898', eye:'#ff3030' },
  bomb:     { body:'#c0392b', bodyS:'#8a1a1a', core:'#f39c12', glow:'#f1c40f', fuse:'#e67e22' },
  ironite:  { body:'#7f8c8d', bodyS:'#5a6060', armor:'#4a5a6a', eye:'#f1c40f' },
  plant:    { stem:'#27ae60', stemS:'#1a7a40', mouth:'#c0392b', petals:'#e91e63', petalsS:'#b01040' },
  darkknight:{ armor:'#1a1a2e', armorS:'#0a0a18', plate:'#2c3e50', eye:'#e74c3c', plume:'#c0392b' },
  kuja:     { skin:'#d5b8a0', hair:'#f1c40f', coat:'#6a1b9a', coatS:'#3a005a', coatH:'#9a40d0', feathers:'#e74c3c' },
  fuse:     { body:'#d35400', bodyS:'#8a3000', belly:'#e67e22', eye:'#f1c40f', horn:'#a04000' },
};

// ─── Characters (cel-shaded, 3-tone, drop shadow, idle bob) ────────────────

export function drawLuan(ctx, x, y, s = 1, frame = 0, opts = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const { anim = 'idle', flash = false, rimColor = null } = opts;
  const bob = anim === 'victory' ? fastSin(frame * 0.12) * 5 : fastSin(frame * 0.08) * 2;
  const breathe = fastSin(frame * 0.06) * 1.5; // breathing idle
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 4 : 0;
  const attackExtend = anim === 'attack' ? 10 : 0;
  const castExtend = anim === 'cast' ? 8 : 0;
  const flutter = clothFlutter(frame, 0);
  shadow(ctx, hitShake, 42, 22, 6);
  // Legs + boots (batched — single save/restore)
  outlinedBatch(ctx, [
    [c => rect(c, -8 + hitShake, 20 + bob, 6, 18), PAL.luan.pants],
    [c => rect(c, 2 + hitShake, 20 + bob, 6, 18), PAL.luan.pants],
    [c => rect(c, -9 + hitShake, 36 + bob, 8, 6), PAL.luan.boots],
    [c => rect(c, 1 + hitShake, 36 + bob, 8, 6), PAL.luan.boots],
  ]);
  // Deep shadow on pants
  ctx.fillStyle = PAL.luan.pantsS;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(-7 + hitShake, 28 + bob, 3, 10);
  ctx.fillRect(3 + hitShake, 28 + bob, 3, 10);
  ctx.globalAlpha = 1;
  // Coat body (with breathing expansion)
  const coatW = 24 + breathe * 0.3;
  outlined(ctx, c => { rect(c, -12 + hitShake + flutter * 0.2, -8 + bob, coatW, 32 + breathe); }, PAL.luan.coat);
  // Coat shadow (4-tone: deep shadow)
  ctx.fillStyle = PAL.luan.coatS;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(-4 + hitShake + flutter * 0.2, -4 + bob, 4, 26);
  ctx.globalAlpha = 0.25;
  ctx.fillRect(-8 + hitShake + flutter * 0.2, 0 + bob, 4, 20);
  ctx.globalAlpha = 1;
  // Coat highlight
  ctx.fillStyle = PAL.luan.coatH;
  ctx.fillRect(8 + hitShake + flutter * 0.2, -4 + bob, 3, 20);
  // Belt
  outlined(ctx, c => rect(c, -11 + hitShake, 10 + bob, 22, 4), '#5d4e37', 1.8);
  // Belt buckle shine
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(-2 + hitShake, 11 + bob, 4, 2);
  // Head (with breathing bob)
  const headY = -20 + bob + breathe * 0.2;
  outlined(ctx, c => arc(c, 0 + hitShake, headY, 15), PAL.luan.skin);
  // Hair (spiky, with flutter)
  ctx.fillStyle = PAL.luan.hair;
  ctx.beginPath(); ctx.arc(0 + hitShake, headY - 6, 15, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14 + hitShake, -24 + bob); ctx.lineTo(-10 + hitShake, -38 + bob + fastSin(frame * 0.07) * 2); ctx.lineTo(-4 + hitShake, -26 + bob); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-2 + hitShake, -28 + bob); ctx.lineTo(0 + hitShake, -40 + bob + fastSin(frame * 0.06 + 1) * 2); ctx.lineTo(4 + hitShake, -28 + bob); ctx.fill();
  ctx.beginPath(); ctx.moveTo(6 + hitShake, -26 + bob); ctx.lineTo(12 + hitShake, -38 + bob + fastSin(frame * 0.05 + 2) * 2); ctx.lineTo(14 + hitShake, -24 + bob); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.arc(0 + hitShake, headY - 6, 15, Math.PI, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-14 + hitShake, -24 + bob); ctx.lineTo(-10 + hitShake, -38 + bob); ctx.lineTo(-4 + hitShake, -26 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2 + hitShake, -28 + bob); ctx.lineTo(0 + hitShake, -40 + bob); ctx.lineTo(4 + hitShake, -28 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6 + hitShake, -26 + bob); ctx.lineTo(12 + hitShake, -38 + bob); ctx.lineTo(14 + hitShake, -24 + bob); ctx.stroke();
  // Hair highlight strand
  ctx.fillStyle = PAL.luan.hairS;
  ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.moveTo(-1 + hitShake, -36 + bob); ctx.lineTo(1 + hitShake, -38 + bob); ctx.lineTo(3 + hitShake, -30 + bob); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // Eyes (with expression)
  eyePoint(ctx, -5 + hitShake, headY); eyePoint(ctx, 5 + hitShake, headY);
  // Eyebrows (expression-dependent)
  if (anim === 'attack') {
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-7 + hitShake, headY - 7); ctx.lineTo(-3 + hitShake, headY - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3 + hitShake, headY - 6); ctx.lineTo(7 + hitShake, headY - 7); ctx.stroke();
  }
  // Mouth expression based on anim
  if (anim === 'victory') { ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0 + hitShake, -11 + bob, 5, 0.2, Math.PI - 0.2); ctx.stroke(); }
  else if (anim === 'hit') { mouthLine(ctx, -5 + hitShake, -12 + bob, -2 + hitShake, -11 + bob); mouthLine(ctx, 2 + hitShake, -11 + bob, 5 + hitShake, -12 + bob); }
  else { mouthLine(ctx, -4 + hitShake, -13 + bob, 4 + hitShake, -14 + bob); }
  // Dagger (extends in attack, with blade shine)
  const daggerX = 12 + attackExtend + castExtend;
  ctx.fillStyle = '#95a5a6';
  ctx.fillRect(daggerX + hitShake, 12 + bob, 14, 3);
  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(daggerX + 10 + hitShake, 10 + bob, 3, 7);
  // Blade shine line
  bladeShine(ctx, daggerX + 7 + hitShake, 12 + bob, 14, 3);
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(daggerX - 2 + hitShake, 11 + bob, 4, 5);
  // Victory pose: raise arms
  if (anim === 'victory') {
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('⚔', 24 + hitShake, -10 + bob);
  }
  // Rim light
  if (rimColor) { ctx.strokeStyle = rimColor; ctx.lineWidth = 2; ctx.globalAlpha = 0.5; ctx.strokeRect(-12 + hitShake, -8 + bob, 24, 32); ctx.globalAlpha = 1; }
  // Hit flash overlay
  if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-14 + hitShake, -40 + bob, 28, 60); }
  ctx.restore();
}

export function drawAldric(ctx, x, y, s = 1, frame = 0, opts = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const { anim = 'idle', flash = false, rimColor = null } = opts;
  const bob = anim === 'victory' ? fastSin(frame * 0.12) * 5 : fastSin(frame * 0.08) * 2;
  const breathe = fastSin(frame * 0.06) * 1;
  const capeSway = fastSin(frame * 0.04) * 4 + clothFlutter(frame, 1);
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 3 : 0;
  const attackLean = anim === 'attack' ? 6 : 0;
  shadow(ctx, hitShake, 48, 26, 7);
  // Legs + boots (batched)
  outlinedBatch(ctx, [
    [c => rect(c, -10 + hitShake, 22 + bob, 9, 16), '#34495e'],
    [c => rect(c, 1 + hitShake, 22 + bob, 9, 16), '#34495e'],
    [c => rect(c, -11 + hitShake, 36 + bob, 11, 6), '#5d6d7e'],
    [c => rect(c, 0 + hitShake, 36 + bob, 11, 6), '#5d6d7e'],
  ]);
  // Leg deep shadows
  ctx.fillStyle = '#2a3a4e';
  ctx.globalAlpha = 0.35;
  ctx.fillRect(-9 + hitShake, 26 + bob, 4, 12);
  ctx.fillRect(2 + hitShake, 26 + bob, 4, 12);
  ctx.globalAlpha = 1;
  // Cape behind (enhanced with flutter)
  ctx.fillStyle = PAL.alduin.cloak;
  ctx.beginPath();
  ctx.moveTo(-10 + capeSway * 0.3 + hitShake, -8 + bob);
  ctx.lineTo(-22 + capeSway + hitShake, 24 + bob);
  ctx.lineTo(-8 + capeSway * 0.3 + hitShake, 22 + bob);
  ctx.closePath(); ctx.fill();
  // Cape inner shadow
  ctx.fillStyle = PAL.alduin.cloakS;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(-14 + capeSway * 0.4 + hitShake, 0 + bob);
  ctx.lineTo(-20 + capeSway + hitShake, 20 + bob);
  ctx.lineTo(-10 + capeSway * 0.3 + hitShake, 18 + bob);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(10 + capeSway * 0.3 + hitShake, -8 + bob);
  ctx.lineTo(22 + capeSway + hitShake, 24 + bob);
  ctx.lineTo(8 + capeSway * 0.3 + hitShake, 22 + bob);
  ctx.closePath(); ctx.fill();
  // Armor body (with breathing)
  const armorW = 28 + breathe * 0.3;
  outlined(ctx, c => rect(c, -14 + hitShake, -12 + bob, armorW, 36 + breathe), PAL.alduin.armor);
  // Chest plate
  outlined(ctx, c => rect(c, -9 + hitShake, -6 + bob, 18, 20), PAL.alduin.plate);
  // Plate highlight (4th tone)
  ctx.fillStyle = PAL.alduin.armorH;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(-8 + hitShake, -5 + bob, 3, 16);
  ctx.globalAlpha = 1;
  // Pauldrons
  outlined(ctx, c => { arc(c, -16 + hitShake, -6 + bob, 8); }, PAL.alduin.armorS);
  outlined(ctx, c => { arc(c, 16 + hitShake, -6 + bob, 8); }, PAL.alduin.armorS);
  // Pauldron highlight
  ctx.fillStyle = PAL.alduin.armorH;
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.arc(-15 + hitShake, -8 + bob, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(17 + hitShake, -8 + bob, 4, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Head (with breathing)
  const headY = -22 + bob + breathe * 0.15;
  outlined(ctx, c => arc(c, 0 + hitShake, headY, 15), PAL.alduin.skin);
  // Helmet
  ctx.fillStyle = PAL.alduin.armor;
  ctx.beginPath(); ctx.arc(0 + hitShake, headY - 6, 15, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.arc(0 + hitShake, headY - 6, 15, Math.PI, 0); ctx.stroke();
  // Helmet visor lines
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9 + hitShake, headY); ctx.lineTo(-3 + hitShake, headY + 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3 + hitShake, headY + 3); ctx.lineTo(9 + hitShake, headY); ctx.stroke();
  // Plume (with flutter)
  ctx.fillStyle = PAL.alduin.cloak;
  ctx.beginPath(); ctx.moveTo(0 + hitShake, -40 + bob); ctx.lineTo(8 + capeSway * 0.2 + hitShake, -54 + bob); ctx.lineTo(-4 + capeSway * 0.2 + hitShake, -52 + bob); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.moveTo(0 + hitShake, -40 + bob); ctx.lineTo(8 + capeSway * 0.2 + hitShake, -54 + bob); ctx.lineTo(-4 + capeSway * 0.2 + hitShake, -52 + bob); ctx.closePath(); ctx.stroke();
  // Greatsword (angles forward in attack)
  const swdX = 24 + (anim === 'victory' ? 0 : attackLean);
  const swdY = -30 + (anim === 'victory' ? -6 : 0) + bob;
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(swdX + hitShake, swdY, 5, 52 + (anim === 'attack' ? 6 : 0));
  // Blade highlight + deep shadow
  ctx.fillStyle = '#ecf0f1';
  ctx.fillRect(swdX + 1 + hitShake, swdY, 2, 48 + (anim === 'attack' ? 6 : 0));
  ctx.fillStyle = '#95a5a6';
  ctx.globalAlpha = 0.4;
  ctx.fillRect(swdX + 3 + hitShake, swdY, 2, 48 + (anim === 'attack' ? 6 : 0));
  ctx.globalAlpha = 1;
  // Blade shine line
  bladeShine(ctx, swdX + 2.5 + hitShake, swdY + 20, 5, 40);
  // Guard
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(swdX - 2 + hitShake, swdY - 2, 9, 5);
  // Pommel
  outlined(ctx, c => arc(c, swdX + 2 + hitShake, 18 + (anim === 'attack' ? 6 : 0) + bob, 5), '#c0392b');
  // Victory: raise sword higher
  if (anim === 'victory') {
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('🛡', swdX + hitShake, -12 + bob);
  }
  if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-16 + hitShake, -60 + bob, 32, 90); }
  ctx.restore();
}

export function drawMira(ctx, x, y, s = 1, frame = 0, opts = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const { anim = 'idle', flash = false, rimColor = null } = opts;
  const bob = fastSin(frame * 0.08) * 2;
  const flt = fastSin(frame * 0.05) * 4;
  const breathe = fastSin(frame * 0.06) * 1;
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 4 : 0;
  const castGlow = anim === 'cast' ? fastSin(frame * 0.15) * 0.5 + 0.5 : 0;
  const flutter = clothFlutter(frame, 2, 0.8);
  shadow(ctx, hitShake, 34 + flt, 20, 5);
  // Legs (batched)
  outlinedBatch(ctx, [
    [c => rect(c, -8 + hitShake, 26 + bob + flt, 7, 12), '#4a2063'],
    [c => rect(c, 1 + hitShake, 26 + bob + flt, 7, 12), '#4a2063'],
  ]);
  // Robe (with breathing + flutter)
  const robeW = 28 + breathe * 0.3;
  outlined(ctx, c => rect(c, -14 + hitShake + flutter * 0.2, -6 + bob + flt, robeW, 36 + breathe), PAL.mira.robe);
  // Robe shadow (4-tone)
  ctx.fillStyle = PAL.mira.robeS;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(-10 + hitShake + flutter * 0.2, 2 + bob + flt, 8, 26);
  ctx.globalAlpha = 0.25;
  ctx.fillRect(-12 + hitShake + flutter * 0.2, 6 + bob + flt, 5, 22);
  ctx.globalAlpha = 1;
  // Robe highlight
  ctx.fillStyle = PAL.mira.robeH;
  ctx.fillRect(8 + hitShake + flutter * 0.2, 0 + bob + flt, 4, 24);
  // Cast glow on robe
  if (castGlow > 0) {
    ctx.fillStyle = `rgba(155,89,182,${castGlow * 0.15})`;
    ctx.fillRect(-14 + hitShake + flutter * 0.2, -6 + bob + flt, robeW, 36 + breathe);
  }
  // Sash
  outlined(ctx, c => rect(c, -13 + hitShake, 8 + bob + flt, 26, 4), PAL.mira.sash, 1.8);
  // Head (with breathing)
  const headY = -18 + bob + flt + breathe * 0.15;
  outlined(ctx, c => arc(c, 0 + hitShake, headY, 14), PAL.mira.skin);
  // Hair (flowing with flutter)
  ctx.fillStyle = PAL.mira.hair;
  ctx.beginPath(); ctx.arc(0 + hitShake, headY - 7, 14, Math.PI, 0); ctx.fill();
  ctx.fillRect(-14 + hitShake + flutter * 0.3, headY - 2, 4, 22);
  ctx.fillRect(10 + hitShake + flutter * 0.3, headY - 2, 4, 22);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.arc(0 + hitShake, headY - 7, 14, Math.PI, 0); ctx.stroke();
  ctx.strokeRect(-14 + hitShake + flutter * 0.3, headY - 2, 4, 22);
  ctx.strokeRect(10 + hitShake + flutter * 0.3, headY - 2, 4, 22);
  // Hair gem
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath(); ctx.arc(0 + hitShake, headY - 8, 2.5, 0, Math.PI * 2); ctx.fill();
  // Eyes (wide in cast)
  if (anim === 'cast') { eyePoint(ctx, -5 + hitShake, headY, '#fff', '#9b59b6'); eyePoint(ctx, 5 + hitShake, headY, '#fff', '#9b59b6'); }
  else { eyePoint(ctx, -5 + hitShake, headY); eyePoint(ctx, 5 + hitShake, headY); }
  // Mouth
  if (anim === 'cast') { ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0 + hitShake, headY + 8, 4, 0.1, Math.PI - 0.1); ctx.stroke(); }
  else { mouthLine(ctx, -3 + hitShake, headY + 6, 3 + hitShake, headY + 6); }
  // Staff (raised in cast)
  const staffX = anim === 'cast' ? 24 : 22;
  const staffY = anim === 'cast' ? -16 + bob + flt : -10 + bob + flt;
  ctx.fillStyle = '#5b2c6f';
  ctx.fillRect(staffX + hitShake, staffY, 3, anim === 'cast' ? 46 : 36);
  ctx.fillStyle = '#7d3a98';
  ctx.fillRect(staffX + 1 + hitShake, staffY, 1, anim === 'cast' ? 46 : 34);
  // Staff orb glow (intense in cast, with pulsing rings)
  const orbY = -14 + bob + flt + (anim === 'cast' ? -6 : 0);
  const orbGlow = castGlow > 0 ? 8 + castGlow * 6 : 6;
  outlined(ctx, c => arc(c, staffX + 1 + hitShake, orbY, orbGlow), '#f1c40f');
  if (castGlow > 0) {
    ctx.fillStyle = `rgba(241,196,15,${castGlow * 0.2})`;
    ctx.beginPath(); ctx.arc(staffX + 1 + hitShake, orbY, 20, 0, Math.PI * 2); ctx.fill();
    // Pulsing ring
    ctx.strokeStyle = `rgba(241,196,15,${castGlow * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(staffX + 1 + hitShake, orbY, 14 + fastSin(frame * 0.1) * 3, 0, Math.PI * 2); ctx.stroke();
  }
  outlined(ctx, c => arc(c, staffX + 1 + hitShake, orbY, 3), '#fff');
  // Floating aura particles (more in cast)
  ctx.globalAlpha = anim === 'cast' ? 0.3 + castGlow * 0.2 : 0.15 + fastSin(frame * 0.06) * 0.1;
  ctx.fillStyle = '#9b59b6';
  for (let i = 0; i < (anim === 'cast' ? 8 : 4); i++) {
    const a = i * (anim === 'cast' ? 0.785 : 1.57) + frame * (anim === 'cast' ? 0.06 : 0.02);
    const rad = anim === 'cast' ? 26 : 18;
    ctx.beginPath(); ctx.arc(fastCos(a) * rad + hitShake, fastSin(a) * (rad * 0.6) + bob + flt, anim === 'cast' ? 4 : 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-16 + hitShake, -20 + bob + flt, 32, 60); }
  ctx.restore();
}

export function drawSelia(ctx, x, y, s = 1, frame = 0, opts = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const { anim = 'idle', flash = false, rimColor = null } = opts;
  const bob = fastSin(frame * 0.08) * 2;
  const sway = fastSin(frame * 0.03) * 3;
  const breathe = fastSin(frame * 0.06) * 1;
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 4 : 0;
  const castPulse = anim === 'cast' || anim === 'heal' ? fastSin(frame * 0.15) * 0.4 + 0.6 : 0;
  const flutter = clothFlutter(frame, 3, 0.7);
  shadow(ctx, hitShake, 34, 20, 5);
  // Legs (batched)
  outlinedBatch(ctx, [
    [c => rect(c, -8 + hitShake, 22 + bob, 7, 10), PAL.selia.boots],
    [c => rect(c, 1 + hitShake, 22 + bob, 7, 10), PAL.selia.boots],
  ]);
  // Dress (with breathing + flutter)
  const dressW = 24 + breathe * 0.3;
  outlined(ctx, c => rect(c, -12 + hitShake + flutter * 0.2, -8 + bob, dressW, 34 + breathe), PAL.selia.dress);
  // Dress shadow (4-tone)
  ctx.fillStyle = PAL.selia.dressS;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(-8 + hitShake + flutter * 0.2, 0 + bob, 8, 24);
  ctx.globalAlpha = 0.25;
  ctx.fillRect(-10 + hitShake + flutter * 0.2, 4 + bob, 5, 20);
  ctx.globalAlpha = 1;
  // Dress highlight
  ctx.fillStyle = PAL.selia.dressH;
  ctx.fillRect(6 + hitShake + flutter * 0.2, -2 + bob, 4, 20);
  // Heal/cast glow on dress
  if (castPulse > 0) {
    ctx.fillStyle = `rgba(46,204,113,${castPulse * 0.12})`;
    ctx.fillRect(-12 + hitShake + flutter * 0.2, -8 + bob, dressW, 34 + breathe);
  }
  // Collar
  outlined(ctx, c => rect(c, -9 + hitShake, 0 + bob, 18, 5), PAL.selia.collar, 1.8);
  // Head (with breathing)
  const headY = -18 + bob + breathe * 0.15;
  outlined(ctx, c => arc(c, 0 + sway * 0.2 + hitShake, headY, 14), PAL.selia.skin);
  // Hair (flowing with sway + flutter)
  ctx.fillStyle = PAL.selia.hair;
  ctx.beginPath(); ctx.arc(0 + sway * 0.2 + hitShake, headY - 7, 13, Math.PI, 0); ctx.fill();
  ctx.fillRect(-14 + sway * 0.1 + hitShake + flutter * 0.3, headY - 2, 4, 20);
  ctx.fillRect(10 + sway * 0.1 + hitShake + flutter * 0.3, headY - 2, 4, 20);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.arc(0 + sway * 0.2 + hitShake, headY - 7, 13, Math.PI, 0); ctx.stroke();
  ctx.strokeRect(-14 + sway * 0.1 + hitShake + flutter * 0.3, headY - 2, 4, 20);
  ctx.strokeRect(10 + sway * 0.1 + hitShake + flutter * 0.3, headY - 2, 4, 20);
  // Tiara (with sway)
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.moveTo(-7 + sway * 0.2 + hitShake, headY - 12);
  ctx.lineTo(0 + sway * 0.2 + hitShake, headY - 17);
  ctx.lineTo(7 + sway * 0.2 + hitShake, headY - 12);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-7 + sway * 0.2 + hitShake, headY - 12);
  ctx.lineTo(0 + sway * 0.2 + hitShake, headY - 17);
  ctx.lineTo(7 + sway * 0.2 + hitShake, headY - 12);
  ctx.closePath(); ctx.stroke();
  // Tiara gem
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath(); ctx.arc(0 + sway * 0.2 + hitShake, headY - 14, 2, 0, Math.PI * 2); ctx.fill();
  // Eyes
  if (anim === 'cast' || anim === 'heal') { eyePoint(ctx, -5 + sway * 0.2 + hitShake, headY, '#fff', '#2ecc71'); eyePoint(ctx, 5 + sway * 0.2 + hitShake, headY, '#fff', '#2ecc71'); }
  else { eyePoint(ctx, -5 + sway * 0.2 + hitShake, headY); eyePoint(ctx, 5 + sway * 0.2 + hitShake, headY); }
  // Expression
  if (anim === 'hit') { mouthLine(ctx, -5 + sway * 0.2 + hitShake, headY + 7, -2 + sway * 0.2 + hitShake, headY + 8); mouthLine(ctx, 2 + sway * 0.2 + hitShake, headY + 8, 5 + sway * 0.2 + hitShake, headY + 7); }
  else if (anim === 'victory') { ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0 + sway * 0.2 + hitShake, headY + 8, 5, 0.2, Math.PI - 0.2); ctx.stroke(); }
  else { ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0 + sway * 0.2 + hitShake, headY + 6, 4, 0.15, Math.PI - 0.15); ctx.stroke(); }
  // Heal aura in cast/heal (pulsing rings)
  if (castPulse > 0) {
    ctx.fillStyle = `rgba(46,204,113,${castPulse * 0.08})`;
    ctx.shadowColor = '#2ecc71'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(0 + hitShake, -4 + bob, 28 + fastSin(frame * 0.08) * 4, 0, Math.PI * 2); ctx.fill();
    // Pulsing heal ring
    ctx.strokeStyle = `rgba(46,204,113,${castPulse * 0.2})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0 + hitShake, -4 + bob, 20 + fastSin(frame * 0.1) * 5, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-14 + hitShake, -36 + bob, 28, 60); }
  ctx.restore();
}

// ─── Enemies (cel-shaded) ──────────────────────────────────────────────────

export function drawGoblin(ctx, x, y, s = 1, frame = 0, opts = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const { anim = 'idle', flash = false, rimColor = null } = opts;
  const bob = fastSin(frame * 0.1) * 3;
  const breathe = fastSin(frame * 0.06) * 1.5;
  const earWiggle = fastSin(frame * 0.08) * 2;
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 4 : 0;
  shadow(ctx, hitShake, 48, 24, 6);
  // Legs (batched)
  outlinedBatch(ctx, [
    [c => rect(c, -10, 32 + bob, 8, 16), '#5d4e37'],
    [c => rect(c, 2, 32 + bob, 8, 16), '#5d4e37'],
  ]);
  ctx.fillStyle = '#4a3a28'; ctx.globalAlpha = 0.3;
  ctx.fillRect(-9, 36 + bob, 3, 12);
  ctx.fillRect(3, 36 + bob, 3, 12);
  ctx.globalAlpha = 1;
  // Body (4-tone)
  const bodyW = 20 + breathe * 0.3;
  outlined(ctx, c => ellipse(c, 0, 12 + bob, bodyW, 24 + breathe), PAL.goblin.body);
  // Body deep shadow
  ctx.fillStyle = PAL.goblin.bodyS;
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.ellipse(-6, 16 + bob, 10, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.ellipse(-8, 20 + bob, 6, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Belly highlight
  outlined(ctx, c => ellipse(c, 0, 18 + bob, 12, 14), PAL.goblin.belly);
  ctx.fillStyle = '#a0cc70'; ctx.globalAlpha = 0.2;
  ctx.beginPath(); ctx.ellipse(2, 15 + bob, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Head (large, with breathing)
  const headY = -14 + bob + breathe * 0.2;
  outlined(ctx, c => arc(c, 0, headY, 18), PAL.goblin.skin);
  // Head shadow
  ctx.fillStyle = PAL.goblin.skin; ctx.globalAlpha = 0.2;
  ctx.beginPath(); ctx.arc(-4, headY + 4, 14, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Ears (animated wiggle)
  outlined(ctx, c => ellipse(c, -20 - earWiggle, -8 + bob, 8, 14), PAL.goblin.skin);
  outlined(ctx, c => ellipse(c, 20 + earWiggle, -8 + bob, 8, 14), PAL.goblin.skin);
  // Inner ear
  ctx.fillStyle = PAL.goblin.body; ctx.globalAlpha = 0.4;
  ctx.beginPath(); ctx.ellipse(-20 - earWiggle, -6 + bob, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(20 + earWiggle, -6 + bob, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Eyes (with angry brow in attack)
  eyePoint(ctx, -7, headY + 2, '#fff', PAL.goblin.eye);
  eyePoint(ctx, 7, headY + 2, '#fff', PAL.goblin.eye);
  if (anim === 'attack') {
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-10, headY - 4); ctx.lineTo(-4, headY - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, headY - 4); ctx.lineTo(4, headY - 2); ctx.stroke();
  }
  // Mouth (jagged teeth, enhanced)
  ctx.fillStyle = '#222';
  ctx.fillRect(-7, -6 + bob, 14, 5);
  for (let t = -3; t <= 3; t++) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(t * 4 - 2, -6 + bob); ctx.lineTo(t * 4, -1 + bob); ctx.lineTo(t * 4 + 2, -6 + bob);
    ctx.closePath(); ctx.fill();
  }
  // Gum line
  ctx.fillStyle = '#8a4030';
  ctx.fillRect(-6, -6 + bob, 12, 1.5);
  // Club (with wood grain)
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(22 + hitShake, 4 + bob, 5, 24);
  ctx.fillStyle = '#4a3228';
  ctx.fillRect(23 + hitShake, 8 + bob, 1, 18);
  outlined(ctx, c => arc(c, 24 + hitShake, -2 + bob, 7), '#5d4037');
  // Club highlight
  ctx.fillStyle = '#7a5a40'; ctx.globalAlpha = 0.3;
  ctx.fillRect(22 + hitShake, 6 + bob, 2, 16);
  ctx.globalAlpha = 1;
  if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-25 + hitShake, -40, 50, 100); }
  if (rimColor) { ctx.strokeStyle = rimColor; ctx.lineWidth = 2; ctx.globalAlpha = 0.4; ctx.strokeRect(-24 + hitShake, -26 + bob, 48, 64); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function drawFuse(ctx, x, y, s = 1, frame = 0, opts = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const { anim = 'idle', flash = false, rimColor = null } = opts;
  const bob = fastSin(frame * 0.12) * 3;
  const breathe = fastSin(frame * 0.06) * 1;
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 4 : 0;
  shadow(ctx, hitShake, 40, 18, 5);
  // Body (4-tone)
  const bodyW = 18 + breathe * 0.2;
  outlined(ctx, c => ellipse(c, 0, 10 + bob, bodyW, 22 + breathe), PAL.fuse.body);
  // Body shadow
  ctx.fillStyle = PAL.fuse.bodyS; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.ellipse(-6, 14 + bob, 10, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.ellipse(-8, 18 + bob, 6, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Body highlight
  ctx.fillStyle = '#e07020'; ctx.globalAlpha = 0.2;
  ctx.beginPath(); ctx.ellipse(4, 6 + bob, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Belly
  outlined(ctx, c => ellipse(c, 0, 16 + bob, 12, 14), PAL.fuse.belly);
  // Head
  const headY = -12 + bob + breathe * 0.15;
  outlined(ctx, c => arc(c, 0, headY, 16), PAL.fuse.body);
  // Horn (with depth)
  ctx.fillStyle = PAL.fuse.horn;
  ctx.beginPath(); ctx.moveTo(-5, -26 + bob); ctx.lineTo(0, -38 + bob); ctx.lineTo(5, -26 + bob); ctx.closePath(); ctx.fill();
  // Horn highlight
  ctx.fillStyle = '#c06020'; ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.moveTo(-2, -28 + bob); ctx.lineTo(0, -36 + bob); ctx.lineTo(2, -28 + bob); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.moveTo(-5, -26 + bob); ctx.lineTo(0, -38 + bob); ctx.lineTo(5, -26 + bob); ctx.closePath(); ctx.stroke();
  // Eyes (with anger in attack)
  eyePoint(ctx, -6, headY + 2, '#fff', PAL.fuse.eye);
  eyePoint(ctx, 6, headY + 2, '#fff', PAL.fuse.eye);
  if (anim === 'attack') {
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-9, headY - 4); ctx.lineTo(-3, headY - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, headY - 4); ctx.lineTo(3, headY - 2); ctx.stroke();
  }
  // Mouth
  ctx.fillStyle = '#333';
  ctx.fillRect(-6, -6 + bob, 12, 3);
  // Legs
  outlined(ctx, c => rect(c, -8 + hitShake, 32 + bob, 8, 12), '#5d4e37');
  outlined(ctx, c => rect(c, 0 + hitShake, 32 + bob, 8, 12), '#5d4e37');
  // Leg highlight
  ctx.fillStyle = '#7a5a40'; ctx.globalAlpha = 0.2;
  ctx.fillRect(-7 + hitShake, 34 + bob, 3, 8);
  ctx.fillRect(1 + hitShake, 34 + bob, 3, 8);
  ctx.globalAlpha = 1;
  if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-22 + hitShake, -42, 44, 86); }
  if (rimColor) { ctx.strokeStyle = rimColor; ctx.lineWidth = 2; ctx.globalAlpha = 0.4; ctx.strokeRect(-20 + hitShake, -30 + bob, 40, 60); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function drawSkeleton(ctx, x, y, s = 1, frame = 0, opts = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const { anim = 'idle', flash = false, rimColor = null } = opts;
  const bob = fastSin(frame * 0.08) * 3;
  const breathe = fastSin(frame * 0.06) * 1;
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 4 : 0;
  const eyeFlicker = 0.6 + 0.4 * fastSin(frame * 0.12);
  shadow(ctx, hitShake, 48, 18, 5);
  // Legs (bone with depth)
  ctx.strokeStyle = PAL.skeleton.bone; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6, 28 + bob); ctx.lineTo(-10, 44 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, 28 + bob); ctx.lineTo(10, 44 + bob); ctx.stroke();
  // Leg bone highlight
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.2;
  ctx.beginPath(); ctx.moveTo(-5, 29 + bob); ctx.lineTo(-9, 43 + bob); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.moveTo(-6, 28 + bob); ctx.lineTo(-10, 44 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, 28 + bob); ctx.lineTo(10, 44 + bob); ctx.stroke();
  // Ribcage (with depth + breathing)
  const ribW = 28 + breathe * 0.2;
  outlined(ctx, c => rect(c, -ribW/2, -4 + bob, ribW, 30 + breathe), PAL.skeleton.bone);
  // Rib shadows (4-tone)
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = PAL.skeleton.boneS;
    ctx.fillRect(-12, 2 + i * 5 + bob, 24, 2);
  }
  // Deep shadow on ribcage
  ctx.fillStyle = '#a09080'; ctx.globalAlpha = 0.2;
  ctx.fillRect(-ribW/2, -2 + bob, 6, 26 + breathe);
  ctx.globalAlpha = 1;
  // Spine detail
  ctx.strokeStyle = PAL.skeleton.boneS; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -4 + bob); ctx.lineTo(0, 24 + bob); ctx.stroke();
  // Arms (bone with joints)
  ctx.strokeStyle = PAL.skeleton.bone; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-14, 4 + bob); ctx.lineTo(-26, 20 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, 4 + bob); ctx.lineTo(26, 20 + bob); ctx.stroke();
  // Elbow joints
  ctx.fillStyle = PAL.skeleton.bone;
  ctx.beginPath(); ctx.arc(-20, 12 + bob, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(20, 12 + bob, 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.moveTo(-14, 4 + bob); ctx.lineTo(-26, 20 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, 4 + bob); ctx.lineTo(26, 20 + bob); ctx.stroke();
  // Skull (enhanced)
  outlined(ctx, c => arc(c, 0, -18 + bob, 16), PAL.skeleton.bone);
  // Jaw
  ctx.fillStyle = PAL.skeleton.bone;
  ctx.beginPath(); ctx.moveTo(-10, -8 + bob); ctx.lineTo(-8, -4 + bob);
  ctx.lineTo(8, -4 + bob); ctx.lineTo(10, -8 + bob); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-10, -8 + bob); ctx.lineTo(-8, -4 + bob);
  ctx.lineTo(8, -4 + bob); ctx.lineTo(10, -8 + bob); ctx.stroke();
  // Eye sockets (deep)
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath(); ctx.arc(-6, -20 + bob, 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, -20 + bob, 6, 0, Math.PI * 2); ctx.fill();
  // Glowing eyes (with flicker)
  ctx.fillStyle = PAL.skeleton.eye;
  ctx.shadowColor = PAL.skeleton.eye;
  ctx.shadowBlur = 8 + fastSin(frame * 0.15) * 4;
  ctx.globalAlpha = eyeFlicker;
  ctx.beginPath(); ctx.arc(-6, -20 + bob, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, -20 + bob, 3, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  // Nose hole
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath(); ctx.moveTo(-2, -14 + bob); ctx.lineTo(0, -12 + bob); ctx.lineTo(2, -14 + bob); ctx.closePath(); ctx.fill();
  // Mouth (teeth)
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-8 + hitShake, -10 + bob, 16, 5);
  for (let t = -3; t <= 3; t++) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(t * 4 - 1 + hitShake, -10 + bob, 2, 6);
  }
  // Hit flash
  if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-30 + hitShake, -50, 60, 100); }
  if (rimColor) { ctx.strokeStyle = rimColor; ctx.lineWidth = 2; ctx.globalAlpha = 0.4; ctx.strokeRect(-28 + hitShake, -22 + bob, 56, 66); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function drawBomb(ctx, x, y, s = 1, frame = 0, opts = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const { anim = 'idle', flash = false, rimColor = null } = opts;
  const pulse = 1 + fastSin(frame * 0.12) * 0.06;
  const glow = fastSin(frame * 0.15) * 0.3 + 0.7;
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 4 : 0;
  shadow(ctx, hitShake, 30 * pulse, 22 * pulse, 6);
  ctx.scale(pulse, pulse);
  // Glow aura (layered)
  ctx.fillStyle = `rgba(241,196,15,${0.12 * glow})`;
  ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(241,196,15,${0.06 * glow})`;
  ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(255,100,50,${0.04 * glow})`;
  ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
  // Body (4-tone)
  outlined(ctx, c => arc(c, 0, 2, 24), PAL.bomb.body);
  // Body shadow layers
  ctx.fillStyle = PAL.bomb.bodyS;
  ctx.beginPath(); ctx.arc(-6, 6, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6a1a10'; ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.arc(-8, 8, 14, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Body highlight
  ctx.fillStyle = '#e04030'; ctx.globalAlpha = 0.2;
  ctx.beginPath(); ctx.arc(6, -4, 12, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Core glow (pulsing)
  ctx.fillStyle = PAL.bomb.core;
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
  const corePulse = 10 + fastSin(frame * 0.1) * 3;
  ctx.fillStyle = '#ffe066';
  ctx.beginPath(); ctx.arc(0, 0, corePulse, 0, Math.PI * 2); ctx.fill();
  // Core inner
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.4 + 0.2 * fastSin(frame * 0.15);
  ctx.beginPath(); ctx.arc(0, 0, corePulse * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Face
  eyePoint(ctx, -8, -4, '#fff', '#333');
  eyePoint(ctx, 8, -4, '#fff', '#333');
  // Angry brow in attack
  if (anim === 'attack') {
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-11, -8); ctx.lineTo(-5, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(11, -8); ctx.lineTo(5, -6); ctx.stroke();
  }
  // Zigzag mouth (enhanced)
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-9, 6); ctx.lineTo(-5, 3); ctx.lineTo(-2, 7);
  ctx.lineTo(2, 3); ctx.lineTo(5, 7); ctx.lineTo(9, 4); ctx.stroke();
  // Fuse (with glow trail)
  ctx.strokeStyle = PAL.bomb.fuse; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(8, -34); ctx.lineTo(16, -30); ctx.stroke();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(8, -34); ctx.lineTo(16, -30); ctx.stroke();
  // Fuse spark (animated, with trail)
  const sparkX = 16 + fastSin(frame * 0.2) * 2;
  const sparkY = -30 + fastCos(frame * 0.25) * 2;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(sparkX + hitShake, sparkY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sparkX + hitShake, sparkY, 2, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.shadowBlur = 0;
  // Spark trail particles
  for (let i = 0; i < 3; i++) {
    const tx = sparkX + fastSin(frame * 0.3 + i * 2) * 4;
    const ty = sparkY + i * 3;
    ctx.fillStyle = `rgba(241,196,15,${0.3 - i * 0.1})`;
    ctx.beginPath(); ctx.arc(tx, ty, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  // Hit flash
  if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-28 + hitShake, -40, 56, 80); }
  if (rimColor) { ctx.strokeStyle = rimColor; ctx.lineWidth = 2; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(0 + hitShake, 2, 28 * pulse, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function drawIronite(ctx, x, y, s = 1, frame = 0, opts = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const { anim = 'idle', flash = false, rimColor = null } = opts;
  const bob = fastSin(frame * 0.06) * 2;
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 4 : 0;
  shadow(ctx, hitShake, 42, 22, 6);
  // Body (4-tone)
  outlined(ctx, c => ellipse(c, 0, 8 + bob, 28, 30), PAL.ironite.body);
  // Body deep shadow
  ctx.fillStyle = PAL.ironite.bodyS; ctx.globalAlpha = 0.4;
  ctx.beginPath(); ctx.ellipse(-8, 14 + bob, 12, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Body highlight
  ctx.fillStyle = '#9aacac'; ctx.globalAlpha = 0.2;
  ctx.beginPath(); ctx.ellipse(6, 2 + bob, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Armor lines (rivets)
  ctx.strokeStyle = PAL.ironite.armor; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 8 + bob, 24, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 8 + bob, 24, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  // Armor rivets
  ctx.fillStyle = '#6a7a7a';
  for (let i = 0; i < 6; i++) {
    const a = i * (Math.PI * 2 / 6);
    ctx.beginPath(); ctx.arc(fastCos(a) * 24, 8 + bob + fastSin(a) * 24, 2, 0, Math.PI * 2); ctx.fill();
  }
  // Armor plate highlight
  ctx.fillStyle = '#a0b0b0'; ctx.globalAlpha = 0.15;
  ctx.beginPath(); ctx.ellipse(4, 4 + bob, 16, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Eyes (glowing, with flicker)
  const eyeGlow = 0.7 + 0.3 * fastSin(frame * 0.1);
  outlined(ctx, c => arc(c, -10, 4 + bob, 5), '#e74c3c', 1.8);
  outlined(ctx, c => arc(c, 10, 4 + bob, 5), '#e74c3c', 1.8);
  ctx.fillStyle = PAL.ironite.eye;
  ctx.shadowColor = PAL.ironite.eye; ctx.shadowBlur = 6 * eyeGlow;
  ctx.globalAlpha = eyeGlow;
  ctx.beginPath(); ctx.arc(-10, 4 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(10, 4 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  // Legs (with armor plates)
  outlined(ctx, c => rect(c, -16 + hitShake, 34 + bob, 12, 10), PAL.ironite.armor);
  outlined(ctx, c => rect(c, 4 + hitShake, 34 + bob, 12, 10), PAL.ironite.armor);
  // Leg armor detail
  ctx.fillStyle = '#5a6a6a'; ctx.globalAlpha = 0.3;
  ctx.fillRect(-14 + hitShake, 36 + bob, 4, 6);
  ctx.fillRect(6 + hitShake, 36 + bob, 4, 6);
  ctx.globalAlpha = 1;
  // Hit flash
  if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-32 + hitShake, -20 + bob, 64, 90); }
  if (rimColor) { ctx.strokeStyle = rimColor; ctx.lineWidth = 2; ctx.globalAlpha = 0.4; ctx.strokeRect(-30 + hitShake, -14 + bob, 60, 54); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function drawPlant(ctx, x, y, s = 1, frame = 0, opts = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const { anim = 'idle', flash = false, rimColor = null } = opts;
  const sway = fastSin(frame * 0.05) * 6;
  const breathe = fastSin(frame * 0.06) * 1;
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 4 : 0;
  shadow(ctx, hitShake, 44, 22, 6);
  // Stem (with depth)
  ctx.fillStyle = PAL.plant.stem;
  ctx.fillRect(-4 + sway * 0.3, 12, 8, 32);
  // Stem shadow
  ctx.fillStyle = PAL.plant.stemS; ctx.globalAlpha = 0.5;
  ctx.fillRect(-3 + sway * 0.3, 14, 3, 28);
  ctx.globalAlpha = 1;
  // Stem highlight
  ctx.fillStyle = '#40c070'; ctx.globalAlpha = 0.2;
  ctx.fillRect(1 + sway * 0.3, 14, 2, 28);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.strokeRect(-4 + sway * 0.3, 12, 8, 32);
  // Vines (with leaves)
  ctx.strokeStyle = PAL.plant.stem; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4 + sway * 0.3, 22); ctx.quadraticCurveTo(-24, 14, -20 + sway, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4 + sway * 0.3, 28); ctx.quadraticCurveTo(26, 18, 22 + sway, 10); ctx.stroke();
  // Vine leaves
  ctx.fillStyle = PAL.plant.stem;
  ctx.beginPath(); ctx.ellipse(-16 + sway, 10, 4, 6, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(18 + sway, 14, 4, 6, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.moveTo(-4 + sway * 0.3, 22); ctx.quadraticCurveTo(-24, 14, -20 + sway, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4 + sway * 0.3, 28); ctx.quadraticCurveTo(26, 18, 22 + sway, 10); ctx.stroke();
  // Flower head (with breathing)
  const headW = 26 + breathe * 0.3;
  outlined(ctx, c => ellipse(c, 0 + sway, -4, headW, 28 + breathe), PAL.plant.stem);
  // Head shadow
  ctx.fillStyle = PAL.plant.stemS; ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.ellipse(-4 + sway, 0, 14, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Mouth (enhanced)
  ctx.fillStyle = PAL.plant.mouth;
  ctx.beginPath(); ctx.ellipse(0 + sway, 4, 18, 14, 0, 0, Math.PI * 2); ctx.fill();
  // Mouth inner shadow
  ctx.fillStyle = '#8a1a1a'; ctx.globalAlpha = 0.4;
  ctx.beginPath(); ctx.ellipse(0 + sway, 6, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.ellipse(0 + sway, 4, 18, 14, 0, 0, Math.PI * 2); ctx.stroke();
  // Teeth (sharper)
  ctx.fillStyle = '#fff';
  for (let t = -3; t <= 3; t++) {
    ctx.beginPath();
    ctx.moveTo(t * 8 - 3 + sway, -2);
    ctx.lineTo(t * 8 + sway, 8);
    ctx.lineTo(t * 8 + 3 + sway, -2);
    ctx.closePath(); ctx.fill();
  }
  // Lower teeth
  for (let t = -2; t <= 2; t++) {
    ctx.beginPath();
    ctx.moveTo(t * 8 - 2 + sway, 10);
    ctx.lineTo(t * 8 + sway, 2);
    ctx.lineTo(t * 8 + 2 + sway, 10);
    ctx.closePath(); ctx.fill();
  }
  // Eyes (with angry brow in attack)
  outlined(ctx, c => arc(c, -10 + sway, -12, 6), '#fff', 1.8);
  outlined(ctx, c => arc(c, 10 + sway, -12, 6), '#fff', 1.8);
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.arc(-10 + sway, -12, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(10 + sway, -12, 3, 0, Math.PI * 2); ctx.fill();
  if (anim === 'attack') {
    ctx.strokeStyle = PAL.plant.stem; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-14 + sway, -16); ctx.lineTo(-6 + sway, -14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14 + sway, -16); ctx.lineTo(6 + sway, -14); ctx.stroke();
  }
  // Petals (dancing, with 4-tone)
  for (let i = 0; i < 7; i++) {
    const a = i * (Math.PI * 2 / 7) + fastSin(frame * 0.02) * 0.15;
    const px = fastCos(a) * 32 + sway + hitShake;
    const py = fastSin(a) * 32 - 4;
    outlined(ctx, c => ellipse(c, px, py, 9, 14), PAL.plant.petals);
    // Petal shadow
    ctx.fillStyle = PAL.plant.petalsS; ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.ellipse(px - 2, py + 2, 5, 8, a, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Hit flash
  if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-35 + hitShake, -50, 70, 100); }
  if (rimColor) { ctx.strokeStyle = rimColor; ctx.lineWidth = 2; ctx.globalAlpha = 0.4; ctx.strokeRect(-30 + hitShake, -20, 60, 70); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function drawDarkKnight(ctx, x, y, s = 1, frame = 0, opts = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const { anim = 'idle', flash = false, rimColor = null } = opts;
  const bob = fastSin(frame * 0.06) * 2;
  const clothFlutter = fastSin(frame * 0.08) * 3;
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 4 : 0;
  shadow(ctx, hitShake, 50, 26, 7);
  // Cape (behind, flowing with flutter)
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath(); ctx.moveTo(-14, -6 + bob); ctx.lineTo(-30 + clothFlutter, 32 + bob); ctx.lineTo(-12, 28 + bob); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14, -6 + bob); ctx.lineTo(28 - clothFlutter, 30 + bob); ctx.lineTo(12, 28 + bob); ctx.closePath(); ctx.fill();
  // Cape shadow
  ctx.fillStyle = '#0e0e1a'; ctx.globalAlpha = 0.4;
  ctx.beginPath(); ctx.moveTo(-12, -2 + bob); ctx.lineTo(-26 + clothFlutter, 30 + bob); ctx.lineTo(-14, 26 + bob); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // Cape highlight
  ctx.fillStyle = '#2a2a4a'; ctx.globalAlpha = 0.2;
  ctx.beginPath(); ctx.moveTo(-16, -4 + bob); ctx.lineTo(-32 + clothFlutter, 28 + bob); ctx.lineTo(-10, 26 + bob); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // Cape outline
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.moveTo(-14, -6 + bob); ctx.lineTo(-30 + clothFlutter, 32 + bob); ctx.lineTo(-12, 28 + bob); ctx.closePath(); ctx.stroke();
  // Legs
  outlined(ctx, c => rect(c, -11, 24 + bob, 10, 18), '#1a1a2e');
  outlined(ctx, c => rect(c, 1, 24 + bob, 10, 18), '#1a1a2e');
  // Leg highlight
  ctx.fillStyle = '#2a2a4a'; ctx.globalAlpha = 0.2;
  ctx.fillRect(2, 26 + bob, 3, 14);
  ctx.globalAlpha = 1;
  // Boots
  outlined(ctx, c => rect(c, -12, 40 + bob, 12, 8), '#2c3e50');
  outlined(ctx, c => rect(c, 0, 40 + bob, 12, 8), '#2c3e50');
  // Armor (4-tone)
  outlined(ctx, c => rect(c, -16, -14 + bob, 32, 40), PAL.darkknight.armor);
  // Armor shadow
  ctx.fillStyle = PAL.darkknight.armorS; ctx.globalAlpha = 0.4;
  ctx.fillRect(-14, -10 + bob, 10, 34);
  ctx.globalAlpha = 1;
  // Armor highlight
  ctx.fillStyle = '#3a3a5a'; ctx.globalAlpha = 0.3;
  ctx.fillRect(4, -12 + bob, 8, 36);
  ctx.globalAlpha = 1;
  // Plate details (with rivets)
  outlined(ctx, c => rect(c, -12, -8 + bob, 10, 22), PAL.darkknight.plate);
  outlined(ctx, c => rect(c, 2, -8 + bob, 10, 22), PAL.darkknight.plate);
  // Plate highlights
  ctx.fillStyle = '#4a4a6a'; ctx.globalAlpha = 0.2;
  ctx.fillRect(3, -6 + bob, 4, 18);
  ctx.globalAlpha = 1;
  // Armor rivets
  ctx.fillStyle = '#5a5a7a';
  for (const rx of [-14, -6, 6, 14]) {
    ctx.beginPath(); ctx.arc(rx, -12 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx, 18 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  // Belt
  ctx.fillStyle = '#2a1a0a';
  ctx.fillRect(-16, 18 + bob, 32, 5);
  ctx.fillStyle = '#c0a020';
  ctx.fillRect(-4, 18 + bob, 8, 5);
  // Helmet (4-tone)
  outlined(ctx, c => arc(c, 0, -24 + bob, 18), PAL.darkknight.armor);
  // Helmet shadow
  ctx.fillStyle = PAL.darkknight.armorS; ctx.globalAlpha = 0.4;
  ctx.beginPath(); ctx.arc(-6, -22 + bob, 12, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Helmet highlight
  ctx.fillStyle = '#3a3a5a'; ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.arc(6, -26 + bob, 8, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Horns (with depth)
  ctx.fillStyle = PAL.darkknight.armorS;
  ctx.beginPath(); ctx.moveTo(-14, -32 + bob); ctx.lineTo(-18, -48 + bob); ctx.lineTo(-8, -36 + bob); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14, -32 + bob); ctx.lineTo(18, -48 + bob); ctx.lineTo(8, -36 + bob); ctx.closePath(); ctx.fill();
  // Horn highlights
  ctx.fillStyle = '#3a3a5a'; ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.moveTo(-12, -34 + bob); ctx.lineTo(-16, -46 + bob); ctx.lineTo(-10, -36 + bob); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.moveTo(-14, -32 + bob); ctx.lineTo(-18, -48 + bob); ctx.lineTo(-8, -36 + bob); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, -32 + bob); ctx.lineTo(18, -48 + bob); ctx.lineTo(8, -36 + bob); ctx.closePath(); ctx.stroke();
  // Red eyes (glowing, with flicker)
  const eyeGlow = 0.7 + 0.3 * fastSin(frame * 0.12);
  ctx.fillStyle = PAL.darkknight.eye;
  ctx.shadowColor = PAL.darkknight.eye; ctx.shadowBlur = 12 * eyeGlow;
  ctx.globalAlpha = eyeGlow;
  ctx.beginPath(); ctx.arc(-6, -24 + bob, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, -24 + bob, 4, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  // Plume (with flutter)
  ctx.fillStyle = PAL.darkknight.plume;
  ctx.beginPath(); ctx.moveTo(0, -40 + bob); ctx.lineTo(14 + clothFlutter * 0.5, -56 + bob); ctx.lineTo(-4, -54 + bob); ctx.closePath(); ctx.fill();
  // Plume shadow
  ctx.fillStyle = '#8a1a1a'; ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.moveTo(0, -42 + bob); ctx.lineTo(10 + clothFlutter * 0.5, -54 + bob); ctx.lineTo(-2, -52 + bob); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.moveTo(0, -40 + bob); ctx.lineTo(14 + clothFlutter * 0.5, -56 + bob); ctx.lineTo(-4, -54 + bob); ctx.closePath(); ctx.stroke();
  // Greatsword (enhanced with metal sheen)
  ctx.fillStyle = '#8a8a9a';
  ctx.fillRect(26 + hitShake, -40 + bob, 6, 58);
  // Blade shadow
  ctx.fillStyle = '#6a6a7a'; ctx.globalAlpha = 0.4;
  ctx.fillRect(25 + hitShake, -38 + bob, 2, 54);
  ctx.globalAlpha = 1;
  // Blade highlight
  ctx.fillStyle = '#c0c0d0'; ctx.globalAlpha = 0.4;
  ctx.fillRect(30 + hitShake, -38 + bob, 1, 54);
  ctx.globalAlpha = 1;
  // Blade edge
  ctx.fillStyle = '#e0e0f0'; ctx.globalAlpha = 0.3;
  ctx.fillRect(31 + hitShake, -38 + bob, 1, 54);
  ctx.globalAlpha = 1;
  // Crossguard
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(24 + hitShake, -42 + bob, 10, 6);
  // Crossguard highlight
  ctx.fillStyle = '#ffe066'; ctx.globalAlpha = 0.3;
  ctx.fillRect(25 + hitShake, -41 + bob, 8, 2);
  ctx.globalAlpha = 1;
  // Handle
  ctx.fillStyle = '#3a1a0a';
  ctx.fillRect(28 + hitShake, -36 + bob, 2, 10);
  // Sword pommel
  outlined(ctx, c => arc(c, 29 + hitShake, 18 + bob, 7), '#c0392b');
  // Pommel glow
  ctx.fillStyle = '#e04040'; ctx.globalAlpha = 0.3 + 0.2 * fastSin(frame * 0.08);
  ctx.beginPath(); ctx.arc(29 + hitShake, 18 + bob, 5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Hit flash
  if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-20 + hitShake, -58 + bob, 40, 110); }
  if (rimColor) { ctx.strokeStyle = rimColor; ctx.lineWidth = 2; ctx.globalAlpha = 0.4; ctx.strokeRect(-18 + hitShake, -16 + bob, 36, 44); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function drawKuja(ctx, x, y, s = 1, frame = 0, opts = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const { anim = 'idle', flash = false, rimColor = null } = opts;
  const flt = fastSin(frame * 0.05) * 5;
  const breathe = fastSin(frame * 0.06) * 1;
  const clothFlutter = fastSin(frame * 0.07) * 2;
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 4 : 0;
  shadow(ctx, hitShake, 44 + flt, 24, 5);
  // Aura (layered, pulsing)
  const auraPulse = 0.10 + fastSin(frame * 0.04) * 0.05;
  ctx.fillStyle = `rgba(106,27,154,${auraPulse})`;
  ctx.beginPath(); ctx.arc(0, 8 + flt, 42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(142,68,173,${auraPulse * 0.5})`;
  ctx.beginPath(); ctx.arc(0, 8 + flt, 38, 0, Math.PI * 2); ctx.fill();
  // Coat (with depth, 4-tone)
  const coatW = 16 + breathe * 0.1;
  outlined(ctx, c => rect(c, -coatW, -6 + flt, coatW * 2, 40), PAL.kuja.coat);
  // Coat shadow
  ctx.fillStyle = PAL.kuja.coatS; ctx.globalAlpha = 0.5;
  ctx.fillRect(-coatW + 2, 4 + flt, 10, 28);
  ctx.globalAlpha = 0.25;
  ctx.fillRect(-coatW + 4, 8 + flt, 6, 22);
  ctx.globalAlpha = 1;
  // Coat highlight
  ctx.fillStyle = PAL.kuja.coatH; ctx.globalAlpha = 0.3;
  ctx.fillRect(coatW - 6, 2 + flt, 4, 24);
  ctx.globalAlpha = 1;
  // Coat hem flutter
  ctx.fillStyle = '#6a1a8a'; ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(-coatW, 34 + flt);
  ctx.quadraticCurveTo(-coatW - clothFlutter, 42 + flt, -coatW + 4, 36 + flt);
  ctx.lineTo(-coatW + 4, 34 + flt);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // Belt
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(-coatW + 2, 12 + flt, coatW * 2 - 4, 3);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.strokeRect(-coatW + 2, 12 + flt, coatW * 2 - 4, 3);
  // Belt buckle
  ctx.fillStyle = '#ffe066'; ctx.globalAlpha = 0.4;
  ctx.fillRect(-2, 12 + flt, 4, 3);
  ctx.globalAlpha = 1;
  // Head
  outlined(ctx, c => arc(c, 0, -18 + flt, 16), PAL.kuja.skin);
  // Head shadow
  ctx.fillStyle = '#c09a7a'; ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.arc(-4, -16 + flt, 10, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Hair (flowing with strands)
  ctx.fillStyle = PAL.kuja.hair;
  ctx.beginPath(); ctx.arc(0, -26 + flt, 16, Math.PI, 0); ctx.fill();
  ctx.fillRect(-16, -22 + flt, 5, 24);
  ctx.fillRect(11, -22 + flt, 5, 24);
  // Hair shadow
  ctx.fillStyle = '#4a1a4a'; ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.arc(-4, -28 + flt, 10, Math.PI, 0); ctx.fill();
  ctx.globalAlpha = 1;
  // Hair highlight
  ctx.fillStyle = '#9a3a9a'; ctx.globalAlpha = 0.2;
  ctx.beginPath(); ctx.arc(6, -30 + flt, 6, Math.PI, 0); ctx.fill();
  ctx.globalAlpha = 1;
  // Hair strand highlights
  ctx.strokeStyle = '#9a3a9a'; ctx.lineWidth = 1; ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.moveTo(-12, -18 + flt); ctx.lineTo(-14, -4 + flt); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12, -18 + flt); ctx.lineTo(14, -4 + flt); ctx.stroke();
  ctx.globalAlpha = 1;
  // Hair outline
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.arc(0, -26 + flt, 16, Math.PI, 0); ctx.stroke();
  ctx.strokeRect(-16, -22 + flt, 5, 24);
  ctx.strokeRect(11, -22 + flt, 5, 24);
  // Eyes (narrow, menacing, with glow)
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -18 + flt); ctx.lineTo(-3, -15 + flt); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, -15 + flt); ctx.lineTo(9, -18 + flt); ctx.stroke();
  // Eye glow
  ctx.fillStyle = '#c0392b';
  ctx.shadowColor = '#c0392b'; ctx.shadowBlur = 4;
  ctx.globalAlpha = 0.4 + 0.2 * fastSin(frame * 0.1);
  ctx.beginPath(); ctx.arc(-6, -17 + flt, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, -17 + flt, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  // Feathers (with shimmer)
  for (let i = 0; i < 5; i++) {
    const a = i * 1.0 + 0.3;
    const fx = fastCos(a) * 34;
    const fy = fastSin(a) * 14 + 16 + flt;
    outlined(ctx, c => ellipse(c, fx, fy, 5, 12), PAL.kuja.feathers);
    // Feather highlight
    ctx.fillStyle = '#c090d0'; ctx.globalAlpha = 0.2;
    ctx.beginPath(); ctx.ellipse(fx + 1, fy - 2, 2, 6, a, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Legs
  outlined(ctx, c => rect(c, -9, 34 + flt, 8, 14), '#4a235a');
  outlined(ctx, c => rect(c, 1, 34 + flt, 8, 14), '#4a235a');
  // Leg highlight
  ctx.fillStyle = '#6a3a7a'; ctx.globalAlpha = 0.2;
  ctx.fillRect(2, 36 + flt, 3, 10);
  ctx.globalAlpha = 1;
  // Energy orbs (pulsing, with trails)
  const orbGlow = 0.3 + fastSin(frame * 0.06) * 0.15;
  ctx.fillStyle = `rgba(241,196,15,${orbGlow})`;
  ctx.beginPath(); ctx.arc(-28 + hitShake, 6 + flt, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(28 + hitShake, 8 + flt, 7, 0, Math.PI * 2); ctx.fill();
  // Orb inner
  ctx.fillStyle = '#ffe066';
  ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 6;
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.arc(-28 + hitShake, 6 + flt, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(28 + hitShake, 8 + flt, 3, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  // Orb trail particles
  for (let i = 0; i < 2; i++) {
    const tx = -28 + fastSin(frame * 0.1 + i * 3) * 3;
    const ty = 6 + flt + i * 4;
    ctx.fillStyle = `rgba(241,196,15,${0.15 - i * 0.05})`;
    ctx.beginPath(); ctx.arc(tx, ty, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  // Hit flash
  if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-20 + hitShake, -52 + flt, 40, 100); }
  if (rimColor) { ctx.strokeStyle = rimColor; ctx.lineWidth = 2; ctx.globalAlpha = 0.4; ctx.strokeRect(-18 + hitShake, -20 + flt, 36, 50); ctx.globalAlpha = 1; }
  ctx.restore();
}

// ─── Dispatch ────────────────────────────────────────────────────────────

export function drawCharacter(ctx, id, x, y, s = 1, frame = 0, opts = {}) {
  const anim = opts.anim || 'idle';
  const flash = opts.flash ? 1 : 0;
  const rim = opts.rimColor || '';
  const alpha = opts.alpha ?? 1;
  const bucket = Math.floor(frame / SPRITE_BUCKET);
  const key = `char_${id}_${anim}_${flash}_${rim}_${alpha}_${s}`;
  let entry = _spriteCache.get(key);
  if (!entry) {
    entry = { canvas: document.createElement('canvas'), bucket: -1 };
    entry.canvas.width = SPRITE_OFF; entry.canvas.height = SPRITE_OFF;
    _spriteCache.set(key, entry); _evictSpriteCache();
  }
  if (entry.bucket !== bucket) {
    const octx = entry.canvas.getContext('2d');
    octx.clearRect(0, 0, SPRITE_OFF, SPRITE_OFF);
    switch (id) {
      case 'zidane': drawHeroLuan(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
      case 'knight': drawHeroAldric(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
      case 'mage':   drawHeroMira(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
      case 'healer': drawHeroSelia(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
      default:       drawHeroLuan(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
    }
    entry.bucket = bucket;
  }
  ctx.drawImage(entry.canvas, x - SPRITE_AX, y - SPRITE_AY);
}

export function drawEnemySprite(ctx, model, x, y, s = 1, frame = 0, opts = {}) {
  const anim = opts.anim || 'idle';
  const flash = opts.flash ? 1 : 0;
  const rim = opts.rimColor || '';
  const alpha = opts.alpha ?? 1;
  const bucket = Math.floor(frame / SPRITE_BUCKET);
  const key = `enemy_${model}_${anim}_${flash}_${rim}_${alpha}_${s}`;
  let entry = _spriteCache.get(key);
  if (!entry) {
    entry = { canvas: document.createElement('canvas'), bucket: -1 };
    entry.canvas.width = SPRITE_OFF; entry.canvas.height = SPRITE_OFF;
    _spriteCache.set(key, entry); _evictSpriteCache();
  }
  if (entry.bucket !== bucket) {
    const octx = entry.canvas.getContext('2d');
    octx.clearRect(0, 0, SPRITE_OFF, SPRITE_OFF);
    // Try image atlas first, fall back to procedural
    if (!drawEnemyImage(model, octx, SPRITE_AX, SPRITE_AY, s, frame, opts)) {
      switch (model) {
        case 'goblin':     drawGoblin(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
        case 'fuse':       drawFuse(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
        case 'skeleton':   drawSkeleton(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
        case 'bomb':       drawBomb(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
        case 'ironite':    drawIronite(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
        case 'plant':      drawPlant(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
        case 'darkknight': drawDarkKnight(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
        case 'kuja':       drawKuja(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
        default:           drawGoblin(octx, SPRITE_AX, SPRITE_AY, s, frame, opts); break;
      }
    }
    entry.bucket = bucket;
  }
  ctx.drawImage(entry.canvas, x - SPRITE_AX, y - SPRITE_AY);
}

// ─── Image-based sprite rendering (4x2 sheet frames + cel-shading) ─────────

const HERO_CELL_BASE = 0.34;   // char ≈ 384 * 0.34 ≈ 130px tall at s=1
const ENEMY_CELL_BASE = 0.42;  // enemies slightly bigger

/**
 * Draw a hero using the sliced animation frame (4x2 sheet).
 * Falls back to procedural drawLuan/etc if frame missing.
 */
function drawHeroFrameCanvas(heroId, ctx, x, y, s = 1, frame = 0, opts = {}) {
  const cv = getHeroFrame(heroId, opts.anim || 'idle');
  if (!cv) return false;

  const { anim = 'idle', flash = false, rimColor = null, alpha = 1 } = opts;
  const bob = fastSin(frame * 0.08) * 2;
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 4 : 0;
  const attackLunge = anim === 'attack' ? 8 : 0;

  const tw = cv.width * HERO_CELL_BASE * s;
  const th = cv.height * HERO_CELL_BASE * s;
  const footPad = th * 0.04;

  ctx.save();
  ctx.translate(x + hitShake + attackLunge, y + bob);
  ctx.globalAlpha = alpha;

  // Shadow at feet
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(0, 4, tw * 0.32, th * 0.05, 0, 0, 6.2832);
  ctx.fill();

  // Sprite (bottom-aligned to y)
  ctx.drawImage(cv, -tw / 2, -th + footPad, tw, th);

  if (flash) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.3 * fastSin(frame * 0.3)})`;
    ctx.fillRect(-tw / 2, -th, tw, th);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (anim === 'dying') ctx.globalAlpha = Math.max(0, alpha * (1 - frame / 30));
  if (rimColor) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.shadowColor = rimColor; ctx.shadowBlur = 14;
    ctx.drawImage(cv, -tw / 2, -th + footPad, tw, th);
    ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  }
  ctx.restore();
  return true;
}

// Hero image drawers (fallback to procedural if not loaded)
export function drawHeroLuan(ctx, x, y, s, frame, opts) {
  if (!drawHeroFrameCanvas('luan', ctx, x, y, s, frame, opts)) drawLuan(ctx, x, y, s, frame, opts);
}
export function drawHeroAldric(ctx, x, y, s, frame, opts) {
  if (!drawHeroFrameCanvas('aldric', ctx, x, y, s, frame, opts)) drawAldric(ctx, x, y, s, frame, opts);
}
export function drawHeroMira(ctx, x, y, s, frame, opts) {
  if (!drawHeroFrameCanvas('mira', ctx, x, y, s, frame, opts)) drawMira(ctx, x, y, s, frame, opts);
}
export function drawHeroSelia(ctx, x, y, s, frame, opts) {
  if (!drawHeroFrameCanvas('selia', ctx, x, y, s, frame, opts)) drawSelia(ctx, x, y, s, frame, opts);
}

/**
 * Draw enemy using sliced atlas frame (single static frame per type),
 * with procedural bob/hit/flash anim. Fallback to procedural sprite if missing.
 */
export function drawEnemyImage(model, ctx, x, y, s = 1, frame = 0, opts = {}) {
  const cv = getEnemyFrame(model);
  if (!cv) return false;

  const { anim = 'idle', flash = false, alpha = 1 } = opts;
  const bob = fastSin(frame * 0.1) * 3;
  const hitShake = anim === 'hit' ? fastSin(frame * 0.5) * 4 : 0;
  const attackLunge = anim === 'attack' ? 6 : 0;

  const tw = cv.width * ENEMY_CELL_BASE * s;
  const th = cv.height * ENEMY_CELL_BASE * s;
  const footPad = th * 0.04;

  const dx = x + hitShake + attackLunge;
  const dy = y + bob;

  // Shadow (cheap ellipse, no save/restore)
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(dx, dy + 4, tw * 0.3, th * 0.05, 0, 0, 6.2832);
  ctx.fill();

  ctx.globalAlpha = alpha;
  ctx.drawImage(cv, dx - tw / 2, dy - th + footPad, tw, th);
  ctx.globalAlpha = 1;

  if (flash) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.3 * fastSin(frame * 0.3)})`;
    ctx.fillRect(dx - tw / 2, dy - th, tw, th);
    ctx.restore();
  }
  if (anim === 'dying') {
    ctx.globalAlpha = Math.max(0, alpha * (1 - frame / 30));
    ctx.drawImage(cv, dx - tw / 2, dy - th + footPad, tw, th);
    ctx.globalAlpha = 1;
  }
  return true;
}
