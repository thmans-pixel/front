// Banc de mesure (spec 002 § 9) : simule sans affichage et mesure.
//   node outils/banc.ts [--ticks 1500] [--tailles 2064x1032,4128x2064] [--tribus N]
import { genererCarte } from '../src/cartes/generer.ts';
import { Partie, ID_HUMAIN } from '../src/sim/partie.ts';
import { tribusParDefaut } from './catalogue.ts';

const argv = process.argv.slice(2);
const opt = (nom: string, defaut: string): string => {
  const i = argv.indexOf(`--${nom}`);
  return i >= 0 ? argv[i + 1] : defaut;
};
const ticks = Number(opt('ticks', '1500'));
const tailles = opt('tailles', '2064x1032,4128x2064').split(',').map((s) => s.split('x').map(Number));
const mo = (o: number): string => (o / 1048576).toFixed(0);

console.log(`Node ${process.version} — ${ticks} ticks par taille\n`);
console.log('| Carte | Tuiles | Tribus | Génération | Création | Tick moyen | p99 | max | Mémoire (RSS) |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const [l, h] of tailles) {
  let t0 = performance.now();
  const carte = genererCarte({ genre: 'terra', largeur: l, hauteur: h, graine: 7 });
  const tGen = performance.now() - t0;
  const demandees = Number(opt('tribus', String(Math.min(tribusParDefaut(carte.terres), 2000))));
  t0 = performance.now();
  const p = new Partie(carte, { graine: 1, tribus: demandees, pseudo: 'Banc' });
  const tCrea = performance.now() - t0;
  const duree = new Float64Array(ticks);
  for (let i = 0; i < ticks; i++) {
    if (i === 20) p.soumettre({ type: 'apparaitre', joueur: ID_HUMAIN, tuile: p.departsTribus[0] + 40 });
    if (i > 160 && i % 30 === 0) p.soumettre({ type: 'attaquer', joueur: ID_HUMAIN, cible: 0, ratio: 30 });
    const d = performance.now();
    p.avancer();
    p.prendreModifications();
    duree[i] = performance.now() - d;
  }
  const jeu = Array.from(duree.subarray(p.tick > 160 ? 160 : 0)).sort((a, b) => a - b);
  const moy = jeu.reduce((s, v) => s + v, 0) / jeu.length;
  console.log(
    `| ${l}×${h} | ${((l * h) / 1e6).toFixed(1)} M | ${p.tribusPlacees}/${demandees} | ${(tGen / 1000).toFixed(1)} s | ${(tCrea / 1000).toFixed(1)} s | ${moy.toFixed(2)} ms | ${jeu[Math.floor(jeu.length * 0.99)].toFixed(2)} ms | ${jeu[jeu.length - 1].toFixed(1)} ms | ${mo(process.memoryUsage().rss)} Mo |`,
  );
}
