// Générateur de cartes (spec 002 § 5). Déterministe : même paramètres, même
// carte, octet pour octet. Aucune donnée d'OpenFront.

import { hachage2 } from '../sim/alea.ts';
import type { Carte } from './format.ts';
import { compterTerres, EAU, HAUTEURS, MONTAGNE, PLAINE, TERRE } from './format.ts';

export type Genre = 'carre' | 'losange' | 'archipel' | 'terra';

export interface ParamsCarte {
  genre: Genre;
  largeur: number;
  hauteur: number;
  graine: number;
  nom?: string;
  /** Part de terres visée, en % (terra, archipel). */
  pourcentTerres?: number;
  /** Nombre de continents (carre, losange). */
  continents?: number;
}

const lisser = (t: number): number => t * t * (3 - 2 * t);

/** Bruit de valeurs à une fréquence donnée. */
function bruit(x: number, y: number, graine: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = lisser(x - ix);
  const fy = lisser(y - iy);
  const a = hachage2(ix, iy, graine);
  const b = hachage2(ix + 1, iy, graine);
  const c = hachage2(ix, iy + 1, graine);
  const d = hachage2(ix + 1, iy + 1, graine);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Bruit fractal normalisé dans [0, 1]. */
function fractal(x: number, y: number, graine: number, octaves: number): number {
  let somme = 0;
  let amp = 1;
  let total = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    somme += amp * bruit(x * f, y * f, graine + o * 101);
    total += amp;
    amp *= 0.5;
    f *= 2;
  }
  return somme / total;
}

const BACS = 4096;

/** Terrain par altitude : on garde les `pc` % les plus hauts comme terre. */
function terrainParAltitude(alt: Float32Array, pc: number): Uint8Array {
  const n = alt.length;
  const hist = new Uint32Array(BACS);
  for (let i = 0; i < n; i++) hist[Math.min(BACS - 1, Math.floor(alt[i] * BACS))]++;
  const seuil = (part: number): number => {
    // plus petit bac b tel que (tuiles dans les bacs >= b) <= part × n
    const cible = part * n;
    let cumul = 0;
    for (let b = BACS - 1; b >= 0; b--) {
      if (cumul + hist[b] > cible) return b + 1;
      cumul += hist[b];
    }
    return 0;
  };
  const p = pc / 100;
  const sTerre = seuil(p);
  const sHaut = seuil(p * 0.3);
  const sMont = seuil(p * 0.08);
  const t = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const b = Math.min(BACS - 1, Math.floor(alt[i] * BACS));
    if (b >= sMont) t[i] = TERRE | MONTAGNE;
    else if (b >= sHaut) t[i] = TERRE | HAUTEURS;
    else if (b >= sTerre) t[i] = TERRE | PLAINE;
    else t[i] = EAU;
  }
  return t;
}

function altitudesBruit(l: number, h: number, graine: number, echelle: number, octaves: number): Float32Array {
  const alt = new Float32Array(l * h);
  const marge = Math.max(2, 0.08 * Math.min(l, h));
  for (let y = 0; y < h; y++) {
    const dy = Math.min(y, h - 1 - y);
    for (let x = 0; x < l; x++) {
      const d = Math.min(dy, x, l - 1 - x) / marge;
      const bord = d >= 1 ? 1 : lisser(d);
      const v = fractal(x / echelle, y / echelle, graine, octaves);
      alt[y * l + x] = v * (0.25 + 0.75 * bord) * (bord < 1 ? bord * 0.5 + 0.5 : 1);
    }
  }
  return alt;
}

/** Continents en grille ; `distance` renvoie 0 au centre, 1 au bord, > 1 dehors. */
function continentsGrille(
  l: number,
  h: number,
  n: number,
  distance: (dx: number, dy: number) => number,
): Uint8Array {
  const t = new Uint8Array(l * h);
  const colonnes = Math.ceil(Math.sqrt(n));
  const lignes = Math.ceil(n / colonnes);
  const cl = l / colonnes;
  const ch = h / lignes;
  for (let k = 0; k < n; k++) {
    const cx = (k % colonnes + 0.5) * cl;
    const cy = (Math.floor(k / colonnes) + 0.5) * ch;
    const demiL = cl * 0.4;
    const demiH = ch * 0.4;
    const x0 = Math.max(0, Math.floor(cx - demiL));
    const x1 = Math.min(l - 1, Math.ceil(cx + demiL));
    const y0 = Math.max(0, Math.floor(cy - demiH));
    const y1 = Math.min(h - 1, Math.ceil(cy + demiH));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = distance((x - cx) / demiL, (y - cy) / demiH);
        if (d > 1) continue;
        t[y * l + x] = TERRE | (d < 0.25 ? MONTAGNE : d < 0.55 ? HAUTEURS : PLAINE);
      }
    }
  }
  return t;
}

export function genererCarte(p: ParamsCarte): Carte {
  const { largeur: l, hauteur: h } = p;
  if (!(l >= 8 && h >= 8)) throw new Error('Carte trop petite (8 × 8 au minimum)');
  const grand = Math.max(l, h);
  let terrain: Uint8Array;
  let nom: string;
  let description: string;
  switch (p.genre) {
    case 'carre':
      terrain = continentsGrille(l, h, p.continents ?? 4, (dx, dy) => Math.max(Math.abs(dx), Math.abs(dy)));
      nom = p.nom ?? 'Carrés';
      description = `Continents carrés générés (graine ${p.graine}).`;
      break;
    case 'losange':
      terrain = continentsGrille(l, h, p.continents ?? 4, (dx, dy) => Math.abs(dx) + Math.abs(dy));
      nom = p.nom ?? 'Losanges';
      description = `Continents en losange générés (graine ${p.graine}).`;
      break;
    case 'archipel': {
      const alt = altitudesBruit(l, h, p.graine, Math.max(4, grand / 40), 4);
      terrain = terrainParAltitude(alt, p.pourcentTerres ?? 22);
      nom = p.nom ?? 'Archipel';
      description = `Archipel généré (graine ${p.graine}).`;
      break;
    }
    case 'terra': {
      const alt = altitudesBruit(l, h, p.graine, Math.max(4, grand / 5), 7);
      terrain = terrainParAltitude(alt, p.pourcentTerres ?? 30);
      nom = p.nom ?? 'Terra';
      description = `Continents irréguliers générés (graine ${p.graine}).`;
      break;
    }
    default:
      throw new Error(`Genre de carte inconnu : ${String(p.genre)}`);
  }
  return { nom, description, largeur: l, hauteur: h, terres: compterTerres(terrain), terrain };
}
