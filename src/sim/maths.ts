// Fonctions mathématiques de la simulation, centralisées pour pouvoir les
// remplacer par des tables si deux moteurs JavaScript divergent (spec 002, R3).

export function puissance(x: number, y: number): number {
  return Math.pow(x, y);
}

export function exponentielle(x: number): number {
  return Math.exp(x);
}

export function borne(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x;
}
