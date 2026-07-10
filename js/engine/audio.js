// engine/audio.js — AAA Adaptive Music Engine (Grounded Loop v9)
// Scene-track mapping, 1.5s crossfade, boss trigger, multi-band intensity, preload all
import { AUDIO } from '../config.js';

const TRACK_LIST = [
  'Crystal Village',
  'Lanterns Over Brine',
  'Lanterns of Ashenvale',
  'Crystal Panic GAME',
  'Clockwork Duel',
  'Glass Trial',
  'Djinn in My Veins',
  'Afritt Rising',
  'Machina Veil',
  'Rift of Refantazio',
  'Shtetl Crown',
  // ── New tracks ──
  'Ashen Covenant',
  'Blackened Crown',
  'Skybound Duel',
  'Skybound Phase',
  'The Descent into Ruin',
];

const SCENE_MUSIC = {
  title:         'Crystal Village',
  field:         'Afritt Rising',
  town:          'Lanterns Over Brine',
  town_forest:   'Lanterns of Ashenvale',
  town_steampunk:'Machina Veil',
  town_royal:    'Shtetl Crown',
  battle:        'Crystal Panic GAME',
  boss:          'Clockwork Duel',
  boss_rift:     'Rift of Refantazio',
  final_boss:    'Djinn in My Veins',
  cave:          'Glass Trial',
  revelation:    'Crystal Village',
  theend:        'Crystal Village',
  gameover:      'Glass Trial',
  // ── New scene mappings ──
  desert:        'Blackened Crown',
  darkforest:    'Ashen Covenant',
  airship:       'Skybound Phase',
  siege:         'The Descent into Ruin',
  menu:          'Crystal Village',
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.filterNode = null;
    this.compressor = null;

    // Active music state
    this._currentSource = null;   // current AudioBufferSourceNode
    this._currentGain = null;     // per-transition gain node for crossfade
    this._currentTrackName = null;
    this._nextFadePending = false;

    // Track cache (preloaded AudioBuffers)
    this.musicTracks = {};
    this._preloadDone = false;

    // Intensity: 0 (calm) … 1 (full combat)
    this.intensity = 0;
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  async init() {
    if (this._initPromise) return this._initPromise;
    if (this._preloadDone) return;
    this._initPromise = this._doInit();
    return this._initPromise;
  }

  async _doInit() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();

    // Master volume → compressor → destination (single chain, no bypass)
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.compressor.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = AUDIO.master;
    this.master.connect(this.compressor);

    // Music gain — controls overall music volume (also used for intensity boost)
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = AUDIO.music;

    // Adaptive multi-band filter chain
    // Lowpass: controls how "bright" the music feels
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 22000;
    this.filterNode.Q.value = 0.5;

    // Routing: per-source gain → musicGain → filterNode → master → compressor → dest
    this.musicGain.connect(this.filterNode);
    this.filterNode.connect(this.master);

    // SFX gain → direct to master (no filter)
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = AUDIO.sfx;
    this.sfxGain.connect(this.master);

    // Preload all tracks — init awaits completion so first playScene finds tracks ready
    await this._preloadAll();
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
  }

  // ─── Track Preloading ────────────────────────────────────────────────────

  async _preloadAll() {
    if (this._preloadDone) return;
    const results = await Promise.allSettled(
      TRACK_LIST.map(async (name) => {
        try {
          const res = await fetch(`music/${name}.mp3`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const arr = await res.arrayBuffer();
          this.musicTracks[name] = await this.ctx.decodeAudioData(arr.slice(0));
        } catch (e) {
          console.warn(`[Audio] Failed to load "${name}" : ${e.message}`);
        }
      })
    );
    const loaded = Object.keys(this.musicTracks).length;
    console.log(`[Audio] ${loaded}/${TRACK_LIST.length} tracks preloaded`);
    this._preloadDone = true;
  }

  getTrackBuffer(name) { return this.musicTracks[name]; }

  // ─── Scene-Based Music ──────────────────────────────────────────────────

  /**
   * Play music for a given scene. Crossfades from current track if different.
   * @param {string} scene  — 'title' | 'field' | 'town' | 'battle' | 'boss' | 'theend'
   * @param {object} [opts]
   * @param {boolean} [opts.boss]  — if true, forces 'Clockwork Duel' regardless of scene
   */
  async playScene(scene, opts = {}) {
    await this.init();
    await this.resume();

    // Resolve track: boss='final' → final_boss, boss=true → boss, else scene lookup
    let trackName;
    if (opts?.boss === 'final') trackName = SCENE_MUSIC.final_boss;
    else if (opts?.boss) trackName = SCENE_MUSIC.boss;
    else trackName = SCENE_MUSIC[scene];

    if (!trackName) return; // no music mapped for this scene (e.g. gameover, menu)
    if (this._currentTrackName === trackName && this._currentSource) {
      // Already playing this track — just ensure context is running
      return;
    }

    const buffer = this.musicTracks[trackName];
    if (!buffer) {
      console.warn(`[Audio] Track "${trackName}" not loaded`);
      return;
    }

    this._crossfadeTo(buffer, trackName);
  }

  /** Internal: crossfade from current track to new buffer. */
  _crossfadeTo(buffer, name) {
    this._nextFadePending = false;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const fade = 1.5; // seconds — smooth broadcast-style crossfade

    // ── Fade out current source ──
    if (this._currentSource && this._currentGain) {
      const oldGain = this._currentGain;
      oldGain.gain.cancelScheduledValues(now);
      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.linearRampToValueAtTime(0.0001, now + fade);

      const oldSrc = this._currentSource;
      setTimeout(() => {
        try { oldSrc.stop(); } catch {}
        try { oldGain.disconnect(); } catch {}
      }, (fade + 0.1) * 1000);
    }

    // ── Create fresh gain + source for new track ──
    const newGain = ctx.createGain();
    newGain.gain.setValueAtTime(0.0001, now);
    newGain.gain.linearRampToValueAtTime(1.0, now + fade);
    newGain.connect(this.musicGain);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(newGain);
    src.start(now);

    // Store references
    this._currentSource = src;
    this._currentGain = newGain;
    this._currentTrackName = name;
  }

  /** Legacy: play default track by name (kept for backward compat). */
  async playMusic(loop = true) {
    await this.playScene('battle');
  }

  /** Stop current music with optional fade. */
  stopMusic(fade = false) {
    if (!this._currentSource) return;
    if (fade && this._currentGain) {
      const t = this.ctx.currentTime;
      this._currentGain.gain.cancelScheduledValues(t);
      this._currentGain.gain.setValueAtTime(this._currentGain.gain.value, t);
      this._currentGain.gain.linearRampToValueAtTime(0.0001, t + 0.4);
      const s = this._currentSource;
      setTimeout(() => { try { s.stop(); } catch {} }, 450);
    } else {
      try { this._currentSource.stop(); } catch {}
    }
    this._currentSource = null;
    this._currentGain = null;
    this._currentTrackName = null;
  }

  /** Pause current music (stores offset for resume). Not supported in crossfade mode — stops. */
  pauseMusic() {
    this.stopMusic(true);
  }

  // ─── Adaptive Intensity ──────────────────────────────────────────────────

  /**
   * Set music intensity (0 = calm … 1 = full combat).
   * Uses exponential lowpass curve + gain boost for dynamic feel.
   * Smooth ramp: 0.8s for increase, 1.5s for decrease (dramatic wind-down).
   */
  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
    if (!this.filterNode || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const now = t;
    const rampTime = v > (this._prevIntensity || 0) ? 0.8 : 1.5; // faster build, slower release
    this._prevIntensity = v;

    // Cubic curve: slow buildup at low intensity, fast open at high
    const curve = v * v * v;
    const cutoff = 600 + curve * 21400; // 600Hz (calm) → 22000Hz (combat)

    this.filterNode.frequency.cancelScheduledValues(now);
    this.filterNode.frequency.setValueAtTime(this.filterNode.frequency.value || cutoff, now);
    this.filterNode.frequency.linearRampToValueAtTime(cutoff, now + rampTime);

    // Gain boost: subtle volume swell at high intensity (+0 to +4 dB)
    const boost = 1.0 + v * 0.25; // 1.0 → 1.25
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(AUDIO.music * boost, now + rampTime * 0.8);
  }

  // ─── Procedural SFX (unchanged, production-grade) ────────────────────────

  beep(freq = 440, dur = 0.08, type = 'sine', vol = 0.2) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  sfx(name) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const mk = (type, freqStart, freqEnd, dur, vol) => {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(freqStart, now);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), now + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.connect(g); g.connect(this.sfxGain);
      o.start(now); o.stop(now + dur);
    };
    switch (name) {
      case 'cursor': this.beep(880, 0.05, 'square', 0.12); break;
      case 'confirm': mk('triangle', 440, 1200, 0.18, 0.25); break;
      case 'cancel': mk('triangle', 660, 220, 0.18, 0.22); break;
      case 'menu_open': mk('sine', 300, 800, 0.25, 0.2); break;
      case 'menu_close': mk('sine', 800, 200, 0.25, 0.2); break;
      case 'battle_start':
        mk('square', 200, 600, 0.2, 0.25);
        setTimeout(() => mk('square', 400, 900, 0.3, 0.25), 250); break;
      case 'hit':
        mk('sawtooth', 180, 60, 0.12, 0.3);
        this._noise(0.1, 0.2); break;
      case 'slash':
        this._noise(0.18, 0.3, 1800);
        setTimeout(() => mk('triangle', 600, 200, 0.1, 0.15), 30); break;
      case 'magic_fire': mk('sawtooth', 220, 900, 0.35, 0.3); this._noise(0.2, 0.15, 1200); break;
      case 'magic_ice': mk('sine', 1800, 600, 0.4, 0.25); break;
      case 'magic_thunder': mk('square', 1200, 60, 0.25, 0.3); this._noise(0.12, 0.25, 3000); break;
      case 'magic_holy': mk('sine', 600, 2400, 0.5, 0.25); break;
      case 'magic_cure': mk('triangle', 660, 1320, 0.5, 0.22); setTimeout(()=>mk('triangle',990,1980,0.5,0.18),80); break;
      case 'enemy_die': mk('sawtooth', 400, 40, 0.5, 0.3); this._noise(0.3, 0.15); break;
      case 'ally_die': mk('sine', 500, 100, 0.8, 0.3); break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => mk('triangle', f, f, 0.18, 0.25), i * 140)); break;
      case 'level_up':
        [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => mk('square', f, f, 0.12, 0.2), i * 100)); break;
      case 'boss_intro':
        mk('sawtooth', 80, 400, 0.6, 0.3);
        this._noise(0.5, 0.2, 200);
        setTimeout(() => mk('square', 200, 600, 0.5, 0.25), 300);
        setTimeout(() => mk('sawtooth', 400, 100, 0.8, 0.25), 600); break;
      case 'save':
        mk('sine', 600, 1200, 0.3, 0.2);
        setTimeout(() => mk('sine', 900, 1800, 0.4, 0.18), 100);
        setTimeout(() => mk('triangle', 1200, 2400, 0.5, 0.15), 200); break;
      case 'treasure':
        [523, 784, 1047, 1568].forEach((f, i) => setTimeout(() => mk('square', f, f, 0.12, 0.22), i * 90)); break;
      case 'dragon_transform':
        mk('sawtooth', 100, 800, 0.4, 0.3);
        this._noise(0.3, 0.2, 400);
        setTimeout(() => mk('triangle', 400, 1600, 0.5, 0.25), 200); break;
      case 'crit':
        mk('square', 300, 100, 0.1, 0.3);
        this._noise(0.15, 0.25, 2000); break;
      case 'coin': mk('square', 1200, 800, 0.08, 0.18); break;
      default: this.beep(440, 0.08, 'sine', 0.15);
    }
  }

  _noise(dur = 0.1, vol = 0.2, highpass = 0) {
    if (!this.ctx) return;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    if (highpass > 0) {
      const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = highpass;
      src.connect(hp); hp.connect(g);
    } else src.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }

  setMusicVolume(v) { if (this.musicGain) this.musicGain.gain.value = v; }
  setSfxVolume(v) { if (this.sfxGain) this.sfxGain.gain.value = v; }
}

export const audio = new AudioEngine();
