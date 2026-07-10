// scenes/theend.js — Ending screen after final boss
import { STORY } from '../data/story.js';
import { GAME } from '../state.js';
import { clearSave } from '../engine/save.js';
import { audio } from '../engine/audio.js';

export const theend = {
  show() {
    audio.setIntensity(0);
    audio.playScene('theend');
    GAME.scene = 'theend';
    const el = document.createElement('div'); el.id = 'theend-screen';
    el.innerHTML = `
      <div class="go-bg" style="background:url('sprites/ui/theend_bg.png') center/cover no-repeat"></div>
      <div class="te-inner">
        <h1>FIN</h1>
        <p class="te-epilogue">${STORY.premise}</p>
        <p class="te-msg">Mira a choisi sa propre signification. La Brume s'est dissipée. Alexandrie et Lindblum retrouvent la paix. Luan et ses compagnons rentrent, ensemble.</p>
        <p class="te-ty">Merci d'avoir joué.</p>
        <button id="te-continue">Nouvelle Partie+</button>
      </div>`;
    document.body.appendChild(el);
    document.getElementById('te-continue').onclick = () => { clearSave(); location.reload(); };
  },
};
