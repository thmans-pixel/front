// Constantes de la simulation. « [V] » = valeur reprise d'OpenFront v0.36.7
// (spec 001) ; « [J] » = notre choix, à confirmer.
// RAPPEL : les troupes sont stockées ×10 et affichées ÷10 (CLAUDE.md). Toutes
// les valeurs de ce fichier sont en unités internes.

import { HAUTEURS, MONTAGNE, PLAINE } from '../cartes/format.ts';

export const TICKS_PAR_SECONDE = 10; // [V]
export const DUREE_APPARITION_TICKS = 10 * TICKS_PAR_SECONDE; // 10 s en solo [V]
export const IMMUNITE_TICKS = 5 * TICKS_PAR_SECONDE; // 5 s [V]
export const DISTANCE_MIN_TRIBUS = 30; // tuiles [V]
export const RAYON_DEPART = 4; // tuiles [J]

export const TROUPES_DEPART_JOUEUR = 25_000; // 2 500 affichées [V]
export const TROUPES_DEPART_TRIBU = 10_000; // 1 000 affichées [V]
export const OR_PAR_TICK_JOUEUR = 100; // 1 000 or/s [V]
export const OR_PAR_TICK_TRIBU = 50; // 500 or/s [V]

export const COEF_MAX_TRIBU = 1 / 3; // [V]
export const COEF_CROISSANCE_TRIBU = 0.5; // [V]

export const RATIO_DEFAUT = 20; // % [V]
export const RETOUR_ANNULATION = 0.75; // 25 % de pertes [V]
export const SEUIL_VICTOIRE = 0.8; // [V]

/** Décision d'une tribu : toutes les 4 à 8 s [V]. */
export const DECISION_TRIBU_MIN = 4 * TICKS_PAR_SECONDE;
export const DECISION_TRIBU_MAX = 8 * TICKS_PAR_SECONDE;
export const RATIO_ATTAQUE_TRIBU = 0.5; // % (réglé à la main : tribus lentes) [J]
export const SEUIL_ATTAQUE_TRIBU = 0.5; // part du max de troupes [J]

/** Difficulté de prise (spec 001, A4) [V]. */
export function sanglant(type: number): number {
  return type === MONTAGNE ? 120 : type === HAUTEURS ? 100 : type === PLAINE ? 80 : 80;
}
export function lent(type: number): number {
  return type === MONTAGNE ? 25 : type === HAUTEURS ? 20 : type === PLAINE ? 16.5 : 16.5;
}

/** Facteur global de lenteur des attaques [J] : la formule D2 brute (÷ longueur du front)
 * donne des vitesses irréalistes (≈ 5 tuiles/s de rayon) ; à recalibrer en jouant. */
export const FACTEUR_LENTEUR = 8;

/** Au-delà de ~300 000 tuiles, courbe en S du bonus de taille [V] (forme exacte [?]). */
export const TAILLE_MILIEU_BONUS = 300_000;
export const TAILLE_ECHELLE_BONUS = 100_000; // [J]
export const REDUCTION_MAX_ATTAQUANT = 0.7; // [V]
export const REDUCTION_MAX_DEFENSEUR = 0.3; // [V]
