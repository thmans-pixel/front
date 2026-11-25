# Spec 001 — Cahier des charges général du jeu

- **Statut : validée** (par Thibault, 2026-11-24 — voir « Décisions » en fin de document)
- Date : 2026-11-24
- Dépôt : `thmans-pixel/front`
- Référence : OpenFront 0.36 (code lu : tag `v0.36.7` de `openfrontio/OpenFrontIO`)
- Relecture demandée : 🔒 agent `gardien-enfants` pour les sections marquées 🔒

---

## Sommaire

1. Contexte et objectif
2. Ce que j'ai lu, vérifié… et pas pu vérifier
3. Licence : réécriture ou fork
4. Nom du jeu
5. Choix technique (3 options, recommandation)
6. Tableau des fonctionnalités : reprise / adaptée / écartée
7. Règles détaillées (blocs A à I), valeurs et critères d'acceptation
8. Maquettes des écrans
9. Découpage en étapes livrables
10. Hébergement et multijoueur (bloc J)
11. Risques
12. Points à relire par le gardien-enfants 🔒
13. Questions ouvertes (avec ma proposition)

**Légende des valeurs** :
- **[V]** vérifiée dans le code d'OpenFront v0.36.7 (fichier cité en section 2) ;
- **[J]** à régler en jouant (valeur de départ proposée, pas trouvée ou pas
  confirmée dans le code) ;
- **[≠]** la valeur du code diffère de celle de la demande : c'est la valeur du
  code qui est retenue, l'écart est expliqué.

**Unités** : comme OpenFront, les troupes sont stockées ×10 en interne et
affichées ÷10 **[V]** (`renderTroops`). Dans cette spec, sauf mention
contraire, les troupes sont en **unités affichées**. L'or n'a pas de facteur :
ce qui est stocké est ce qui est affiché. Un **tick** = 100 ms, soit 10 ticks
par seconde **[V]**.

---

## 1. Contexte et objectif

Créer un jeu de stratégie en temps réel dans le navigateur qui reprend les
fonctionnalités d'OpenFront 0.36 (conquête de pixels sur une carte réelle,
économie, constructions, mer, nucléaire, diplomatie, IA), pour jouer en
famille et entre amis, en solo ou en salon privé, hébergé sur thnas.

Ce que le jeu **n'est pas** : un service public, un jeu classé, un jeu avec
boutique, comptes payants ou publicité.

Contrainte forte : une carte d'environ **2 millions de pixels** (Monde :
2064 × 1032 = 2 130 048 pixels) et **400 tribus + 70 nations** simulées en temps
réel doivent rester fluides dans un navigateur (PC, tablette, téléphone).

---

## 2. Ce que j'ai lu, vérifié… et pas pu vérifier

### Lu

Dépôt public `openfrontio/OpenFrontIO`, **tag `v0.36.7`** (dernière version
0.36), en particulier :

| Fichier | Ce qu'il contient |
|---|---|
| `packages/engine-lib/src/configuration/Config.ts` | troupes max, croissance, durées (alliance, traître, immunité, phase d'apparition), portées SAM, rayons des bombes, seuil de victoire |
| `packages/engine/src/configuration/EngineConfig.ts` | formule de combat, coûts des unités, or passif, or des trains et des bateaux, navires de guerre, recharges, embargo, dons, émojis, tchat |
| `packages/engine/src/execution/*` | annulation d'attaque (malus 25 %), MIRV (350 ogives), tribus, nations, embargo automatique |
| `packages/engine/src/game/GameImpl.ts`, `PlayerImpl.ts` | trahison, embargos |
| `src/client/UserSettings.ts`, `InputHandler.ts`, `hud/Tutorial.ts` | raccourcis par défaut, ratio 20 %, tutoriel en 22 étapes |
| `src/client/SinglePlayerModal.ts`, `HostLobbyModal.ts` | 400 tribus par défaut |
| `resources/maps/world/manifest.json`, `resources/QuickChat.json` | Monde 2064×1032, 620 903 pixels de terre (29,1 %), 70 nations ; 6 catégories de tchat rapide |
| `src/server/ServerEnv.ts`, `GameServer.ts`, `ClientGameRunner.ts`, `WorkerClient.ts` | architecture : le serveur relaie les ordres 10 fois par seconde, chaque navigateur calcule la partie dans un Web Worker, rendu WebGL |
| `LICENSE`, `LICENSING.md`, `LICENSE-ASSETS` | licences (voir section 3) |

### Écarts trouvés avec la demande

| Demande | Code v0.36.7 | Retenu |
|---|---|---|
| Or : sources = territoire, … | L'or passif est **fixe** : 100 or par tick (1 000/s) par joueur, 50 pour une tribu, quelle que soit la taille du territoire. Le territoire n'en donne pas directement. | **[≠]** Or fixe comme dans le code ; je propose une question ouverte (Q7) pour ajouter un petit bonus de territoire si le jeu en famille le demande. |
| Barre de troupes « passe à l'orange vers la moitié du max » | La partie **orange** de la barre = troupes **engagées dans des attaques**. La croissance, elle, est maximale vers 40-45 % du max puis ralentit. | **[≠]** Orange = troupes en attaque ; on affiche en plus la croissance par seconde. |
| Plus d'attaquants = moins de pertes, plafonné à 2:1 | Les pertes de l'attaquant sont proportionnelles au rapport défenseurs/attaquants, **borné entre 0,6 et 2**. L'avantage s'arrête donc quand on est ~1,67 fois plus nombreux ; le désavantage s'arrête à 2 contre 1. | **[≠]** Bornes 0,6 et 2. |
| SAM : rayon 100 px, recharge 12 s | Rayon **70 px** au niveau 1 (formule 150 − 480/(niveau+5)), recharge **90 ticks = 9 s**. | **[≠]** 70 px / 9 s. |
| Navire de guerre niveau max 3 | Les navires ne s'améliorent pas : ils gagnent de la **vétérance** (max 3) en coulant des transports ou en capturant des bateaux de commerce. | **[≠]** Vétérance max 3. |
| MIRV 25M | 25M **+ 15M par MIRV déjà lancé** dans la partie (tous joueurs confondus). | **[≠]** |
| Ville : +25K de max | 250 000 internes = **+25K affichés** par niveau de ville. | Conforme. |
| Ports et usines | Leur coût croissant est **commun** : chaque port ou usine possédé fait doubler le prix des deux. | **[V]** repris. |

### Pas pu vérifier

- **L'interface exacte d'OpenFront en jeu** (couleurs, disposition des
  menus, textes) : je n'ai lu que le code, pas joué. Les maquettes de la
  section 8 sont les miennes.
- **La protection « tirs amis » juste après l'alliance** : je n'ai pas trouvé
  de règle explicite de ce nom. J'ai trouvé : une bombe qui touche plus de
  100 pixels d'un allié rompt l'alliance **[V]**. Le reste est **[J]**.
- **Le partage de l'or des bateaux de commerce entre les deux ports** :
  formule du montant vérifiée, répartition non vérifiée **[J]**.
- **Le don de troupes « selon le ratio »** : le moteur prévoit un tiers des
  troupes par défaut **[V]** ; je n'ai pas vérifié si l'interface utilise le
  curseur de ratio **[J]**.
- Les options « mort subite » et « blitz » : pas d'option portant ces noms.
  Le code a deux mécanismes anti-blocage, **Overtime** (le seuil de victoire
  baisse) et **Doomsday Clock** (les retardataires dépérissent). Je propose
  Blitz = Overtime et Mort subite = Doomsday Clock (Q8).
- Le détail complet des comportements des nations (plus de 3 000 lignes) :
  j'en ai relevé l'essentiel (cadence, riposte, bateaux, alliances), pas
  chaque stratégie.
- **Aucun test n'a été lancé** : je n'ai pas exécuté OpenFront.

---

## 3. Licence : réécriture ou fork

Ce que dit OpenFront **[V]** :
- **code** : AGPL v3 (depuis septembre 2025), avec conditions supplémentaires
  (article 7) : garder la mention « © OpenFront and Contributors » à un endroit
  visible (pied de page, écran de chargement ou menu principal), ne pas
  présenter une version modifiée comme l'officielle, **ne pas utiliser
  « OpenFront » comme titre principal** ;
- **assets du dossier `resources/`** (cartes, images, sons) : CC BY-SA 4.0
  (attribution + partage à l'identique) ;
- **dossier `proprietary/` et tout ce qui est servi par leurs serveurs**
  (skins, drapeaux premium, musique…) : tous droits réservés, interdit.

### Option 1 — Réécriture indépendante (par défaut, recommandée)

- On lit le code pour comprendre les règles et on reprend les **valeurs
  numériques** (des faits de réglage), mais on n'en copie ni le texte, ni la
  structure de fichiers, ni les cartes, images ou sons.
- Licence libre de notre choix. Proposition : AGPL v3 aussi, par cohérence et
  parce que le jeu tourne sur un serveur (Q1).
- Avantages : code qu'on comprend entièrement, adapté au français et à thnas,
  sans tout ce qui ne nous sert pas (boutique, comptes, ELO, clans, Cloudflare,
  Turnstile, publicités…) — une grosse partie du dépôt d'OpenFront.
- Inconvénients : plus long ; il faudra régler l'équilibre nous-mêmes.

### Option 2 — Fork d'OpenFront

Ce que ça impose :
- **publier tout le code source** modifié sous AGPL v3, et le proposer aux
  joueurs, même si le jeu ne tourne que chez nous (l'AGPL vise justement les
  jeux en réseau) — par exemple un lien « Code source » sur l'accueil ;
- afficher **« © OpenFront and Contributors »** et **« Basé sur OpenFront »**
  sur l'écran d'accueil ;
- ne pas appeler le jeu « OpenFront » ;
- les cartes et images de `resources/` restent en CC BY-SA 4.0 (attribution,
  et nos modifications sous la même licence) ; ne rien reprendre de
  `proprietary/` ;
- retirer et maintenir à l'écart la boutique, les comptes, l'ELO, les clans,
  Cloudflare/Turnstile, l'API externe… puis suivre ou abandonner les mises à
  jour de leur dépôt (très actif : des dizaines de changements par semaine).
- Avantages : tout fonctionne dès le départ, équilibre déjà réglé, cartes
  disponibles.
- Inconvénients : énorme base de code (≈ 4 600 fichiers) en grande partie
  inutile pour nous, Node 24, nginx, supervisord, Docker ; difficile à
  traduire et à faire évoluer ; peu de plaisir à « créer son jeu ».

**Ma recommandation : option 1 (réécriture).** À toi de trancher (Q1).

---

## 4. Nom du jeu

Trois propositions (aucune ne contient « OpenFront ») :

1. **Ligne de Front** — clin d'œil au nom du dépôt, parle tout de suite du
   jeu (frontières qui avancent). *Ma préférée.*
2. **Frontières** — court, simple pour les enfants.
3. **Pixelmonde** — dit que c'est une carte du monde en pixels.

Question Q2.

---

## 5. Choix technique

### Ce qui détermine le choix

- 2,1 millions de pixels : chaque pixel a un propriétaire, un terrain, des
  drapeaux. On ne peut pas les parcourir tous à chaque tick : la simulation
  ne travaille **que sur les frontières** des attaques en cours.
- 400 tribus + 70 nations : chacune « réfléchit » toutes les 3 à 10 secondes
  **[V]**, décalées entre elles, donc ~5 à 15 IA par tick.
- Dessin : la carte doit être une **texture** mise à jour seulement là où des
  pixels changent, pas redessinée pixel par pixel.
- Multijoueur : OpenFront fait calculer la partie **par chaque navigateur**
  (simulation déterministe, le serveur ne fait que relayer les ordres 10 fois
  par seconde) **[V]**. C'est ce qui rend le serveur léger et le solo
  possible sans serveur.

Ces quatre points valent pour les trois options : dans toutes, la simulation
tourne dans le navigateur, dans un **Web Worker** (fil séparé de l'affichage).

### Option A — TypeScript partout (client + simulation + serveur Node)

- Simulation en TypeScript, dans un Web Worker, avec tableaux typés
  (`Uint16Array` pour les propriétaires, `Uint8Array` pour le terrain).
- Rendu WebGL2 (repli Canvas 2D pour les vieux appareils).
- Serveur Node.js minimal : fichiers statiques, salons, relais des ordres ;
  il peut aussi faire tourner **la même simulation** (pour la reconnexion
  rapide, les rediffusions et la vérification de désynchronisation).
- Construction avec `esbuild` (une seule dépendance de développement) ;
  aucune dépendance côté navigateur.
- ➕ Un seul langage ; le typage protège une grosse simulation
  (des dizaines de milliers de lignes) ; tests de la simulation sans
  navigateur ; architecture éprouvée à cette échelle par OpenFront.
- ➖ Node à installer sur thnas (YunoHost sait le faire) ; une étape de
  construction ; différent de tes autres jeux en Python.

### Option B — Serveur Python qui calcule tout, client JS qui affiche

- Le serveur Python simule la partie et envoie les changements aux
  navigateurs.
- ➕ Pile que tu connais.
- ➖ Python pur trop lent pour 2,1 M pixels × 10 ticks/s × 470 IA (il
  faudrait numpy/Cython) ; flux réseau important ; le solo dépend du serveur ;
  si thnas tousse, toutes les parties s'arrêtent. **Déconseillée.**

### Option C — Serveur Python léger (relais) + client JS sans dépendance

- Comme tes autres jeux : serveur Python (Starlette) pour les fichiers, les
  salons et le relais des ordres ; client en JavaScript moderne (modules ES)
  sans dépendance ni construction, simulation dans un Web Worker, rendu WebGL.
- Types vérifiés par JSDoc + `tsc --checkJs` sur ton PC (facultatif).
- ➕ Pile habituelle côté serveur, pas d'étape de construction, serveur
  très léger.
- ➖ Deux langages ; le serveur ne peut pas exécuter la simulation (la
  reconnexion se fait en rejouant les ordres dans le navigateur) ; typage
  moins solide ; les tests de la simulation demandent quand même Node sur
  le poste de développement.

### Recommandation : **option A**

C'est la seule où le serveur peut faire tourner la simulation (reconnexion
instantanée, rediffusions, détection de triche ou de désynchronisation), et le
typage compte beaucoup pour une simulation de cette taille. Si tu tiens à
garder Python côté serveur, l'option C est un bon second choix : les
performances dans le navigateur sont les mêmes. Question Q3.

### Objectifs de performance (valables quelle que soit l'option)

- **CA-PERF-1** : carte Monde, 400 tribus + 70 nations, sur ton PC : affichage
  ≥ 55 images/s, tick de simulation moyen < 15 ms, 99 % des ticks < 40 ms.
- **CA-PERF-2** : même partie sur une tablette milieu de gamme : ≥ 30 images/s,
  pas de tick > 100 ms (la partie ne prend pas de retard).
- **CA-PERF-3** : mémoire de l'onglet < 600 Mo sur la carte Monde.
- **CA-PERF-4** : chargement de la carte Monde < 5 s sur la fibre, < 10 s en 4G.
- **CA-PERF-5** : deux navigateurs qui jouent la même partie ont le même
  « empreinte » (somme de contrôle de l'état) à chaque seconde pendant 30 min.

---

## 6. Tableau des fonctionnalités

| Fonctionnalité OpenFront | Décision | Raison |
|---|---|---|
| Carte en pixels tirée de la géographie | Reprise | Cœur du jeu. |
| Cartes d'OpenFront (fichiers) | Écartée | Licence CC BY-SA ; on génère les nôtres. |
| Catalogue de cartes (onglets, recherche, fiche) | Reprise | Utile dès qu'on a plusieurs cartes. |
| Terrains plaine / hauteurs / montagne / eau | Reprise | Règle de combat. |
| Vue terrain/pays, grille, zoom, centrage | Reprise | Confort de jeu. |
| Phase d'apparition, apparition aléatoire, immunité | Reprise | Début de partie. |
| Nations (IA, 4 difficultés, attitude) | Reprise | Adversaires du solo. |
| Tribus (400 par défaut) | Reprise | Remplissage et or. |
| Or passif fixe | Reprise | Valeurs du code. |
| Troupes : max, croissance, barre | Reprise | Cœur du jeu. |
| Attaque, ratio, pertes, annulation | Reprise | Cœur du jeu. |
| Bateau de transport | Reprise | Mer. |
| 10 constructions et unités, coûts croissants, niveaux | Reprise | Profondeur stratégique. |
| Trains et rails automatiques | Reprise | Économie. |
| Bateaux de commerce | Reprise | Économie. |
| Navires de guerre et vétérance | Reprise | Mer. |
| Silo, SAM, bombe A, bombe H, MIRV | Reprise | Fin de partie. |
| Alliances, renouvellement, trahison | Reprise | Diplomatie. |
| Dons de troupes et d'or | Reprise | Jeu d'équipe. |
| Embargo manuel et automatique | Reprise | Diplomatie. |
| Cibler un joueur | Reprise | Coordination entre alliés. |
| Émojis | Adaptée | Liste fermée relue pour les enfants 🔒. |
| Tchat rapide en phrases toutes faites | Adaptée | Phrases réécrites en français, relues 🔒 ; pas de texte libre. |
| Texte libre dans le tchat | Écartée | Jeu familial, enfants 🔒. |
| Classement en jeu | Reprise | Lisibilité. |
| Menu radial, fiche joueur, journal, icônes | Reprise | Interface. |
| Pause et vitesse | Reprise | Solo seulement, comme le code. |
| Tutoriel guidé en 22 étapes | Adaptée | Mêmes étapes, textes à nous en français. |
| Écran de fin, regarder la suite | Reprise | |
| Tactile | Reprise | Tablettes et téléphones de la famille. |
| Mode équipes | Reprise | Jeux en famille. |
| Options de partie (solo, salon) | Reprise | Voir 7.H. |
| Overtime et Doomsday Clock | Adaptée | Renommés « Blitz » et « Mort subite » (Q8). |
| Triches d'hôte (or/troupes infinis pour l'hôte seul) | Adaptée | Gardé comme « privilèges de l'hôte » réglables, désactivés par défaut. |
| Préréglages, sauvegarde de partie | Adaptée | Préréglages : présents ; sauvegarde : à nous (OpenFront n'a que des rediffusions). |
| Rediffusion avec retour en arrière | Reprise | Possible grâce à la simulation déterministe. |
| Pseudo + tag, pseudo aléatoire | Adaptée | Tag = « clan familial » libre mais filtré 🔒. |
| Paramètres en 4 onglets, raccourcis modifiables | Reprise | |
| Interface multilingue | Adaptée | Français seulement. |
| Parties publiques ouvertes à tous | Écartée | Jeu privé. |
| Parties classées 1v1/2v2, ELO | Écartée | Pas de compétition publique. |
| Guerres de clans, classement général | Écartée | Idem. |
| Boutique, monnaie, abonnements, skins, drapeaux, couronnes, effets | Écartée | Ni achat ni pub. |
| Inventaire, succès, comptes | Écartée | Pas de compte (Q5 pour un éventuel historique local). |
| Publicités | Écartée | Jeu familial. |
| Statistiques en direct publiques, API externe | Écartée | Inutile chez nous. |
| Protection anti-robot (Turnstile), Cloudflare | Écartée | Remplacée par lien secret + approbation de l'hôte. |
| Spectateurs volontaires | Adaptée | Un joueur éliminé peut regarder ; spectateur dès le départ en Q10. |

---

## 7. Règles détaillées

### A. Carte

**A1. Grille.** La carte est une grille de pixels (tuiles). Chaque tuile a :
terrain (eau, plaine, hauteurs, montagne, infranchissable), propriétaire
(personne ou un joueur), drapeaux (côte, retombées radioactives, rail…).

- Référence Monde : **2064 × 1032**, **620 903** tuiles de terre = **29,1 %**,
  **70 nations** **[V]**.
- Chaque carte existe en 3 résolutions **[V]** : pleine, ¼ (« compacte »),
  1⁄16 (aperçu).

**A2. D'où viennent nos cartes.** Générateur à nous (script dans le dépôt) à
partir de données **du domaine public** :
- côtes et pays : **Natural Earth** (domaine public) ;
- relief : **ETOPO** (NOAA, domaine public) ou **SRTM** (NASA, domaine
  public), découpé en plaine / hauteurs / montagne selon l'altitude ;
- positions et noms des nations : notre propre liste (capitales des pays),
  drapeaux dessinés par nous en formes simples (pas de reprise des drapeaux
  d'OpenFront) ; Q6 pour les vrais drapeaux nationaux (domaine public pour la
  plupart).

Premières cartes proposées : **Monde**, **Europe**, **France** (étape 1 : Monde
seule, ou France si la performance Monde n'est pas encore atteinte).

**A3. Catalogue.** Onglets **En vedette / Tout / Atlas / Favoris**, recherche
par nom, carte **Aléatoire**, fiche : taille (L × H), nombre de nations,
% de terres, nombre de joueurs conseillé, auteur. Favoris enregistrés dans le
navigateur.

**A4. Terrains et difficulté de prise [V]** (coût de base d'une tuile) :

| Terrain | Sanglant (pertes) | Lent (coût en vitesse) |
|---|---|---|
| Plaine | 80 | 16,5 |
| Hauteurs | 100 | 20 |
| Montagne | 120 | 25 |
| Eau / infranchissable | — | non attaquable |

**A5. Vues et déplacement.** Espace : bascule vue pays / vue terrain **[V]** ;
M : grille de coordonnées **[V]** ; molette, pincement, Q/E et +/− : zoom
**[V]** ; glisser, ZQSD/WASD et flèches : déplacement **[V]** ; C : centrer sur
soi **[V]**. Les raccourcis sont donnés en AZERTY dans l'aide (Z/Q/S/D) et
modifiables.

Critères d'acceptation :
- **CA-A1** : la carte Monde s'affiche entière, zoomable de la vue globale
  jusqu'à 1 tuile = 16 pixels d'écran, sans saccade (CA-PERF-1).
- **CA-A2** : Espace bascule la vue en moins d'une image.
- **CA-A3** : C recentre la vue sur le territoire du joueur.
- **CA-A4** : la fiche de chaque carte affiche les 5 informations ; la carte
  Aléatoire en tire une au hasard parmi « Tout ».
- **CA-A5** : % de terres et nombre de nations affichés = valeurs calculées
  par le générateur.

### B. Départ et adversaires

**B1. Phase d'apparition [V]** : 10 s en solo, 20 s en salon (15 s en
apparition aléatoire). Le joueur clique une tuile de terre libre ; il peut
changer d'avis jusqu'à la fin de la phase. Distance minimale entre deux
joueurs : 30 tuiles **[V]**. Option « apparition aléatoire ».
**Immunité** après le départ : 5 s par défaut **[V]**, réglable (0 à 5 min
**[J]**).

**B2. Types de joueurs.**
- **Joueur** humain : départ 2 500 troupes **[V]**.
- **Nation** : IA avec nom et drapeau, construit, attaque, bombarde, propose
  et accepte des alliances ; **attitude** envers chaque joueur : Hostile,
  Méfiante, Neutre, Amicale **[V]** (4 niveaux ; évolue selon les attaques,
  alliances, dons, trahisons).
- **Tribu** : petite IA faible, **400 par défaut** **[V]** (0 à 400), départ
  1 000 troupes, troupes max ÷3, croissance ×0,5, or passif 500/s **[V]** ;
  attaque toutes les 4 à 8 s **[V]**, préfère attaquer les **traîtres** **[V]**.

**B3. Difficulté des nations [V].**

| | Facile | Moyen | Difficile | Impossible |
|---|---|---|---|---|
| Troupes de départ | 1 250 | 1 875 | 2 500 | 3 125 |
| Troupes max | ×0,5 | ×0,75 | ×1 | ×1,25 |
| Croissance | ×0,9 | ×0,95 | ×1 | ×1,05 |
| Réfléchit toutes les | 6,5-10 s | 5,5-7 s | 4,5-6 s | 3-5 s |
| Riposte quand on l'attaque | jamais | 1 fois sur 2 | toujours | toujours |
| Bateaux de transport | non | oui | oui | oui |
| Trouve les joueurs sur une île | non | oui | oui | oui |

Critères d'acceptation :
- **CA-B1** : sans clic pendant la phase d'apparition, le joueur est placé
  au hasard (comportement **[J]** : OpenFront le laisse spectateur ; je propose
  le placement aléatoire pour les enfants).
- **CA-B2** : pendant l'immunité, aucune attaque ne peut viser le joueur ni
  être lancée par lui.
- **CA-B3** : avec 400 tribus, toutes apparaissent, à au moins 30 tuiles des
  joueurs humains.
- **CA-B4** : en Facile, une nation n'envoie jamais de bateau de transport
  (vérifiable sur 10 parties simulées sans affichage).

### C. Ressources

**C1. Or [V].**
- Revenu passif : **1 000 or/s** par joueur ou nation (100 par tick), 500/s
  par tribu, × multiplicateur d'or de la partie.
- Bateaux de commerce : par trajet, 75 000 / (1 + e^(−0,03 × (d − 300))) +
  50 × d, où d = distance du trajet (en tuiles). Un trajet court (< 300) rapporte
  peu.
- Trains : à chaque gare visitée, 10 000 (chez soi), 25 000 (équipier ou
  autre joueur), **35 000 (allié)** ; −5 000 par gare au-delà de la 9e,
  minimum 5 000.
- Élimination : on reçoit **tout l'or** d'une nation ou tribu conquise, **la
  moitié** de celui d'un joueur humain.
- Affichage : total + revenu par seconde (moyenne glissante sur 5 s **[J]**).

**C2. Troupes [V]** (formules en unités internes, ÷10 à l'affichage).
- Max = 2 × (1 000 × T^0,6 + 50 000) + 250 000 × (somme des niveaux de
  villes terminées), T = nombre de tuiles. Exemples affichés : 1 tuile ≈
  10 200 ; 10 000 tuiles ≈ 60 200 ; chaque niveau de ville **+25 000**.
- Croissance par tick = (10 + troupes^0,73 / 4) × (1 − troupes / max), ×
  coefficient du type de joueur (tribu ×0,5, nations selon B3).
- La croissance est maximale vers 40-45 % du max puis ralentit jusqu'à 0 au
  max.
- Barre : vert = troupes disponibles, **orange = troupes engagées dans les
  attaques** **[V]**, texte « actuel / max » et « +N/s ». Alerte à 80 % du
  max **[V]** (« votre armée est presque pleine »).

Critères d'acceptation :
- **CA-C1** : un joueur seul sans constructions gagne exactement 1 000 or en
  10 ticks (multiplicateur 1).
- **CA-C2** : avec T = 10 000 et sans ville, le max affiché vaut 60 237 ± 1.
- **CA-C3** : une ville de niveau 1 terminée ajoute exactement 25 000 au max
  affiché ; en construction, rien.
- **CA-C4** : les troupes ne dépassent jamais le max.
- **CA-C5** : conquérir la dernière tuile d'une nation qui a 40 000 or crédite
  40 000 or ; celle d'un humain qui en a 40 000 en crédite 20 000.

### D. Combat

**D1. Lancer une attaque.** Clic gauche sur une tuile voisine ennemie ou
libre = attaque depuis la frontière commune, avec **ratio × troupes
disponibles**. Ratio 1-100 %, **20 % par défaut** **[V]**, curseur ; T / Y
(et molette avec Alt) pour −/+ 10 % **[V]**.

**D2. Résolution par tuile [V].** À chaque tick, chaque attaque prend des
tuiles sur son front jusqu'à épuiser son budget. Pour une tuile défendue :

- r = troupes du défenseur / troupes de l'attaque ;
- pertes de l'attaquant = sanglant(terrain) × borne(r, 0,6, 2) ×
  (0,463 × bonus_grand_attaquant × bonus_grand_défenseur + 0,0039 × densité),
  densité = troupes du défenseur / ses tuiles ;
- pertes du défenseur = sa densité (troupes par tuile) ;
- coût en vitesse = borne(r, 0,82, 7,5) × borne(r/20, 1, 50) / 8,55 ×
  lent(terrain) × bonus de taille ÷ longueur du front.
- Bonus de taille : un très grand territoire (au-delà de ~300 000 tuiles)
  attaque et est attaqué moins cher et plus vite (courbe en S : jusqu'à
  −70 % de pertes pour l'attaquant, −30 % pour le défenseur).
- Humains et nations qui attaquent une tribu : pertes ×0,7.
- Terre libre : pertes = sanglant / 5 (tribus : /10), vitesse selon les
  troupes engagées.
- Modificateurs : poste de défense (×5 pertes, ×3 lenteur), traître
  (×0,5 pertes, ×0,8 lenteur), retombées radioactives (×2,5 à ×5).

**D3. Attaques en cours.** Liste à gauche : cible, troupes engagées, bouton
**Annuler**. Annuler = les troupes reviennent avec **25 % de pertes** **[V]**.
Deux attaques vers la même cible fusionnent **[J]**.

**D4. Bateau de transport.** Clic droit → « Bateau », ou **B** sur une côte
ennemie ou libre **[V]**. Emporte ratio × troupes. **3 bateaux maximum** en
même temps **[V]**. Annulé : il fait demi-tour vers la tuile possédée la plus
proche. Coulé par un navire de guerre : troupes perdues.

Critères d'acceptation :
- **CA-D1** : avec ratio 20 % et 10 000 troupes, l'attaque part avec 2 000.
- **CA-D2** : tests unitaires de la formule D2 sur 10 cas tirés du code
  d'OpenFront (mêmes entrées → mêmes sorties à 1e-6 près).
- **CA-D3** : annuler une attaque de 2 000 rend 1 500 troupes.
- **CA-D4** : un 4e bateau est refusé avec le message « 3 bateaux maximum ».
- **CA-D5** : à troupes égales, prendre une montagne coûte 1,5 fois plus
  de troupes qu'une plaine.

### E. Constructions

Barre de construction **1 à 0** **[V]**, menu de construction par
**Ctrl + clic** (Cmd sur Mac) **[V]**, compteur par type dans le bandeau.
Poser le même type sur la même case = **niveau supérieur** (villes, usines,
ports, silos, SAM) **[V]**. Distance minimale entre deux bâtiments :
15 tuiles **[V]**. Le coût monte avec le nombre possédé ; il est affiché sur
le bouton et le bouton est grisé si l'or manque.

| # | Bâtiment / unité | Coût **[V]** | Construction **[V]** | Effet **[V]** |
|---|---|---|---|---|
| 1 | Ville | 125K × 2ⁿ, max 1M | 2 s | +25K troupes max par niveau |
| 2 | Usine | 125K × 2ⁿ (n = ports + usines), max 1M | 2 s | Rails automatiques (15 à 110 tuiles) vers villes, ports, usines, voisins amis ; trains (or en C1) |
| 3 | Port | idem usine (compteur commun) | 5 s | Côtier ; bateaux de commerce automatiques ; permet les navires de guerre |
| 4 | Poste de défense | 50K × (n+1), max 250K | 5 s | Zone de 30 tuiles (affichée en damier) : attaques ennemies ×5 pertes, ×3 plus lentes ; tire sur les ennemis à 75 tuiles |
| 5 | Silo à missiles | 1M | 10 s | Lance les bombes ; recharge 9 s ; améliorable |
| 6 | Lanceur SAM | 1,5M × (n+1), max 3M | 30 s | Intercepte les bombes ; portée 70 tuiles au niveau 1 (150 − 480/(niv.+5)) ; recharge 9 s |
| 7 | Navire de guerre | 250K × (n+1), max 1M | — | Santé 1 000, obus de 250 ; patrouille 100 tuiles, cible à 130 ; capture les bateaux de commerce, coule transports et navires ; se répare au port sous 75 % ; vétérance max 3 (+20 % santé et dégâts par niveau ; 10 transports coulés ou 25 captures par niveau) ; sélection multiple (Maj + glisser) |
| 8 | Bombe atomique | 750K | — | Rayon 12 (destruction) / 30 (dégâts) ; vitesse 10 |
| 9 | Bombe H | 5M | — | Rayon 80 / 100 |
| 0 | MIRV | 25M + 15M par MIRV déjà lancé dans la partie | — | 350 ogives (rayon 12/18) qui ne touchent que le joueur visé |

Bombes : non rappelables une fois lancées ; une bombe qui détruit plus de
100 tuiles d'un allié rompt l'alliance **[V]** ; les tuiles touchées gardent des
retombées qui rendent l'attaque plus coûteuse **[V]**. Option « bombes à
eau » : autoriser les tirs sur l'eau **[V]**. Suppression d'un de ses bâtiments :
marquage 30 s, puis délai de 30 s avant la suivante **[V]**.

Critères d'acceptation :
- **CA-E1** : les coûts affichés suivent le tableau (2e ville 250K, 3e 500K,
  4e et suivantes 1M ; avec 1 port, la 1re usine coûte 250K).
- **CA-E2** : une ville posée sur une ville existante passe au niveau 2 et
  ajoute 25K de max une fois terminée.
- **CA-E3** : une attaque dans la zone d'un poste de défense perd 5 fois plus
  de troupes qu'en dehors (test unitaire).
- **CA-E4** : un SAM niveau 1 intercepte une bombe A visant une tuile à
  60 tuiles de lui, pas à 80 ; il ne peut pas retirer avant 9 s.
- **CA-E5** : le MIRV ne détruit aucune tuile d'un autre joueur que la cible.
- **CA-E6** : deux usines à moins de 110 tuiles se relient d'un rail en
  moins de 5 s ; un train qui passe chez un allié lui rapporte 35K
  (multiplicateur 1, moins de 10 gares).

### F. Diplomatie

**F1. Alliance [V].** Demande depuis le menu radial, la fiche joueur ou **K** ;
notification avec **Focaliser / Accepter / Refuser** ; la demande expire en
**20 s** ; une nouvelle demande au même joueur après **30 s**. Durée de
l'alliance **5 min** (réglable 1-15 min, 0 = alliances désactivées) ;
**30 s avant la fin**, proposition de renouveler, compte à rebours visible.
Alliance rompue par **L**.

**F2. Entre alliés [V].** Attaque bloquée ; **don de troupes** (J, ratio du
curseur **[J]**, 1/3 par défaut **[V]**) et **don d'or** (O, curseur) avec
délai de 10 s entre deux dons ; trains plus rentables chez un allié (35K).
« Protection contre les tirs amis juste après l'alliance » : **[J]**, proposition :
pendant 10 s après l'acceptation, les bombes déjà en vol vers l'allié ne lui
font aucun dégât.

**F3. Trahison [V].** Rompre une alliance avec un joueur non traître et
connecté = **traître pendant 30 s** (icône bouclier cassé) : ses défenseurs
font perdre **moitié moins** de troupes à l'attaquant (défense −50 %) et on
le prend 20 % plus vite. L'attaque du traître déclenche l'embargo automatique
5 min (F4). Les tribus visent les traîtres en priorité. Compteur de trahisons
visible dans la fiche joueur.

**F4. Embargo [V].** Manuel : « Arrêter le commerce / Reprendre le commerce »
(par joueur, ou « avec tout le monde » avec 10 s de délai). Automatique :
quand on est attaqué, on coupe le commerce avec l'attaquant pendant **5 min**.
Pas de bateau de commerce ni de train entre deux joueurs sous embargo.

**F5. Communication [V].** Cibler un joueur (N) : marqué pendant 10 s chez
ses alliés, 15 s de délai. Émojis (F, Alt + clic) : 5 par 5 s maximum,
affichés 5 s au-dessus du territoire. Tchat rapide (R) : phrases toutes
faites, 3 s de délai, en 6 catégories **[V]** : Aide, Attaque, Défense,
Salutations, Divers, Avertissements — avec un nom de joueur à insérer quand
la phrase le prévoit. **Pas de texte libre.** Phrases réécrites en français
par nous (pas de traduction de leur fichier) et relues 🔒.

Critères d'acceptation :
- **CA-F1** : une demande non répondue disparaît après 20 s ; renvoyée avant
  30 s, elle est refusée avec le temps restant affiché.
- **CA-F2** : clic sur un allié = aucun départ d'attaque (message « allié »).
- **CA-F3** : après une rupture, le traître affiche l'icône 30 s ; une
  attaque sur lui pendant ce temps perd 2 fois moins de troupes.
- **CA-F4** : attaquer quelqu'un coupe ses bateaux de commerce et trains
  vers soi pendant 5 min.
- **CA-F5** : aucune zone de saisie de texte libre n'existe dans le jeu en
  partie.

### G. Interface en jeu

- **G1. Bandeau haut** : or (+/s), troupes (barre C2), compteurs des
  10 bâtiments, infos de la tuile survolée (terrain, propriétaire).
- **G2. Classement** : rang, nom, % de terres, or, troupes ; 5 premiers +
  soi, bouton « montrer tout », repliable.
- **G3. Menu radial** (clic droit / appui long) : Infos, Attaque, Bateau,
  Alliance (+ Émoji, Cibler, Dons pour un allié).
- **G4. Fiche joueur** (I) : type, attitude (nations), or, troupes,
  trahisons, commerce (oui/embargo), alliances en cours avec compte à
  rebours, boutons d'action.
- **G5. Journal** (en bas) : événements filtrables (attaques, alliances,
  élimination « X a été éliminé, vous recevez N or »).
- **G6. Icônes sur la carte** : couronne (1er), bouclier cassé (traître),
  poignée de main (allié), dollar barré (embargo), cible.
- **G7. Barre du haut droite** : chrono, pause et vitesse ×0,5/×1/×2 (solo
  seulement **[V]**), plein écran, menu (sauvegarder, paramètres graphiques,
  paramètres, quitter).
- **G8. Tutoriel** : voir I.
- **G9. Écran de fin** : Victoire ou Défaite, classement final, durée,
  boutons « Quitter » et « Regarder la suite ».
- **G10. Tactile** : toucher = attaque, appui long = menu radial, pincement =
  zoom, deux doigts = déplacement, barre de construction en bas, ratio par
  curseur.
- **G11. Victoire** : posséder **80 % des terres** **[V]** (réglable), ou être le
  dernier humain/équipe en lice **[J]**.

Critères d'acceptation :
- **CA-G1** : toutes les actions des blocs D, E, F sont faisables à la
  souris seule et au doigt seul (tablette).
- **CA-G2** : le classement se met à jour au moins 2 fois par seconde.
- **CA-G3** : pause et vitesse absentes en salon multijoueur.
- **CA-G4** : la couronne suit le 1er du classement en moins de 1 s.

### H. Options de partie

**Solo et salon** : mode **Chacun pour soi** ou **Équipes** (duos, trios,
quatuors, 2 à 7 équipes) ; nombre de tribus (0-400) ; nations activées ou
non ; difficulté ; construction instantanée ; or infini ; troupes infinies ;
carte compacte (¼) ; bombes à eau ; **Mort subite** (Doomsday Clock) ;
durée de jeu max ; multiplicateur d'or ; or de départ ; durée des alliances
(0-15 min) ; **Blitz** après N minutes (seuil de victoire −2 points/min à
partir de N, 30 par défaut) ; seuil de victoire en % ; désactivation de
chaque unité une par une. Toutes ces options existent dans le schéma de
configuration d'OpenFront **[V]**.

**Salon privé en plus** : limite de joueurs, délai de démarrage, immunité de
départ, dons de troupes / d'or autorisés, joueurs anonymes, privilèges de
l'hôte (or/troupes infinis pour lui seul), liste blanche de pseudos.

**Préréglages** : enregistrer / charger / supprimer un jeu d'options (dans le
navigateur, plus côté serveur pour les salons **[J]**).
**Parties sauvegardées** (solo) : sauvegarde = graine + liste des ordres,
rechargée en rejouant à vitesse maximale ; 3 emplacements + sauvegarde auto
**[J]**.

Critères d'acceptation :
- **CA-H1** : chaque option change bien la partie (un test par option).
- **CA-H2** : un préréglage rechargé redonne exactement les mêmes options.
- **CA-H3** : une partie solo sauvegardée à 10 min et rechargée reprend dans
  le même état (même empreinte).

### I. Hors partie

- **Accueil** : pseudo + tag (3-16 caractères, filtrés 🔒), bouton pseudo
  aléatoire (liste de pseudos amusants à nous), boutons **Solo**, **Tutoriel**,
  **Créer un salon**, **Rejoindre un salon** (code ou lien).
- **Paramètres** en 4 onglets : Gameplay (ratio par défaut, pas du ratio,
  confirmations), Graphiques (qualité, noms sur la carte, effets), Audio
  (volumes), **Raccourcis clavier** (tous modifiables, bouton « par
  défaut »). **Aide** avec tableau des raccourcis.
- **Tutoriel guidé en 22 étapes [V]**, qui n'avance que quand l'action est
  faite : apparition, attaque de terre libre, troupes, croissance, ratio,
  capturer des tribus, ville, alliance, infos alliance, usine, infos usine,
  bateau, port, infos port, poste de défense, navire de guerre, silo, lancer
  une bombe, infos bombe A, infos bombe H, infos MIRV, infos SAM. Partie
  dédiée : départ à 6 000 troupes, adversaires bridés **[V]**.
- **Rediffusion** des parties (dernières 20 parties **[J]**) avec lecture,
  vitesse, barre de temps et **retour en arrière** (par instantanés toutes
  les 30 s + relecture).
- Interface **en français uniquement**.
- **Écartés par défaut** : parties publiques, classées 1v1/2v2, ELO, guerres
  de clans, classement général, boutique et tout ce qui s'achète, inventaire,
  succès, comptes, publicités (voir tableau section 6).

Critères d'acceptation :
- **CA-I1** : un enfant qui ne sait pas jouer termine le tutoriel sans aide
  (test en famille).
- **CA-I2** : chaque raccourci modifié est pris en compte immédiatement et
  conservé après rechargement.
- **CA-I3** : une rediffusion revient de 5 min en arrière en moins de 3 s.

---

## 8. Maquettes des écrans

### 8.1 Accueil

```
┌──────────────────────────────────────────────────────────────────┐
│                       LIGNE DE FRONT                             │
│                (Inspiré d'OpenFront — lien)                      │
│                                                                  │
│   Pseudo [ Capitaine Brioche     ] [🎲]   Tag [ THNAS ]          │
│                                                                  │
│   ┌────────────┐  ┌────────────┐  ┌──────────────┐              │
│   │   SOLO     │  │ TUTORIEL   │  │ CRÉER UN     │              │
│   │            │  │            │  │ SALON  🔒    │              │
│   └────────────┘  └────────────┘  └──────────────┘              │
│                                                                  │
│   Rejoindre un salon : [ code ou lien          ] [Rejoindre]     │
│                                                                  │
│   Rediffusions · Paramètres · Aide                  v0.1         │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Options de partie (solo ; le salon ajoute la colonne de droite)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Accueil                OPTIONS DE PARTIE           Préréglage [▼][💾]│
├───────────────────────────────┬──────────────────────────────────────┤
│ CARTE                         │ ADVERSAIRES                          │
│ [En vedette|Tout|Atlas|Favoris]│ Tribus      [====|----] 400          │
│ 🔎 [ rechercher      ]         │ Nations     [x] activées             │
│ ┌────┐┌────┐┌────┐┌────┐       │ Difficulté  (Facile)(Moyen)●(Diff.)  │
│ │Mon-││Euro││Fran││ 🎲 │       │                                      │
│ │ de ││ pe ││ ce ││Alé.│       │ MODE   ●Chacun pour soi  ○Équipes[2▼]│
│ └────┘└────┘└────┘└────┘       │                                      │
│ Monde · 2064×1032 · 70 nations │ RÈGLES                               │
│ 29 % de terres · 4-16 joueurs  │ [ ] Construction instantanée         │
│ Auteur : Thibault              │ [ ] Or infini   [ ] Troupes infinies │
│                               │ [ ] Carte compacte [ ] Bombes à eau  │
│                               │ [ ] Mort subite  [ ] Blitz après [30]│
│                               │ Or ×[1.0]  Or de départ [0]          │
│                               │ Alliances [5] min  Victoire à [80] % │
│                               │ Durée max [illimitée▼]               │
│                               │ Unités : [x]Ville [x]Usine … [x]MIRV │
│                               │ ─ Salon ─ joueurs max [10] délai [10]s│
│                               │ immunité [5]s dons [x]troupes [x]or  │
│                               │ [ ] anonymes  liste blanche [éditer] │
├───────────────────────────────┴──────────────────────────────────────┤
│                                              [ LANCER LA PARTIE ]    │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.3 En jeu

```
┌────────────────────────────────────────────────────────────────────────┐
│ 💰 1,2M (+3,4K/s) │ 🪖 45,2K/60,2K ▓▓▓▓▓▓▒▒░░ +820/s │ 🏙2 🏭1 ⚓1 🛡3 …  │
│ Survol : Montagne — Nation d'Ibérie                  ⏱ 12:34 ⏸ ×1 ⛶ ☰ │
├──────────────┬─────────────────────────────────────────┬───────────────┤
│ ATTAQUES     │                                         │ CLASSEMENT  ▾ │
│ → Ibérie 4K ✕│                                         │ 1 👑 Arthur 22%│
│ → Tribu  1K ✕│              C A R T E                  │ 2  Léo     18%│
│ ⛵ → Corse 2K✕│                                         │ 3  Ibérie  9% │
│              │       (territoires colorés, noms,        │ … montrer tout│
│              │        icônes 👑 🛡️ 🤝 🚫$ 🎯)           │               │
│              │                                         │               │
├──────────────┴─────────────────────────────────────────┴───────────────┤
│ Ratio [====●-----] 20 %   │ 1🏙 2🏭 3⚓ 4🛡 5🚀 6📡 7🚢 8☢ 9💥 0✴       │
│ Journal : Tribu des Saules éliminée — vous recevez 12 400 or           │
└────────────────────────────────────────────────────────────────────────┘
```

Menu radial (clic droit sur un territoire) :

```
            [ Infos ]
   [Alliance]   ●   [ Attaque ]
            [ Bateau ]
```

### 8.4 Fiche joueur

```
┌──────────────────────────────────────────┐
│ 🏳 Nation d'Ibérie                     ✕ │
│ Type : Nation (Difficile)                │
│ Attitude envers vous : Méfiante 😐       │
│ Or : 840K     Troupes : 31,2K            │
│ Trahisons : 1 🛡️‍💥   Commerce : 🚫 embargo │
│ Alliances : Léo (2:41)                   │
├──────────────────────────────────────────┤
│ [🤝 Alliance] [🎯 Cibler] [😀 Émoji]     │
│ [💬 Tchat rapide] [$ Commerce on/off]    │
│ (allié : [🪖 Don troupes] [💰 Don or]    │
│          [💔 Rompre])                    │
└──────────────────────────────────────────┘
```

### 8.5 Fin de partie

```
┌──────────────────────────────────────────┐
│              🏆 VICTOIRE !               │
│      Vous possédez 80 % des terres       │
│                                          │
│  1 👑 Arthur   80 %   28 min             │
│  2    Léo      12 %                      │
│  3    Ibérie    4 %                      │
│                                          │
│  [ Regarder la suite ]  [ Quitter ]      │
│  [ Revoir la partie ]                    │
└──────────────────────────────────────────┘
```

---

## 9. Découpage en étapes livrables

Chaque étape = une spec détaillée (002, 003…) + une branche + une PR, et se
termine par une version **jouable**.

| Étape | Contenu | Jouable à la fin |
|---|---|---|
| **1. Le cœur (solo)** | Générateur de carte + carte Monde (ou France si la perf Monde n'est pas atteinte), affichage WebGL, zoom/déplacement/vues, phase d'apparition, expansion et attaque (formule D2), ratio, annulation, tribus (400), troupes/or, classement, victoire 80 %, écran de fin, tactile de base. Mise en ligne en site statique sur thnas. | Une partie solo contre 400 tribus. Objectifs CA-PERF-1 à 4. |
| **2. Constructions** | Ville, usine + rails + trains, poste de défense, barre 1-0, menu Ctrl+clic, niveaux, coûts croissants. | Économie et défense. |
| **3. Nations et diplomatie** | Nations (4 difficultés, attitude), alliances, trahison, embargo, dons, ciblage, émojis, tchat rapide, menu radial complet, fiche joueur, journal. | Solo complet sur terre. |
| **4. La mer** | Ports, bateaux de commerce, bateaux de transport, navires de guerre, vétérance. | Îles et continents. |
| **5. Le nucléaire** | Silo, SAM, bombe A, bombe H, MIRV, retombées. | Fin de partie explosive. |
| **6. Multijoueur** | Serveur, salons, liens secrets, approbation de l'hôte, synchronisation 10 tours/s, reconnexion, service systemd, accès 🔒. | Parties en famille sur thnas. |
| **7. Options et cartes** | Toutes les options H, équipes, préréglages, sauvegardes, catalogue avec Europe et France. | Parties sur mesure. |
| **8. Finitions** | Tutoriel 22 étapes, paramètres 4 onglets, raccourcis modifiables, rediffusion avec retour arrière, sons. | Version 1.0. |

Je propose de faire **le multijoueur plus tôt (étape 4)** si l'envie de jouer
ensemble passe avant la mer et le nucléaire (Q9).

---

## 10. Hébergement et multijoueur (bloc J)

**J1. Installation.** Application YunoHost « my_webapp » (comme
tower.izicraft.fr) pour les fichiers statiques **+ un service systemd** pour
le serveur de jeu (Node, ou Python en option C), écoutant sur
`127.0.0.1:<port>` ; nginx de YunoHost fait le proxy (WebSocket) sur
**`front.izicraft.fr`** (à confirmer, Q4). Journaux : `journalctl -u front`,
rotation par journald, **sans adresse IP au-delà de 7 jours** 🔒.
Mise à jour : `git pull` + construction + `systemctl restart front`, script
`deploiement/mettre-a-jour.sh` ; les parties en cours sont prévenues 1 min
avant.

**J2. Qui peut jouer 🔒.**
- Le **solo et le tutoriel** ne demandent pas de serveur (tout tourne dans
  le navigateur) : ils marchent même si personne d'autre n'est connecté, et
  même si le serveur de jeu est arrêté.
- **Créer un salon** : réservé aux comptes YunoHost de la famille (SSO
  YunoHost sur `/salon/creer`).
- **Rejoindre** : uniquement avec le **lien secret** du salon (code aléatoire
  de 128 bits, valable tant que le salon existe), puis **l'hôte accepte** chaque
  arrivant dans la salle d'attente. Option liste blanche de pseudos.
- Aucun salon n'est listé publiquement ; limite de 10 tentatives de code par
  minute et par adresse ; salon fermé automatiquement 30 min après la fin.
- Ainsi, quelqu'un sur Internet qui trouve l'adresse peut au plus jouer en
  solo : il ne voit aucun salon, aucun pseudo, aucun enfant.

**J3. Simulation.** Chaque navigateur calcule la partie (déterministe :
entiers et maths déterministes, aléatoire à graine commune), le serveur
regroupe les ordres reçus en **tours de 100 ms (10 par seconde) [V]** et les
renvoie à tous. En option A, le serveur fait aussi tourner la simulation
pour : reconnexion instantanée (il envoie l'état courant), rediffusions,
détection de désynchronisation (comparaison d'empreintes toutes les 10 s).

**J4. Reconnexion.** Un joueur coupé garde son territoire (marqué
« déconnecté », ses équipiers peuvent l'attaquer sans perte **[V]**). En
revenant avec le même lien dans les 5 min **[J]**, il reprend sa place : il
reçoit l'état (option A) ou rejoue les tours depuis le début en accéléré
(option C).

**J5. Charge attendue sur thnas** (estimation, à mesurer à l'étape 6) :
- relais seul : < 5 % d'un cœur, < 50 Mo de mémoire, < 5 Ko/s par joueur ;
- avec simulation serveur (option A) : ~1 cœur à 20-40 % et 300-500 Mo par
  salon Monde avec 400 tribus ;
- 2 à 10 joueurs : négligeable pour la fibre 1 Gbit ; le téléchargement
  initial de la carte (~3-5 Mo compressés) est le plus gros transfert.
- thnas étant jugé peu stable (RAID 0 ancien), rien d'important n'est
  stocké côté serveur : préréglages et sauvegardes vivent dans le navigateur,
  les rediffusions de salon sont un bonus.

Critères d'acceptation :
- **CA-J1** : serveur de jeu arrêté, le solo se lance et se joue normalement.
- **CA-J2** : sans compte YunoHost, impossible de créer un salon ; sans lien,
  impossible d'en trouver un.
- **CA-J3** : un arrivant avec le lien attend l'accord de l'hôte.
- **CA-J4** : 6 joueurs + 400 tribus pendant 30 min : aucune
  désynchronisation, charge thnas mesurée et notée dans le CLAUDE.md.
- **CA-J5** : un joueur qui recharge sa page revient dans la partie en moins
  de 10 s.

---

## 11. Risques

| Risque | Gravité | Parade |
|---|---|---|
| **Performance** : 2,1 M pixels + 470 IA trop lourds pour tablettes/téléphones | Forte | Simulation par frontières, Web Worker, WebGL, mesure dès l'étape 1 (CA-PERF) ; carte compacte (¼) proposée automatiquement sur appareil faible. |
| **Déterminisme** : une désynchronisation en multijoueur casse la partie | Forte | Entiers et maths déterministes, aléatoire à graine, tests d'empreinte entre deux exécutions dès l'étape 1. |
| **Taille des cartes** : fichiers de plusieurs Mo, génération longue | Moyenne | Format binaire compressé, 3 résolutions, génération hors ligne une fois pour toutes. |
| **Charge sur thnas** et stabilité du serveur | Moyenne | Solo sans serveur ; relais léger ; rien d'important stocké côté serveur ; redémarrage auto systemd. |
| **Licence** : copie involontaire de code ou de cartes OpenFront | Moyenne | Règle dans CLAUDE.md ; cartes générées depuis le domaine public ; relecture des PR. |
| **Équilibre** : nos IA trop fortes ou trop faibles pour des enfants | Moyenne | Valeurs du code comme départ, difficulté Facile testée avec Arthur et Léo. |
| **Ampleur** : OpenFront est très riche, le projet peut s'étirer | Forte | Étapes jouables, l'étape 1 est déjà un jeu. |
| **Sécurité des enfants** en salon 🔒 | Forte | Pas de texte libre, pseudos filtrés, accès par lien + accord de l'hôte, relecture gardien-enfants. |

---

## 12. Points à relire par le gardien-enfants 🔒

1. **Pseudos et tags** : longueur, caractères, filtre de mots, pas de
   prénom imposé, pseudo aléatoire par défaut proposé aux enfants ; option
   « joueurs anonymes » en salon.
2. **Tchat** : uniquement phrases toutes faites (liste à relire), émojis
   (liste fermée à relire), aucun texte libre, limites de fréquence.
3. **Accès depuis Internet** : SSO YunoHost pour créer, lien secret 128 bits
   + accord de l'hôte pour entrer, aucun salon listé, limitation des essais.
4. **Journaux** : quelles données (IP, pseudos), durée de conservation (7 j
   proposés).
5. **Rediffusions** : contiennent les pseudos ; stockées où, pour combien
   de temps, qui peut les voir.
6. Aucune donnée n'est envoyée à un service extérieur (pas de statistiques,
   pas de pub, pas d'IA).

---

## 13. Questions ouvertes

| N° | Question | Ma proposition |
|---|---|---|
| Q1 | Réécriture ou fork d'OpenFront ? Quelle licence ? | Réécriture ; licence AGPL v3. |
| Q2 | Nom du jeu ? | **Ligne de Front** (sinon Frontières ou Pixelmonde). |
| Q3 | Technique : A (TypeScript + Node), B (Python qui calcule) ou C (Python relais + JS) ? | **A**, C en second choix. |
| Q4 | Domaine ? | `front.izicraft.fr`. |
| Q5 | Garder un historique local (parties jouées, victoires) sans compte ? | Oui, dans le navigateur seulement. |
| Q6 | Drapeaux des nations : vrais drapeaux (domaine public) ou drapeaux inventés ? | Vrais drapeaux simplifiés, dessinés par nous. |
| Q7 | Or passif fixe (comme le code) ou bonus de territoire ? | Fixe comme le code au départ ; bonus seulement si les parties manquent de rythme. |
| Q8 | « Blitz » = Overtime (seuil qui baisse) et « Mort subite » = Doomsday Clock (les derniers dépérissent) ? | Oui. |
| Q9 | Le multijoueur avant la mer et le nucléaire ? | Oui si vous voulez jouer ensemble vite : étape 4 au lieu de 6. |
| Q10 | Spectateurs dès le début de partie (parents qui regardent) ? | Oui, en salon, sans tchat. |
| Q11 | Joueur absent pendant la phase d'apparition : placé au hasard ou spectateur ? | Placé au hasard. |
| Q12 | Solo accessible à tous ceux qui ont l'adresse, ou derrière le SSO YunoHost aussi ? | Ouvert (comme tower), il ne montre rien de privé. |
| Q13 | Carte de l'étape 1 : Monde directement, ou France d'abord (plus petite) ? | Monde, avec repli France si CA-PERF-1 n'est pas atteint. |

---

## 14. Décisions de Thibault (2026-11-24)

Spec validée. Réponses aux questions ouvertes :

- **Q1** : **réécriture indépendante**, pour un usage familial et entre amis ;
  licence **AGPL v3** acceptée.
- **Q3** : **option A** (TypeScript partout, serveur Node).
- **Q13** : carte Monde à l'étape 1, **mais l'objectif est aussi d'avoir de
  très grandes cartes, détaillées**, et de proposer des **cartes simples**
  (continents carrés, losanges, etc.).
- **Autres questions (Q2, Q4 à Q12)** : les propositions de la spec sont
  retenues telles quelles (« la spec est validée »).

### Conséquences sur la conception

1. **Dimensionner pour thnas** (AMD Ryzen 7 8600G, 32 Go DDR5) : la taille
   maximale des cartes n'est plus fixée sur le Monde (2064 × 1032) mais
   déterminée par mesure ; la structure de données et le serveur doivent
   permettre des cartes bien plus grandes. Le serveur Node (étape 6) peut
   exécuter la simulation : sa marge mémoire et CPU est le plafond à mesurer.
   Les navigateurs des joueurs (tablettes comprises, CA-PERF-2) restent le
   second plafond : les grandes cartes sont signalées « PC conseillé » dans la
   fiche carte.
2. **Cartes de taille variable dès l'étape 1** : aucune dimension codée en
   dur ; tableaux typés dimensionnés à partir de la carte ; identifiants de
   propriétaire et de tuile assez larges pour dépasser 16 millions de tuiles.
3. **Générateur de cartes simples** (continents carrés, losanges, archipels,
   etc.) en plus des cartes réelles : paramétrable en taille, utile aussi aux
   tests de performance et de déterminisme.
4. **Nouveau critère CA-PERF-6** : une carte d'au moins 4 fois la surface du
   Monde (≈ 8 millions de tuiles) se charge et se joue sur thnas/PC sans
   dépasser les budgets mémoire ; les limites réelles mesurées sont notées
   dans le catalogue.
