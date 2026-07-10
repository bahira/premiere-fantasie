// scenes/title.js — Premium Three.js title screen (3D bg + DOM menu overlay)
import { GAME, initParty } from '../state.js';
import { hasSave, loadGame } from '../engine/save.js';
import { audio } from '../engine/audio.js';
import { STORY } from '../data/story.js';
import { TitleThree } from '../renderer/three_title.js';

export class TitleScene {
  constructor(onStart) {
    this.onStart = onStart;
    this.root = null;
    this.sel = 0;
    this.three = null;
    this._kbTitle = null;
  }

  show() {
    GAME.scene = 'title';

    // ── 3D background (Three.js) ───────────────────────────────────
    this.three = new TitleThree(document.body);

    // ── DOM overlay (menu + title text) ─────────────────────────────
    this.root = document.createElement('div');
    this.root.id = 'title-screen';
    this.root.classList.add('title-3d');

    const titleLetters = STORY.title.split('').map((ch, i) =>
      ch === ' '
        ? ' '
        : `<span class="title-letter" style="animation-delay:${0.6 + i * 0.03}s">${ch}</span>`
    ).join('');
    const subtitle = STORY.title.split('—')[1] ? '—' + STORY.title.split('—')[1].trim() : '';

    this.root.innerHTML = `
      <div class="title-grain"></div>
      <div class="title-inner">
        <div class="title-emblem-3d"></div>
        <h1 class="title-main">${titleLetters}</h1>
        <p class="title-sub">${subtitle}</p>
        <div class="title-underline"><div class="title-underline-fill"></div></div>
        <p class="title-prem">${STORY.premise}</p>
        <nav class="title-nav" id="title-nav">
          <button data-a="new" class="title-btn" data-sel="0">
            <span class="title-btn-key">↵</span>
            <span class="title-btn-text">Nouvelle Partie</span>
          </button>
          ${hasSave() ? `<button data-a="continue" class="title-btn" data-sel="1"><span class="title-btn-key"></span><span class="title-btn-text">Continuer</span></button>` : ''}
          <button data-a="options" class="title-btn" data-sel="${hasSave() ? 2 : 1}">
            <span class="title-btn-key"></span>
            <span class="title-btn-text">Options</span>
          </button>
          <button data-a="about" class="title-btn" data-sel="${hasSave() ? 3 : 2}">
            <span class="title-btn-key"></span>
            <span class="title-btn-text">À Propos</span>
          </button>
        </nav>
        <div class="title-credits">Sentinel · ${STORY.title}</div>
        <div class="title-help">↑ ↓ : naviguer · Entrée : valider</div>
      </div>
      <div id="title-about" class="title-modal hidden">
        <div class="title-modal-inner">
          <h2>${STORY.title}</h2>
          <p>${STORY.premise}</p>
          <button class="title-modal-close">Fermer</button>
        </div>
      </div>`;

    document.body.appendChild(this.root);

    // Re-index selection after building
    this._buttons = [...this.root.querySelectorAll('button[data-a]')];
    this.sel = 0;
    this._highlight();

    // Music auto-start on first interaction
    const startMusic = async () => {
      await audio.init();
      await audio.playScene('title');
      if (this.root) {
        this.root.removeEventListener('click', startMusic);
        this.root.removeEventListener('keydown', startMusic);
      }
    };
    this.root.addEventListener('click', startMusic);
    this.root.addEventListener('keydown', startMusic);

    // Wire button clicks
    this._buttons.forEach((b) => {
      b.addEventListener('click', () => {
        audio.sfx('confirm');
        this._action(b.dataset.a);
      });
      b.addEventListener('mouseenter', () => {
        this.sel = parseInt(b.dataset.sel, 10) || 0;
        this._highlight();
        audio.sfx('cursor');
      });
    });

    // Keyboard navigation (arrows + enter)
    this._kbTitle = (e) => {
      if (GAME.scene !== 'title') return;
      const n = this._buttons.length;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        this.sel = (this.sel + 1) % n;
        this._highlight();
        audio.sfx('cursor');
      } else if (e.code === 'ArrowUp' || e.code === 'KeyZ') {
        e.preventDefault();
        this.sel = (this.sel - 1 + n) % n;
        this._highlight();
        audio.sfx('cursor');
      } else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        audio.sfx('confirm');
        this._action(this._buttons[this.sel].dataset.a);
      } else if (e.code === 'Escape') {
        const about = document.getElementById('title-about');
        if (about) about.classList.add('hidden');
      }
    };
    window.addEventListener('keydown', this._kbTitle);

    // Close about modal
    const aboutClose = this.root.querySelector('.title-modal-close');
    if (aboutClose) {
      aboutClose.addEventListener('click', () => {
        audio.sfx('cancel');
        document.getElementById('title-about').classList.add('hidden');
      });
    }
  }

  _highlight() {
    this._buttons.forEach((b, i) => {
      b.classList.toggle('sel', i === this.sel);
    });
  }

  hide() {
    if (this._kbTitle) {
      window.removeEventListener('keydown', this._kbTitle);
      this._kbTitle = null;
    }
    if (this.three) {
      this.three.dispose();
      this.three = null;
    }
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
  }

  _action(a) {
    if (a === 'new') {
      initParty();
      GAME.chapterId = 1;
      this.onStart('field');
    } else if (a === 'continue') {
      loadGame(GAME);
      setTimeout(() => this.onStart('field'), 50);
    } else if (a === 'options') {
      import('../ui/options.js')
        .then((m) => m.options.open())
        .catch(() => alert('Options: Musique/SFX réglables via le menu.'));
    } else if (a === 'about') {
      const about = document.getElementById('title-about');
      if (about) about.classList.remove('hidden');
    }
  }
}
