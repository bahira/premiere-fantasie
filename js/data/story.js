// data/story.js — Scenario tree (FFIX-style long story in 12 chapters)
// INSPIRED BY FFIX: war between nations, mist, summons, identity quest.
// ALL strings use double quotes to avoid JS parse errors with French apostrophes.

export const STORY = {
  title: "Premiere Fantasie — L'Echo de la Brume",
  premise: "Le royaume attaque sa voisine Lindblum. La jeune princesse Selia fuit avec le voleur Luan a bord d'un aeronef qui s'ecrase dans la foret maudite de la Brume. Une aventure commence pour reveiller les Esprits et comprendre le secret de Mira, mage nee de la brume.",

  chapters: [
    {
      id: 1, title: "La Foret de la Brume", location: "forest",
      intro: "L'aeronef s'ecrase. Luan et Selia se reveillent seuls. Mira, une jeune mage perdue, les rejoint chassee par un monstre.",
      scenes: [
        { speaker: "Luan", text: "On est vivants... ou suis-je, bon sang ?" },
        { speaker: "Selia", text: "C'est la foret de la Brume. On dit que ceux qui s'y perdent ne reviennent jamais." },
        { speaker: "Luan", text: "Super. On leve le camp. Je crois qu'on est pas les seuls ici." },
        { speaker: "Mira", text: "Aidez-moi ! Une chose me suit ! Elle a des yeux rouges..." },
        { speaker: "Luan", text: "Derriere toi ! Prepare-toi, on se bat !" },
      ],
      map: {
        startX: 80, startY: 400, width: 600, height: 500,
        bounds: { top: 30, bottom: 470, left: 20, right: 580 },
        encounterZones: [
          { x: 50, y: 50, w: 200, h: 200, enemies: ['goblin'], rate: 0.06, stepThreshold: 10, expReward: 30, apReward: 1, gilReward: 15 },
          { x: 300, y: 200, w: 180, h: 180, enemies: ['goblin','goblin'], rate: 0.07, stepThreshold: 12, expReward: 40, apReward: 1, gilReward: 20 },
          { x: 100, y: 280, w: 150, h: 150, enemies: ['fuse'], rate: 0.05, stepThreshold: 15, expReward: 35, apReward: 1, gilReward: 18 },
        ],
        pois: [
          { x: 500, y: 100, label: 'Sortie', icon: '🚪', type: 'advance', action: 'Quitter la forêt' },
          { x: 60, y: 440, label: 'Coffre', icon: '📦', type: 'chest', action: 'Ouvrir', contents: { gold: 150 } },
          { x: 560, y: 460, label: 'Coffre Mystère', icon: '📦', type: 'chest', action: 'Ouvrir', contents: { item: { id: 'elixir', count: 1 } } },
        ],
        npcs: [
          { id: 'old_woodcutter', name: 'Bûcheron Gron', role: 'villager', x: 200, y: 100, radius: 50,
            lines: [
              "Hé là, jeunes gens ! La forêt est dangereuse avec cette brume. J'ai vu des gobelins rôder.",
              "Ma hache s'émousse sur ces brumes... mais je connais un raccourci vers la sortie.",
              "Prenez garde aux fleurs rouges. Leur pollen rend aveugle."
            ]
          },
          { id: 'lost_hunter', name: 'Chasseur Perdu', role: 'guard', x: 400, y: 420, radius: 45,
            lines: [
              "Je chassais un sanglier quand la brume m'a enveloppé. Je tourne en rond depuis des heures.",
              "Vous venez du ciel ? J'ai entendu un fracas cette nuit. Une étoile tombée?",
              "Si vous voyez une lumière bleue, suivez-la. Les esprits de la forêt guident les cœurs purs."
            ]
          },
          { id: 'forest_spirit', name: 'Esprit de la Forêt', role: 'elder', x: 350, y: 50, radius: 45,
            lines: [
              "Je suis l'esprit de ces bois... Je dormais. Votre crash m'a réveillé.",
              "La Brume n'existait pas avant que l'Arbre ne se mette à saigner. Quelqu'un le blesse.",
              "Selia... J'entends Raziel en vous. Vous êtes plus que ce que vous croyez."
            ],
            questgiver: true,
            questIntro: "Petits humains. Trouvez le gland de lumière dans le bosquet maudit. Plantez-le à la clairière pour purifier cette terre.",
            questReward: { gold: 200, item: { id: 'potion', count: 5 } }
          }
        ],
      },
      objective: "Survivre a la foret et rejoindre la clairiere.",
    },
    {
      id: 2, title: "Le Chevalier d'Alexandrie", location: "forest",
      intro: "Aldric, chevalier d'Alexandrie, arrive pour recuperer la princesse Selia. Mesentente, puis alliance forcee.",
      scenes: [
        { speaker: "Aldric", text: "Princesse Selia ! Par ordre de votre mere, je vous escorte a Alexandrie." },
        { speaker: "Selia", text: "Pardonne, Aldric. Je ne rentrerai pas comme ca. Il faut comprendre la Brume." },
        { speaker: "Aldric", text: "C'est du mutiny. Je ne peux le permettre. Au nom d'Alexandrie, je frappe !" },
        { speaker: "Luan", text: "Oh non. Vas-y, princesse. On le calme." },
      ],
      battle: { enemies: ["boss_steiner_dark"], apReward: 5, expReward: 200, isStoryFight: true, yieldAlly: "knight" },
      cutsceneAfter: { speaker: "Aldric", text: "Vous etes fou, Luan. Mais vous vous battez bien. Je viens avec vous." },
      objective: "Vaincre Aldric, gagner son allegeance.",
    },
    {
      id: 3, title: "La Cave de Brume", location: "cave",
      intro: "Une grotte pleine de brume dilue la realite. L'equipe y cherche la source du phenomene.",
      scenes: [
        { speaker: "Mira", text: "Cette brume... elle me parle. Comme si je la connaissais." },
        { speaker: "Aldric", text: "Restez groupes. Le sol respire." },
        { speaker: "Luan", text: "Une queue ! Vite, on degaine." },
      ],
      battle: { enemies: ["skeleton","bomb"], apReward: 4, expReward: 100 },
      map: {
        startX: 80, startY: 350, width: 600, height: 450,
        bounds: { top: 20, bottom: 430, left: 20, right: 580 },
        encounterZones: [
          { x: 50, y: 30, w: 200, h: 180, enemies: ['skeleton'], rate: 0.06, stepThreshold: 10, expReward: 60, apReward: 2, gilReward: 20 },
          { x: 300, y: 60, w: 200, h: 170, enemies: ['bomb','mimic'], rate: 0.07, stepThreshold: 12, expReward: 70, apReward: 2, gilReward: 25 },
          { x: 150, y: 250, w: 250, h: 150, enemies: ['skeleton','bomb'], rate: 0.05, stepThreshold: 15, expReward: 100, apReward: 3, gilReward: 30 },
          { x: 400, y: 280, w: 140, h: 120, enemies: ['fantome'], rate: 0.04, stepThreshold: 14, expReward: 130, apReward: 4, gilReward: 35 },
          { x: 460, y: 360, w: 110, h: 70, enemies: ['darkknight'], rate: 0.015, stepThreshold: 6, expReward: 500, apReward: 12, gilReward: 200, isBoss: true },
        ],
        pois: [
          { x: 520, y: 80, label: 'Source', icon: '💠', type: 'advance', action: 'Explorer la source' },
          { x: 60, y: 80, label: 'Torche', icon: '🔥', type: 'rest', action: 'Se reposer' },
        ],
        npcs: [
          { id: 'trapped_miner', name: 'Mineur Piégé', role: 'villager', x: 380, y: 400, radius: 45,
            lines: [
              "La brume a pris mes compagnons... Je les ai vus disparaître un par un.",
              "Ne faites pas confiance aux lumières dansantes. Elles mènent aux gouffres.",
              "La sortie est au nord-est. Si vous la trouvez, dites aux miens que je suis vivant."
            ]
          },
          { id: 'cave_sage', name: 'Sage des Roches', role: 'elder', x: 200, y: 120, radius: 50,
            lines: [
              "La brume n'est pas naturelle. Elle est fabriquée par une volonté, là-bas, au cœur de l'arbre.",
              "Vous cherchez la vérité ? Elle se trouve dans les souvenirs de ceux qui ont été créés par la brume.",
              "Mira... ce nom résonne dans les cristaux. Elle est la clé."
            ],
            questgiver: true,
            questIntro: "Approchez, voyageurs. Trouvez le fragment de miroir dans la chambre aux échos et rapportez-le-moi. Il révèlera vos véritables visages.",
            questReward: { gold: 300, item: { id: 'potion', count: 3 } }
          }
        ],
      },
      cutsceneAfter: { speaker: "Mira", text: "Je sens une presence. Quoi que ce soit qui fabrique la brume... c'est ici." },
      objective: "Traverser la grotte et trouver la source de la brume.",
    },
    {
      id: 4, title: "La Plante Carnivore", location: "cave",
      intro: "Une plante geante barre le chemin, abreuvee de brume. Premier vrai defi.",
      scenes: [
        { speaker: "Selia", text: "Une fleur immense... elle nous a reperes." },
        { speaker: "Luan", text: "On l'amadoue pas, on la coupe. Ca va taper fort." },
        { speaker: "Mira", text: "Attention au pollen. Je vois etouffer." },
      ],
      battle: { enemies: ["boss_plant"], apReward: 12, expReward: 400, isBossFight: true, reward: { item: "mythril_dagger" } },
      cutsceneAfter: { speaker: "Selia", text: "Victoire. On respire. Mais le vrai secret est encore plus loin." },
      objective: "Vaincre la Plante Carnivore.",
    },
    {
      id: 5, title: "Lindblum, cite du Grand Chateau", location: "town_lindblum",
      intro: "Arrivee a la grande cite industrielle. PNJs, objets, repos.",
      scenes: [
        { speaker: "Luan", text: "Lindblum ! Enfin. Si on trouve un aubergiste et un marchand, ca ira." },
        { speaker: "Aldric", text: "Je connais le Regent Cid. Il nous aidera." },
        { speaker: "Cid", text: "Bienvenue, voyageurs. La brume tourmente s'etend. Alexandrie n'est plus ce qu'elle etait." },
        { speaker: "Selia", text: "Ma mere... elle est derriere tout ca ?" },
      ],
      isTown: true,
      townFeatures: ["inn","shop","synthesis","save"],
      objective: "Reposer, acheter, parler a Cid, sauvegarder.",
    },
    {
      id: 6, title: "Le Chant des Esprits", location: "forest",
      intro: "Selia entend un Esprit l'appeler dans la clairiere. Premier appel de pouvoir d'Esprit.",
      scenes: [
        { speaker: "Selia", text: "Une voix... comme une cloche sous l'eau." },
        { speaker: "?",      text: "Pretresse, tu portes notre memoire. Reveille-nous." },
        { speaker: "Luan", text: "Selia ? Tu parles seule la. Ca va ?" },
        { speaker: "Selia", text: "Oui. Je crois que je commence a comprendre." },
      ],
      map: {
        startX: 80, startY: 300, width: 600, height: 500,
        bounds: { top: 30, bottom: 470, left: 20, right: 580 },
        encounterZones: [
          { x: 30, y: 30, w: 250, h: 200, enemies: ['loup'], rate: 0.06, stepThreshold: 11, expReward: 80, apReward: 2, gilReward: 28 },
          { x: 250, y: 250, w: 200, h: 180, enemies: ['araignee','champignon'], rate: 0.06, stepThreshold: 13, expReward: 100, apReward: 3, gilReward: 32 },
          { x: 120, y: 380, w: 180, h: 120, enemies: ['loup','loup'], rate: 0.05, stepThreshold: 14, expReward: 110, apReward: 4, gilReward: 35 },
          { x: 450, y: 180, w: 120, h: 120, enemies: ['dryad'], rate: 0.04, stepThreshold: 16, expReward: 140, apReward: 5, gilReward: 40 },
        ],
        pois: [
          { x: 500, y: 100, label: 'Clairière', icon: '✨', type: 'advance', action: 'Entrer dans la clairière' },
          { x: 80, y: 80, label: 'Camp', icon: '🏕️', type: 'rest', action: 'Se reposer' },
          { x: 300, y: 420, label: 'Sauvegarde', icon: '💾', type: 'save', action: 'Sauvegarder' },
          { x: 60, y: 460, label: 'Coffre', icon: '📦', type: 'chest', action: 'Ouvrir', contents: { item: { id: 'ether', count: 2 } } },
          { x: 560, y: 460, label: 'Coffre Secret', icon: '📦', type: 'chest', action: 'Ouvrir', contents: { gold: 500 } },
        ],
        npcs: [
          { id: 'spirit_guide', name: 'Guide des Esprits', role: 'elder', x: 250, y: 150, radius: 50,
            lines: [
              "Les esprits vibrent fort ici. Selia, entends-tu leur chant ?",
              "La clairière au nord-est est un lieu de pouvoir. Les cristaux y parlent aux élus.",
              "J'ai gardé ce lieu pendant quarante ans. Jamais je n'ai senti les esprits si agités."
            ]
          },
          { id: 'light_spirit', name: 'Lumen', role: 'sage', x: 450, y: 300, radius: 45,
            lines: [
              "Je suis un fragment de Raziel. Ma mémoire est dispersée. Rassemblez les morceaux.",
              "Kuja craint ce que vous allez devenir. C'est pourquoi il vous traque.",
              "Le monde est un cristal brisé. Chaque âme en est un éclat."
            ],
            questgiver: true,
            questIntro: "Porteur de lumière. Dans le bosquet sombre au nord, trois fragments de ma mémoire sont cachés. Trouvez-les et je révélerai le chemin vers Raziel.",
            questReward: { gold: 400, item: { id: 'ether', count: 1 } }
          }
        ],
        npcs: [
          { id: 'elder_moss', name: 'Vieux Mouss', role: 'elder', x: 120, y: 200, radius: 50,
            lines: [
              "La brume ne fait que s'épaissir, enfants. Les anciens esprits s'y cachent... ou sont-ils la cause ?",
              "J'ai vu des lueurs dans la clairière, la nuit. Des esprits qui chantent.",
              "Méfiez-vous du sol qui respire. Il se souvient de chaque pas."
            ],
            questgiver: true,
            questIntro: "Ah, des voyageurs braves ou fous... Écoutez. Si vous trouvez le cristal brisé au fond de la grotte, rapportez-le-moi. Je saurai quoi en faire.",
            questReward: { gold: 500, item: { id: 'elixir', count: 1 } }
          },
          { id: 'lost_child', name: 'Petit Tim', role: 'child', x: 400, y: 350, radius: 45,
            lines: [
              "Maman a dit de ne pas aller trop loin... mais j'ai vu un chat lumineux !",
              "Il a disparu vers le nord. Il brillait comme les étoiles.",
              "Vous aussi vous cherchez les esprits ? Moi aussi."
            ]
          },
          { id: 'wandering_merchant', name: 'Marchand Ghys', role: 'merchant', x: 520, y: 200, radius: 50,
            lines: [
              "Ah, des clients ! J'ai des potions, des éthers, des plumes de phénix... mais pas de clients ici !",
              "La route vers Lindblum est dangereuse. Prenez au moins un élixir, pour la route.",
              "J'ai entendu dire qu'un trésor dort dans la grotte. Mais personne n'en revient."
            ]
          }
        ],
      },
      objective: "Approfondir le lien de Selia avec les Esprits.",
    },
    {
      id: 7, title: "Le Desert de Conde Petie", location: "desert",
      intro: "Desert chaud, oasis et marchands ambulants. Premiere vraie exploration.",
      scenes: [
        { speaker: "Luan", text: "Pas le plus cool pour un vol nocturne." },
        { speaker: "Aldric", text: "Continuons. Un temple se dresse plus loin." },
      ],
      map: {
        startX: 60, startY: 400, width: 700, height: 500,
        bounds: { top: 20, bottom: 480, left: 15, right: 685 },
        encounterZones: [
          { x: 30, y: 30, w: 300, h: 200, enemies: ['scorpion'], rate: 0.06, stepThreshold: 12, expReward: 130, apReward: 4, gilReward: 35 },
          { x: 350, y: 180, w: 200, h: 180, enemies: ['djinn'], rate: 0.07, stepThreshold: 14, expReward: 160, apReward: 6, gilReward: 40 },
          { x: 80, y: 320, w: 150, h: 130, enemies: ['vautour','vautour'], rate: 0.05, stepThreshold: 16, expReward: 120, apReward: 4, gilReward: 30 },
          { x: 520, y: 300, w: 130, h: 130, enemies: ['scorpion','djinn'], rate: 0.04, stepThreshold: 18, expReward: 200, apReward: 7, gilReward: 50 },
        ],
        pois: [
          { x: 620, y: 80, label: 'Temple', icon: '🏛️', type: 'advance', action: 'Entrer dans le temple' },
          { x: 200, y: 440, label: 'Oasis', icon: '💧', type: 'rest', action: 'Boire et se reposer' },
          { x: 60, y: 80, label: 'Coffre Ancien', icon: '📦', type: 'chest', action: 'Ouvrir', contents: { item: { id: 'mythril_dagger', count: 1 } } },
          { x: 670, y: 460, label: 'Coffre', icon: '📦', type: 'chest', action: 'Ouvrir', contents: { gold: 300 } },
        ],
        npcs: [
          { id: 'caravan_leader', name: 'Chef de Caravane', role: 'merchant', x: 150, y: 150, radius: 50,
            lines: [
              "Notre caravane a été attaquée par des gobelins. J'ai perdu la moitié de ma marchandise.",
              "Si vous allez vers l'est, attention aux squelettes qui marchent. La brume les anime.",
              "J'ai des potions en vente si vous êtes intéressés. Le voyage est long jusqu'au temple."
            ]
          },
          { id: 'temple_guardian', name: 'Gardien du Temple', role: 'guard', x: 550, y: 380, radius: 50,
            lines: [
              "Le temple est interdit aux non-initiés. Mais vous... vous sentez différent.",
              "On dit que le cristal du désert peut révéler les mensonges par la vérité.",
              "Si vous cherchez l'entrée scellée, vous aurez besoin de trois sceaux de lumière."
            ],
            questgiver: true,
            questIntro: "Étrangers. Prouvez votre valeur. Trois ombres errent dans le désert — des Ironites corrompus. Détruisez-les et je vous laisserai passer.",
            questReward: { gold: 600, item: { id: 'mythril_dagger', count: 1 } }
          },
          { id: 'mirage_traveler', name: 'Voyageur Mirage', role: 'sage', x: 400, y: 100, radius: 45,
            lines: [
              "Le désert est un voile. Derrière lui se trouve un monde de cristal où les souvenirs dansent.",
              "Mira n'est pas née. Elle a été rêvée par Kuja. Mais les rêves peuvent se rebeller.",
              "La chaleur ici est trompeuse. Elle n'est pas naturelle. C'est la fièvre du monde."
            ]
          }
        ],
      },
      objective: "Traverser le desert et atteindre le Temple.",
    },
    {
      id: 8, title: "L'Arbre d'Iifa", location: "magic_tree",
      intro: "L'arbre surnaturel emet toute la brume du monde. Le coeur du malaise y loge.",
      scenes: [
        { speaker: "Mira", text: "Ici, je suis nee. Je le sais maintenant. On m'a faite de cette brume. Je suis une arme." },
        { speaker: "Selia", text: "Mira... tu n'es pas une arme. Tu es notre amie." },
        { speaker: "Luan", text: "Et on va couper la source. ENSEMBLE." },
      ],
      battle: { enemies: ["fuse","skeleton","bomb"], apReward: 10, expReward: 320 },
      map: {
        startX: 80, startY: 420, width: 650, height: 480,
        bounds: { top: 20, bottom: 460, left: 20, right: 630 },
        encounterZones: [
          { x: 40, y: 40, w: 220, h: 180, enemies: ['champignon','dryad'], rate: 0.06, stepThreshold: 12, expReward: 140, apReward: 4, gilReward: 35 },
          { x: 300, y: 80, w: 200, h: 180, enemies: ['construct_mana'], rate: 0.05, stepThreshold: 14, expReward: 180, apReward: 6, gilReward: 45 },
          { x: 120, y: 260, w: 240, h: 160, enemies: ['ombre_ancienne','dryad'], rate: 0.04, stepThreshold: 16, expReward: 200, apReward: 7, gilReward: 50 },
          { x: 440, y: 300, w: 150, h: 120, enemies: ['construct_mana','ombre_ancienne'], rate: 0.03, stepThreshold: 18, expReward: 280, apReward: 9, gilReward: 65 },
        ],
        pois: [
          { x: 560, y: 60, label: 'Sommet', icon: '🌳', type: 'advance', action: 'Monter au sommet' },
          { x: 60, y: 60, label: 'Camp de brume', icon: '🏕️', type: 'rest', action: 'Se reposer' },
          { x: 340, y: 420, label: 'Sauvegarde', icon: '💾', type: 'save', action: 'Sauvegarder' },
          { x: 60, y: 420, label: 'Coffre Ancestral', icon: '📦', type: 'chest', action: 'Ouvrir', contents: { item: { id: 'elixir', count: 1 } } },
          { x: 560, y: 420, label: 'Coffre', icon: '📦', type: 'chest', action: 'Ouvrir', contents: { gold: 600 } },
        ],
        npcs: [
          { id: 'tree_guardian', name: 'Gardien de Iifa', role: 'elder', x: 320, y: 180, radius: 50,
            lines: [
              "L'Arbre Iifa fut le berceau du monde. Quelqu'un l'a empoisonné de brume.",
              "Mira... je te reconnais. Tu es l'enfant de l'Arbre. Son cœur te bat encore.",
              "Montez. Le sommet révélera la vérité que Kuja cache depuis toujours."
            ],
            questgiver: true,
            questIntro: "Enfants de la brume... Si vous trouvez le cristal de sève au cœur de l'arbre, il purifiera les racines. Revenez vers moi.",
            questReward: { gold: 700, item: { id: 'elixir', count: 1 } }
          },
          { id: 'mystic_bloom', name: 'Fleur Mystique', role: 'sage', x: 500, y: 240, radius: 40,
            lines: [
              "Chaque pétale contient un souvenir. Celui-ci est le premier rire de Mira.",
              "La brume n'est pas le mal. L'intention derrière l'est.",
              "Kuja voulait créer une arme. L'Arbre a donné un cœur."
            ]
          }
        ],
      },
      objective: "Atteindre le sommet de l'arbre et identifier la source.",
    },
    {
      id: 9, title: "Le Retour du Chevalier Noir", location: "magic_tree",
      intro: "Aldric doit affronter son ancien capitaine, devenu sclerarche de la Brume.",
      scenes: [
        { speaker: "Dark Knight", text: "Traitre. Tu choisis les faibles contre Alexandrie." },
        { speaker: "Aldric", text: "Je choisis l'honneur. De mon epee, je te juge !" },
      ],
      battle: { enemies: ["boss_steiner_dark"], apReward: 18, expReward: 700, isBossFight: true, reward: { item: "saves_the_queen" } },
      map: {
        startX: 340, startY: 400, width: 620, height: 460,
        bounds: { top: 20, bottom: 440, left: 20, right: 600 },
        encounterZones: [
          { x: 50, y: 30, w: 200, h: 180, enemies: ['ombre_ancienne','construct_mana'], rate: 0.04, stepThreshold: 14, expReward: 240, apReward: 8, gilReward: 60 },
          { x: 350, y: 60, w: 200, h: 180, enemies: ['gargoyyle','ombre_ancienne'], rate: 0.03, stepThreshold: 16, expReward: 300, apReward: 10, gilReward: 75 },
        ],
        pois: [
          { x: 560, y: 60, label: 'Arène du Chevalier', icon: '⚔️', type: 'advance', action: 'Affronter le Chevalier Noir' },
          { x: 60, y: 80, label: 'Refuge', icon: '🏕️', type: 'rest', action: 'Se reposer' },
          { x: 300, y: 400, label: 'Sauvegarde', icon: '💾', type: 'save', action: 'Sauvegarder' },
          { x: 60, y: 400, label: 'Coffre du Chevalier', icon: '📦', type: 'chest', action: 'Ouvrir', contents: { item: { id: 'elixir', count: 1 } } },
        ],
      },
      cutsceneAfter: { speaker: "Aldric", text: "Adieu, mon frere d'armes. Que ta brume enfin se dissipe." },
      objective: "Vaincre le Chevalier Noir pour de bon.",
    },
    {
      id: 10, title: "L'Echo de Kuja", location: "desert",
      intro: "Un etre etrange fend l'horizon. Il se nomme Kuja, et il a cree Mira comme arme.",
      scenes: [
        { speaker: "Kuja", text: "Ma petite experience s'est trouvee une famille. Pathetique." },
        { speaker: "Mira", text: "...Tu es mon createur ? Alors tu sais POURQUOI j'existe ?" },
        { speaker: "Kuja", text: "Pour detruire. Mais tu refuses. Je vais le faire moi-meme." },
        { speaker: "Selia", text: "On l'arretera, Mira. On l'arretera." },
      ],
      battle: { enemies: ["ironite","skeleton","bomb"], apReward: 15, expReward: 600 },
      map: {
        startX: 50, startY: 400, width: 700, height: 500,
        bounds: { top: 20, bottom: 480, left: 15, right: 685 },
        encounterZones: [
          { x: 30, y: 20, w: 300, h: 200, enemies: ['scorpion','djinn'], rate: 0.06, stepThreshold: 12, expReward: 180, apReward: 6, gilReward: 45 },
          { x: 380, y: 160, w: 200, h: 200, enemies: ['vautour','vautour','djinn'], rate: 0.07, stepThreshold: 14, expReward: 220, apReward: 7, gilReward: 55 },
          { x: 200, y: 350, w: 180, h: 130, enemies: ['scorpion','scorpion'], rate: 0.05, stepThreshold: 16, expReward: 260, apReward: 8, gilReward: 60 },
        ],
        pois: [
          { x: 630, y: 80, label: 'Portail', icon: '🌀', type: 'advance', action: 'Affronter Kuja' },
          { x: 100, y: 80, label: 'Oasis de cristal', icon: '💧', type: 'rest', action: 'Se reposer' },
        ],
        npcs: [
          { id: 'desert_wanderer', name: 'Nomade Shur', role: 'villager', x: 300, y: 440, radius: 45,
            lines: [
              "Le vent du désert charrie des murmures. Kuja... ce nom glace le sang des marchands.",
              "J'ai vu un homme flottant au-dessus des dunes. Ses yeux brûlaient d'une lumière violette.",
              "Si vous cherchez le créateur de brume, il est à l'est. Mais préparez-vous à perdre ce que vous aimez."
            ]
          },
          { id: 'kuja_cultist', name: 'Fidèle Ombragé', role: 'villager', x: 500, y: 300, radius: 50,
            lines: [
              "Kuja est notre sauveur. Il purifiera ce monde par la brume.",
              "Vous les amis de la créature ratée... Mira n'est qu'un échec. Kuja est la perfection.",
              "Fuyez avant qu'il ne vous remarque. Sa clémence n'existe pas."
            ]
          },
          { id: 'old_sage_desert', name: 'Sage Ancien', role: 'elder', x: 180, y: 200, radius: 50,
            lines: [
              "Kuja n'est pas de ce monde. Il a été créé par un pouvoir plus ancien. Un pouvoir qui dort dans le cristal.",
              "Mira porte en elle le même noyau que Kuja. Elle peut le vaincre si elle choisit.",
              "Le cristal originel se trouve dans le monde renversé. Kuja y puise sa force."
            ],
            questgiver: true,
            questIntro: "Écoutez-moi bien. Kuja cherche le Cristal du Néant. Trouvez la clé des étoiles dans les ruines du sud et brisez-la avant lui. Je vous confie cette mission.",
            questReward: { gold: 800, item: { id: 'ether', count: 2 } }
          }
        ],
      },
      objective: "Repousser les sous-fifres de Kuja.",
    },
    {
      id: 11, title: "Le Reveil de Raziel", location: "palace",
      intro: "Selia invoque son Esprit interieur. Les vies du monde se posent dans le cristal.",
      scenes: [
        { speaker: "Selia", text: "Je t'invoque, Raziel ! Lampe sur le monde !" },
        { speaker: "Luan", text: "Ce pouvoir... on va pas se laisser faire par Kuja." },
      ],
      battle: { enemies: ["ironite","ironite","skeleton"], apReward: 20, expReward: 800 },
      map: {
        startX: 340, startY: 420, width: 680, height: 500,
        bounds: { top: 20, bottom: 480, left: 20, right: 660 },
        encounterZones: [
          { x: 40, y: 30, w: 250, h: 200, enemies: ['fantome','djinn'], rate: 0.06, stepThreshold: 14, expReward: 220, apReward: 7, gilReward: 55 },
          { x: 350, y: 60, w: 220, h: 180, enemies: ['gargoyyle'], rate: 0.05, stepThreshold: 16, expReward: 260, apReward: 8, gilReward: 60 },
          { x: 80, y: 280, w: 200, h: 150, enemies: ['fantome','fantome'], rate: 0.04, stepThreshold: 18, expReward: 300, apReward: 9, gilReward: 70 },
          { x: 440, y: 300, w: 160, h: 140, enemies: ['djinn','gargoyyle'], rate: 0.03, stepThreshold: 20, expReward: 350, apReward: 10, gilReward: 80 },
        ],
        pois: [
          { x: 600, y: 60, label: 'Trône Royal', icon: '👑', type: 'advance', action: 'Entrer dans la salle du trône' },
          { x: 80, y: 80, label: 'Autel de Lumière', icon: '✨', type: 'rest', action: 'Se reposer' },
          { x: 340, y: 420, label: 'Sauvegarde', icon: '💾', type: 'save', action: 'Sauvegarder' },
          { x: 60, y: 440, label: 'Coffre Royal', icon: '📦', type: 'chest', action: 'Ouvrir', contents: { item: { id: 'elixir', count: 2 } } },
          { x: 580, y: 440, label: 'Trésor Caché', icon: '📦', type: 'chest', action: 'Ouvrir', contents: { gold: 1000 } },
        ],
        npcs: [
          { id: 'palace_sentinel', name: 'Sentinelle du Palais', role: 'guard', x: 200, y: 160, radius: 50,
            lines: [
              "Nul ne passe sans l'aveu du Roi. Mais la raison est morte avec la Brume.",
              "Le palais est hanté par les souvenirs d'un temps oublié.",
              "Selia... la princesse ? Vous êtes revenue ? Le Roi attendait."
            ]
          },
          { id: 'ghost_advisor', name: 'Ancien Conseiller', role: 'elder', x: 500, y: 200, radius: 45,
            lines: [
              "Je suis l'ombre d'un homme qui servait le Roi avant la Brume.",
              "Raziel dort sous le trône. Réveillez-le et le monde retrouvera sa lumière.",
              "Kuja a volé la Couronne du Cristal. Sans elle, Raziel ne se réveillera pas."
            ],
            questgiver: true,
            questIntro: "Princesse... Si vous trouvez les trois éclats de Raziel cachés dans les salles du palais, l'Esprit se réveillera. Je vous en supplie.",
            questReward: { gold: 900, item: { id: 'elixir', count: 1 } }
          }
        ],
      },
      cutsceneAfter: { speaker: "Selia", text: "Raziel repond. La fin approche. On va le retrouver." },
      objective: "Reveiller l'Esprit final.",
    },
    {
      id: 12, title: "Le Combat Final — Kuja", location: "crystal_world",
      intro: "Le monde de cristal, choix definitif. Kuja vibre, fait de brume ancestrale, puissance ultime.",
      scenes: [
        { speaker: "Kuja", text: "Tant d'energie... pour quoi ? Vous allez mourir ici." },
        { speaker: "Luan", text: "On a une raison de vivre. Et toi, Kuja, tu as peur de la tienne." },
        { speaker: "Kuja", text: "Parlez, parlez. La fin vient a vous. FLARE." },
        { speaker: "Mira", text: "Pas cette fois. Je choisis ma signification." },
      ],
      battle: { enemies: ["boss_kuja_echo"], apReward: 30, expReward: 2000, isFinalBoss: true, reward: { item: "ribbon" } },
      cutsceneAfter: { speaker: "Luan", text: "Mira... tu l'as fait. On rentrera. Tous ensemble." },
      ending: true,
      objective: "Vaincre Kuja et sauver Gaia.",
    },
  ],
};

export function getChapter(id) { return STORY.chapters.find(c => c.id === id); }
export function nextChapter(currentId) { return STORY.chapters.find(c => c.id === currentId + 1); }
export const TOTAL_CHAPTERS = STORY.chapters.length;