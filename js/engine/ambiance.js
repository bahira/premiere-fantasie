// engine/ambiance.js — Atmosphere engine (dynamic music, weather, time-of-day, events)
// Called from field tick + battle start/end. Non-intrusive, no breaking changes.

import { audio } from './audio.js';
import { GAME } from '../state.js';
import { dialogue } from './dialogue.js';

class Ambiance {
  constructor() {
    this._biome = 'forest';
    this._timeOfDay = 12; // 0-24
    this._weather = 'clear';
    this._weatherAlpha = 0;
    this._eventTimer = 0;
    this._eventCooldown = 600; // frames between rare events
    this._intensity = 0;
    this._lastBiome = null;
  }

  reset() {
    this._timeOfDay = 12; this._weather = 'clear'; this._weatherAlpha = 0;
    this._eventTimer = 0; this._eventCooldown = 600;
  }

  setBiome(b) {
    if (b && b !== this._biome) {
      this._biome = b;
      this._onBiomeChange(b);
    }
  }

  _onBiomeChange(b) {
    // Weather per biome
    const weatherMap = {
      forest: ['clear', 'mist', 'rain'],
      desert: ['clear', 'sandstorm', 'heat'],
      cave: ['clear', 'glow', 'dark'],
      crystal: ['clear', 'shimmer', 'storm'],
      city: ['clear', 'fog', 'rain'],
    };
    const opts = weatherMap[b] || ['clear'];
    this._weather = opts[Math.floor(Math.random() * opts.length)];
    this._weatherAlpha = 0;
    // Music per biome
    const musicMap = {
      forest: 'Afritt Rising', desert: 'Blackened Crown', cave: 'Glass Trial',
      crystal: 'Rift of Refantazio', city: 'Lanterns Over Brine', royal: 'Shtetl Crown',
    };
    if (musicMap[b]) audio.playMusic(musicMap[b]);
  }

  // Called every frame from field tick
  update(dt, context = {}) {
    // Time of day advances slowly during exploration
    if (GAME.scene === 'field' || GAME.scene === 'town') {
      this._timeOfDay += dt * 0.002;
      if (this._timeOfDay >= 24) this._timeOfDay -= 24;
    }
    // Weather alpha ease
    const targetAlpha = this._weather === 'clear' ? 0 : 0.25;
    this._weatherAlpha += (targetAlpha - this._weatherAlpha) * 0.02;
    // Rare atmosphere events
    this._eventTimer++;
    if (this._eventTimer >= this._eventCooldown && GAME.scene === 'field') {
      this._eventTimer = 0;
      this._eventCooldown = 400 + Math.floor(Math.random() * 800);
      this._triggerEvent();
    }
  }

  _triggerEvent() {
    const events = [
      { id: 'shooting_star', line: ['Une étoile filante traverse le ciel.', 'Fais un vœu...'] },
      { id: 'spirit_sighting', line: ['Un esprit de brume danse entre les arbres.', 'La magie est vivante ici.'], flag: 'saw_spirit' },
      { id: 'ancient_ruin', line: ['Des ruines émergent de la brume.', 'Quel secret cachent-elles?'], flag: 'found_ruin' },
      { id: 'lore_unlock', line: ['Une mélodie oubliée résonne.', 'Un fragment de l\'histoire se révèle.'], flag: 'ambient_lore' },
    ];
    const ev = events[Math.floor(Math.random() * events.length)];
    if (ev.flag) GAME.flags[ev.flag] = true;
    if (GAME.flags.lore_unlock_ambient === undefined && ev.id === 'lore_unlock') {
      GAME.flags.lore_unlock_ambient = true;
    }
    dialogue.show({ speaker: '✦ Événement', lines: ev.line });
  }

  // Battle transitions
  onBattleStart(isBoss) {
    this._intensity = 1;
    audio.playMusic(isBoss ? 'Clockwork Duel' : 'Crystal Panic GAME');
  }
  onBattleEnd() {
    this._intensity = 0;
    audio.playMusic(this._biome === 'desert' ? 'Blackened Crown' : 'Afritt Rising');
  }

  // Low HP tension
  setTension(lowHp) {
    if (lowHp && this._intensity < 0.5) {
      audio.playMusic('The Descent into Ruin');
      this._intensity = 0.5;
    }
  }

  // Draw weather overlay (call from field render)
  drawWeather(ctx, w, h) {
    if (this._weatherAlpha <= 0.01) return;
    ctx.save();
    if (this._weather === 'mist' || this._weather === 'fog') {
      ctx.fillStyle = `rgba(200,220,230,${this._weatherAlpha})`;
      ctx.fillRect(0, 0, w, h);
    } else if (this._weather === 'rain') {
      ctx.fillStyle = `rgba(100,130,180,${this._weatherAlpha * 0.5})`;
      ctx.fillRect(0, 0, w, h);
    } else if (this._weather === 'sandstorm' || this._weather === 'heat') {
      ctx.fillStyle = `rgba(200,160,60,${this._weatherAlpha})`;
      ctx.fillRect(0, 0, w, h);
    } else if (this._weather === 'shimmer' || this._weather === 'glow') {
      ctx.fillStyle = `rgba(150,100,220,${this._weatherAlpha * 0.6})`;
      ctx.fillRect(0, 0, w, h);
    } else if (this._weather === 'dark') {
      ctx.fillStyle = `rgba(10,10,30,${this._weatherAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  // Time-of-day tint
  drawTimeTint(ctx, w, h) {
    const t = this._timeOfDay;
    let alpha = 0, color = '0,0,0';
    if (t < 6 || t > 20) { alpha = 0.35; color = '10,20,60'; } // night
    else if (t < 8 || t > 18) { alpha = 0.15; color = '255,150,80'; } // dawn/dusk
    if (alpha > 0) {
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  getTimeString() {
    const h = Math.floor(this._timeOfDay);
    const m = Math.floor((this._timeOfDay - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}

export const ambiance = new Ambiance();
