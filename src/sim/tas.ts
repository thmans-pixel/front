// Tas binaire minimum (clé réelle, valeur entière) sur tableaux typés :
// sert de file d'échéances au front d'une attaque.

export class Tas {
  taille = 0;
  private cles: Float64Array;
  private vals: Uint32Array;

  constructor(capacite = 64) {
    this.cles = new Float64Array(capacite);
    this.vals = new Uint32Array(capacite);
  }

  empiler(cle: number, val: number): void {
    if (this.taille === this.cles.length) {
      const c = new Float64Array(this.taille * 2);
      c.set(this.cles);
      this.cles = c;
      const v = new Uint32Array(this.taille * 2);
      v.set(this.vals);
      this.vals = v;
    }
    let i = this.taille++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cles[p] <= cle) break;
      this.cles[i] = this.cles[p];
      this.vals[i] = this.vals[p];
      i = p;
    }
    this.cles[i] = cle;
    this.vals[i] = val;
  }

  /** Plus petite clé, ou Infinity si vide. */
  cleMin(): number {
    return this.taille === 0 ? Infinity : this.cles[0];
  }

  valMin(): number {
    return this.vals[0];
  }

  depiler(): number {
    const v = this.vals[0];
    const cle = this.cles[--this.taille];
    const val = this.vals[this.taille];
    let i = 0;
    const n = this.taille;
    for (;;) {
      let f = 2 * i + 1;
      if (f >= n) break;
      if (f + 1 < n && this.cles[f + 1] < this.cles[f]) f++;
      if (this.cles[f] >= cle) break;
      this.cles[i] = this.cles[f];
      this.vals[i] = this.vals[f];
      i = f;
    }
    if (n > 0) {
      this.cles[i] = cle;
      this.vals[i] = val;
    }
    return v;
  }

  vider(): void {
    this.taille = 0;
  }
}
