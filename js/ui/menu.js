// ui/menu.js — FFIX-style main menu (command ring-like)
// Enhanced with Job system, Pet system, keyboard shortcuts
import { GAME } from '../state.js';
import { learnedSkills } from '../engine/progression.js';
import { getItem } from '../data/items.js';
import { getSkill } from '../data/skills.js';
import { audio } from '../engine/audio.js';
import { saveGame, hasSave, clearSave } from '../engine/save.js';
import { getCharDef } from '../data/helpers.js';
import { ENEMIES } from '../data/enemies.js';
import { STORY } from '../data/story.js';
import { JOBS, getJobSkills } from '../data/jobs.js';
import { PETS, getPetAbilities } from '../data/pets.js';
import { keyboard } from '../engine/keyboard.js';

export class GameMenu {
  constructor() {
    this.root = null;
    this.cur = 0;
    this.items = [];
    this._memberIdx = 0;
    this._bestiarySeen = GAME._bestiarySeen || [];
    this._subPanel = null; // for nested panels (jobs, pets)
  }

  open() {
    audio.sfx('menu_open');
    GAME.prevScene = GAME.scene;
    GAME.scene = 'menu';
    this._subPanel = null;
    this._build();
    this._render();
  }

  close() {
    audio.sfx('menu_close');
    GAME.scene = GAME.prevScene || 'field';
    if (this.root) { this.root.remove(); this.root = null; }
    this._subPanel = null;
  }

  _build() {
    if (this.root) this.root.remove();
    this.root = document.createElement('div');
    this.root.id = 'rpg-menu';

    // Layout-aware key hints
    const isAzerty = keyboard.layout === 'azerty';
    const moveHint = isAzerty ? 'ZQSD' : 'WASD';
    const menuHint = isAzerty ? 'Échap' : 'Esc';
    const confirmHint = isAzerty ? 'Entrée' : 'Enter';

    this.root.innerHTML = `
      <div class="mm-side">
        <div class="mm-portrait" id="mm-portrait"></div>
        <div class="mm-name" id="mm-name"></div>
        <div class="mm-class" id="mm-class"></div>
        <div class="mm-job" id="mm-job"></div>
        <div class="mm-pet" id="mm-pet"></div>
        <div class="mm-stats" id="mm-stats"></div>
        <div class="mm-shortcuts">
          <small>◂▸ ${isAzerty ? 'Q/D' : 'A/D'}: Membre</small><br>
          <small>${moveHint}: Naviguer · ${confirmHint}: Valider</small><br>
          <small>${menuHint}: Fermer</small>
        </div>
      </div>
      <div class="mm-list" id="mm-list"></div>
      <div class="mm-detail" id="mm-detail"></div>`;
    document.body.appendChild(this.root);

    this.items = [
      { label: 'Objets',      icon: '🧪', action: () => this._panelItems() },
      { label: 'Équipement',  icon: '⚔️', action: () => this._panelEquip() },
      { label: 'Capacités',   icon: '✨', action: () => this._panelAbilities() },
      { label: 'Classe',      icon: '🎭', action: () => this._panelJobs() },
      { label: 'Familier',    icon: '🐾', action: () => this._panelPets() },
      { label: 'Statut',      icon: '📊', action: () => this._panelStatus() },
      { label: 'Bestiaire',   icon: '📖', action: () => this._panelBestiary() },
      { label: 'Sauvegarder', icon: '💾', action: () => this._panelSave() },
      { label: 'Quitter',     icon: '🚪', action: () => this.close() },
    ];
    this.cur = 0;
    this._bindKeys();
  }

  _bindKeys() {
    this._kb = (e) => {
      if (GAME.scene !== 'menu') return;
      // Sub-panel back navigation
      if (this._subPanel && (e.code === 'Escape' || e.code === 'Backspace')) {
        this._subPanel = null;
        audio.sfx('cancel');
        this._renderDetail();
        return;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { this.cur = (this.cur + 1) % this.items.length; audio.sfx('cursor'); this._renderList(); }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') { this.cur = (this.cur - 1 + this.items.length) % this.items.length; audio.sfx('cursor'); this._renderList(); }
      else if (e.code === 'ArrowLeft' || e.code === 'KeyQ' || e.code === 'KeyA') { this._cycleMember(-1); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { this._cycleMember(1); }
      else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); audio.sfx('confirm'); this.items[this.cur].action(); }
      else if (e.code === 'Escape' || e.code === 'Backspace') { this._close2(); }
    };
    window.addEventListener('keydown', this._kb);
    this._close2 = () => { window.removeEventListener('keydown', this._kb); this.close(); };
    this.root.addEventListener('click', (e) => {
      const it = e.target.closest('.mm-item'); if (!it) return;
      this.cur = +it.dataset.i; audio.sfx('confirm'); this.items[this.cur].action();
    });
  }

  _cycleMember(dir) {
    if (!GAME.party.length) return;
    this._memberIdx = (this._memberIdx + dir + GAME.party.length) % GAME.party.length;
    audio.sfx('cursor');
    this._renderSide();
    // If in a panel that shows per-member data, refresh it
    if (this._subPanel) this._subPanel();
  }

  _render() { this._renderSide(); this._renderList(); this._renderDetail(); }

  _renderSide() {
    const m = GAME.party[this._memberIdx] || GAME.party[0] || null;
    const p = document.getElementById('mm-portrait');
    const n = document.getElementById('mm-name');
    const c = document.getElementById('mm-class');
    const jobEl = document.getElementById('mm-job');
    const petEl = document.getElementById('mm-pet');
    const s = document.getElementById('mm-stats');
    if (m) {
      const CHAR = getChar(m.id);
      p.textContent = CHAR.portrait;
      n.textContent = m.name + (GAME.party.length > 1 ? '  ◂▸' : '');
      c.textContent = CHAR.class + ' · Niv.' + m.level;

      // Job info
      const jobState = GAME.jobs[m.id];
      if (jobState && JOBS[jobState.jobId]) {
        const job = JOBS[jobState.jobId];
        jobEl.textContent = `${job.icon} ${job.name} Niv.${jobState.level}`;
        jobEl.style.display = 'block';
      } else {
        jobEl.style.display = 'none';
      }

      // Pet info
      const petState = GAME.pets[m.id];
      if (petState && PETS[petState.petId]) {
        const pet = PETS[petState.petId];
        petEl.textContent = `${pet.icon} ${pet.name} Niv.${petState.level || 1}`;
        petEl.style.display = 'block';
      } else {
        petEl.textContent = 'Aucun familier';
        petEl.style.display = 'block';
      }

      const xpNext = (m.xpNext || 100);
      const xpPct = Math.min(100, Math.floor((m.xp / xpNext) * 100));
      s.innerHTML = `HP ${m.hp}/${m.maxHp}<br>PM ${m.mp}/${m.maxMp}<br>FOR ${m.stats.str} · MAG ${m.stats.mag}<br>VIT ${m.stats.vit} · DEF ${m.stats.def}<br>RAP ${m.stats.spd} · CHN ${m.stats.luck}<br><div class="ap-bar"><div style="width:${xpPct}%"></div></div><small>XP ${m.xp}/${xpNext}</small>`;
    }
  }

  _renderList() {
    const el = document.getElementById('mm-list'); if (!el) return;
    el.innerHTML = this.items.map((it, i) =>
      `<div class="mm-item ${i===this.cur?'sel':''}" data-i="${i}">
        <span class="mm-item-icon">${it.icon}</span>
        <span class="mm-item-label">${i===this.cur?'▸ ':''}${it.label}</span>
      </div>`
    ).join('');
  }

  _renderDetail(msg = 'Choisis une action.') {
    const el = document.getElementById('mm-detail'); if (!el) return;
    el.innerHTML = `<div class="mm-detail-title">Menu</div><div class="mm-detail-body">${msg}</div>`;
  }

  // ─── OBJETS ──────────────────────────────────────────────────────────

  _panelItems() {
    this._subPanel = () => this._panelItems();
    const items = GAME.inventory.listItems();
    if (!items.length) { this._renderDetail('Aucun objet.'); return; }
    const html = items.map(it =>
      `<div class="mm-row"><span>${it.icon||'🧪'} ${it.name}</span><span>×${it.count}</span><br><small>${it.desc||''}</small></div>`
    ).join('');
    this._renderDetail(`<b>Objets</b><br>${html}`);
  }

  // ─── ÉQUIPEMENT ──────────────────────────────────────────────────────

  _panelEquip() {
    this._subPanel = () => this._panelEquip();
    if (!GAME.party.length) { this._renderDetail('Aucun membre.'); return; }
    const m = GAME.party[this._memberIdx] || GAME.party[0];
    const curStats = { atk: 0, mag: 0, def: 0 };
    for (const slot of ['weapon','armor','accessory']) {
      const id = m.equipped[slot]; const it = id ? getItem(id) : null;
      if (it) { if (it.atk) curStats.atk += it.atk; if (it.mag) curStats.mag += it.mag; if (it.def) curStats.def += it.def; }
    }
    let html = `<b>${m.name} — Équipement</b><br>`;
    for (const slot of ['weapon','armor','accessory']) {
      const id = m.equipped[slot]; const it = id ? getItem(id) : null;
      const stats = it ? ` [ATK${it.atk||0} MAG${it.mag||0}]` : '';
      html += `<div class="mm-row equip-slot" data-slot="${slot}" style="cursor:pointer;" title="Cliquer pour déséquiper">
        <span>${slotName(slot)}</span><span>${it? (it.icon||'')+' '+it.name+stats : '—'}</span></div>`;
    }
    const owned = GAME.inventory.listEquipment();
    const equipOwned = owned.filter(o => {
      const it = getItem(o.id);
      return it && (it.type === 'weapon' || it.type === 'armor' || it.type === 'accessory');
    });
    if (equipOwned.length > 0) {
      html += '<br><b>Stock (cliquer pour équiper)</b><br>';
      for (const o of equipOwned) {
        const it = getItem(o.id);
        const newStats = { atk: it.atk || 0, mag: it.mag || 0, def: it.def || 0 };
        const diffAtk = newStats.atk - curStats.atk;
        const diffMag = newStats.mag - curStats.mag;
        const diffDef = newStats.def - curStats.def;
        const diffHtml = [
          diffAtk !== 0 ? `<span class="stat-diff ${diffAtk > 0 ? 'pos' : 'neg'}">ATK${diffAtk > 0 ? '▲' : '▼'}${Math.abs(diffAtk)}</span>` : '',
          diffMag !== 0 ? `<span class="stat-diff ${diffMag > 0 ? 'pos' : 'neg'}">MAG${diffMag > 0 ? '▲' : '▼'}${Math.abs(diffMag)}</span>` : '',
          diffDef !== 0 ? `<span class="stat-diff ${diffDef > 0 ? 'pos' : 'neg'}">DEF${diffDef > 0 ? '▲' : '▼'}${Math.abs(diffDef)}</span>` : '',
        ].filter(Boolean).join(' ');
        html += `<div class="mm-row equip-stock" data-equip="${o.id}" style="cursor:pointer;">
          <span>${it.icon||''} ${it.name} ×${o.count}</span>
          <span class="stat-diffs">${diffHtml || '<small style="color:var(--muted)">=</small>'}</span></div>`;
      }
    }
    this._renderDetail(html);
    setTimeout(() => {
      const detail = this.root?.querySelector('.mm-detail-body');
      if (!detail) return;
      detail.querySelectorAll('.equip-slot[data-slot]').forEach(el => {
        el.onclick = () => {
          const slot = el.dataset.slot;
          if (m.equipped[slot]) {
            GAME.inventory.add(m.equipped[slot], 1);
            m.equipped[slot] = null;
            audio.sfx('confirm');
            this._panelEquip();
          }
        };
      });
      detail.querySelectorAll('.equip-stock[data-equip]').forEach(el => {
        el.onclick = () => {
          const itemId = el.dataset.equip;
          const it = getItem(itemId);
          if (!it) return;
          const slot = it.slot || it.type;
          if (m.equipped[slot]) GAME.inventory.add(m.equipped[slot], 1);
          GAME.inventory.add(itemId, -1);
          m.equipped[slot] = itemId;
          audio.sfx('equip');
          this._panelEquip();
        };
      });
    }, 50);
  }

  // ─── CAPACITÉS ───────────────────────────────────────────────────────

  _panelAbilities() {
    this._subPanel = () => this._panelAbilities();
    if (!GAME.party.length) return;
    const m = GAME.party[this._memberIdx] || GAME.party[0];
    const learned = learnedSkills(m);
    let html = `<b>${m.name} — Capacités</b><br>`;

    // Learned skills
    if (learned.length > 0) {
      html += '<b style="color:#f1c40f">Apprises</b><br>';
      for (const s of learned) html += `<div class="mm-row"><span>✨ ${s.name}</span><small>${s.desc||''}</small></div>`;
    }

    // Job skills
    const jobState = GAME.jobs[m.id];
    if (jobState && JOBS[jobState.jobId]) {
      const job = JOBS[jobState.jobId];
      const jobSkills = getJobSkills(jobState.jobId, jobState.level);
      if (jobSkills.length > 0) {
        html += `<br><b style="color:#9b59b6">${job.icon} Compétences de classe</b><br>`;
        for (const sk of jobSkills) {
          html += `<div class="mm-row"><span>${sk.name}</span><small>${sk.desc} [${sk.jpCost} JP]</small></div>`;
        }
      }
    }

    // Equipment-granted skills in progress
    html += `<br><b>En cours d'apprentissage (via l'équipement)</b><br>`;
    const granted = GAME.inventory.currentEquipSkills(m).map(g => {
      const sk = getSkill(g.skillId);
      const cur = m.ap[g.skillId] || 0;
      const pct = sk ? Math.min(100, Math.floor(cur / sk.ap * 100)) : 0;
      return `<div class="mm-row"><span>${sk?.name||g.skillId}</span><div class="ap-bar"><div style="width:${pct}%"></div></div><span>${cur}/${sk?.ap||0} AP</span></div>`;
    }).join('');
    html += granted || '<i>Aucune.</i>';
    this._renderDetail(html);
  }

  // ─── CLASSE (Jobs) ──────────────────────────────────────────────────

  _panelJobs() {
    this._subPanel = () => this._panelJobs();
    if (!GAME.party.length) { this._renderDetail('Aucun membre.'); return; }
    const m = GAME.party[this._memberIdx] || GAME.party[0];
    const jobState = GAME.jobs[m.id];
    const currentJobId = jobState?.jobId;

    let html = `<b>${m.name} — Classe</b><br>`;

    // Current job
    if (currentJobId && JOBS[currentJobId]) {
      const job = JOBS[currentJobId];
      const xpNeeded = Math.floor(30 * Math.pow(jobState.level + 1, 1.6) + 10);
      const xpPct = Math.min(100, Math.floor((jobState.xp / xpNeeded) * 100));
      html += `<div class="job-current">
        <div class="job-header">${job.icon} ${job.name} <small>Niv.${jobState.level}</small></div>
        <div class="job-desc">${job.desc}</div>
        <div class="job-passive">Passif: ${job.passiveDesc}</div>
        <div class="ap-bar"><div style="width:${xpPct}%"></div></div>
        <small>JP ${jobState.xp}/${xpNeeded}</small>
      </div>`;
    }

    // Available jobs
    html += '<br><b>Changer de classe:</b><br>';
    for (const [id, job] of Object.entries(JOBS)) {
      const isCurrent = id === currentJobId;
      const meetsReq = !job.requires || (GAME.jobs[job.requires.job]?.level || 0) >= job.requires.level;
      const cls = isCurrent ? 'job-item current' : meetsReq ? 'job-item available' : 'job-item locked';
      const lock = !meetsReq ? ' 🔒' : isCurrent ? ' ✓' : '';
      const reqText = job.requires ? ` (Requiert: ${JOBS[job.requires.job]?.name} Niv.${job.requires.level})` : '';
      html += `<div class="mm-row ${cls}" data-job="${id}" style="cursor:${meetsReq && !isCurrent ? 'pointer' : 'default'}">
        <span>${job.icon} ${job.name}${lock}</span>
        <small>${job.passive}${reqText}</small>
      </div>`;
    }
    this._renderDetail(html);

    // Wire click handlers
    setTimeout(() => {
      const detail = this.root?.querySelector('.mm-detail-body');
      if (!detail) return;
      detail.querySelectorAll('.job-item[data-job]').forEach(el => {
        el.onclick = () => {
          const jobId = el.dataset.job;
          if (jobId === currentJobId) return;
          const job = JOBS[jobId];
          if (!job) return;
          const meetsReq = !job.requires || (GAME.jobs[job.requires.job]?.level || 0) >= job.requires.level;
          if (!meetsReq) return;
          // Switch job
          GAME.jobs[m.id] = { jobId, level: jobState?.level || 1, xp: jobState?.xp || 0 };
          audio.sfx('equip');
          this._panelJobs();
          this._renderSide();
        };
      });
    }, 50);
  }

  // ─── FAMILIER (Pets) ────────────────────────────────────────────────

  _panelPets() {
    this._subPanel = () => this._panelPets();
    if (!GAME.party.length) { this._renderDetail('Aucun membre.'); return; }
    const m = GAME.party[this._memberIdx] || GAME.party[0];
    const petState = GAME.pets[m.id];
    const currentPetId = petState?.petId;

    let html = `<b>${m.name} — Familier</b><br>`;

    // Current pet
    if (currentPetId && PETS[currentPetId]) {
      const pet = PETS[currentPetId];
      const lvl = petState.level || 1;
      const xpNeeded = Math.floor(25 * Math.pow(lvl + 1, 1.5) + 5);
      const xpPct = Math.min(100, Math.floor(((petState.xp || 0) / xpNeeded) * 100));
      const abilities = getPetAbilities(currentPetId, lvl);

      html += `<div class="pet-current">
        <div class="pet-header">${pet.icon} ${pet.name} <small>Niv.${lvl} · Élément: ${pet.element}</small></div>
        <div class="pet-desc">${pet.desc}</div>
        <div class="pet-passive">Passif: ${pet.passive.type} (${pet.passive.value})</div>
        <div class="pet-stats">ATK${pet.stats.atk} DEF${pet.stats.def} MAG${pet.stats.mag} RAP${pet.stats.spd}</div>
        <div class="ap-bar"><div style="width:${xpPct}%"></div></div>
        <small>XP ${petState.xp || 0}/${xpNeeded}</small>
      </div>`;

      // Pet abilities unlocked
      if (abilities.length > 0) {
        html += '<br><b>Capacités débloquées:</b><br>';
        for (const a of abilities) {
          html += `<div class="mm-row"><span>🌟 ${a.ability}</span><small>Lv.${a.level}: ${a.desc}</small></div>`;
        }
      }
    }

    // Available pets
    html += '<br><b>Changer de familier:</b><br>';
    for (const [id, pet] of Object.entries(PETS)) {
      const isCurrent = id === currentPetId;
      const cls = isCurrent ? 'pet-item current' : 'pet-item available';
      const lock = isCurrent ? ' ✓' : '';
      html += `<div class="mm-row ${cls}" data-pet="${id}" style="cursor:${!isCurrent ? 'pointer' : 'default'}">
        <span>${pet.icon} ${pet.name}${lock}</span>
        <small>${pet.passive.type} · ${pet.element}</small>
      </div>`;
    }
    this._renderDetail(html);

    // Wire click handlers
    setTimeout(() => {
      const detail = this.root?.querySelector('.mm-detail-body');
      if (!detail) return;
      detail.querySelectorAll('.pet-item[data-pet]').forEach(el => {
        el.onclick = () => {
          const petId = el.dataset.pet;
          if (petId === currentPetId) return;
          GAME.pets[m.id] = { petId, level: petState?.level || 1, xp: petState?.xp || 0 };
          audio.sfx('equip');
          this._panelPets();
          this._renderSide();
        };
      });
    }, 50);
  }

  // ─── STATUT ──────────────────────────────────────────────────────────

  _panelStatus() {
    this._subPanel = () => this._panelStatus();
    let html = '<b>Équipe — Statut</b><br>';
    for (const m of GAME.party) {
      const CHAR = getChar(m.id);
      const jobState = GAME.jobs[m.id];
      const petState = GAME.pets[m.id];
      const jobName = jobState && JOBS[jobState.jobId] ? `${JOBS[jobState.jobId].icon} ${JOBS[jobState.jobId].name} Niv.${jobState.level}` : '';
      const petName = petState && PETS[petState.petId] ? `${PETS[petState.petId].icon} ${PETS[petState.petId].name}` : '';

      html += `<div class="status-card">
        <div class="status-header">${CHAR.portrait} ${m.name} <small>${CHAR.class} Niv.${m.level}</small></div>
        ${jobName ? `<div class="status-job">🎭 ${jobName}</div>` : ''}
        ${petName ? `<div class="status-pet">🐾 ${petName}</div>` : ''}
        <div class="status-stats">HP ${m.hp}/${m.maxHp} · PM ${m.mp}/${m.maxMp}</div>
        <div class="status-stats">FOR ${m.stats.str} · MAG ${m.stats.mag} · VIT ${m.stats.vit}</div>
        <div class="status-stats">DEF ${m.stats.def} · RAP ${m.stats.spd} · CHN ${m.stats.luck}</div>
      </div>`;
    }
    html += `<br><b>Or:</b> ${GAME.inventory.gold} G`;
    this._renderDetail(html);
  }

  // ─── BESTIAIRE ───────────────────────────────────────────────────────

  _panelBestiary() {
    this._subPanel = () => this._panelBestiary();
    const seen = new Set(GAME._bestiarySeen || []);
    const all = Object.values(ENEMIES);
    let html = '<b>Bestiaire</b><br>';
    html += `<small>${seen.size}/${all.length} créatures rencontrées</small><br>`;
    for (const e of all) {
      const met = seen.has(e.id);
      if (!met) {
        html += `<div class="mm-row"><span>❓ ???</span><span>—</span></div>`;
        continue;
      }
      const wk = (e.element_weak || []).map(w => ({fire:'🔥',ice:'❄️',thunder:'⚡',holy:'🌟',dark:'🌑',water:'🌊',none:'⚔'})[w] || w).join(' ') || '—';
      html += `<div class="mm-row"><span>${e.name}</span><span>PV ${e.hp}</span></div>`;
      html += `<div class="mm-row"><small>FOR ${e.str} · MAG ${e.mag} · VIT ${e.vit}</small></div>`;
      html += `<div class="mm-row"><small>Faiblesse: ${wk}</small></div>`;
    }
    this._renderDetail(html);
  }

  // ─── SAUVEGARDE ──────────────────────────────────────────────────────

  _panelSave() {
    this._subPanel = () => this._panelSave();
    const hasExisting = hasSave();
    let preview = '';
    if (hasExisting) {
      try {
        const raw = localStorage.getItem('firstFantasy_save_v1');
        if (raw) {
          const save = JSON.parse(raw);
          const ts = save.timestamp ? new Date(save.timestamp).toLocaleString('fr-FR') : 'Inconnu';
          const ch = save.chapterId || '?';
          const chTitle = STORY.chapters?.[ch - 1]?.title || `Chapitre ${ch}`;
          const gold = save.gold || 0;
          const members = (save.party || []).map(m => {
            const CHAR = getChar(m.id);
            return `<div class="mm-row"><span>${CHAR.portrait} ${m.name}</span><span>Niv.${m.level} · HP${m.hp}/${m.maxHp || '?'} · PM${m.mp}/${m.maxMp || '?'}</span></div>`;
          }).join('');
          preview = `
            <div class="save-preview">
              <div class="save-preview-header">💾 Sauvegarde existante</div>
              <div class="mm-row"><span>📖 ${chTitle}</span><span>💰 ${gold} G</span></div>
              <div class="mm-row"><small>🕐 ${ts}</small></div>
              ${members}
            </div>`;
        }
      } catch {}
    }
    const html = `
      <b>Sauvegarde</b><br>
      ${preview}
      <div class="save-actions">
        <button class="save-btn" id="save-overwrite">💾 Sauvegarder${hasExisting ? ' (écraser)' : ''}</button>
        ${hasExisting ? '<button class="save-btn danger" id="save-clear">🗑️ Effacer la sauvegarde</button>' : ''}
      </div>`;
    this._renderDetail(html);
    setTimeout(() => {
      const ow = document.getElementById('save-overwrite');
      if (ow) ow.onclick = () => {
        const ok = saveGame(GAME);
        audio.sfx(ok ? 'save' : 'cancel');
        this._renderDetail(ok ? '✅ Partie sauvegardée.' : '❌ Échec de la sauvegarde.');
      };
      const cl = document.getElementById('save-clear');
      if (cl) cl.onclick = () => {
        clearSave();
        audio.sfx('cancel');
        this._renderDetail('🗑️ Sauvegarde effacée.');
      };
    }, 50);
  }
}

function getChar(id) {
  return getCharDef(id) || { portrait:'?', class:'?', name:id };
}
function slotName(s) { return { weapon:'Arme', armor:'Armure', accessory:'Accessoire' }[s] || s; }

export const menu = new GameMenu();
