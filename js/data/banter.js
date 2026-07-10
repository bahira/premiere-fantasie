// data/banter.js — Character-specific battle quips (FFIX-style personality)
// Triggers: first_blood, crit_landed, ally_ko, boss_phase, victory, focus_ready, dragon_form, counter

export const BANTER = {
  zidane: {
    first_blood:   [`Premier sang. Ça va saigner.`, `Toi d'abord, monstre.`, `En garde, crétin !`],
    crit_landed:   [`DANS LE MILLE !`, `Ah ! Prends ça !`, `Trop facile !`],
    ally_ko:       [`Non ! Tiens bon !`, `Lâche-le !`, `Je vais lui faire payer ça.`],
    boss_phase:    [`Il se déchaîne ! Accrochez-vous !`, `Encore plus fort ?!`, `C'est ça le vrai combat.`],
    victory:       [`Comme d'habitude.`, `Encore un.`, `On est les meilleurs.`],
    focus_ready:   [`La rage monte...`, `Je sens le pouvoir !`, `À mon tour !`],
    dragon_form:   [`JE SUIS LE DRAGON !`, `PUISSANCE INFINIE !`, `BRÛLE !`],
    counter:       [`T'as touché le mauvais jour !`, `RENCARD !`, `À moi de jouer !`],
    battle_start:  [`C'est parti !`, `On les a !`, `Montrons-leur.`],
    heal_received: [`Merci, Selia.`, `Bien reçu.`, `Je repars.`],
  },
  knight: {
    first_blood:   [`En position.`, `Pour Alexandrie !`, `En garde !`],
    crit_landed:   [`JUGEMENT !`, `Implacable !`, `Tu ne passeras pas !`],
    ally_ko:       [`Non... pas lui...`, `Je vengerai ça.`, `Tu paieras, démon.`],
    boss_phase:    [`Son pouvoir augmente. Restez solides.`, `Gardez le moral !`, `C'est l'épreuve.`],
    victory:       [`Honneur et gloire.`, `Le devoir m'appelait.`, `Un pas de plus.`],
    focus_ready:   [`Mon coeur s'embrase...`, `Je sens la flamme !`, `Maintenant !`],
    dragon_form:   [`PAR LE DRAGON SACRÉ !`, `LAME DIVINE !`, `PUISSANCE CÉLESTE !`],
    counter:       [`Trop lent !`, `Contre !`, `Riposte !`],
    battle_start:  [`Prêts au combat.`, `Que l'honneur nous guide.`, `En avant.`],
    heal_received: [`Merci.`, `Bien reçu.`, `Je continue.`],
  },
  mage: {
    first_blood:   [`Attention, ça va chauffer !`, `Fuyez pas, c'est l'heure.`, `Je contrôle pas tout...`],
    crit_landed:   [`EXPLOSION !`, `PUISSANCE DE LA BRUME !`, `Brûle !`],
    ally_ko:       [`Arrêtez ! LÂCHEZ-LE !`, `Non... pas encore...`, `Je vais tous vous détruire.`],
    boss_phase:    [`Sa magie est énorme...`, `Il puise dans la brume !`, `Je reconnais cette énergie...`],
    victory:       [`Ouf... c'était chaud.`, `J'ai pas tout compris.`, `On a gagné.`],
    focus_ready:   [`Ça bouillonne...`, `La brume répond !`, `Encore !`],
    dragon_form:   [`APOCALYPSE !`, `TOUT VA DISPARAÎTRE !`, `JE SUIS LA BRUME !`],
    counter:       [`Surprise !`, `TIENS !`, `Raté !`],
    battle_start:  [`Faisons-les fumer.`, `Attention, je lance.`, `Je te vois...`],
    heal_received: [`Merci.`, `Ça fait du bien.`, `Encore...`],
  },
  healer: {
    first_blood:   [`Que les Esprits nous protègent.`, `Pour la paix.`, `Je prie pour nous.`],
    crit_landed:   [`LUMIÈRE DIVINE !`, `PAR RAZIEL !`, `Puissance sacrée !`],
    ally_ko:       [`Revenez... REVENEZ !`, `Non, je ne vous laisse pas tomber.`, `Je vais vous sauver.`],
    boss_phase:    [`La lumière vacille...`, `Gardez la foi !`, `Les Esprits nous regardent.`],
    victory:       [`Les Esprits veillent.`, `Encore debout.`, `Paix retrouvée.`],
    focus_ready:   [`La lumière m'emplit...`, `Je sens leur présence.`, `Protégez-moi !`],
    dragon_form:   [`L'AURORE SE LÈVE !`, `LUMIÈRE ÉTERNELLE !`, `PAR LE PREMIER ESPRIT !`],
    counter:       [`La lumière te juge !`, `REPENT !`, `Frappe sacrée !`],
    battle_start:  [`Que la lumière nous garde.`, `Je suis avec vous.`, `En avant, ensemble.`],
    heal_received: [`Merci...`, `Je vais mieux.`, `Bénis sois-tu.`],
  },
  narrator: {
    boss_phase: [`L'ennemi déchaîne sa puissance !`, `Une aura maléfique émane du boss.`, `Le combat prend une tournure féroce !`],
    victory:    [`Victoire !`, `Combat terminé.`, `Les héros triomphent !`],
    ally_ko:    [`Un allié tombe...`, `La situation se corse.`, `L'issue est incertaine.`],
  },
};

// Pick a random line for a character and context
export function getBanter(charId, context) {
  const charLines = BANTER[charId] || BANTER.narrator;
  const lines = charLines[context] || BANTER.narrator[context] || [`...`];
  return lines[Math.floor(Math.random() * lines.length)];
}
