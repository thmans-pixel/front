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

À compléter quand la technique sera choisie (spec 001, section 5).

## Tester

À compléter quand la technique sera choisie. Prévu : tests automatiques de la
simulation (déterminisme, formules de combat, croissance) qui tournent sans
navigateur.

## Déployer sur thnas

À compléter (spec 001, section 10) : domaine YunoHost, service systemd,
journaux, procédure de mise à jour.

## Pièges connus

À remplir au fil de l'eau.

- Les troupes sont stockées ×10 en interne et affichées ÷10 (convention
  reprise d'OpenFront) : ne jamais mélanger les deux unités dans une formule.
