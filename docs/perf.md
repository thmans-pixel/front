# Mesures de performance (spec 002 § 9)

Dernière mise à jour : 2026-11-24 — étape 1.

## Ce qui a été mesuré, et ce qui ne l'a pas été

| Mesure | Fait ? |
|---|---|
| Simulation sans affichage (Node 26.12, PC de jeu Bazzite, Ryzen 7 7600X) | **Oui** (tableau ci-dessous) |
| Simulation sur **thnas** (Ryzen 7 8600G, 32 Go) | **Non** : thnas n'a que Node 16, trop ancien pour lancer le banc. À refaire après installation de Node 22 ou plus. |
| Images par seconde du rendu (CA-PERF-1, CA-PERF-2) | **Non** : seulement vérifié que l'affichage fonctionne (Chromium sans carte graphique, rendu logiciel, cartes jusqu'à 8,5 M de tuiles et 800 tribus). À mesurer à la main sur le PC et sur une tablette. |
| Mémoire de l'onglet (CA-PERF-3), chargement (CA-PERF-4) | **Non**. |
| Parties jouées par un humain sur grande carte | **Non** : le banc n'a qu'un joueur qui lance une attaque vers la terre libre tous les 3 s. Les combats lourds entre nombreuses attaques simultanées ne sont pas représentés. |

## Simulation (`npm run banc`, 6 000 ticks = 10 minutes de jeu, carte `terra`, tribus au défaut)

Node v26.12.0 ; temps d'un tick après le début de la partie (hors phase d'apparition).

| Carte | Tuiles | Tribus placées/demandées | Génération | Création | Tick moyen | p99 | max | Mémoire (RSS) |
|---|---|---|---|---|---|---|---|---|
| 2064×1032 (≈ Monde) | 2,1 M | 380/411 | 0,2 s | 0,0 s | 0,09 ms | 0,27 ms | 0,9 ms | 131 Mo |
| 4128×2064 (×4) | 8,5 M | 1290/1648 | 0,8 s | 0,0 s | 0,45 ms | 1,08 ms | 3,9 ms | 224 Mo |
| 8256×4128 (×16) | 34,1 M | 2000/2000 | 3,8 s | 0,2 s | 1,59 ms | 2,93 ms | 4,7 ms | 483 Mo |
| 12384×6192 (×36) | 76,7 M | 2000/2000 | 7,6 s | 0,3 s | 1,99 ms | 3,82 ms | 8,0 ms | 799 Mo |

Lecture :

- Budgets du CA-PERF-1 (tick moyen < 15 ms, 99 % < 40 ms) : **très largement respectés** côté simulation, jusqu'à 77 millions de tuiles, dans le scénario mesuré. CA-PERF-6 (≥ 4 × le Monde) : respecté côté simulation.
- Le coût d'un tick dépend de l'activité (fronts des attaques) et non de la taille de la carte : il augmente peu avec la taille.
- Le plafond pratique viendra de la **mémoire** et du **navigateur** : environ 11 octets par tuile dans le worker, plus une copie du terrain et des propriétaires (3 octets) dans l'onglet et 3 octets de textures. Pour 34 M de tuiles : ≈ 375 Mo (worker) + ≈ 100 Mo (client) + ≈ 100 Mo (textures) ; les tablettes seront limitées avant le PC.
- Le seuil provisoire « PC conseillé » est fixé à 4 millions de tuiles (`outils/catalogue.ts`), en attendant les mesures de rendu et de mémoire sur tablette.

## Mémoire par tuile (simulation)

terrain 1 + propriétaire 2 + position de bordure 4 + marque d'attaque 4 = **11 octets** (la spec 002 annonçait 4 : les deux tableaux supplémentaires évitent de parcourir la carte à chaque tick).
