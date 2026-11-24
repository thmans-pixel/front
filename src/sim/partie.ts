// Noyau de la simulation (spec 002 § 6). Pur TypeScript : aucune API du
// navigateur. Tableaux typés dans la boucle chaude, un tick ne travaille que
// sur les fronts des attaques et les bordures maintenues incrémentalement.

import { INFRANCHISSABLE, MASQUE_TYPE, TERRE, type Carte } from '../cartes/format.ts';
import { Alea } from './alea.ts';
import * as K from './constantes.ts';
import { borne, exponentielle, puissance } from './maths.ts';
import { nomTribu } from './noms.ts';
import { Tas } from './tas.ts';

export type TypeJoueur = 'humain' | 'tribu';

export interface Joueur {
  id: number;
  type: TypeJoueur;
  nom: string;
  tuiles: number;
  /** Troupes disponibles, unités internes (×10). */
  troupes: number;
  or: number;
  vivant: boolean;
  attaques: Attaque[];
  /** Tuiles du joueur qui touchent une tuile de terre d'un autre propriétaire (ou libre). */
  bord: Uint32Array;
  nbord: number;
  prochaineDecision: number;
  aApparu: boolean;
}

export interface Attaque {
  id: number;
  attaquant: number;
  /** 0 = terre libre. */
  cible: number;
  /** Troupes engagées (internes). */
  troupes: number;
  tas: Tas;
  budget: number;
}

export interface Config {
  graine: number;
  /** Nombre de tribus demandé (le nombre réellement placé peut être inférieur). */
  tribus: number;
  pseudo: string;
}

export type Ordre =
  | { type: 'apparaitre'; joueur: number; tuile: number }
  | { type: 'attaquer'; joueur: number; cible: number; ratio: number }
  | { type: 'annuler'; joueur: number; idAttaque: number };

export interface Fin {
  resultat: 'victoire' | 'defaite';
  tick: number;
}

export const ID_HUMAIN = 1;
const BANDE = 1000; // largeur d'un tick dans les clés du tas d'une attaque

export class Partie {
  readonly largeur: number;
  readonly hauteur: number;
  readonly taille: number;
  readonly terrain: Uint8Array;
  readonly proprio: Uint16Array;
  /** Position de la tuile dans la liste de bordure de son propriétaire, -1 sinon. */
  private readonly posBord: Int32Array;
  /** Numéro de l'attaque qui a déjà empilé la tuile (évite les doublons). */
  private readonly marque: Uint32Array;
  readonly joueurs: Joueur[] = [];
  readonly terresPraticables: number;
  readonly tribusPlacees: number;
  /** Tuile centrale de départ de chaque tribu (CA-B3). */
  readonly departsTribus: number[] = [];
  tick = 0;
  phase: 'apparition' | 'jeu' = 'apparition';
  fin: Fin | null = null;
  private alea: Alea;
  private ordres: Ordre[] = [];
  private prochaineAttaque = 1;
  private journal = new Uint32Array(1024);
  private njournal = 0;
  private startTile: number[] = [];
  /** Refus d'ordres du joueur depuis le dernier relevé (pour afficher un message). */
  refus: string[] = [];

  constructor(carte: Carte, config: Config) {
    this.largeur = carte.largeur;
    this.hauteur = carte.hauteur;
    this.taille = carte.largeur * carte.hauteur;
    this.terrain = carte.terrain;
    this.proprio = new Uint16Array(this.taille);
    this.posBord = new Int32Array(this.taille).fill(-1);
    this.marque = new Uint32Array(this.taille);
    this.alea = new Alea(config.graine);
    let praticables = 0;
    for (let i = 0; i < this.taille; i++) if (this.praticable(i)) praticables++;
    this.terresPraticables = praticables;
    if (config.tribus > 65_000) throw new Error('Trop de tribus (65 000 au plus)');

    this.joueurs.push(this.nouveauJoueur(0, 'humain', 'Personne')); // indice 0 : personne
    this.joueurs.push(this.nouveauJoueur(ID_HUMAIN, 'humain', config.pseudo));
    this.tribusPlacees = this.placerTribus(config.tribus);
  }

  // --- Accès de base ------------------------------------------------------

  praticable(t: number): boolean {
    const v = this.terrain[t];
    return (v & TERRE) !== 0 && (v & MASQUE_TYPE) !== INFRANCHISSABLE;
  }

  get humain(): Joueur {
    return this.joueurs[ID_HUMAIN];
  }

  private nouveauJoueur(id: number, type: TypeJoueur, nom: string): Joueur {
    return {
      id, type, nom, tuiles: 0, troupes: 0, or: 0, vivant: true, attaques: [],
      bord: new Uint32Array(16), nbord: 0, prochaineDecision: 0, aApparu: false,
    };
  }

  // --- Apparition ---------------------------------------------------------

  private placerTribus(demandees: number): number {
    // Distance euclidienne ≥ 30 ; cases de 15 tuiles (au plus une tribu par case).
    const dmin = K.DISTANCE_MIN_TRIBUS;
    const cote = Math.floor(dmin / 2);
    const cx = Math.ceil(this.largeur / cote);
    const cy = Math.ceil(this.hauteur / cote);
    const grille = new Int32Array(cx * cy); // tuile + 1, 0 = vide
    let placees = 0;
    for (let k = 0; k < demandees; k++) {
      let ok = false;
      for (let essai = 0; essai < 200 && !ok; essai++) {
        const t = this.alea.entier(this.taille);
        if (!this.praticable(t) || this.proprio[t] !== 0) continue;
        const x = t % this.largeur;
        const y = (t - x) / this.largeur;
        const gx = Math.floor(x / cote);
        const gy = Math.floor(y / cote);
        let libre = true;
        for (let dy = -2; dy <= 2 && libre; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const ax = gx + dx;
            const ay = gy + dy;
            if (ax < 0 || ay < 0 || ax >= cx || ay >= cy) continue;
            const o = grille[ay * cx + ax] - 1;
            if (o < 0) continue;
            const ox = o % this.largeur;
            const oy = (o - ox) / this.largeur;
            if ((ox - x) ** 2 + (oy - y) ** 2 < dmin * dmin) { libre = false; break; }
          }
        }
        if (!libre) continue;
        grille[gy * cx + gx] = t + 1;
        this.departsTribus.push(t);
        const id = this.joueurs.length;
        const j = this.nouveauJoueur(id, 'tribu', nomTribu(placees));
        this.joueurs.push(j);
        this.fonder(j, t);
        j.troupes = K.TROUPES_DEPART_TRIBU;
        j.aApparu = true;
        j.prochaineDecision = K.DUREE_APPARITION_TICKS + this.alea.entreBornes(K.DECISION_TRIBU_MIN, K.DECISION_TRIBU_MAX);
        placees++;
        ok = true;
      }
      if (!ok) break; // plus de place : on s'arrête, le nombre placé est annoncé
    }
    return placees;
  }

  /** Territoire de départ : disque de tuiles libres autour de `centre`. */
  private fonder(j: Joueur, centre: number): void {
    const cx = centre % this.largeur;
    const cy = (centre - cx) / this.largeur;
    const r = K.RAYON_DEPART;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= this.largeur || y >= this.hauteur) continue;
        const t = y * this.largeur + x;
        if (this.praticable(t) && this.proprio[t] === 0) this.donner(t, j.id);
      }
    }
  }

  /** Le joueur peut-il apparaître ici ? Tuile de terre libre. */
  peutApparaitre(tuile: number): boolean {
    return tuile >= 0 && tuile < this.taille && this.praticable(tuile) && this.proprio[tuile] === 0;
  }

  private terminerApparition(): void {
    const h = this.humain;
    if (!h.aApparu) {
      // Sans clic : placement au hasard (CA-B1).
      for (let essai = 0; essai < 10_000; essai++) {
        const t = this.alea.entier(this.taille);
        if (this.peutApparaitre(t)) { this.startTile.push(t); break; }
      }
    }
    const t = this.startTile.length ? this.startTile[this.startTile.length - 1] : -1;
    if (t >= 0) {
      this.fonder(h, t);
      h.aApparu = true;
      h.troupes = K.TROUPES_DEPART_JOUEUR;
    }
    if (h.tuiles === 0) { h.vivant = false; this.terminer('defaite'); }
    this.phase = 'jeu';
  }

  get immuniteFinTick(): number {
    return K.DUREE_APPARITION_TICKS + K.IMMUNITE_TICKS;
  }

  enImmunite(): boolean {
    return this.tick < this.immuniteFinTick;
  }

  // --- Propriété des tuiles et bordures ----------------------------------

  private noter(t: number, nouveau: number): void {
    if (this.njournal + 2 > this.journal.length) {
      const j = new Uint32Array(this.journal.length * 2);
      j.set(this.journal);
      this.journal = j;
    }
    this.journal[this.njournal++] = t;
    this.journal[this.njournal++] = nouveau;
  }

  /** Change le propriétaire d'une tuile et met à jour bordures et compteurs. */
  private donner(t: number, nouveau: number): void {
    const ancien = this.proprio[t];
    if (ancien !== 0) {
      if (this.posBord[t] >= 0) this.retirerBord(this.joueurs[ancien], t);
      this.joueurs[ancien].tuiles--;
    }
    this.proprio[t] = nouveau;
    if (nouveau !== 0) this.joueurs[nouveau].tuiles++;
    this.noter(t, nouveau);
    this.majBord(t);
    const l = this.largeur;
    const x = t % l;
    if (x > 0) this.majBord(t - 1);
    if (x < l - 1) this.majBord(t + 1);
    if (t >= l) this.majBord(t - l);
    if (t < this.taille - l) this.majBord(t + l);
  }

  private estBord(t: number, o: number): boolean {
    const l = this.largeur;
    const x = t % l;
    const p = this.proprio;
    if (x > 0 && p[t - 1] !== o && this.praticable(t - 1)) return true;
    if (x < l - 1 && p[t + 1] !== o && this.praticable(t + 1)) return true;
    if (t >= l && p[t - l] !== o && this.praticable(t - l)) return true;
    if (t < this.taille - l && p[t + l] !== o && this.praticable(t + l)) return true;
    return false;
  }

  private majBord(t: number): void {
    const o = this.proprio[t];
    if (o === 0) return;
    const dedans = this.posBord[t] >= 0;
    const doit = this.estBord(t, o);
    if (doit && !dedans) this.ajouterBord(this.joueurs[o], t);
    else if (!doit && dedans) this.retirerBord(this.joueurs[o], t);
  }

  private ajouterBord(j: Joueur, t: number): void {
    if (j.nbord === j.bord.length) {
      const b = new Uint32Array(j.bord.length * 2);
      b.set(j.bord);
      j.bord = b;
    }
    j.bord[j.nbord] = t;
    this.posBord[t] = j.nbord++;
  }

  private retirerBord(j: Joueur, t: number): void {
    const i = this.posBord[t];
    const dernier = j.bord[--j.nbord];
    j.bord[i] = dernier;
    this.posBord[dernier] = i;
    this.posBord[t] = -1;
  }

  // --- Ressources ---------------------------------------------------------

  /** Troupes maximales (internes). Pas de ville à l'étape 1. */
  troupesMax(j: Joueur): number {
    const max = 2 * (1000 * puissance(j.tuiles, 0.6) + 50_000);
    return j.type === 'tribu' ? max * K.COEF_MAX_TRIBU : max;
  }

  private croissance(j: Joueur): void {
    const max = this.troupesMax(j);
    const coef = j.type === 'tribu' ? K.COEF_CROISSANCE_TRIBU : 1;
    const gain = (10 + puissance(j.troupes, 0.73) / 4) * (1 - j.troupes / max) * coef;
    j.troupes = Math.min(max, j.troupes + Math.max(0, Math.floor(gain)));
  }

  // --- Ordres -------------------------------------------------------------

  soumettre(o: Ordre): void {
    this.ordres.push(o);
  }

  private appliquerOrdre(o: Ordre): void {
    const j = this.joueurs[o.joueur];
    if (!j || !j.vivant) return;
    if (o.type === 'apparaitre') {
      if (this.phase !== 'apparition' || j.id !== ID_HUMAIN) return;
      if (!this.peutApparaitre(o.tuile)) return;
      this.startTile.push(o.tuile);
      j.aApparu = true;
    } else if (o.type === 'attaquer') {
      if (this.lancerAttaque(j, o.cible, o.ratio) === 0 && j.id === ID_HUMAIN) {
        this.refus.push(this.enImmunite() ? 'immunite' : j.troupes < 1 ? 'troupes' : 'contact');
      }
    } else {
      this.annulerAttaque(j, o.idAttaque);
    }
  }

  // --- Attaques -----------------------------------------------------------

  /** Lance (ou renforce) une attaque ; renvoie son numéro, ou 0 si refusée. */
  lancerAttaque(j: Joueur, cible: number, ratio: number): number {
    if (this.phase !== 'jeu' || !j.vivant || cible === j.id) return 0;
    const c = this.joueurs[cible];
    if (!c || (cible !== 0 && !c.vivant)) return 0;
    // Immunité (CA-B2) : ni lancée par l'humain, ni contre lui.
    if (this.enImmunite() && (j.id === ID_HUMAIN || cible === ID_HUMAIN)) return 0;
    const pct = borne(ratio, 0.01, 100);
    const engagees = Math.floor((pct / 100) * j.troupes);
    if (engagees < 1) return 0;
    let att = j.attaques.find((a) => a.cible === cible);
    const neuve = !att;
    if (!att) {
      att = { id: this.prochaineAttaque++, attaquant: j.id, cible, troupes: 0, tas: new Tas(), budget: 0 };
    }
    this.remplirFront(att);
    if (att.tas.taille === 0) {
      if (neuve) this.prochaineAttaque--;
      return 0; // pas de contact avec la cible
    }
    att.troupes += engagees;
    j.troupes -= engagees;
    if (neuve) j.attaques.push(att);
    return att.id;
  }

  annulerAttaque(j: Joueur, id: number): void {
    const i = j.attaques.findIndex((a) => a.id === id);
    if (i < 0) return;
    const a = j.attaques[i];
    j.attaques.splice(i, 1);
    this.viderAttaque(a);
    j.troupes = Math.min(this.troupesMax(j), j.troupes + Math.floor(a.troupes * K.RETOUR_ANNULATION));
  }

  private viderAttaque(a: Attaque): void {
    while (a.tas.taille > 0) {
      const t = a.tas.depiler();
      if (this.marque[t] === a.id) this.marque[t] = 0;
    }
  }

  private cle(t: number, tickPousse: number): number {
    // Délai aléatoire de 0 à 2 ticks : le front avance de façon irrégulière (contours arrondis).
    return tickPousse * BANDE + K.lent(this.terrain[t] & MASQUE_TYPE) * 10 + this.alea.entier(BANDE * 1.5);
  }

  private pousser(a: Attaque, t: number, tickPousse: number): void {
    if (this.marque[t] === a.id) return;
    this.marque[t] = a.id;
    a.tas.empiler(this.cle(t, tickPousse), t);
  }

  /** Empile les tuiles de la cible qui touchent le territoire de l'attaquant. */
  private remplirFront(a: Attaque): void {
    const j = this.joueurs[a.attaquant];
    const l = this.largeur;
    const p = this.proprio;
    for (let i = 0; i < j.nbord; i++) {
      const t = j.bord[i];
      const x = t % l;
      if (x > 0 && p[t - 1] === a.cible && this.praticable(t - 1)) this.pousser(a, t - 1, this.tick);
      if (x < l - 1 && p[t + 1] === a.cible && this.praticable(t + 1)) this.pousser(a, t + 1, this.tick);
      if (t >= l && p[t - l] === a.cible && this.praticable(t - l)) this.pousser(a, t - l, this.tick);
      if (t < this.taille - l && p[t + l] === a.cible && this.praticable(t + l)) this.pousser(a, t + l, this.tick);
    }
  }

  private touche(t: number, o: number): boolean {
    const l = this.largeur;
    const x = t % l;
    const p = this.proprio;
    return (x > 0 && p[t - 1] === o) || (x < l - 1 && p[t + 1] === o) ||
      (t >= l && p[t - l] === o) || (t < this.taille - l && p[t + l] === o);
  }

  private bonusTaille(tuiles: number, reductionMax: number): number {
    const s = 1 / (1 + exponentielle(-(tuiles - K.TAILLE_MILIEU_BONUS) / K.TAILLE_ECHELLE_BONUS));
    return 1 - reductionMax * s;
  }

  /** Pertes de l'attaquant pour une tuile défendue (formule D2). */
  pertesAttaque(att: number, def: number, attTuiles: number, defTuiles: number, defTroupes: number, type: number, attHumain: boolean, defTribu: boolean): number {
    const r = defTroupes / att;
    const densite = defTroupes / Math.max(1, defTuiles);
    const bA = this.bonusTaille(attTuiles, K.REDUCTION_MAX_ATTAQUANT);
    const bD = this.bonusTaille(defTuiles, K.REDUCTION_MAX_DEFENSEUR);
    let pertes = K.sanglant(type) * borne(r, 0.6, 2) * (0.463 * bA * bD + 0.0039 * densite);
    if (attHumain && defTribu) pertes *= 0.7;
    return pertes;
  }

  /** Coût en vitesse d'une tuile, en ticks (formule D2). */
  coutVitesse(r: number, type: number, longueurFront: number): number {
    return (borne(r, 0.82, 7.5) * borne(r / 20, 1, 50)) / 8.55 * K.lent(type) * K.FACTEUR_LENTEUR / Math.max(1, longueurFront);
  }

  /** Avance une attaque d'un tick ; renvoie false si elle est terminée. */
  private avancerAttaque(a: Attaque): boolean {
    const j = this.joueurs[a.attaquant];
    const c = this.joueurs[a.cible];
    a.budget = Math.min(a.budget + 1, 60);
    const limite = (this.tick + 1) * BANDE;
    for (;;) {
      if (a.tas.taille === 0) {
        this.remplirFront(a);
        if (a.tas.taille === 0) return false;
      }
      if (a.tas.cleMin() >= limite) return true;
      const t = a.tas.valMin();
      if (this.proprio[t] !== a.cible || !this.touche(t, a.attaquant)) {
        a.tas.depiler();
        if (this.marque[t] === a.id) this.marque[t] = 0;
        continue;
      }
      const type = this.terrain[t] & MASQUE_TYPE;
      const libre = a.cible === 0;
      const r = libre ? 1 : c.troupes / a.troupes;
      const cout = this.coutVitesse(r, type, a.tas.taille);
      if (a.budget < cout) return true;
      let pertes: number;
      let pertesDef = 0;
      if (libre) {
        pertes = K.sanglant(type) / (j.type === 'tribu' ? 10 : 5);
      } else {
        pertes = this.pertesAttaque(a.troupes, a.cible, j.tuiles, c.tuiles, c.troupes, type, j.type === 'humain', c.type === 'tribu');
        pertesDef = c.troupes / Math.max(1, c.tuiles);
      }
      if (a.troupes < pertes) return false; // plus assez de troupes pour prendre la tuile
      a.budget -= cout;
      a.tas.depiler();
      this.marque[t] = 0;
      a.troupes -= pertes;
      if (!libre) c.troupes = Math.max(0, c.troupes - pertesDef);
      this.donner(t, a.attaquant);
      if (!libre && c.tuiles === 0) this.eliminer(c, j);
      const l = this.largeur;
      const x = t % l;
      const suivant = this.tick + 1;
      if (x > 0 && this.proprio[t - 1] === a.cible && this.praticable(t - 1)) this.pousser(a, t - 1, suivant);
      if (x < l - 1 && this.proprio[t + 1] === a.cible && this.praticable(t + 1)) this.pousser(a, t + 1, suivant);
      if (t >= l && this.proprio[t - l] === a.cible && this.praticable(t - l)) this.pousser(a, t - l, suivant);
      if (t < this.taille - l && this.proprio[t + l] === a.cible && this.praticable(t + l)) this.pousser(a, t + l, suivant);
    }
  }

  private eliminer(c: Joueur, par: Joueur): void {
    c.vivant = false;
    par.or += c.type === 'humain' ? c.or / 2 : c.or; // tout l'or d'une tribu, la moitié d'un humain [V]
    c.or = 0;
    c.troupes = 0;
    for (const a of c.attaques) this.viderAttaque(a);
    c.attaques = [];
    if (c.id === ID_HUMAIN) this.terminer('defaite');
  }

  private terminer(resultat: 'victoire' | 'defaite'): void {
    if (!this.fin) this.fin = { resultat, tick: this.tick };
  }

  // --- Tribus -------------------------------------------------------------

  private deciderTribu(j: Joueur): void {
    j.prochaineDecision = this.tick + this.alea.entreBornes(K.DECISION_TRIBU_MIN, K.DECISION_TRIBU_MAX);
    if (j.attaques.length > 0 || j.nbord === 0) return;
    if (j.troupes < K.SEUIL_ATTAQUE_TRIBU * this.troupesMax(j)) return;
    const l = this.largeur;
    let meilleur = -1;
    let faiblesse = Infinity;
    const essais = Math.min(12, j.nbord);
    for (let k = 0; k < essais; k++) {
      const t = j.bord[this.alea.entier(j.nbord)];
      const x = t % l;
      const voisins = [x > 0 ? t - 1 : -1, x < l - 1 ? t + 1 : -1, t >= l ? t - l : -1, t < this.taille - l ? t + l : -1];
      for (const v of voisins) {
        if (v < 0 || !this.praticable(v)) continue;
        const o = this.proprio[v];
        if (o === j.id) continue;
        if (o === ID_HUMAIN && this.enImmunite()) continue;
        if (o !== 0 && !this.joueurs[o].vivant) continue;
        const f = o === 0 ? -1 : this.joueurs[o].troupes;
        if (f < faiblesse) { faiblesse = f; meilleur = o; }
      }
    }
    if (meilleur >= 0) this.lancerAttaque(j, meilleur, K.RATIO_ATTAQUE_TRIBU);
  }

  // --- Tick ---------------------------------------------------------------

  avancer(): void {
    for (const o of this.ordres) this.appliquerOrdre(o);
    this.ordres.length = 0;

    if (this.phase === 'apparition') {
      this.tick++;
      if (this.tick >= K.DUREE_APPARITION_TICKS) this.terminerApparition();
      return;
    }
    // Ressources
    for (let i = 1; i < this.joueurs.length; i++) {
      const j = this.joueurs[i];
      if (!j.vivant || j.tuiles === 0) continue;
      j.or += j.type === 'tribu' ? K.OR_PAR_TICK_TRIBU : K.OR_PAR_TICK_JOUEUR;
      this.croissance(j);
    }
    // Décisions des tribus
    for (let i = 2; i < this.joueurs.length; i++) {
      const j = this.joueurs[i];
      if (j.vivant && j.tuiles > 0 && this.tick >= j.prochaineDecision) this.deciderTribu(j);
    }
    // Attaques (ordre des joueurs, puis ordre de lancement : déterministe)
    for (let i = 1; i < this.joueurs.length; i++) {
      const j = this.joueurs[i];
      if (j.attaques.length === 0) continue;
      const restantes: Attaque[] = [];
      for (const a of j.attaques) {
        if (!j.vivant) break;
        if (this.avancerAttaque(a)) restantes.push(a);
        else this.terminerAttaque(j, a);
      }
      if (j.vivant) j.attaques = restantes;
    }
    // Victoire
    if (!this.fin) {
      const seuil = K.SEUIL_VICTOIRE * this.terresPraticables;
      if (this.humain.tuiles >= seuil) this.terminer('victoire');
      else {
        for (let i = 2; i < this.joueurs.length; i++) {
          if (this.joueurs[i].tuiles >= seuil) { this.terminer('defaite'); break; }
        }
      }
    }
    this.tick++;
  }

  private terminerAttaque(j: Joueur, a: Attaque): void {
    this.viderAttaque(a);
    // Les troupes qui restent rentrent à la maison.
    if (j.vivant) j.troupes = Math.min(this.troupesMax(j), j.troupes + Math.floor(a.troupes));
  }

  // --- Sorties ------------------------------------------------------------

  /** Modifications depuis le dernier appel : paires (index de tuile, propriétaire). */
  prendreModifications(): Uint32Array {
    const out = this.journal.slice(0, this.njournal);
    this.njournal = 0;
    return out;
  }

  engagees(j: Joueur): number {
    let s = 0;
    for (const a of j.attaques) s += a.troupes;
    return s;
  }

  /** Empreinte 32 bits de l'état (déterminisme, CA-S2-1). */
  empreinte(): number {
    let h = 2166136261 | 0;
    const mel = (v: number): void => { h = Math.imul(h ^ (v | 0), 16777619); };
    const p = this.proprio;
    for (let i = 0; i < p.length; i++) mel(p[i]);
    for (let i = 1; i < this.joueurs.length; i++) {
      const j = this.joueurs[i];
      mel(j.tuiles);
      mel(Math.round(j.troupes));
      mel(Math.round(j.or));
      mel(this.engagees(j));
    }
    mel(this.tick);
    return h >>> 0;
  }
}
