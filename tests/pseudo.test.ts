import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pseudoAleatoire, verifierPseudo } from '../src/client/pseudo.ts';

test('les pseudos aléatoires sont toujours acceptés', () => {
  for (let i = 0; i < 3000; i++) {
    const p = pseudoAleatoire();
    assert.equal(verifierPseudo(p), null, p);
  }
  // toutes les combinaisons possibles (12 × 12)
  const animaux = ['Renard', 'Loup', 'Hibou', 'Lynx', 'Castor', 'Hérisson', 'Faucon', 'Panda', 'Dauphin', 'Pingouin', 'Koala', 'Lama'];
  const adj = ['Joyeux', 'Rapide', 'Brave', 'Malin', 'Calme', 'Curieux', 'Doux', 'Fier', 'Agile', 'Sage', 'Espiègle', 'Rusé'];
  for (const a of animaux) for (const j of adj) assert.equal(verifierPseudo(`${a} ${j}`), null, `${a} ${j}`);
});

test('prénoms et mots courants acceptés', () => {
  for (const p of ['Violette', 'Véronique', 'Monique', 'Dominique', 'Hercule', 'Calcul', 'Habite', 'Fichier', 'Essex', 'Cap Dorian', 'Léo', 'Arthur', 'Mort-Subite']) {
    assert.equal(verifierPseudo(p), null, p);
  }
});

test('mots interdits et contournements refusés', () => {
  for (const p of ['merde', 'm3rd3', 'fvck', 'sh1t', 'n1que', 'puuute', 'p u t e', 'PUTAIN', 'pd', 'ＰＵＴＥ', 'pédé lol', 'ntm', 'Hitler', 'tr0is nazi', 'аrthur' /* « а » cyrillique */]) {
    assert.notEqual(verifierPseudo(p), null, p);
  }
});

test('longueur et caractères', () => {
  assert.notEqual(verifierPseudo('a'), null);
  assert.notEqual(verifierPseudo('x'.repeat(21)), null);
  assert.notEqual(verifierPseudo('<b>gras</b>'), null);
});
