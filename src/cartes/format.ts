// Format de carte `.fmap` (spec 002 § 4).
// Octet de terrain : bit 7 = terre ; bits 0-2 = type.

export const TERRE = 0x80;
export const MASQUE_TYPE = 0x07;
export const EAU = 0;
export const PLAINE = 1;
export const HAUTEURS = 2;
export const MONTAGNE = 3;
export const INFRANCHISSABLE = 4;

export const VERSION_FORMAT = 1;
const SIGNATURE = [0x46, 0x4d, 0x41, 0x50]; // « FMAP »

export interface Carte {
  nom: string;
  description: string;
  largeur: number;
  hauteur: number;
  /** Nombre de tuiles de terre (bit 7), infranchissables comprises. */
  terres: number;
  /** largeur × hauteur octets. */
  terrain: Uint8Array;
}

export function compterTerres(terrain: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < terrain.length; i++) if (terrain[i] & TERRE) n++;
  return n;
}

export function encoderCarte(c: Carte): Uint8Array {
  if (c.terrain.length !== c.largeur * c.hauteur) throw new Error('Carte : taille du terrain incohérente');
  const te = new TextEncoder();
  const nom = te.encode(c.nom);
  const desc = te.encode(c.description);
  const entete = 20 + nom.length + 2 + desc.length;
  const out = new Uint8Array(entete + c.terrain.length);
  const dv = new DataView(out.buffer);
  out.set(SIGNATURE, 0);
  dv.setUint16(4, VERSION_FORMAT);
  dv.setUint32(6, c.largeur);
  dv.setUint32(10, c.hauteur);
  dv.setUint32(14, c.terres);
  dv.setUint16(18, nom.length);
  out.set(nom, 20);
  dv.setUint16(20 + nom.length, desc.length);
  out.set(desc, 22 + nom.length);
  out.set(c.terrain, entete);
  return out;
}

export function decoderCarte(buf: Uint8Array): Carte {
  if (buf.length < 22) throw new Error('Carte : fichier trop court');
  for (let i = 0; i < 4; i++) if (buf[i] !== SIGNATURE[i]) throw new Error("Carte : ce n'est pas un fichier de carte");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const version = dv.getUint16(4);
  if (version !== VERSION_FORMAT) throw new Error(`Carte : version ${version} non gérée`);
  const largeur = dv.getUint32(6);
  const hauteur = dv.getUint32(10);
  const terres = dv.getUint32(14);
  const ln = dv.getUint16(18);
  const td = new TextDecoder();
  const nom = td.decode(buf.subarray(20, 20 + ln));
  const ld = dv.getUint16(20 + ln);
  const description = td.decode(buf.subarray(22 + ln, 22 + ln + ld));
  const debut = 22 + ln + ld;
  if (buf.length !== debut + largeur * hauteur) throw new Error('Carte : taille du terrain incohérente');
  const terrain = buf.slice(debut);
  if (compterTerres(terrain) !== terres) throw new Error('Carte : nombre de tuiles de terre incohérent');
  return { nom, description, largeur, hauteur, terres, terrain };
}

async function flux(donnees: Uint8Array, transfo: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const source = new Blob([donnees as BlobPart]).stream().pipeThrough(transfo as unknown as ReadableWritablePair);
  return new Uint8Array(await new Response(source).arrayBuffer());
}

export function compresser(donnees: Uint8Array): Promise<Uint8Array> {
  return flux(donnees, new CompressionStream('gzip'));
}

export function decompresser(donnees: Uint8Array): Promise<Uint8Array> {
  return flux(donnees, new DecompressionStream('gzip'));
}

export async function ecrireFmap(c: Carte): Promise<Uint8Array> {
  return compresser(encoderCarte(c));
}

export async function lireFmap(donnees: Uint8Array): Promise<Carte> {
  return decoderCarte(await decompresser(donnees));
}
