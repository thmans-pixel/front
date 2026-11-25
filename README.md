# front — jeu de stratégie en temps réel dans le navigateur

Jeu de conquête en temps réel sur une carte du monde en pixels : on choisit
son point de départ, on s'étend, on attaque ses voisins, on construit villes,
ports et usines, on noue (ou trahit) des alliances, et on finit à coups de
missiles. Parties en solo contre des IA (nations et tribus) ou entre amis
dans un salon privé.

Le jeu est fait pour la famille et les amis : pas de compte payant, pas de
boutique, pas de publicité, pas de parties publiques ouvertes à tous. Il est
hébergé à la maison, sur le serveur **thnas** (Debian 12 + YunoHost).

> **Inspiré d'OpenFront** — https://github.com/openfrontio/OpenFrontIO
>
> Ce dépôt est une réécriture indépendante : il ne contient ni code, ni
> images, ni cartes d'OpenFront. OpenFront n'est ni l'auteur ni le garant de
> ce projet.

## État

Étape 1 (cœur solo) en cours de réalisation — spec
[`docs/specs/002-etape-1-coeur-solo.md`](docs/specs/002-etape-1-coeur-solo.md) :
cartes générées (carrés, losanges, archipels, continents), apparition,
expansion, attaques, tribus, classement, victoire à 80 %. Le plan général est
dans [`docs/specs/`](docs/specs/).

## Lancer, tester, déployer

Voir [`CLAUDE.md`](CLAUDE.md) (commandes `npm run dev`, `npm test`, `npm run build`).
Mesures de performance : [`docs/perf.md`](docs/perf.md).

## Licence

Voir [`LICENSE`](LICENSE) — licence provisoire, à trancher dans la spec 001.
