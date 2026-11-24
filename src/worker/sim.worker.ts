// Web Worker : fait tourner la simulation, indépendamment de l'affichage.
import { Partie, ID_HUMAIN } from '../sim/partie.ts';
import { DUREE_APPARITION_TICKS, TICKS_PAR_SECONDE } from '../sim/constantes.ts';
import type { DepuisWorker, Stats, VersWorker } from './messages.ts';

let partie: Partie | null = null;
let vitesse = 1;
let dernier = 0;
let acc = 0;
let dernierStats = -1;
const MS_TICK = 1000 / TICKS_PAR_SECONDE;

const envoyer = (m: DepuisWorker, transfert: Transferable[] = []): void =>
  (self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(m, transfert);

function calculerStats(p: Partie): Stats {
  const vivants = p.joueurs.filter((j) => j.id > 0 && j.vivant && j.tuiles > 0);
  vivants.sort((a, b) => b.tuiles - a.tuiles || a.id - b.id);
  const total = p.terresPraticables;
  const ligne = (j: (typeof vivants)[number]) => ({
    id: j.id, nom: j.nom, humain: j.id === ID_HUMAIN, tuiles: j.tuiles,
    pct: (100 * j.tuiles) / total, troupes: Math.floor(j.troupes / 10), or: Math.floor(j.or),
  });
  const h = p.humain;
  const top = vivants.slice(0, 30).map(ligne);
  if (h.vivant && h.tuiles > 0 && !top.some((l) => l.id === ID_HUMAIN)) top.push(ligne(h));
  return {
    tick: p.tick,
    phase: p.phase,
    apparitionRestante: Math.max(0, DUREE_APPARITION_TICKS - p.tick),
    immuniteRestante: Math.max(0, p.immuniteFinTick - p.tick),
    moi: {
      tuiles: h.tuiles, pct: (100 * h.tuiles) / total, troupes: Math.floor(h.troupes / 10),
      max: Math.floor(p.troupesMax(h) / 10), engagees: Math.floor(p.engagees(h) / 10), or: Math.floor(h.or), vivant: h.vivant,
    },
    classement: top,
    rang: h.vivant ? vivants.findIndex((j) => j.id === ID_HUMAIN) + 1 : 0,
    vivants: vivants.length,
    attaques: h.attaques.map((a) => ({
      id: a.id, cible: a.cible, nomCible: a.cible === 0 ? 'Terre libre' : p.joueurs[a.cible].nom, troupes: Math.floor(a.troupes / 10),
    })),
    fin: p.fin,
  };
}

function boucle(): void {
  const p = partie;
  if (!p) return;
  const maintenant = performance.now();
  acc = Math.min(acc + (maintenant - dernier) * vitesse, MS_TICK * 8);
  dernier = maintenant;
  let n = 0;
  while (acc >= MS_TICK && n < 6) {
    p.avancer();
    acc -= MS_TICK;
    n++;
  }
  if (n > 0 || dernierStats < 0) {
    const modifs = p.prendreModifications();
    let stats: Stats | null = null;
    if (p.tick - dernierStats >= 5 || p.fin) {
      stats = calculerStats(p);
      dernierStats = p.tick;
    }
    const refus = p.refus;
    p.refus = [];
    if (modifs.length > 0 || stats || refus.length > 0) {
      envoyer({ type: 'maj', tick: p.tick, modifs, stats, refus }, [modifs.buffer]);
    }
  }
  setTimeout(boucle, 20);
}

self.onmessage = (e: MessageEvent<VersWorker>): void => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      partie = new Partie(
        { nom: m.nom, description: '', largeur: m.largeur, hauteur: m.hauteur, terres: 0, terrain: m.terrain },
        m.config,
      );
      envoyer({ type: 'pret', tribusPlacees: partie.tribusPlacees, terresPraticables: partie.terresPraticables });
      dernier = performance.now();
      dernierStats = -1;
      boucle();
    } else if (!partie) {
      return;
    } else if (m.type === 'apparaitre') {
      partie.soumettre({ type: 'apparaitre', joueur: ID_HUMAIN, tuile: m.tuile });
    } else if (m.type === 'attaquer') {
      partie.soumettre({ type: 'attaquer', joueur: ID_HUMAIN, cible: m.cible, ratio: m.ratio });
    } else if (m.type === 'annuler') {
      partie.soumettre({ type: 'annuler', joueur: ID_HUMAIN, idAttaque: m.id });
    } else if (m.type === 'vitesse') {
      vitesse = m.valeur;
    }
  } catch (err) {
    envoyer({ type: 'erreur', message: String(err instanceof Error ? err.message : err) });
  }
};
