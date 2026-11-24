// Pseudos 🔒 (spec 002 § 7.1) : stockés seulement dans le navigateur.
// Listes à relire par l'agent gardien-enfants.

const ADJECTIFS = ['Joyeux', 'Rapide', 'Brave', 'Malin', 'Calme', 'Curieux', 'Doux', 'Fier', 'Agile', 'Sage', 'Espiègle', 'Rusé'];
const ANIMAUX = ['Renard', 'Loup', 'Hibou', 'Lynx', 'Castor', 'Hérisson', 'Faucon', 'Panda', 'Dauphin', 'Pingouin', 'Koala', 'Lama'];

/** Mots refusés (comparaison sans accents, sans majuscules, lettres seules). */
const INTERDITS = [
  'merde', 'putain', 'pute', 'salope', 'connard', 'connasse', 'encule', 'nique', 'niquer', 'bite', 'couille',
  'foutre', 'batard', 'pd', 'tapette', 'nazi', 'hitler', 'sexe', 'sex', 'porn', 'cul', 'chier', 'fuck', 'shit',
  'bitch', 'dick', 'nigger', 'negre', 'viol', 'suicide',
];

function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}

export function pseudoAleatoire(): string {
  const tirer = (l: string[]): string => l[Math.floor(Math.random() * l.length)];
  return `${tirer(ANIMAUX)} ${tirer(ADJECTIFS)}`;
}

/** Renvoie un message d'erreur, ou null si le pseudo est accepté. */
export function verifierPseudo(p: string): string | null {
  const s = p.trim();
  if (s.length < 2 || s.length > 16) return 'Le pseudo doit faire entre 2 et 16 caractères.';
  if (!/^[\p{L}\p{N} -]+$/u.test(s)) return 'Le pseudo ne peut contenir que des lettres, des chiffres, des espaces et des tirets.';
  const n = normaliser(s);
  if (INTERDITS.some((m) => n.includes(m))) return 'Ce pseudo n\'est pas accepté. Choisis-en un autre.';
  return null;
}
