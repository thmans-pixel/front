// Noms des tribus (spec 002 § 7.1). 🔒 liste à relire par gardien-enfants :
// noms d'animaux et de plantes, au masculin pluriel, aucun nom de personne.

const NOMS = [
  'Renards', 'Loups', 'Hiboux', 'Saules', 'Chênes', 'Lynx', 'Castors', 'Hérissons',
  'Écureuils', 'Faucons', 'Cerfs', 'Ours', 'Hérons', 'Aigles', 'Bisons', 'Lièvres',
  'Pins', 'Érables', 'Bouleaux', 'Sapins', 'Frênes', 'Peupliers', 'Tilleuls', 'Cèdres',
  'Blaireaux', 'Chamois', 'Dauphins', 'Pandas', 'Koalas', 'Lamas', 'Morses', 'Pingouins',
  'Corbeaux', 'Moineaux', 'Rossignols', 'Geais', 'Cygnes', 'Bambous', 'Roseaux', 'Nénuphars',
];
const ADJECTIFS = [
  'Bleus', 'Verts', 'Gris', 'Violets', 'Orangés', 'Cuivrés', 'Dorés', 'Argentés',
  'Rapides', 'Calmes', 'Joyeux', 'Braves',
];

/** Nom unique pour les 480 premières tribus, puis numéroté. */
export function nomTribu(indice: number): string {
  const total = NOMS.length * ADJECTIFS.length;
  const n = indice % total;
  const adj = (n + Math.floor(n / NOMS.length)) % ADJECTIFS.length; // 480 couples tous différents
  const base = `Tribu des ${NOMS[n % NOMS.length]} ${ADJECTIFS[adj]}`;
  return indice < total ? base : `${base} ${Math.floor(indice / total) + 1}`;
}
