import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { genererCarte } from '../src/cartes/generer.ts';
import { Partie, ID_HUMAIN, type Joueur } from '../src/sim/partie.ts';
import * as K from '../src/sim/constantes.ts';
import { MONTAGNE, PLAINE } from '../src/cartes/format.ts';
import { Alea } from '../src/sim/alea.ts';

const carre = (n = 64) => genererCarte({ genre: 'carre', largeur: n, hauteur: n, graine: 1, continents: 1 });

/** Partie sans tribu, joueur placé au centre, apparition terminée. */
function partieSolo(tribus = 0, n = 64): Partie {
  const p = new Partie(carre(n), { graine: 1, tribus, pseudo: 'Test' });
  const centre = Math.floor(n / 2) * n + Math.floor(n / 2);
  p.soumettre({ type: 'apparaitre', joueur: ID_HUMAIN, tuile: centre });
  while (p.phase === 'apparition') p.avancer();
  return p;
}

test('CA-B1 : sans clic, le joueur est placé au hasard', () => {
  const p = new Partie(carre(), { graine: 3, tribus: 0, pseudo: 'T' });
  while (p.phase === 'apparition') p.avancer();
  assert.ok(p.humain.tuiles > 0);
  assert.equal(p.humain.troupes, K.TROUPES_DEPART_JOUEUR);
});

test("CA-B2 : pendant l'immunité, aucune attaque ne part du joueur ni ne le vise", () => {
  const p = partieSolo(0);
  assert.ok(p.enImmunite());
  assert.equal(p.lancerAttaque(p.humain, 0, 20), 0);
  while (p.enImmunite()) p.avancer();
  assert.ok(p.lancerAttaque(p.humain, 0, 20) > 0);
});

test('CA-B3 : les tribus sont à au moins 30 tuiles les unes des autres', () => {
  const carte = genererCarte({ genre: 'terra', largeur: 400, hauteur: 300, graine: 5 });
  const p = new Partie(carte, { graine: 2, tribus: 80, pseudo: 'T' });
  assert.equal(p.tribusPlacees, p.departsTribus.length);
  assert.ok(p.tribusPlacees > 25);
  const l = carte.largeur;
  for (let i = 0; i < p.departsTribus.length; i++) {
    for (let j = i + 1; j < p.departsTribus.length; j++) {
      const a = p.departsTribus[i];
      const b = p.departsTribus[j];
      const d = Math.hypot((a % l) - (b % l), Math.floor(a / l) - Math.floor(b / l));
      assert.ok(d >= K.DISTANCE_MIN_TRIBUS, `tribus ${i} et ${j} à ${d}`);
    }
  }
});

test('le joueur peut apparaître collé à une tribu', () => {
  const carte = carre(100);
  const p = new Partie(carte, { graine: 1, tribus: 1, pseudo: 'T' });
  const t = p.departsTribus[0];
  const voisin = t + 5; // hors du disque de départ (rayon 4) mais juste à côté
  assert.ok(p.peutApparaitre(voisin));
});

test('CA-C1 : un joueur seul gagne exactement 1 000 or en 10 ticks', () => {
  const p = partieSolo(0);
  const avant = p.humain.or;
  for (let i = 0; i < 10; i++) p.avancer();
  assert.equal(p.humain.or - avant, 1000);
});

test('CA-C2 : T = 10 000 tuiles → max affiché 60 237 ± 1', () => {
  const p = partieSolo(0);
  const fictif = { tuiles: 10_000, type: 'humain' } as Joueur;
  assert.ok(Math.abs(p.troupesMax(fictif) / 10 - 60_237) <= 1);
  assert.ok(Math.abs(p.troupesMax({ tuiles: 1, type: 'humain' } as Joueur) / 10 - 10_200) <= 1);
});

test('CA-C4 : les troupes ne dépassent jamais le max', () => {
  const carte = genererCarte({ genre: 'terra', largeur: 300, hauteur: 200, graine: 4 });
  const p = new Partie(carte, { graine: 4, tribus: 40, pseudo: 'T' });
  for (let i = 0; i < 30_000; i++) {
    p.avancer();
    if (i % 25 === 0) for (const j of p.joueurs) if (j.id > 0) assert.ok(j.troupes <= p.troupesMax(j) + 1e-6, `${j.nom} tick ${i}`);
  }
});

test("CA-C5 : l'élimination crédite l'or (tout pour une tribu, la moitié pour un humain)", () => {
  const p = partieSolo(1);
  const tribu = p.joueurs[2];
  tribu.or = 40_000;
  const avant = p.humain.or;
  (p as unknown as { eliminer(c: Joueur, par: Joueur): void }).eliminer(tribu, p.humain);
  assert.equal(p.humain.or - avant, 40_000);
  const q = partieSolo(1);
  q.humain.or = 40_000;
  const av = q.joueurs[2].or;
  (q as unknown as { eliminer(c: Joueur, par: Joueur): void }).eliminer(q.humain, q.joueurs[2]);
  assert.equal(q.joueurs[2].or - av, 20_000);
});

test('CA-D1 : ratio 20 % de 10 000 troupes affichées → attaque de 2 000', () => {
  const p = partieSolo(0);
  while (p.enImmunite()) p.avancer();
  p.humain.troupes = 100_000;
  const id = p.lancerAttaque(p.humain, 0, 20);
  assert.ok(id > 0);
  assert.equal(p.humain.attaques[0].troupes, 20_000);
  assert.equal(p.humain.troupes, 80_000);
});

test('CA-D3 : annuler une attaque de 2 000 rend 1 500', () => {
  const p = partieSolo(0);
  while (p.enImmunite()) p.avancer();
  p.humain.troupes = 100_000;
  const id = p.lancerAttaque(p.humain, 0, 20);
  p.annulerAttaque(p.humain, id);
  assert.equal(p.humain.troupes, 80_000 + 15_000);
  assert.equal(p.humain.attaques.length, 0);
});

test('CA-D5 : une montagne coûte 1,5 fois une plaine', () => {
  const p = partieSolo(0);
  const plaine = p.pertesAttaque(1000, 2, 100, 100, 1000, PLAINE, false, false);
  const montagne = p.pertesAttaque(1000, 2, 100, 100, 1000, MONTAGNE, false, false);
  assert.ok(Math.abs(montagne / plaine - 1.5) < 1e-9);
});

test('une attaque sur terre libre conquiert des tuiles et consomme des troupes', () => {
  const p = partieSolo(0);
  while (p.enImmunite()) p.avancer();
  const tuiles = p.humain.tuiles;
  p.lancerAttaque(p.humain, 0, 50);
  for (let i = 0; i < 100; i++) p.avancer();
  assert.ok(p.humain.tuiles > tuiles + 50, `tuiles ${p.humain.tuiles}`);
});

test('CA-G11 : la victoire est atteinte à 80 % des terres', () => {
  const p = partieSolo(0);
  for (let i = 0; i < 4000 && !p.fin; i++) {
    if (i % 10 === 0) p.lancerAttaque(p.humain, 0, 100);
    p.avancer();
  }
  assert.equal(p.fin?.resultat, 'victoire');
  assert.ok(p.humain.tuiles >= 0.8 * p.terresPraticables);
});

test('combat entre joueur et tribu : tuiles conservées, bordures cohérentes', () => {
  const carte = genererCarte({ genre: 'terra', largeur: 200, hauteur: 150, graine: 8 });
  const p = new Partie(carte, { graine: 8, tribus: 25, pseudo: 'T' });
  for (let i = 0; i < 4000; i++) {
    if (i % 40 === 0 && p.phase === 'jeu') p.lancerAttaque(p.humain, 0, 40);
    p.avancer();
  }
  // les compteurs de tuiles correspondent à la carte
  const compte = new Uint32Array(p.joueurs.length);
  for (let i = 0; i < p.taille; i++) compte[p.proprio[i]]++;
  for (const j of p.joueurs) if (j.id > 0) assert.equal(j.tuiles, compte[j.id], j.nom);
  // chaque tuile de bordure déclarée est bien une bordure, et inversement
  const nb = new Uint32Array(p.joueurs.length);
  for (let i = 0; i < p.taille; i++) {
    const o = p.proprio[i];
    if (o === 0) continue;
    const x = i % carte.largeur;
    const vs = [x > 0 ? i - 1 : -1, x < carte.largeur - 1 ? i + 1 : -1, i >= carte.largeur ? i - carte.largeur : -1, i < p.taille - carte.largeur ? i + carte.largeur : -1];
    if (vs.some((v) => v >= 0 && p.praticable(v) && p.proprio[v] !== o)) nb[o]++;
  }
  for (const j of p.joueurs) if (j.id > 0) assert.equal(j.nbord, nb[j.id], `bordure de ${j.nom}`);
});

function jouerScript(carte: ReturnType<typeof genererCarte>, tribus: number, ticks: number, graine: number): number[] {
  const p = new Partie(carte, { graine, tribus, pseudo: 'T' });
  const script = new Alea(99);
  const empreintes: number[] = [];
  for (let i = 0; i < ticks; i++) {
    if (i === 20) p.soumettre({ type: 'apparaitre', joueur: ID_HUMAIN, tuile: script.entier(p.taille) });
    if (i > 160 && i % 37 === 0) p.soumettre({ type: 'attaquer', joueur: ID_HUMAIN, cible: script.entier(tribus + 2), ratio: 1 + script.entier(60) });
    p.avancer();
    p.prendreModifications();
    if (i % 10 === 0) empreintes.push(p.empreinte());
  }
  return empreintes;
}

test('CA-S2-1 : déterminisme (mêmes graine et ordres → même empreinte chaque seconde)', () => {
  const tailles: Array<[number, number, number]> = [[120, 90, 12], [220, 160, 40], [360, 240, 90]];
  for (const [l, h, tribus] of tailles) {
    const carte = genererCarte({ genre: 'terra', largeur: l, hauteur: h, graine: 17 });
    const a = jouerScript(carte, tribus, 18_000, 5);
    const b = jouerScript(carte, tribus, 18_000, 5);
    assert.deepEqual(a, b, `${l}×${h}`);
    const c = jouerScript(carte, tribus, 600, 6);
    assert.notDeepEqual(a.slice(0, c.length), c);
  }
});

test('CA-S2-2 : aucune dimension en dur (64×64 et plus de 8 millions de tuiles)', () => {
  for (const [l, h] of [[64, 64], [3000, 2800]]) {
    const carte = genererCarte({ genre: 'losange', largeur: l, hauteur: h, graine: 1, continents: 4 });
    const p = new Partie(carte, { graine: 1, tribus: 30, pseudo: 'T' });
    for (let i = 0; i < 300; i++) p.avancer();
    assert.ok(p.tribusPlacees > 0);
    assert.ok(p.humain.tuiles > 0);
  }
});

test("CA-S2-5 : src/sim n'utilise aucune API du navigateur ni Math.random / Date.now", () => {
  for (const f of readdirSync('src/sim')) {
    const src = readFileSync(`src/sim/${f}`, 'utf8').replace(/\/\/.*$/gm, '');
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
      assert.ok(/^\.\/|^\.\.\/cartes\/format\.ts$/.test(m[1]), `${f} importe ${m[1]}`);
    }
    for (const interdit of ['window', 'document.', 'self.', 'postMessage', 'Math.random', 'Date.now', 'localStorage']) {
      assert.ok(!src.includes(interdit), `${f} utilise ${interdit}`);
    }
  }
});

test('noms de tribus : 480 noms tous différents', async () => {
  const { nomTribu } = await import('../src/sim/noms.ts');
  const s = new Set<string>();
  for (let i = 0; i < 480; i++) s.add(nomTribu(i));
  assert.equal(s.size, 480);
  assert.notEqual(nomTribu(480), nomTribu(0));
});
