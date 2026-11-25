// Pseudos 🔒 (spec 002 § 7.1) : stockés seulement dans le navigateur.
// Listes à relire par l'agent gardien-enfants.

const ADJECTIFS = ['Joyeux', 'Rapide', 'Brave', 'Malin', 'Calme', 'Curieux', 'Doux', 'Fier', 'Agile', 'Sage', 'Espiègle', 'Rusé'];
const ANIMAUX = ['Renard', 'Loup', 'Hibou', 'Lynx', 'Castor', 'Hérisson', 'Faucon', 'Panda', 'Dauphin', 'Pingouin', 'Koala', 'Lama'];

/** Mots refusés s'ils apparaissent n'importe où, après aplatissement des lettres doubles (mots longs, sans ambiguïté). */
const INTERDITS_PARTOUT = [
  'putain', 'salope', 'salaud', 'encul', 'enkul', 'ankul', 'ancul', 'connard', 'connasse', 'merde', 'merdeux', 'hitler',
  'pedophile', 'pedale', 'bougnoul', 'youpin', 'whore', 'pussy', 'jihad', 'daesh', 'daech', 'gestapo', 'shoah', 'branle',
  'sodomie', 'bordel', 'suicid', 'fuck', 'fvck', 'phuck', 'fuxk', 'shithead', 'bullshit', 'chinetoque', 'salopard',
  'tarlouze', 'couille', 'penis', 'hentai', 'bamboula', 'chintok', 'chingchong', 'mongolien', 'siegheil', 'kuklux',
  'salejuif', 'salearabe', 'salenoir', 'violeur', 'killyourself', 'terroriste', 'cocaine', 'niquetam', 'sucemoi',
  'sucemabite', 'sucemaqueue', 'tuetoi', 'petasse', 'poufiasse', 'asshole', 'nazisme', 'pornhub', 'salepute', 'filsdepute',
];

/** Mots refusés tels quels, sans aplatissement : le mot aplati serait un nom propre (« Niger », « Fagot »). */
const INTERDITS_BRUT = ['nigger', 'nigga', 'niggr', 'faggot'];

/** Mots refusés seulement comme mots entiers (courts, ou communs dans d'autres mots : Monique, Violette…). */
const INTERDITS_MOT = [
  'pd', 'fdp', 'ntm', 'tg', 'ftg', 'pede', 'pedo', 'pute', 'puta', 'putin', 'ptain', 'gouine', 'nique', 'niquer', 'niquez', 'nik',
  'cul', 'bite', 'sex', 'sexe', 'viol', 'violer', 'chier', 'zob', 'teub', 'teube', 'chatte', 'cocu', 'bander', 'baiser',
  'mongol', 'triso', 'feuj', 'bicot', 'fag', 'slut', 'cock', 'rape', 'raped', 'rapist', 'retard', 'isis', 'con', 'cons',
  'sida', 'sucer', 'zizi', 'fck', 'fuk', 'ptn', 'dick', 'cum', 'anal', 'kys', 'tuer', 'drogue', 'creve', 'meurs', 'heil',
  'batard', 'bastard', 'nazi', 'shit', 'bitch', 'bitches', 'cunt', 'porn', 'porno', 'nichon', 'vagin', 'negre', 'negro',
  'adolf', 'tapette', 'connerie', 'sodomise',
];

/** Sous-ensemble des mots entiers qu'on cherche aussi quand ils sont coupés en 2 à 4 morceaux (« pu te »). */
const COUPABLES = new Set(['pute', 'putin', 'nique', 'niquer', 'gouine', 'chatte', 'salope', 'connard', 'merde', 'bite', 'zizi', 'vagin']);

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' };
const SPECIALES: Record<string, string> = { œ: 'oe', æ: 'ae', ß: 'ss', ø: 'o', ł: 'l', đ: 'd', ð: 'd', þ: 'th' };

const collapser = (m: string): string => m.replace(/(.)\1+/g, '$1');
const PARTOUT = INTERDITS_PARTOUT.map(collapser);
const MOTS = new Set(INTERDITS_MOT.map(collapser));
const COUPES = new Set([...COUPABLES].map(collapser));

/** Sans accents ni majuscules ; chiffres ramenés à des lettres. Renvoie null s'il reste un caractère exotique. */
function normaliser(s: string): string | null {
  const n = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[œæßøłđðþ]/g, (c) => SPECIALES[c]);
  if (/[^a-z0-9 -]/.test(n)) return null; // petites capitales, ı, ƒ… : refusés plutôt que supprimés en silence
  return n.replace(/[01345 7]/g, (c) => LEET[c] ?? c).replace(/[^a-z -]/g, '');
}

function interdit(m: string): boolean {
  return MOTS.has(m) || (m.length > 2 && /[sx]$/.test(m) && MOTS.has(m.slice(0, -1)));
}

/** Vrai si le texte (déjà validé : latin, chiffres, espaces, tirets) contient un mot interdit. */
function contientInterdit(s: string): boolean {
  const n = normaliser(s);
  if (n === null) return true;
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
  const colleBrut = mots.join('');
  if (INTERDITS_BRUT.some((m) => colleBrut.includes(m))) return true;
  const mc = mots.map(collapser);
  const colle = collapser(colleBrut);
  if (PARTOUT.some((m) => colle.includes(m))) return true;
  if (mc.some(interdit)) return true;
  // Mots coupés en 2 à 4 morceaux : « pu te », « p ut e ».
  for (let i = 0; i < mc.length; i++) {
    let j = mc[i];
    for (let k = i + 1; k < Math.min(mc.length, i + 4); k++) {
      j += mc[k];
      if (COUPES.has(collapser(j)) || (/s$/.test(j) && COUPES.has(collapser(j.slice(0, -1))))) return true;
    }
  }
  return false;
}

export function pseudoAleatoire(): string {
  const tirer = (l: string[]): string => l[Math.floor(Math.random() * l.length)];
  return `${tirer(ANIMAUX)} ${tirer(ADJECTIFS)}`;
}

export const LONGUEUR_MAX_PSEUDO = 20;

/** Renvoie un message d'erreur, ou null si le pseudo est accepté. */
export function verifierPseudo(p: string): string | null {
  const s = p.trim().normalize('NFC');
  if (s.length < 2 || s.length > LONGUEUR_MAX_PSEUDO) return `Le pseudo doit faire entre 2 et ${LONGUEUR_MAX_PSEUDO} caractères.`;
  if (!/^[\p{Script=Latin}\p{N} -]+$/u.test(s)) return 'Le pseudo ne peut contenir que des lettres (alphabet latin), des chiffres, des espaces et des tirets.';
  const minuscule = s.toLowerCase();
  const sansChiffresAuxBouts = s.normalize('NFKD').replace(/(^|[ -])[0-9]+/g, '$1').replace(/[0-9]+(?=[ -]|$)/g, '');
  if (
    /kkk/.test(minuscule) ||
    /(^|\D)14[ -]?88(\D|$)/.test(s) ||
    contientInterdit(s) ||
    contientInterdit(sansChiffresAuxBouts) // « pute2010 »
  ) {
    return "Ce pseudo n'est pas accepté. Choisis-en un autre.";
  }
  return null;
}
