// engine/atb.js — Active Time Battle system (FFIX-style)
// Members and enemies have ATB gauges that fill based on SPD. When full, action.

import { getAttack } from '../data/enemies.js';
import { JOBS } from '../data/jobs.js';
import { PETS } from '../data/pets.js';

export class ATBBattle {
  constructor(party, enemies, opts = {}) {
    this.party = party.filter(m => m.alive);
    this.enemies = Array.isArray(enemies) ? enemies : [enemies];
    this.allUnits = [...this.party, ...this.enemies];
    this.turn = 0;
    this.log = [];
    this.over = false;
    this.result = null; // 'win' | 'lose' | 'flee'
    this.canFlee = opts.canFlee !== false;
    this.backAttack = opts.backAttack || false;
    this.atbScale = opts.atbScale || 1.0;
    this.actionQueue = [];
    this.activeUnit = null;
    this.pendingTargetChoice = null;
    this.onActionResolve = opts.onResolve || (() => {});
    this.onStateChange = opts.onStateChange || (() => {});
    this.caster = null; // selected member
    // Breath of Fire: Focus system (Rage meter)
    for (const u of this.allUnits) {
      u.focus = u.focus || 0;
      u.maxFocus = 100;
      u.focusReady = false; // true when focus >= 100, next attack is empowered
    }
    // Combo tracking
    this._comboChain = { party: 0, enemy: 0 };
    this._lastTarget = null;
    // Charge-up tracking for enemies (charge_up attacks)
    this._chargingUnits = new Map(); // unit -> { attackId, turnsLeft }
  }

  // ─── Job & Pet Passive Helpers ──────────────────────────────────────
  _getJobPassive(member) {
    if (!member._jobId) return null;
    const job = JOBS[member._jobId];
    return job ? job.passive : null;
  }

  _getPetPassive(member) {
    if (!member._petId) return null;
    const pet = PETS[member._petId];
    return pet ? pet.passive : null;
  }

  _hasJobPassive(member, passiveId) {
    return this._getJobPassive(member) === passiveId;
  }

  _hasPetPassive(member, passiveId) {
    const p = this._getPetPassive(member);
    return p && p.type === passiveId;
  }

  step(dt) {
    if (this.over) return;
    // ─── Process charge-up attacks ─────────────────────────────────
    for (const [unit, charge] of this._chargingUnits) {
      charge.turnsLeft -= dt * 0.5; // roughly 2 seconds per charge
      if (charge.turnsLeft <= 0) {
        this._chargingUnits.delete(unit);
        if (unit.alive && charge.target?.alive) {
          this.log.push(`💥 ${unit.name} déchaîne !`);
          this.onStateChange({ type: 'msg', text: `💥 ${unit.name} lance ${charge.attackId} !` });
          this.executeAttack(unit, charge.target, charge.attackId);
        }
      }
    }
    // Fill ATB gauges for living units not already in queue
    for (const u of this.allUnits) {
      if (!u.alive || u.ready || this.actionQueue.includes(u)) continue;
      const spd = u.stats.spd;
      u.atb = (u.atb || 0) + spd * dt * this.atbScale;
      if (u.atb >= 100) { u.atb = 100; u.ready = true; this.actionQueue.push(u);
        this.onStateChange({ type: 'ready', unit: u }); }
    }
    // Status effect ticks (poison damage, blind miss chance, etc.)
    for (const u of this.allUnits) {
      if (!u.alive || !u._status) continue;
      for (const [st, turns] of Object.entries(u._status)) {
        if (turns <= 0) { delete u._status[st]; continue; }
        // Poison: deal 5% max HP at start of turn
        if (st === 'poison' && u.atb > 0 && u.atb < 100) {
          const poisonDmg = Math.max(1, Math.floor(u.maxHp * 0.05));
          u.hp = Math.max(1, u.hp - poisonDmg); // poison never kills (leaves at 1 HP)
          this.onStateChange({ type: 'status_tick', unit: u, status: 'poison', damage: poisonDmg });
        }
        // Decrement duration
        u._status[st]--;
        if (u._status[st] <= 0) {
          delete u._status[st];
          this.onStateChange({ type: 'status_end', unit: u, status: st });
        }
      }
    }
    // Process first ready unit if no active caster
    if (!this.activeUnit && this.actionQueue.length) {
      const u = this.actionQueue.shift();
      u.ready = false; u.atb = 0;
      if (u.isEnemy) {
        // AI auto-acts
        this._enemyAct(u);
      } else {
        // Player member: prompt for command
        this.activeUnit = u;
        this.onStateChange({ type: 'command', unit: u });
      }
    }
    // resolved check
    if (!this.over) {
      const anyEnemyAlive = this.enemies.some(e => e.alive);
      const anyMemberAlive = this.party.some(m => m.alive);
      if (!anyEnemyAlive && !this._winDispatched) {
        this._winDispatched = true; this._resolve('win');
      } else if (!anyMemberAlive && !this._loseDispatched) {
        this._loseDispatched = true; this._resolve('lose');
      } else if (!anyEnemyAlive && !anyMemberAlive && !this._loseDispatched) {
        this._loseDispatched = true; this._resolve('lose');
      }
    }
  }

  _resolve(kind) {
    if (this.over) return;
    this.over = true; this.result = kind;
    this.onStateChange({ type: 'end', result: kind });
  }

  _enemyAct(enemy) {
    const targets = this.party.filter(m => m.alive);
    if (!targets.length) return;
    const hpPct = enemy.hp / enemy.maxHp;
    const isPhase2 = hpPct < 0.50 && (enemy.isBoss || enemy.isFinalBoss);
    // Phase change notification
    if (isPhase2 && !enemy._phaseTriggered) {
      enemy._phaseTriggered = true;
      this.log.push(`⚡ ${enemy.name} déchaîne sa puissance !`);
      this.onStateChange({ type: 'msg', text: `⚡ ${enemy.name} se déchaîne !`, phaseChange: true });
      // Boost stats in phase 2
      const stats = enemy.stats || enemy;
      stats.spd = Math.floor((stats.spd || 10) * 1.4);
    }
    // Smart targeting: prefer vulnerable targets
    let target;
    const magicUsers = targets.filter(t => (t.stats?.mag || 0) > 15);
    const healers = targets.filter(t => (t.mp || 0) > 60 && (t.maxMp || 100) > 60);
    // Bosses with phase 2: target healers first
    if (isPhase2 && healers.length > 0 && Math.random() < 0.6) {
      target = healers[Math.floor(Math.random() * healers.length)];
    } else if (enemy.isBoss && magicUsers.length > 0 && Math.random() < 0.4) {
      target = magicUsers[Math.floor(Math.random() * magicUsers.length)];
    } else {
      target = targets[Math.floor(Math.random() * targets.length)];
    }
    // Smart attack selection based on phase + target
    let atkId;
    const attacks = enemy.attacks || ['coup'];
    if (isPhase2 && attacks.length > 2) {
      // Phase 2: use heavier attacks more often
      const heavyAttacks = attacks.slice(1); // skip first (basic)
      atkId = Math.random() < 0.6 && heavyAttacks.length > 0
        ? heavyAttacks[Math.floor(Math.random() * heavyAttacks.length)]
        : attacks[Math.floor(Math.random() * attacks.length)];
    } else {
      atkId = attacks[Math.floor(Math.random() * attacks.length)];
    }
    // ─── CHARGE-UP ATTACKS ─────────────────────────────────────────
    const atkDef = getAttack(atkId);
    if (atkDef && atkDef.charge_up) {
      // Start charging: execute after 2 turns of delay
      this._chargingUnits.set(enemy, { attackId: atkId, target, turnsLeft: 2 });
      this.log.push(`⚡ ${enemy.name} charge ${atkDef.name}...`);
      this.onStateChange({ type: 'msg', text: `⚡ ${enemy.name} prépare ${atkDef.name}...`, charge: true });
      return;
    }
    // ─── MULTI-TARGET ATTACKS ──────────────────────────────────────
    if (atkDef && atkDef.multi) {
      // Hit all alive party members
      for (const t of targets) {
        this.executeAttack(enemy, t, atkId);
      }
      return;
    }
    this.executeAttack(enemy, target, atkId);
  }

  // Player chooses Attack
  memberAttack(member, target) {
    this.activeUnit = null;
    this.executeAttack(member, target, 'basic');
  }

  memberSkill(member, skillId, target) {
    this.activeUnit = null;
    this.executeAttack(member, target, skillId, { isSkill: true });
  }

  memberItem(member, itemId, target) {
    this.activeUnit = null;
    this.executeAttack(member, target, itemId, { isItem: true });
  }

  flee(member) {
    this.activeUnit = null;
    if (this.canFlee && Math.random() < 0.75) {
      this._resolve('flee');
    } else {
      this.log.push('❌ Fuite ratée !');
      this.onStateChange({ type: 'msg', text: 'Fuite ratée !' });
    }
  }

  defend(member) {
    this.activeUnit = null;
    member._defending = true;
    this.log.push(`${member.name} se met en garde.`);
    this.onStateChange({ type: 'msg', text: `${member.name} garde haut !` });
  }

  // ─── Steal Action ────────────────────────────────────────────────
  steal(member, target) {
    this.activeUnit = null;
    if (!target || !target.alive || !target.steal || !target.steal.length) {
      this.log.push(`${member.name} ne peut rien voler.`);
      this.onStateChange({ type: 'msg', text: 'Rien à voler !' });
      return;
    }
    // Calculate steal chance: base 40% + spd bonus + pet bonus
    let chance = 0.40;
    chance += (member.stats.spd || 10) / 200; // up to +25% from spd
    if (this._hasPetPassive(member, 'steal_chance')) {
      chance += this._getPetPassive(member).value; // +25% from chauve-souris
    }
    chance = Math.min(0.95, chance);
    // Check each steal table entry (try rarest first)
    for (const entry of target.steal) {
      if (Math.random() < chance * (entry.chance || 1)) {
        const itemName = entry.item;
        this.log.push(`${member.name} vole ${itemName} !`);
        this.onStateChange({ type: 'steal', unit: member, target, item: itemName });
        this.onActionResolve({ type: 'steal', unit: member, item: itemName });
        return;
      }
    }
    // Failed
    this.log.push(`${member.name} rate le vol !`);
    this.onStateChange({ type: 'msg', text: `${member.name} échoue !` });
  }

  // Core damage calc (v2 — crits, combos, dragon skills, job & pet passives)
  executeAttack(attacker, target, actionId, opts = {}) {
    if (!attacker || !target || !target.alive) return; // null guard (BoF: never crash)
    // Blind miss check: 40% miss chance on physical attacks
    if (attacker._status?.blind && !opts.isSkill) {
      if (Math.random() < 0.4) {
        this.onStateChange({ type: 'msg', text: `${attacker.name} rate à cause de la cécité !` });
        return;
      }
    }
    // ─── JOB PASSIVE: Esquive (20% dodge) ──────────────────────────
    if (!attacker.isEnemy && target._jobId && this._hasJobPassive(target, 'esquive')) {
      if (Math.random() < 0.20) {
        this.onStateChange({ type: 'msg', text: `${target.name} esquive !` });
        this.onActionResolve({ type: 'miss', unit: target });
        return;
      }
    }
    // ─── PET PASSIVE: Evasion (+15% dodge) ─────────────────────────
    if (!attacker.isEnemy && target._petId && this._hasPetPassive(target, 'evasion')) {
      if (Math.random() < 0.15) {
        this.onStateChange({ type: 'msg', text: `${target.name} esquive grâce à son familier !` });
        this.onActionResolve({ type: 'miss', unit: target });
        return;
      }
    }
    const lvl = attacker.level || 1;
    const rnd = 0.85 + Math.random() * 0.3;
    let dmg = 0; let element = 'none'; let mp = 0;
    let isMagic = false; let status = null; let heal = 0;
    let isDragonSkill = false; let isCrit = false;

    if (opts.isSkill && attacker.skills) {
      const sk = attacker.skills[actionId];
      if (!sk) { return; }
      if (sk.mp && attacker.mp < sk.mp) {
        this.log.push(`${attacker.name} n'a pas assez de MP !`);
        this.onStateChange({ type: 'msg', text: 'PM insuffisant !' });
        return;
      }
      attacker.mp = Math.max(0, attacker.mp - (sk.mp || 0));
      if (sk.type === 'heal') {
        heal = Math.floor((30 + sk.power * 30) * (1 + attacker.stats.mag / 30));
        target.hp = Math.min(target.maxHp, target.hp + heal);
        this.log.push(`${target.name} +${heal} HP (${sk.name})`);
        this.onStateChange({ type: 'heal', unit: target, amount: heal, skill: sk.name });
        return;
      }
      if (sk.type === 'revive') {
        if (!target.alive) {
          target.alive = true; target.hp = Math.floor(target.maxHp * sk.power);
          this.log.push(`${target.name} ranimé (${sk.name})`);
          this.onStateChange({ type: 'revive', unit: target, skill: sk.name });
        }
        return;
      }
      if (sk.type === 'buff') {
        target._buffs = target._buffs || {};
        target._buffs[sk.stat] = (target._buffs[sk.stat] || 1) * sk.factor;
        this.log.push(`${target.name}: ${sk.name}`);
        this.onStateChange({ type: 'buff', unit: target, skill: sk.name });
        return;
      }
      // === DRAGON SKILL: unique per-character Limit Break ===
      if (sk.type === 'dragon') {
        if (!attacker._dragonForm) return; // can only use in dragon form
        isDragonSkill = true;
        isMagic = false;
        element = sk.element || 'none';
        // Base: 2x normal power
        dmg = Math.floor((20 + sk.power * 25) * (1 + attacker.stats.str / 15) * lvl * rnd);
        // Dragon skill ALWAYS crits
        isCrit = true;
      }
      if (!isDragonSkill) {
        isMagic = sk.type === 'magic' || sk.type === 'attack';
        element = sk.element || 'none';
        dmg = Math.floor((10 + sk.power * 20) * (isMagic ? (1 + attacker.stats.mag / 20) : (1 + attacker.stats.str / 20)) * lvl * rnd);
      }
    } else if (opts.isItem) {
      // items handled by inventory elsewhere; placeholder
      this.log.push(`${attacker.name} utilise ${actionId}`);
      return;
    } else if (attacker.isEnemy && actionId) {
      // ENEMY ATTACK: use attack definition (power, element, status)
      const atkDef = getAttack(actionId);
      if (atkDef) {
        element = atkDef.element || 'none';
        isMagic = atkDef.type === 'magic' || false;
        const pow = atkDef.power || 1.0;
        dmg = Math.floor((10 + pow * 22) * (isMagic ? (1 + (attacker.stats.mag || 4) / 20) : (1 + (attacker.stats.str || 10) / 20)) * lvl * rnd);
        if (atkDef.status) status = atkDef.status;
        // Telegraph the attack BEFORE damage
        this.onStateChange({ type: 'telegraph', unit: attacker, target, attackName: atkDef.name, element, isMagic, status });
      } else {
        // Fallback to basic
        dmg = Math.floor((attacker.stats.str * 2 + 10) * lvl * rnd);
        element = 'none';
      }
    } else {
      // Basic physical hit
      dmg = Math.floor((attacker.stats.str * 2 + 10) * lvl * rnd);
      element = attacker.weaponElement || 'none';
    }

    // ─── CRITICAL HIT SYSTEM (10% base, 20% on weakness, 2x damage) ──────
    // Dragon skills already force-crit above
    if (!isCrit) {
      let critChance = 0.10; // 10% base
      // JOB PASSIVE: crit_vie (+25% crit when target HP < 30%)
      if (!attacker.isEnemy && this._hasJobPassive(attacker, 'crit_vie')) {
        if (target.hp / target.maxHp < 0.30) critChance += 0.25;
      }
      // PET PASSIVE: crit_boost (+12% crit)
      if (!attacker.isEnemy && this._hasPetPassive(attacker, 'crit_boost')) {
        critChance += this._getPetPassive(attacker).value;
      }
      if (Math.random() < critChance) {
        isCrit = true;
      }
    }

    // Breath of Fire: Focus Break — 2.5x damage when focus ready, consumes it
    // + Dragon Transformation: full BoF-style power-up
    let focusBreak = false;
    if (attacker && attacker.focusReady) {
      dmg = Math.floor(dmg * 2.5);
      attacker.focusReady = false;
      attacker.focus = 0;
      focusBreak = true;
      // Dragon Transformation: enter "Dragon Form" for 3 turns
      if (!attacker.isEnemy) {
        attacker._dragonForm = 3; // lasts 3 actions
        attacker._buffs = attacker._buffs || {};
        // Dragon Form: ALL stats boosted
        const dragonBuffs = ['str', 'mag', 'vit', 'spd'];
        for (const stat of dragonBuffs) {
          attacker._buffs[stat] = (attacker._buffs[stat] || 1) * 1.6;
          attacker._buffTurns = attacker._buffTurns || {};
          attacker._buffTurns[stat] = 3;
        }
        this.log.push(`🐉 ${attacker.name} se transforme en forme Draconique !`);
        this.onStateChange({ type: 'dragon_form', unit: attacker, active: true });
      }
    }

    // defense
    let def = isMagic ? (target.stats.mag * 1.0) : (target.stats.vit * 1.5);
    def *= (target._defending ? 2 : 1);
    def *= (target._buffs?.def || 1);
    // ─── JOB PASSIVE: sainte_armure (-15% magic damage taken) ──────
    if (!target.isEnemy && isMagic && this._hasJobPassive(target, 'sainte_armure')) {
      def *= 1.15;
    }
    dmg = Math.max(1, Math.floor(dmg - def * 0.6));

    // ─── JOB PASSIVE: concentration (+15% magic damage when HP > 80%) ─
    if (!attacker.isEnemy && isMagic && this._hasJobPassive(attacker, 'concentration')) {
      if (attacker.hp / attacker.maxHp > 0.80) {
        dmg = Math.floor(dmg * 1.15);
      }
    }

    // ─── PET PASSIVE: damage_redirect (10% damage absorbed) ────────
    if (target._petId && this._hasPetPassive(target, 'damage_redirect')) {
      const absorbed = Math.floor(dmg * 0.10);
      dmg -= absorbed;
    }

    // ─── JOB PASSIVE: foi (+20% healing power) ────────────────────
    if (heal > 0 && !attacker.isEnemy && this._hasJobPassive(attacker, 'foi')) {
      heal = Math.floor(heal * 1.20);
    }

    // element weakness / resist
    const weak = target.element_weak || target.weak || [];
    const resist = target.element_resist || target.resist || [];
    let weaknessHit = false;
    if (weak.includes(element)) {
      dmg = Math.floor(dmg * 2.0);  // BoF-style: weakness = critical
      weaknessHit = true;
    }
    if (resist.includes(element)) dmg = Math.floor(dmg * 0.5);

    // ─── APPLY CRIT MULTIPLIER (2x) ─────────────────────────────────────
    if (isCrit) dmg = Math.floor(dmg * 2.0);

    // ─── COMBO DAMAGE BONUS ─────────────────────────────────────────────
    // Consecutive party hits on same target: +25% per chain level
    let comboCount = 0;
    if (attacker && !attacker.isEnemy) {
      if (target === this._lastTarget) {
        comboCount = this._comboChain.party; // chain already started
        this._comboChain.party = Math.min(5, comboCount + 1);
      } else {
        this._comboChain.party = 1; // first hit in chain = 1 (no bonus)
        comboCount = 0;
      }
      this._lastTarget = target;
      if (comboCount > 0) {
        const comboMult = 1 + comboCount * 0.25;
        dmg = Math.floor(dmg * comboMult);
      }
    }

    // Breath of Fire: Focus (Rage) system — gain focus on hit & being hit
    if (attacker && attacker !== target) {
      // Attacker gains focus for landing a hit
      attacker.focus = Math.min(attacker.maxFocus || 100, (attacker.focus || 0) + (weaknessHit ? 12 : 6));
      if (attacker.focus >= (attacker.maxFocus || 100) && !attacker.focusReady) {
        attacker.focusReady = true;
        this.onStateChange({ type: 'focus_ready', unit: attacker });
      }
      // Target gains focus for being hit
      const focusGain = Math.min(20, Math.floor(dmg / 8) + 4);
      target.focus = Math.min(target.maxFocus || 100, (target.focus || 0) + focusGain);
      const justFilled = target.focus >= (target.maxFocus || 100) && !target.focusReady;
      if (justFilled) {
        target.focusReady = true;
        this.onStateChange({ type: 'focus_ready', unit: target });
      }
      // Dragon Counter: when hit while Focus Ready → 50% auto-counter (BoF4)
      if (justFilled && !target.isEnemy && Math.random() < 0.5) {
        // Target just reached focus and got hit — trigger counter
        target.focusReady = true; // keep ready for the counter next action
        this.log.push(`🐉 ${target.name} contre-attaque !`);
        this.onStateChange({ type: 'msg', text: `🐉 ${target.name}: contre-attaque Dragonic !`, counter: true });
      }
    }

    // apply
    target.hp = Math.max(0, target.hp - dmg);
    this.log.push(`${target.name} -${dmg} HP`);
    // Apply status effect if present
    if (status && target.alive) {
      if (!target._status) target._status = {};
      const duration = status === 'poison' ? 4 : status === 'blind' ? 3 : status === 'curse' ? 5 : 3;
      target._status[status] = Math.max(target._status[status] || 0, duration);
      this.onStateChange({ type: 'status_apply', unit: target, status, duration });
    }
    // Decrement buff turns for attacker after action
    if (attacker && attacker._buffTurns) {
      for (const key of Object.keys(attacker._buffTurns)) {
        attacker._buffTurns[key]--;
        if (attacker._buffTurns[key] <= 0) {
          delete attacker._buffTurns[key];
          if (attacker._buffs) delete attacker._buffs[key];
        }
      }
      // Dragon Form expiration check
      if (attacker._dragonForm) {
        attacker._dragonForm--;
        if (attacker._dragonForm <= 0) {
          delete attacker._dragonForm;
          this.log.push(`🐉 ${attacker.name} quitte la forme Draconique.`);
          this.onStateChange({ type: 'dragon_form', unit: attacker, active: false });
        }
      }
    }

    this.onStateChange({ type: 'damage', unit: target, amount: dmg, attacker, element, isMagic,
      fatal: target.hp <= 0, weaknessHit, comboCount: this._comboChain.party, focusBreak, isCrit });
    if (target.hp <= 0) {
      target.alive = false;
      this.log.push(`${target.name} est K.O.`);
      this.onStateChange({ type: 'ko', unit: target });
      this.onActionResolve({ type: 'ko', unit: target });
    } else {
      this.onActionResolve({ type: 'hit', unit: target, amount: dmg });
    }

    // ── Pet Battle Assist ──
    this._triggerPetAssist(attacker, target, dmg, isCrit);
  }

  _triggerPetAssist(attacker, target, dmg, isCrit) {
    if (!attacker._pet) return;
    const pet = attacker._pet;
    const assist = pet.assist;
    if (!assist) return;

    let triggered = false;
    switch (assist.trigger) {
      case 'onHit':
        triggered = Math.random() < assist.chance;
        break;
      case 'onCrit':
        triggered = isCrit && Math.random() < assist.chance;
        break;
      case 'onVictory':
        triggered = Math.random() < assist.chance;
        break;
      default:
        triggered = Math.random() < assist.chance;
    }

    if (!triggered) return;

    switch (assist.effect) {
      case 'burn':
        if (target.alive) {
          target._status = target._status || {};
          target._status.burn = 3;
          this.onStateChange({ type: 'pet_assist', pet: pet.name, effect: '🔥 Brûlure', unit: target });
        }
        break;
      case 'drain':
        if (target.alive && dmg > 0) {
          const healAmt = Math.floor(dmg * assist.power);
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmt);
          this.onStateChange({ type: 'pet_assist', pet: pet.name, effect: `💉 Drain +${healAmt}`, unit: attacker });
        }
        break;
      case 'counter':
        if (target.alive) {
          const counterDmg = Math.floor(attacker.stats.str * assist.power * (0.85 + Math.random() * 0.3));
          target.hp -= counterDmg;
          this.onStateChange({ type: 'pet_assist', pet: pet.name, effect: `⚡ Contre +${counterDmg}`, unit: target });
          if (target.hp <= 0) {
            target.alive = false;
            this.onStateChange({ type: 'ko', unit: target });
          }
        }
        break;
      case 'shield':
        this.onStateChange({ type: 'pet_assist', pet: pet.name, effect: '🛡️ Bouclier', unit: attacker });
        break;
      case 'bonus_gold':
        this.onStateChange({ type: 'pet_assist', pet: pet.name, effect: `💰 +${assist.power} Or` });
        break;
    }
  }
}
