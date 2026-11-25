# CLAUDE.md — règles du dépôt `front`

Jeu de stratégie en temps réel dans le navigateur, inspiré d'OpenFront
(v0.36), pour jouer en famille et entre amis. Hébergé sur thnas (Debian 12,
YunoHost).

## Règles de travail

1. **Spec d'abord.** Tout passe par une spec validée dans `docs/specs/`
   (`NNN-titre.md`) avant la moindre ligne de code. Une spec au statut
   « brouillon » ne se réalise pas ; seul Thibault la passe à « validée ».
2. **Tout en français** : specs, messages de commit, titres et descriptions de
   PR, commentaires de code utiles, textes de l'interface.
3. **Une branche et une PR par étape** (`etape/NN-titre` pour le code,
   `spec/NNN` pour une spec). Rien ne se pousse directement sur `main` après
   la mise en place initiale.
4. **Licence** : on ne copie ni code, ni images, ni cartes, ni sons
   d'OpenFront (code AGPL v3, assets CC BY-SA 4.0, dossier `proprietary/`
   tous droits réservés). On peut lire leur code pour comprendre une règle et
   en reprendre les valeurs numériques, jamais le texte du code. Si on décide
   un jour de partir d'un fork, cette règle change : voir la spec 001.
5. **Ne jamais utiliser « OpenFront » comme titre du jeu.** La mention
   « Inspiré d'OpenFront » avec le lien reste dans le README.
6. **Enfants** : tout ce qui touche les pseudos, le tchat, les émojis, l'accès
   depuis Internet ou des données personnelles passe en relecture par l'agent
   `gardien-enfants` avant fusion.
7. Ce qui n'a pas pu être vérifié (test non lancé, valeur non confirmée) est
   dit explicitement dans la PR.

## Lancer

Prérequis : Node 22 ou plus (testé avec Node 26 sur le PC Bazzite) et `npm install`.

- `npm run dev` : construit et sert le jeu sur http://localhost:8080/ (reconstruction automatique).
- `npm run build` : site statique complet dans `dist/` (les cartes sont générées dans `dist/cartes/` si elles manquent ; `node scripts/construire.mjs --cartes` force la régénération).
- Démarrage direct sans l'accueil (développement, captures) : `/?auto=terra-moyenne&tribus=120`.
- `npm run cartes` : régénère les cartes dans `public/cartes/` ; générateur seul : `node outils/generer-carte.ts --genre terra --largeur 4128 --hauteur 2064 --graine 3 --sortie ...` (voir `outils/generer-carte.ts`).
- `npm run banc` : banc de mesure de la simulation sans affichage (résultats dans `docs/perf.md`).

## Tester

- `npm test` : tests de la simulation, du format de carte et du générateur (lanceur intégré de Node, sans navigateur).
- `npm run typer` : vérification des types (`tsc --noEmit`).
- Le rendu WebGL2 et l'interface ne sont pas testés automatiquement : à vérifier à la main (spec 002, critères « manuel »).

## Déployer sur thnas

Étape 1 = site statique (aucun serveur Node). **Procédure non encore exécutée** (pas d'accès à thnas depuis le PC de développement lors de l'étape 1) :

1. `npm run build` sur le PC.
2. Copier `dist/` sur thnas dans la racine d'un site statique YunoHost (domaine prévu : `front.izicraft.fr`, spec 002 Q-d).
3. Vérifier que nginx sert `.fmap` en `application/octet-stream` (le client sait lire aussi un fichier déjà décompressé par le serveur).

Service systemd, journaux et mise à jour : à compléter avec l'étape 6 (multijoueur).

## Pièges connus

À remplir au fil de l'eau.

- Les troupes sont stockées ×10 en interne et affichées ÷10 (convention
  reprise d'OpenFront) : ne jamais mélanger les deux unités dans une formule.
- Le code de `src/` et `outils/` s'exécute directement par Node (suppression native des types) : imports avec l'extension `.ts`, `import type` pour les types, pas d'`enum` ni de propriétés de paramètres de constructeur.
- `src/sim/` ne doit rien importer du navigateur ni utiliser `Math.random` / `Date.now` (test CA-S2-5) : toute l'aléa passe par `Alea` (déterminisme).
- Mémoire de la simulation : environ 11 octets par tuile (terrain, propriétaire, position de bordure, marque d'attaque), plus une copie du terrain et des propriétaires côté client.
- Les constantes marquées `[J]` ou `[?]` dans `src/sim/constantes.ts` ne viennent pas d'OpenFront : vitesse d'attaque (`FACTEUR_LENTEUR`) et agressivité des tribus sont réglées « à l'œil » et à recalibrer en jouant.
- En test navigateur, Chromium garde `dist/main.js` en cache : désactiver le cache (ou recharger sans cache) après chaque `npm run build`.
