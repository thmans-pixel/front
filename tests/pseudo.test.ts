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
  for (const p of ['Violette', 'Véronique', 'Monique', 'Dominique', 'Hercule', 'Calcul', 'Habite', 'Fichier', 'Essex', 'Cap Dorian', 'Léo', 'Arthur', 'Mort-Subite', 'Canal', 'Animal', 'Couleur', 'Dickens', 'Cumin', 'Sucette', 'Tuerie', 'Dominique', 'Habite', 'Nazim', 'Nazir', 'Harshit', 'Niger', 'Montenegro', 'Adolfo', 'Cornichon', 'Léa K', 'Ana L', 'Ana Zia', 'Ta Pete', 'Cône', 'Succès', 'Pise', 'Fagot', 'Maçonnerie', 'Sauvagin', 'Bitche', 'Therapist', 'Zoé 2014 88', 'Łukasz', 'Søren', 'Fuchsia', 'Confucius', 'Fuchs', 'Sıla', 'Kıvanç', 'Kɔfi', 'Zoé 1985', 'Léo 2014', 'Mathis 99', 'Lola 1', 'Elisabeth', 'Camille']) {
    assert.equal(verifierPseudo(p), null, p);
  }
});

test('mots interdits et contournements refusés', () => {
  for (const p of ['merde', 'm3rd3', 'fvck', 'sh1t', 'n1que', 'puuute', 'p u t e', 'PUTAIN', 'pd', 'ＰＵＴＥ', 'pédé lol', 'ntm', 'Hitler', 'tr0is nazi', 'аrthur' /* « а » cyrillique */,
    'putes', 'culs', 'bites', 'niquetamere', 'pu te', 'suce ma bite', 'salopard', 'negre', 'violeur', 'kys', 'cocaine', 'sale juif', '1488', 'couilles', 'siegheil',
    'n i g g e r', 'c o n n a r d', 'pute1', 'pute2010', 'p ut e', 'salePute', 'ᴘᴜᴛᴇ', 'tue toi', 'creve', '14 88', 'pétasse', 'batard', 'enkulé', 'Kevin KKK', 'pute①', 'pute１', 'ｐｕｔｅ１', 'ni99er', 'hit1er', 'sa1ope', '8ordel', '14  88', '14 - 88', '1 4 8 8', 'tamerelapute', 'labite', 'niktamere', 'p-tain', 'pvtain', 'vagina']) {
    assert.notEqual(verifierPseudo(p), null, p);
  }
});

test('pseudo décomposé (NFD) accepté', () => {
  assert.equal(verifierPseudo('Hérisson'.normalize('NFD')), null);
});

test('longueur et caractères', () => {
  assert.notEqual(verifierPseudo('a'), null);
  assert.notEqual(verifierPseudo('x'.repeat(21)), null);
  assert.notEqual(verifierPseudo('<b>gras</b>'), null);
});
