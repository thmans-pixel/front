// Couleurs des joueurs : teinte par angle d'or, trois niveaux de luminosité
// pour rester distinguables (aide aux daltoniens, spec 002 § 7.3). Le joueur a
// toujours la même couleur vive.

export const COULEUR_MOI: [number, number, number] = [255, 214, 10];

function hslVersRvb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/** Table RGBA (4 octets par identifiant) pour `n` identifiants. */
export function construirePalette(n: number): Uint8Array {
  const out = new Uint8Array(Math.min(n, 65536) * 4);
  for (let id = 1; id < n && id < 65536; id++) {
    let rvb: [number, number, number];
    if (id === 1) rvb = COULEUR_MOI;
    else {
      let teinte = (id * 137.508) % 360;
      if (teinte > 38 && teinte < 70) teinte += 40; // pas de jaune : réservé au joueur
      const l = [0.42, 0.55, 0.34][id % 3];
      const s = [0.62, 0.5, 0.7][(id >> 2) % 3];
      rvb = hslVersRvb(teinte, s, l);
    }
    out[id * 4] = rvb[0];
    out[id * 4 + 1] = rvb[1];
    out[id * 4 + 2] = rvb[2];
    out[id * 4 + 3] = 255;
  }
  return out;
}
