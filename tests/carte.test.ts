import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decoderCarte, encoderCarte, ecrireFmap, lireFmap, compterTerres } from '../src/cartes/format.ts';
import { genererCarte, type ParamsCarte } from '../src/cartes/generer.ts';

const genres: ParamsCarte[] = [
  { genre: 'carre', largeur: 128, hauteur: 96, graine: 1, continents: 4 },
  { genre: 'losange', largeur: 128, hauteur: 128, graine: 1, continents: 2 },
  { genre: 'archipel', largeur: 160, hauteur: 100, graine: 3 },
  { genre: 'terra', largeur: 200, hauteur: 120, graine: 5, pourcentTerres: 30 },
];

test('CA-S2-3 : écrire puis relire un .fmap redonne la même carte', async () => {
  for (const p of genres) {
    const c = genererCarte(p);
    const brut = decoderCarte(encoderCarte(c));
    assert.deepEqual(brut, c);
    const gz = await lireFmap(await ecrireFmap(c));
    assert.deepEqual(gz, c);
  }
});

test('CA-S2-4 : même graine, même carte ; graine différente, carte différente', () => {
  for (const p of genres.filter((g) => g.genre === 'terra' || g.genre === 'archipel')) {
    const a = encoderCarte(genererCarte(p));
    const b = encoderCarte(genererCarte(p));
    assert.deepEqual(a, b);
    const c = encoderCarte(genererCarte({ ...p, graine: p.graine + 1 }));
    assert.notDeepEqual(a, c);
  }
});

test('CA-A5 : le nombre de terres annoncé est celui de la carte', () => {
  for (const p of genres) {
    const c = genererCarte(p);
    assert.equal(c.terres, compterTerres(c.terrain));
    assert.ok(c.terres > 0 && c.terres < c.largeur * c.hauteur, p.genre);
  }
});

test('terra : part de terres proche de la demande', () => {
  const c = genererCarte({ genre: 'terra', largeur: 300, hauteur: 200, graine: 9, pourcentTerres: 30 });
  const pc = (c.terres / (c.largeur * c.hauteur)) * 100;
  assert.ok(Math.abs(pc - 30) < 2, `part de terres ${pc}`);
});

test('fichier invalide refusé', () => {
  assert.throws(() => decoderCarte(new Uint8Array(30)));
});
