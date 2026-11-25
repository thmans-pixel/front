// Pseudos 🔒 (spec 002 § 7.1) : stockés seulement dans le navigateur.
// Listes à relire par l'agent gardien-enfants.

const ADJECTIFS = ['Joyeux', 'Rapide', 'Brave', 'Malin', 'Calme', 'Curieux', 'Doux', 'Fier', 'Agile', 'Sage', 'Espiègle', 'Rusé'];
const ANIMAUX = ['Renard', 'Loup', 'Hibou', 'Lynx', 'Castor', 'Hérisson', 'Faucon', 'Panda', 'Dauphin', 'Pingouin', 'Koala', 'Lama'];

/** Mots refusés s'ils apparaissent n'importe où (mots longs, sans ambiguïté). */
const INTERDITS_PARTOUT = [
  'putain', 'salope', 'salaud', 'encul', 'connard', 'connasse', 'merde', 'merdeux', 'hitler', 'nazi', 'pedophile',
  'pedale', 'bougnoul', 'youpin', 'nigger', 'nigga', 'negro', 'faggot', 'whore', 'pussy', 'jihad',
  'daesh', 'gestapo', 'shoah', 'branle', 'nichon', 'sodomie', 'bordel', 'suicid', 'fuck', 'fvck', 'shit', 'bitch',
  'cunt', 'porn', 'chinetoque',
];

/** Mots refusés seulement comme mots entiers (courts, ou communs dans d'autres mots : Monique, Violette…). */
const INTERDITS_MOT = [
  'pd', 'fdp', 'ntm', 'tg', 'pede', 'pedo', 'pute', 'gouine', 'nique', 'niquer', 'nik', 'cul', 'bite', 'sex', 'sexe', 'viol',
  'chier', 'zob', 'teub', 'teube', 'chatte', 'cocu', 'bander', 'baiser', 'pisse', 'mongol', 'triso', 'feuj', 'bicot',
  'fag', 'slut', 'cock', 'rape', 'retard', 'isis', 'kkk', 'conne', 'con', 'cons', 'sida',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** Sans accents ni majuscules, chiffres/symboles ramenés à des lettres, lettres répétées réduites. */
function normaliser(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[01345 7@$]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z -]/g, '')
    .replace(/(.)\1+/g, '$1');
}

const collapser = (m: string): string => m.replace(/(.)\1+/g, '$1');
const PARTOUT = INTERDITS_PARTOUT.map(collapser);
const MOTS = new Set(INTERDITS_MOT.map(collapser));

export function pseudoAleatoire(): string {
  const tirer = (l: string[]): string => l[Math.floor(Math.random() * l.length)];
  return `${tirer(ANIMAUX)} ${tirer(ADJECTIFS)}`;
}

export const LONGUEUR_MAX_PSEUDO = 20;

/** Renvoie un message d'erreur, ou null si le pseudo est accepté. */
export function verifierPseudo(p: string): string | null {
  const s = p.trim();
  if (s.length < 2 || s.length > LONGUEUR_MAX_PSEUDO) return `Le pseudo doit faire entre 2 et ${LONGUEUR_MAX_PSEUDO} caractères.`;
  if (!/^[\p{Script=Latin}\p{N} -]+$/u.test(s)) return 'Le pseudo ne peut contenir que des lettres (alphabet latin), des chiffres, des espaces et des tirets.';
  const n = normaliser(s);
  const brut = n.split(/[ -]+/).filter(Boolean);
  // « p u t e » : les lettres isolées qui se suivent sont recollées en un mot.
  const mots: string[] = [];
  let enLettres = false; // le dernier mot est fait de lettres isolées recollées
  for (const m of brut) {
    if (m.length === 1 && enLettres) mots[mots.length - 1] += m;
    else {
      mots.push(m);
      enLettres = m.length === 1;
    }
  }
  const colle = mots.join('');
  if (mots.some((m) => MOTS.has(m)) || PARTOUT.some((m) => colle.includes(m))) {
    return "Ce pseudo n'est pas accepté. Choisis-en un autre.";
  }
  return null;
}
