// Générateur pseudo-aléatoire à graine (sfc32). Toute l'aléa de la simulation
// passe par ici : jamais Math.random (déterminisme, spec 002 § 6.1).

export class Alea {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(graine: number) {
    // splitmix32 pour étaler la graine sur 4 mots
    let s = graine >>> 0;
    const suivant = (): number => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = suivant();
    this.b = suivant();
    this.c = suivant();
    this.d = suivant();
    for (let i = 0; i < 12; i++) this.uint32();
  }

  /** Entier 32 bits non signé. */
  uint32(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** Réel dans [0, 1). */
  reel(): number {
    return this.uint32() / 4294967296;
  }

  /** Entier dans [0, n). */
  entier(n: number): number {
    return Math.floor(this.reel() * n);
  }

  /** Entier dans [min, max] inclus. */
  entreBornes(min: number, max: number): number {
    return min + this.entier(max - min + 1);
  }
}

/** Hachage de deux entiers et d'une graine vers [0, 1) (bruit de la carte). */
export function hachage2(x: number, y: number, graine: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(graine | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
