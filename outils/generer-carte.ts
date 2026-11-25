// Générateur de cartes en ligne de commande.
//   node outils/generer-carte.ts --genre terra --largeur 2064 --hauteur 1032 --graine 7 --sortie public/cartes/terra.fmap
//   node outils/generer-carte.ts --tout          (cartes du catalogue, dans public/cartes/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { genererCarte, type Genre, type ParamsCarte } from '../src/cartes/generer.ts';
import { ecrireFmap } from '../src/cartes/format.ts';
import { entreeCatalogue, ecrireCatalogue, type EntreeCatalogue } from './catalogue.ts';

const args = new Map<string, string>();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const suivant = argv[i + 1];
    if (suivant !== undefined && !suivant.startsWith('--')) { args.set(a.slice(2), suivant); i++; } else args.set(a.slice(2), '1');
  }
}

async function produire(id: string, p: ParamsCarte, dossier: string): Promise<EntreeCatalogue> {
  const debut = Date.now();
  const carte = genererCarte(p);
  const fichier = `${dossier}/${id}.fmap`;
  mkdirSync(dirname(fichier), { recursive: true });
  writeFileSync(fichier, await ecrireFmap(carte));
  const e = entreeCatalogue(id, carte, p);
  console.log(`${id}: ${carte.largeur}×${carte.hauteur}, ${e.pourcentTerres} % de terres (${Date.now() - debut} ms)`);
  return e;
}

if (args.has('tout')) {
  const dossier = args.get('dossier') ?? 'public/cartes';
  const liste: Array<[string, ParamsCarte]> = [
    ['petit-carre', { genre: 'carre', largeur: 512, hauteur: 512, graine: 1, continents: 1, nom: 'Petit carré' }],
    ['losanges', { genre: 'losange', largeur: 1024, hauteur: 1024, graine: 1, continents: 4, nom: 'Losanges' }],
    ['archipel', { genre: 'archipel', largeur: 1536, hauteur: 1024, graine: 11, nom: 'Archipel' }],
    ['terra-moyenne', { genre: 'terra', largeur: 2064, hauteur: 1032, graine: 7, nom: 'Terra moyenne' }],
    ['terra-grande', { genre: 'terra', largeur: 4128, hauteur: 2064, graine: 21, nom: 'Terra grande' }],
  ];
  const entrees: EntreeCatalogue[] = [];
  for (const [id, p] of liste) entrees.push(await produire(id, p, dossier));
  ecrireCatalogue(`${dossier}/index.json`, entrees);
} else {
  const genre = (args.get('genre') ?? 'terra') as Genre;
  const p: ParamsCarte = {
    genre,
    largeur: Number(args.get('largeur') ?? 1024),
    hauteur: Number(args.get('hauteur') ?? 1024),
    graine: Number(args.get('graine') ?? 1),
    nom: args.get('nom'),
    pourcentTerres: args.has('terres') ? Number(args.get('terres')) : undefined,
    continents: args.has('continents') ? Number(args.get('continents')) : undefined,
  };
  await produire(args.get('id') ?? genre, p, args.get('dossier') ?? '.');
}
