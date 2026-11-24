# Spec 002 — Étape 1 : le cœur du jeu (solo)

- **Statut : brouillon**
- Date : 2026-11-24
- Dépend de : spec 001 (validée), sections 5, 7.A à 7.D, 7.G, 8.3, 8.5, 9, 14
- Branche prévue : `etape/01-coeur`
- Relecture demandée : 🔒 agent `gardien-enfants` pour les points marqués 🔒
- Les valeurs marquées **[V]** viennent de la spec 001 (lues dans OpenFront
  v0.36.7) ; **[J]** = jugement à confirmer ; **[?]** = à mesurer ou à lire
  avant de coder.

---

## 1. Objectif

À la fin de l'étape, on ouvre une page web, on choisit une carte, on place son
point de départ, et on joue **seul contre des tribus** : on étend son territoire,
on attaque, on gère son ratio de troupes, on voit le classement, on gagne à 80 %
des terres ou on perd quand on n'a plus de tuile. Le tout reste fluide sur de
**très grandes cartes** (objectif de Thibault, spec 001 § 14).

Hors périmètre (étapes suivantes) : constructions, nations IA, diplomatie,
émojis, tchat, mer (bateaux), nucléaire, multijoueur, options avancées,
tutoriel, sons, rediffusion. Les tribus sont donc les seuls adversaires et
elles ne s'allient pas, ne trahissent pas, ne naviguent pas.

## 2. Choix techniques (spec 001, option A)

- **TypeScript**, construction avec **esbuild** (seule dépendance de
  développement avec `typescript` pour la vérification des types). Aucune
  dépendance dans le navigateur.
- Tests avec le lanceur intégré de Node (`node --test`), sans navigateur.
- Rendu **WebGL2**. Pas de repli Canvas 2D à cette étape [J] (reporté à
  l'étape 8) ; si WebGL2 manque, message clair en français.
- Simulation dans un **Web Worker**. Le code de simulation (`src/sim/`) est
  du TypeScript pur, **sans DOM ni API navigateur** : il tourne tel quel dans
  Node (tests, mesures, et plus tard serveur).
- Site **statique** à cette étape : fichiers HTML/JS/cartes servis par nginx
  sur thnas.

### Arborescence

```
package.json  tsconfig.json
src/sim/        simulation pure (carte, joueurs, combat, tribus, victoire)
src/worker/     boîte aux lettres du Web Worker autour de src/sim
src/client/     écrans, entrées souris/tactile, rendu WebGL2, interface
src/cartes/     lecture/écriture du format de carte (partagé outils + client)
outils/         générateur de cartes, banc de mesure (Node)
tests/          tests de la simulation et du format de carte
public/         index.html, cartes/*.fmap (générées), styles
docs/perf.md    résultats des mesures (§ 9)
```

## 3. Grandes cartes : contraintes de conception

Ces règles découlent de la spec 001 § 14 et valent pour tout le code.

1. **Aucune dimension en dur.** Largeur et hauteur viennent de la carte.
2. **Un index de tuile = `y × largeur + x` en entier 32 bits non signé**
   (`Uint32Array` pour les listes d'index). Plafond théorique 4,29 milliards
   de tuiles ; plafond **pratique** déterminé par mesure (§ 9).
3. **Mémoire par tuile** (état de simulation) : terrain 1 octet + propriétaire
   2 octets (`Uint16Array`, 65 535 joueurs au plus, dont « personne » = 0)
   + drapeaux 1 octet = **4 octets/tuile**. Une carte de 8 millions de tuiles
   coûte 32 Mo par copie ; 64 millions, 256 Mo par copie. Il y a deux copies
   (worker et client) plus la texture. **[?]** à mesurer.
4. **Ne jamais parcourir toutes les tuiles dans un tick.** La simulation ne
   touche que les **fronts** (tuiles de bordure des attaques en cours) et les
   compteurs maintenus incrémentalement (tuiles par joueur, bordure par
   joueur). Un tick coûte proportionnellement à l'activité, pas à la carte.
5. **Le rendu ne redessine que ce qui change** : les modifications d'un tick
   sont envoyées au client sous forme de liste d'index (`Uint32Array`
   transférée sans copie), le client met à jour sa copie et marque les dalles
   touchées.
6. **Textures en dalles de 2048 × 2048** : une carte plus grande que la limite
   de texture de la carte graphique (souvent 8192 ou 16384, parfois moins sur
   tablette) est découpée en dalles ; seules les dalles visibles sont dessinées
   et seules les dalles modifiées sont renvoyées à la carte graphique.
7. **Cartes chargées compressées** (gzip, décompression native du navigateur
   via `DecompressionStream`) ; terrain codé sur 1 octet par tuile avant
   compression.
8. **Pas de structure par tuile en objets JavaScript** (ni `Map`, ni objets) :
   tableaux typés uniquement dans la boucle chaude.

## 4. Format de carte (`.fmap`)

Fichier binaire gzip ; contenu décompressé :

| Octets | Contenu |
|---|---|
| 0-3 | signature `FMAP` |
| 4-5 | version du format (1) |
| 6-9 | largeur (uint32) |
| 10-13 | hauteur (uint32) |
| 14-17 | nombre de tuiles de terre (uint32, calculé par le générateur) |
| 18-19 | longueur du nom (uint16), puis nom en UTF-8 |
| ensuite | longueur + texte UTF-8 de la description / auteur / licence des données |
| ensuite | `largeur × hauteur` octets de terrain |

Octet de terrain : bit 7 = terre ; bits 0-2 = type : `0` eau, `1` plaine,
`2` hauteurs, `3` montagne, `4` infranchissable (terre non attaquable, ex. glacier
[J]). Le drapeau « côte » (terre voisine d'eau) est **calculé au chargement**,
pas stocké.

Un catalogue `public/cartes/index.json` liste les cartes : identifiant, nom,
taille (L × H), % de terres, nombre de tribus conseillé, joueurs conseillé,
auteur, mention « PC conseillé » au-delà d'un seuil (§ 9).

Les valeurs de A1 (3 résolutions : pleine, ¼, 1⁄16) : la résolution ¼ est
générée par le chargeur pour l'**aperçu** du catalogue [J] ; la simulation
tourne toujours en pleine résolution.

## 5. Générateur de cartes (`outils/generer-carte.ts`)

Commande unique, déterministe (graine), qui écrit un `.fmap` et met à jour
l'index. **Aucun fichier d'OpenFront** n'est lu ni copié.

**5.1 Cartes simples** (obligatoires, aussi pour les mesures) :

| Genre | Description | Paramètres |
|---|---|---|
| `carre` | Un ou plusieurs continents carrés séparés par la mer | taille, nombre de continents, graine |
| `losange` | Continents en losange | idem |
| `archipel` | Nombreuses îles de formes aléatoires | taille, densité, graine |
| `terra` | Continents irréguliers (bruit fractal), relief plaine/hauteurs/montagne selon l'altitude | taille, % de terres, graine |

Taille jusqu'à ce que la mesure (§ 9) dise stop ; paramètres libres en ligne de
commande. Le générateur affiche et inscrit dans l'index le **% de terres réel**
(CA-A5).

**5.2 Cartes réelles (Monde, France)** à partir de données du domaine public
(Natural Earth pour les côtes, ETOPO ou SRTM pour le relief, spec 001 A2).
Elles dépendent de téléchargements que je n'ai pas encore pu vérifier (**[?]**,
risque R2). Si les données ne sont pas obtenues proprement, la carte `terra`
en très grande taille tient lieu de « Monde » pour l'étape et la PR le dit.

**5.3 Cartes livrées dans le dépôt** : au moins `Petit carré`, `Losanges`,
`Archipel`, `Terra moyenne`, `Terra grande` (taille choisie après mesure) et,
si possible, `Monde`. Fichiers lourds : attention à la taille du dépôt
(sous Git LFS ou régénérés à la construction ; à trancher, Q-b).

## 6. Règles de la simulation

Rappel : **tick = 100 ms** (10 par seconde) **[V]**. Troupes **stockées ×10
et affichées ÷10** (CLAUDE.md) : toutes les formules de ce document sont en
unités internes sauf mention « affiché ».

### 6.1 Déterminisme

- Toute l'aléa passe par un **générateur pseudo-aléatoire à graine** écrit par
  nous (une seule instance dans la partie, tirée dans un ordre fixe). Interdit :
  `Math.random`, `Date.now`, l'itération d'objets sans ordre défini.
- Fonctions mathématiques non exactes (`Math.pow`, `Math.exp`…) : centralisées
  dans `src/sim/maths.ts` pour pouvoir les remplacer par des tables si deux
  moteurs donnent un résultat différent (risque R3, utile à l'étape 6).
- Une **empreinte** (somme de contrôle 32 bits de l'état : propriétaires,
  troupes, or) est calculable à tout moment et affichée en mode développeur.
  Elle sert aux tests (§ 10).

### 6.2 Apparition (7.B1)

- Phase de **10 s** [V] ; le joueur clique une tuile de terre libre (non
  infranchissable) ; il peut changer jusqu'à la fin ; distance minimale
  **30 tuiles** [V] à tout autre départ (tribus comprises : les tribus
  s'apparaissent d'abord, le clic du joueur est refusé si trop proche d'une
  tribu **[J]** — message « Trop près d'une tribu »).
- Sans clic à la fin : **placement aléatoire** (CA-B1).
- Les tribus apparaissent à des positions tirées au sort, ≥ 30 tuiles entre
  elles et d'un joueur ; leur nombre est réduit s'il n'y a pas la place (la PR
  et l'écran indiquent le nombre réellement placé).
- Territoire de départ : disque de rayon 4 tuiles autour du clic, limité à la
  terre [J] (valeur **[?]** à confirmer en lisant OpenFront v0.36.7).
- **Immunité** de **5 s** [V] après la fin de la phase (CA-B2).

### 6.3 Joueurs

- **Joueur** : 2 500 troupes affichées (25 000 internes) [V].
- **Tribu** : 1 000 troupes affichées au départ, max ÷3, croissance ×0,5, or
  passif 500/s [V] ; réfléchit toutes les **4 à 8 s** [V] (tirage décalé par
  tribu, donc ~5 à 15 décisions par tick avec 400 tribus).
- **Nombre de tribus** : réglable 0 à 400 [V], **défaut proportionnel aux
  terres** : ⌊terres / 1 550⌋ plafonné à 400 pour les cartes ≤ Monde,
  plafond relevé selon la mesure pour les grandes cartes **[J]**
  (620 903 / 400 ≈ 1 552 terres par tribu sur le Monde).
- Une tribu **ne joue que contre ce qui touche son territoire** : à chaque
  décision, si elle a assez de troupes (≥ 50 % de son max **[J]**), elle attaque
  son voisin le plus faible ou la terre libre, avec ratio 20 % **[J]**. Elle
  préfère les traîtres [V], mais il n'y en a pas encore. Pas de bateau.
- **Élimination** : zéro tuile. Le vainqueur de la dernière tuile reçoit
  tout l'or d'une tribu, la moitié de celui d'un humain [V] (CA-C5).

### 6.4 Or (7.C1)

- Revenu passif **1 000 or/s** (100 par tick) pour le joueur, **500/s** pour
  une tribu, multiplicateur 1 [V]. L'or ne sert encore à rien (étape 2) mais
  il est compté, affiché et transféré à l'élimination.
- Affichage : total + revenu/s moyen glissant sur 5 s [J].

### 6.5 Troupes (7.C2)

En unités internes, T = nombre de tuiles du joueur :

- **Max** = 2 × (1 000 × T^0,6 + 50 000) + 250 000 × (somme des niveaux de
  villes terminées) ; **pas de ville à cette étape**, terme = 0. Tribu : ÷3.
- **Croissance par tick** = (10 + troupes^0,73 / 4) × (1 − troupes / max),
  × 0,5 pour une tribu. Arrondi : **[?]** (entier, à lire dans le code
  v0.36.7 : on reprend la valeur du comportement, pas le texte).
- Jamais au-dessus du max (CA-C4).
- Barre : vert = disponibles, orange = engagées dans des attaques [V] ;
  alerte à 80 % du max [V].

### 6.6 Combat (7.D)

**Voisinage** : 4 voisins (haut, bas, gauche, droite) **[J]**.

**Lancer** : clic sur une tuile ennemie ou libre **voisine du territoire** (ou
atteignable par le front commun). Troupes engagées = ratio × troupes
disponibles ; ratio 1-100 %, **20 % par défaut** [V], T / Y pour −/+ 10 %
[V] ; curseur en bas. Si le joueur a déjà une attaque vers la même cible,
**fusion** : on ajoute les troupes à l'attaque existante [J]. Pas d'attaque
pendant l'immunité (CA-B2) ni contre soi-même.

**Une attaque** est un objet de simulation : attaquant, cible (joueur ou
« terre libre »), troupes restantes, **front** = ensemble des tuiles de la
cible voisines du territoire de l'attaquant, rangées par **échéance** (tick où
elles peuvent être prises).

**Résolution (D2)** : pour chaque tuile du front dont l'échéance est atteinte :

- terre libre : pertes = sanglant(terrain) / 5 (÷10 pour une tribu) [V] ;
- terre défendue :
  r = troupes du défenseur / troupes de l'attaque ;
  pertes de l'attaquant = sanglant(terrain) × borne(r, 0,6, 2) ×
  (0,463 × bonus_grand_attaquant × bonus_grand_défenseur + 0,0039 × densité),
  densité = troupes du défenseur / ses tuiles ;
  pertes du défenseur = sa densité ;
  coût en vitesse = borne(r, 0,82, 7,5) × borne(r/20, 1, 50) / 8,55 ×
  lent(terrain) × bonus de taille ÷ longueur du front [V] ;
- tables A4 : sanglant 80 / 100 / 120, lent 16,5 / 20 / 25 pour plaine /
  hauteurs / montagne [V] ; eau et infranchissable : jamais prises ;
- bonus de taille (courbe en S au-delà d'environ 300 000 tuiles) et
  « humains et nations contre tribu : pertes × 0,7 » : repris [V].
  Pas de poste de défense, de traître ni de retombées à cette étape.
- La tuile prise passe au propriétaire attaquant ; ses voisines non possédées
  par l'attaquant rejoignent le front ; l'attaque s'arrête quand ses troupes
  tombent à 0 ou que le front est vide (troupes restantes rendues à
  l'attaquant).
- **Annulation (D3)** : les troupes reviennent avec **25 % de pertes** [V]
  (2 000 engagées → 1 500 rendues, CA-D3).
- **Tuiles isolées** : une tuile entourée entièrement par un autre joueur est
  absorbée par lui **[?]** (règle d'OpenFront à confirmer par lecture ;
  si non confirmée, absente et signalée dans la PR).

Les constantes exactes manquantes (bonus de taille, arrondis, `borne`) sont à
**lire dans OpenFront v0.36.7 pour leurs valeurs numériques uniquement** ; le
code est réécrit par nous (CLAUDE.md règle 4). Chaque constante porte un
commentaire « valeur d'OpenFront v0.36.7 » ou « notre choix ».

### 6.7 Victoire et défaite (7.G11)

- **Victoire** : le joueur possède **80 %** des terres (réglable dans le
  code, pas dans l'interface à cette étape) [V].
- **Défaite** : le joueur n'a plus aucune tuile. L'écran de fin propose
  « Regarder la suite » (la simulation continue, vue libre, plus d'ordres) et
  « Quitter ».
- Défaite aussi si une **tribu** atteint 80 % **[J]** (cas rare).

## 7. Client

### 7.1 Écrans

**Accueil** (maquette 8.1 de la spec 001, version réduite) : titre
« Ligne de Front » **[Q2, nom proposé]**, pseudo, choix de la carte (liste
avec fiche : taille, % de terres, nombre de tribus conseillé, « PC conseillé »),
nombre de tribus, graine (facultative), bouton « Jouer ».

**Pseudo** 🔒 : stocké **seulement dans le navigateur**, jamais envoyé nulle
part à cette étape ; 2 à 16 caractères, lettres/chiffres/espace/tiret ; **pseudo
aléatoire proposé par défaut** (liste adjectif + animal, à relire) ; filtre de
mots interdits (liste à relire). Pas de tag à cette étape.

**En jeu** (maquette 8.3, réduite) : bandeau haut (or +/s, barre de troupes
C2, survol de tuile), liste des attaques à gauche avec ✕ Annuler,
**classement** à droite (5 premiers + soi, « montrer tout », repliable ;
rang, nom, % de terres, or, troupes), curseur de ratio en bas, chrono, pause
et vitesse ×0,5 / ×1 / ×2 (solo [V]), plein écran, menu (quitter).
**Pas** de barre des 10 constructions, de journal, de menu radial complet :
le clic gauche sur une tuile = attaque, un bouton « Infos » suffit (survol).

**Écran de fin** (8.5) : Victoire/Défaite, classement final, durée, boutons
« Regarder la suite » et « Quitter ».

Tous les textes en français. Noms des tribus 🔒 : liste à nous, à relire
(noms de plantes, d'animaux, de lieux ; aucun nom de personne).

### 7.2 Entrées

- Souris : molette = zoom, glisser = déplacement, clic = attaque ou départ,
  Espace = bascule vue pays / vue terrain [V], M = grille [V], C = centrer
  sur soi [V], T / Y = ratio −/+ 10 % [V], Q/E et +/− = zoom [V], ZQSD/WASD et
  flèches = déplacement [V]. Raccourcis non modifiables à cette étape.
- Tactile (CA-G1 pour cette étape) : toucher = attaque, pincement = zoom,
  deux doigts = déplacement, curseur de ratio à l'écran.

### 7.3 Rendu

- Une dalle = une texture ; deux couches : **terrain** (couleur selon type,
  avec relief léger) et **propriétaires** (identifiant → couleur par une petite
  texture de palette). Les frontières de territoire sont tracées dans le
  shader (voisin de propriétaire différent) ; la vue « pays » n'affiche que les
  couleurs de joueurs, la vue « terrain » le relief seul.
- Couleurs de joueurs : palette de 400+ couleurs distinctes générée par nous
  (teinte/luminosité), **contrastée pour le daltonisme** [J]. Le joueur a
  toujours la même couleur vive reconnaissable, ses bordures sont épaissies.
- Zoom : de la carte entière jusqu'à **1 tuile = 16 pixels d'écran**
  (CA-A1). Au-delà de 8 pixels/tuile, on affiche la grille fine facultative.
- Noms des joueurs sur la carte : seulement pour les grands territoires, taille
  proportionnelle au zoom ; tribus sans nom au dézoom [J].
- Boucle : `requestAnimationFrame` ; la simulation n'attend pas l'affichage,
  l'affichage n'attend pas la simulation (le worker envoie les mises à jour dès
  qu'elles sont prêtes, le client les applique avant le prochain dessin).

### 7.4 Worker : messages

Du client au worker : `initialiser{carte, configuration}`, `apparaitre{tuile}`,
`attaquer{cible, ratio}`, `annuler{idAttaque}`, `pause/vitesse`, `empreinte?`.

Du worker au client (un message par tick, regroupé si le client est en
retard) : `miseAJour{tick, tuilesModifiées: Uint32Array (index, propriétaire
en paires), statsJoueurs (toutes les 5 ticks : tuiles, troupes, or, engagées),
attaques du joueur, fin?}`.

Les ordres du joueur sont **datés d'un tick** même en solo, pour que le même
canal serve au multijoueur (étape 6).

## 8. Hébergement de l'étape

- Site statique : `dist/` copié sur thnas, servi par nginx (domaine
  YunoHost, **Q4 : `front.izicraft.fr` proposé**). Pas de serveur Node à
  cette étape.
- Sections « Lancer », « Tester » et « Déployer » du `CLAUDE.md` remplies dans
  la même PR (commandes `npm`, build, déploiement, journaux nginx).
- Je **n'ai pas accès à thnas depuis ce poste** : la mise en ligne réelle se
  fait avec Thibault ou l'agent `admin-thnas` ; la PR dit si elle a été faite.

## 9. Mesures de performance (grandes cartes)

Banc `outils/banc.ts` (Node, sans affichage) : génère une carte `terra` de
taille donnée avec le nombre de tribus par défaut, simule N ticks et écrit :
temps moyen / p99 / max d'un tick, mémoire, temps de génération. Tailles :
Monde (2064 × 1032), ×2, ×4 (≈ 8 M tuiles, CA-PERF-6), ×8, ×16, jusqu'à ce que
un budget soit dépassé. Résultats dans `docs/perf.md`, **mesurés sur thnas**
(Ryzen 7 8600G, 32 Go) **et** sur le PC de jeu quand c'est possible, avec la
version de Node. Le tableau fixe :

- la **taille maximale conseillée** (tick moyen < 15 ms, p99 < 40 ms, CA-PERF-1)
  — elle déclenche la mention « PC conseillé » dans le catalogue ;
- la **taille maximale tolérée** (mémoire, temps de chargement).

Le rendu (images/s, mémoire de l'onglet) se mesure à la main sur le PC et une
tablette, résultats ajoutés au même fichier.

## 10. Critères d'acceptation

Repris de la spec 001 pour le périmètre de l'étape, plus les nouveaux :

| Critère | Énoncé | Vérifié par |
|---|---|---|
| CA-A1 | La carte s'affiche entière, zoomable jusqu'à 1 tuile = 16 px, sans saccade | manuel + CA-PERF-1 |
| CA-A2 | Espace bascule la vue en moins d'une image | manuel |
| CA-A3 | C recentre sur le territoire du joueur | manuel |
| CA-A4 | La fiche carte affiche taille, % de terres, tribus conseillées, « PC conseillé » | manuel |
| CA-A5 | % de terres et nombre de tribus = valeurs calculées par le générateur | test automatique |
| CA-B1 | Sans clic, le joueur est placé au hasard | test automatique |
| CA-B2 | Pendant l'immunité, aucune attaque ne vise ni ne part du joueur | test automatique |
| CA-B3 | Toutes les tribus apparaissent à ≥ 30 tuiles des autres (ou le nombre réellement placé est annoncé) | test automatique |
| CA-C1 | Un joueur seul gagne exactement 1 000 or en 10 ticks | test automatique |
| CA-C2 | T = 10 000 : max affiché = 60 237 ± 1 | test automatique |
| CA-C4 | Les troupes ne dépassent jamais le max (partie simulée de 30 000 ticks) | test automatique |
| CA-C5 | Dernière tuile d'une tribu à 40 000 or = +40 000 ; d'un humain = +20 000 | test automatique |
| CA-D1 | Ratio 20 % et 10 000 troupes → attaque de 2 000 | test automatique |
| CA-D2 | 10 cas de la formule D2 tirés du code v0.36.7 donnent les mêmes sorties à 1e-6 | test automatique ; **[?]** si je ne peux pas relire le code, le dire |
| CA-D3 | Annuler 2 000 rend 1 500 | test automatique |
| CA-D5 | À troupes égales, prendre une montagne coûte 1,5 fois une plaine (si l'on en croit la table 120 / 80) | test automatique |
| CA-G1 | Toutes les actions de l'étape se font à la souris seule et au doigt seul | manuel |
| CA-G2 | Le classement se met à jour ≥ 2 fois/s | manuel |
| CA-G9 | Écran de fin avec Victoire/Défaite, classement, durée, Regarder la suite / Quitter | manuel |
| CA-G11 | Victoire à 80 % des terres | test automatique |
| CA-PERF-1 | Carte Monde (ou équivalente), tribus par défaut, PC de Thibault : ≥ 55 images/s ; tick moyen < 15 ms, 99 % < 40 ms | banc + manuel |
| CA-PERF-2 | Même partie, tablette milieu de gamme : ≥ 30 images/s, aucun tick > 100 ms | manuel |
| CA-PERF-3 | Onglet < 600 Mo sur la carte Monde | manuel |
| CA-PERF-4 | Chargement du Monde < 5 s en fibre, < 10 s en 4G | manuel |
| CA-PERF-6 | Carte ≥ 4 × le Monde chargée et jouée sans dépasser les budgets ; limites réelles dans `docs/perf.md` | banc |
| **CA-S2-1** | **Déterminisme** : deux simulations avec la même graine et les mêmes ordres ont la même empreinte à chaque seconde pendant 30 min simulées, sur 3 tailles de carte | test automatique |
| **CA-S2-2** | **Aucune dimension en dur** : la même partie tourne sur une carte 64 × 64 et sur une carte ≥ 8 M tuiles sans modifier le code | test automatique |
| **CA-S2-3** | **Format** : écrire puis relire un `.fmap` redonne exactement la même carte (terrain, taille, tuiles de terre) | test automatique |
| **CA-S2-4** | **Générateur** : même graine → même fichier octet pour octet ; cartes `carre`, `losange`, `archipel`, `terra` produites | test automatique |
| **CA-S2-5** | **Simulation sans DOM** : `src/sim` n'importe rien du navigateur ; les tests tournent dans Node seul | test automatique (analyse des imports) |

## 11. Découpage du travail (commits)

1. Squelette : `package.json`, `tsconfig`, esbuild, `node --test`, scripts
   `npm run build/test/dev`.
2. Format `.fmap` + tests (CA-S2-3).
3. Générateur de cartes simples + `terra` + tests (CA-A5, CA-S2-4).
4. Noyau de simulation : carte, joueurs, aléa, troupes, or + tests C1/C2/C4.
5. Apparition, tribus, combat D2, annulation, élimination, victoire + tests.
6. Banc de mesure + premiers chiffres (`docs/perf.md`) ; réglages des tailles.
7. Worker et messages.
8. Rendu WebGL2 en dalles, zoom/déplacement, vues.
9. Interface : accueil, jeu, classement, attaques, fin, tactile.
10. Cartes livrées, catalogue, `CLAUDE.md` (Lancer / Tester / Déployer).
11. Passage de `gardien-enfants` (pseudos, noms de tribus), puis de
    `relecteur` et `testeur`.

## 12. Risques

- **R1 — Performance des grandes cartes** : la mémoire des deux copies + la
  texture peut limiter la taille avant le CPU. Mitigation : mesures dès le
  commit 6, dalles, 4 octets/tuile.
- **R2 — Données de carte réelles** : téléchargement, licence et poids
  non vérifiés. Mitigation : cartes procédurales d'abord (§ 5.3).
- **R3 — Déterminisme entre moteurs** : `Math.pow`/`exp` peuvent différer entre
  navigateurs. Pas bloquant en solo ; isolé dans `maths.ts` pour l'étape 6.
- **R4 — Fidélité au combat d'OpenFront** : certaines constantes ne sont pas
  dans la spec 001 ; si je ne peux pas les relire, je les calibre par tests de
  sensation et je le signale dans la PR (CA-D2 alors non vérifié).
- **R5 — Tablettes** : limite de taille de texture et mémoire plus basses ;
  dalles et mention « PC conseillé » en protection.
- **R6 — Algorithme du front** : le choix de la file d'échéances (tas binaire
  ou seaux par tick) change fortement le coût sur 400 attaques simultanées ;
  à comparer au banc avant de figer.

## 13. Points à relire par le gardien-enfants 🔒

1. Liste des pseudos aléatoires et filtre de mots.
2. Liste des noms de tribus.
3. Le pseudo ne sort jamais du navigateur (aucun envoi réseau à cette étape).
4. Aucun stockage autre que `localStorage` (pseudo, derniers réglages).
5. Site public ou protégé par SSO YunoHost (Q12 de la spec 001 : « ouvert »).

## 14. Questions ouvertes

| N° | Question | Ma proposition |
|---|---|---|
| Q-a | Node 22 ou plus est-il installé sur le PC Bazzite et sur thnas ? | Je vérifie ; sinon `nvm` ou Flatpak/YunoHost. |
| Q-b | Les cartes générées lourdes : dans le dépôt (Git LFS), ou régénérées à la construction ? | Régénérées par `npm run cartes` (déterministe) ; seul le petit catalogue est versionné. |
| Q-c | Carte « Monde » réelle dès l'étape 1, ou seulement procédurale (§ 5.2) ? | Procédural d'abord ; Monde réel en fin d'étape si les données se téléchargent proprement. |
| Q-d | Domaine pour cette étape ? | `front.izicraft.fr` (Q4). |
| Q-e | Taille des tribus sur les grandes cartes : plafond de 400 ou davantage (ex. 1 tribu / 1 550 terres) ? | Proportionnel, plafond fixé par la mesure. |
| Q-f | Départ du joueur : refuser si trop près d'une tribu, ou déplacer la tribu ? | Refuser avec un message. |
