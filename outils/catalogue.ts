// Catalogue des cartes (public/cartes/index.json).
import { writeFileSync } from 'node:fs';
import type { Carte } from '../src/cartes/format.ts';
import type { ParamsCarte } from '../src/cartes/generer.ts';

export interface EntreeCatalogue {
  id: string;
  nom: string;
  description: string;
  largeur: number;
  hauteur: number;
  terres: number;
  /** Part de terres, en %, arrondie à 0,1. */
  pourcentTerres: number;
  /** Nombre de tribus conseillé (≈ 1 tribu pour 1 550 terres, 400 au plus sur les cartes ≤ Monde). */
  tribusConseillees: number;
  /** Au-delà de ce nombre de tuiles, la carte est lourde pour une tablette. */
  pcConseille: boolean;
  auteur: string;
  genre: string;
  graine: number;
}

/** Seuil provisoire de « PC conseillé » (sera calé sur docs/perf.md). */
export const SEUIL_PC_CONSEILLE = 4_000_000;

export function tribusParDefaut(terres: number): number {
  return Math.max(0, Math.floor(terres / 1550));
}

export function entreeCatalogue(id: string, c: Carte, p: ParamsCarte): EntreeCatalogue {
  const tuiles = c.largeur * c.hauteur;
  return {
    id,
    nom: c.nom,
    description: c.description,
    largeur: c.largeur,
    hauteur: c.hauteur,
    terres: c.terres,
    pourcentTerres: Math.round((c.terres / tuiles) * 1000) / 10,
    tribusConseillees: Math.min(400, tribusParDefaut(c.terres)),
    pcConseille: tuiles > SEUIL_PC_CONSEILLE,
    auteur: 'Générateur du dépôt',
    genre: p.genre,
    graine: p.graine,
  };
}

export function ecrireCatalogue(chemin: string, entrees: EntreeCatalogue[]): void {
  writeFileSync(chemin, JSON.stringify(entrees, null, 2) + '\n');
}
