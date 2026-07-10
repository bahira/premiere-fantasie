// scenes/gameover.js — Game Over screen with Breath of Fire Continue system
import { GAME } from '../state.js';
import { audio } from '../engine/audio.js';

export const gameover = {
  show(isBoss = false) {
    audio.pauseMusic?.();
    GAME.scene = 'gameover';
    const el = document.createElement('div'); el.id = 'gameover-screen';
    el.innerHTML = `
      <div class="go-inner">
        <h1>GAME OVER</h1>
        <p>L'équipe a succombé...</p>
        ${isBoss ? `<button id="go-continue">🐉 Continuer (50% HP/MP)</button>` : ''}
        <button id="go-retry">Continuer depuis la dernière sauvegarde</button>
        <button id="go-title">Retour au Titre</button>
      </div>`;
    document.body.appendChild(el);
    if (isBoss) {
      document.getElementById('go-continue').onclick = () => {
        el.remove();
        // Breath of Fire continue: revive + restore party to 50%
        for (const m of GAME.party) {
          m.alive = true;
          m.hp = Math.max(1, Math.floor(m.maxHp * 0.5));
          m.mp = Math.max(1, Math.floor(m.maxMp * 0.5));
          m.atb = 0; m.ready = false;
          m._buffs = {}; m._buffTurns = {}; m.focus = 0; m.focusReady = false;
        }
        // Reload the scene to retry the battle
        location.reload();
      };
    }
    document.getElementById('go-retry').onclick = () => {
      el.remove();
      import('../engine/save.js').then(s => {
        const ok = s.loadGame(GAME);
        if (ok) location.reload(); else alert('Aucune sauvegarde.');
      });
    };
    document.getElementById('go-title').onclick = () => { el.remove(); location.reload(); };
  },
};
