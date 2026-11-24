// Messages échangés entre le client et le Web Worker de simulation (spec 002 § 7.4).

export interface ConfigPartie {
  graine: number;
  tribus: number;
  pseudo: string;
}

export type VersWorker =
  | { type: 'init'; largeur: number; hauteur: number; terrain: Uint8Array; nom: string; config: ConfigPartie }
  | { type: 'apparaitre'; tuile: number }
  | { type: 'attaquer'; cible: number; ratio: number }
  | { type: 'annuler'; id: number }
  /** 0 = pause ; 0.5, 1 ou 2 */
  | { type: 'vitesse'; valeur: number };

export interface LigneClassement {
  id: number;
  nom: string;
  humain: boolean;
  tuiles: number;
  pct: number;
  troupes: number;
  or: number;
}

export interface AttaqueVue {
  id: number;
  cible: number;
  nomCible: string;
  troupes: number;
}

export interface Stats {
  tick: number;
  phase: 'apparition' | 'jeu';
  /** Ticks restants de la phase d'apparition ou de l'immunité (0 si finie). */
  apparitionRestante: number;
  immuniteRestante: number;
  moi: { tuiles: number; pct: number; troupes: number; max: number; engagees: number; or: number; vivant: boolean };
  classement: LigneClassement[];
  rang: number;
  vivants: number;
  attaques: AttaqueVue[];
  fin: { resultat: 'victoire' | 'defaite'; tick: number } | null;
}

export type DepuisWorker =
  | { type: 'pret'; tribusPlacees: number; terresPraticables: number }
  /** Paires (index de tuile, propriétaire). */
  | { type: 'maj'; tick: number; modifs: Uint32Array; stats: Stats | null; refus: string[] }
  | { type: 'erreur'; message: string };
