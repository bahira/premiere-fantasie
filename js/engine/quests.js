// engine/quests.js — Quest system (main + side quests)
// Tracks active/completed quests, objectives, rewards. Hooks NPC talk / battle win / pickup / POI.
// GAME.quests holds runtime state. QUESTS registry holds definitions.

import { GAME } from '../state.js';
import { SIDE_QUESTS } from '../data/sidequests.js';
import { dialogue } from './dialogue.js';
import { audio } from './audio.js';

export const QUESTS = {};

// Register a quest definition
export function registerQuest(def) {
  QUESTS[def.id] = def;
}

// Initialize GAME.quests if missing
function ensureState() {
  if (!GAME.quests) {
    GAME.quests = { active: {}, completed: {}, failed: {}, tracker: [] };
  }
  return GAME.quests;
}

// Start a quest by id (main or side)
export function startQuest(id) {
  const def = QUESTS[id] || SIDE_QUESTS[id];
  if (!def) { console.warn('Quest not found:', id); return false; }
  const st = ensureState();
  if (st.completed[id] || st.active[id]) return false;
  st.active[id] = {
    id,
    objectives: def.objectives.map(o => ({ ...o, progress: 0, done: false })),
    startedAt: GAME.chapterId,
  };
  st.tracker.push(id);
  audio.sfx('quest_start');
  if (def.onStart) def.onStart();
  return true;
}

// Update a quest objective by key (e.g. 'kill_goblins', count=1)
export function updateObjective(questId, objectiveKey, amount = 1) {
  const st = ensureState();
  const q = st.active[questId];
  if (!q) return;
  let allDone = true;
  for (const o of q.objectives) {
    if (o.key === objectiveKey && !o.done) {
      o.progress = Math.min(o.target, o.progress + amount);
      if (o.progress >= o.target) o.done = true;
    }
    if (!o.done) allDone = false;
  }
  if (allDone) completeQuest(questId);
}

// Generic event hooks (called from other systems)
export function onEvent(event, payload = {}) {
  const st = ensureState();
  for (const id of Object.keys(st.active)) {
    const def = QUESTS[id] || SIDE_QUESTS[id];
    if (!def || !def.onEvent) continue;
    def.onEvent(event, payload, { updateObjective, completeQuest });
  }
}

// Complete a quest + grant rewards
export function completeQuest(id) {
  const def = QUESTS[id] || SIDE_QUESTS[id];
  const st = ensureState();
  if (!st.active[id] || st.completed[id]) return;
  st.completed[id] = { id, at: GAME.chapterId };
  delete st.active[id];
  st.tracker = st.tracker.filter(x => x !== id);
  // Rewards
  if (def.rewards) {
    const inv = GAME.inventory;
    if (def.rewards.gold) inv.gold += def.rewards.gold;
    if (def.rewards.items) for (const it of def.rewards.items) inv.add(it.id, it.count || 1);
    if (def.rewards.flags) for (const f of def.rewards.flags) GAME.flags[f] = true;
  }
  audio.sfx('quest_complete');
  if (def.onComplete) def.onComplete();
  // Show completion popup
  dialogue.show({
    speaker: 'Quete terminee',
    lines: [`${def.title} — Terminee !`, def.rewards?.gold ? `Recompense: ${def.rewards.gold} gil` : 'Recompense recue.'],
    onDone: () => {},
  });
}

// Get active quests for HUD tracker
export function getTracker() {
  const st = ensureState();
  return st.tracker.map(id => {
    const def = QUESTS[id] || SIDE_QUESTS[id];
    const q = st.active[id];
    return { id, title: def?.title || id, objectives: q?.objectives || [] };
  });
}

// Quest log data for menu
export function getQuestLog() {
  const st = ensureState();
  const all = [...Object.keys(st.active), ...Object.keys(st.completed)];
  return all.map(id => {
    const def = QUESTS[id] || SIDE_QUESTS[id];
    return {
      id, title: def?.title || id,
      status: st.completed[id] ? 'done' : 'active',
      description: def?.description || '',
      objectives: st.active[id]?.objectives || [],
    };
  });
}

// Hook: when player talks to an NPC, check for quest-giving NPCs
export function talkToNPC(npcId) {
  const st = ensureState();
  for (const id of Object.keys(SIDE_QUESTS)) {
    const q = SIDE_QUESTS[id];
    if (q.giver === npcId && !st.active[id] && !st.completed[id]) {
      if (q.requires && !q.requires(GAME)) continue;
      if (startQuest(id)) {
        if (q.intro) dialogue.show({ speaker: q.giverName || '?', lines: q.intro });
        return true;
      }
    }
  }
  return false;
}

// Hook: battle victory — update kill-based objectives
export function onBattleWin(enemyId, enemiesDefeated = []) {
  onEvent('battle_win', { enemyId, enemiesDefeated });
}

// Hook: item pickup
export function onPickup(itemId) {
  onEvent('pickup', { itemId });
}

// Hook: POI interaction
export function onPOI(poiId) {
  onEvent('poi', { poiId });
}

// Render tracker HUD (called from battle_ui or field)
export function renderTrackerHUD(ctx, x, y) {
  const tracker = getTracker();
  if (!tracker.length) return;
  ctx.save();
  ctx.font = '12px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - 6, y - 6, 220, 18 * tracker.length + 12);
  let yy = y + 8;
  for (const t of tracker) {
    ctx.fillStyle = '#ffe08a';
    ctx.fillText('◆ ' + t.title, x, yy);
    yy += 16;
    for (const o of t.objectives) {
      ctx.fillStyle = o.done ? '#5cff8f' : '#cccccc';
      ctx.fillText(`   ${o.done ? '✓' : '·'} ${o.label} (${o.progress}/${o.target})`, x, yy);
      yy += 14;
    }
  }
  ctx.restore();
}
