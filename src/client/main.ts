// Client : accueil, entrées, interface et boucle d'affichage.
import { decoderCarte, lireFmap, type Carte } from '../cartes/format.ts';
import { nomTribu } from '../sim/noms.ts';
import type { EntreeCatalogue } from '../../outils/catalogue.ts';
import type { AttaqueVue, DepuisWorker, Stats, VersWorker } from '../worker/messages.ts';
import { construirePalette } from './palette.ts';
import { pseudoAleatoire, verifierPseudo } from './pseudo.ts';
import { Rendu } from './rendu.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

// --- Accueil ---------------------------------------------------------------

let catalogue: EntreeCatalogue[] = [];
let choisie: EntreeCatalogue | null = null;

function lire(cle: string): string | null {
  try { return localStorage.getItem(cle); } catch { return null; }
}
function ecrire(cle: string, v: string): void {
  try { localStorage.setItem(cle, v); } catch { /* stockage indisponible : tant pis */ }
}

function fmtTuiles(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} M` : `${Math.round(n / 1000)} k`;
}

function choisirCarte(e: EntreeCatalogue): void {
  choisie = e;
  ecrire('carte', e.id);
  for (const b of document.querySelectorAll<HTMLElement>('.fiche')) b.classList.toggle('choisie', b.dataset.id === e.id);
  const max = Math.max(400, Math.floor(e.terres / 1000));
  const curseur = $<HTMLInputElement>('tribus');
  const nombre = $<HTMLInputElement>('tribus-nombre');
  curseur.max = String(max);
  nombre.max = String(max);
  fixerTribus(Math.min(e.tribusConseillees, max));
  $('infos-carte').textContent =
    `${e.largeur} × ${e.hauteur} tuiles, ${e.pourcentTerres.toString().replace('.', ',')} % de terres` +
    (e.pcConseille ? ' — grande carte : un PC est conseillé.' : '.');
  ($('jouer') as HTMLButtonElement).disabled = false;
}

function fixerTribus(n: number): void {
  $<HTMLInputElement>('tribus').value = String(n);
  $<HTMLInputElement>('tribus-nombre').value = String(n);
  $('tribus-valeur').textContent = String(n);
}

async function initAccueil(): Promise<void> {
  const champ = $<HTMLInputElement>('pseudo');
  champ.value = lire('pseudo') ?? pseudoAleatoire();
  $('pseudo-alea').onclick = () => { champ.value = pseudoAleatoire(); };
  $<HTMLInputElement>('tribus').oninput = (e) => fixerTribus(Number((e.target as HTMLInputElement).value));
  $<HTMLInputElement>('tribus-nombre').onchange = (e) => {
    const el = e.target as HTMLInputElement;
    fixerTribus(Math.max(0, Math.min(Number(el.max) || 400, Math.floor(Number(el.value) || 0))));
  };
  $('jouer').onclick = () => { void lancer(); };
  try {
    const rep = await fetch('cartes/index.json');
    catalogue = (await rep.json()) as EntreeCatalogue[];
  } catch {
    $('cartes').textContent = 'Impossible de charger la liste des cartes.';
    return;
  }
  const zone = $('cartes');
  zone.textContent = '';
  for (const e of catalogue) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fiche';
    b.dataset.id = e.id;
    const nom = document.createElement('b');
    nom.textContent = e.nom;
    const l1 = document.createElement('small');
    l1.textContent = `${e.largeur} × ${e.hauteur} (${fmtTuiles(e.largeur * e.hauteur)} tuiles)`;
    const l2 = document.createElement('small');
    l2.textContent = `${e.pourcentTerres.toString().replace('.', ',')} % de terres · ${e.tribusConseillees} tribus conseillées`;
    b.append(nom, l1, l2);
    if (e.pcConseille) {
      const pc = document.createElement('small');
      pc.className = 'pc';
      pc.textContent = '💻 PC conseillé';
      b.append(pc);
    }
    b.onclick = () => choisirCarte(e);
    zone.append(b);
  }
  const memo = lire('carte');
  choisirCarte(catalogue.find((e) => e.id === memo) ?? catalogue.find((e) => e.id === 'terra-moyenne') ?? catalogue[0]);
  // Démarrage direct pour le développement et les captures : ?auto=<carte>&tribus=<n>
  const q = new URLSearchParams(location.search);
  const auto = q.get('auto');
  if (auto) {
    const e = catalogue.find((c) => c.id === auto);
    if (e) {
      choisirCarte(e);
      if (q.has('tribus')) fixerTribus(Number(q.get('tribus')));
      void lancer();
    }
  }
}

// --- Partie ----------------------------------------------------------------

let rendu: Rendu | null = null;
let worker: Worker | null = null;
let pseudo = '';
let tuileDepart = -1;
let dernieresStats: Stats | null = null;
let aCentre = false;
let finAffichee = false;
let vitesseChoisie = 1;
let enPause = false;
let montrerTout = false;
let historiqueOr: Array<[number, number]> = [];
let ratio = 20;
let survolEcran: { x: number; y: number } | null = null;
let survolSale = false;
let derniereAttaquesJson = '';
let demandees = 0;

function envoyer(m: VersWorker): void {
  worker?.postMessage(m);
}

function afficherErreur(msg: string): void {
  const el = $('erreur-globale');
  el.textContent = msg;
  el.hidden = false;
}

function nomJoueur(id: number): string {
  return id === 0 ? 'Terre libre' : id === 1 ? pseudo : nomTribu(id - 2);
}

async function lancer(): Promise<void> {
  if (!choisie) return;
  const err = verifierPseudo($<HTMLInputElement>('pseudo').value);
  const zoneErr = $('pseudo-erreur');
  zoneErr.hidden = !err;
  zoneErr.textContent = err ?? '';
  if (err) return;
  pseudo = $<HTMLInputElement>('pseudo').value.trim();
  ecrire('pseudo', pseudo);
  $('erreur-globale').hidden = true;
  ($('jouer') as HTMLButtonElement).disabled = true;
  const info = $('chargement');
  info.hidden = false;
  info.textContent = 'Chargement de la carte…';
  try {
    const rep = await fetch(`cartes/${choisie.id}.fmap`);
    if (!rep.ok) throw new Error(`Carte introuvable (${rep.status})`);
    const brut = new Uint8Array(await rep.arrayBuffer());
    const carte: Carte = brut[0] === 0x1f && brut[1] === 0x8b ? await lireFmap(brut) : decoderCarte(brut);
    info.textContent = 'Préparation de la partie…';
    demarrer(carte, Number($<HTMLInputElement>('tribus-nombre').value) || 0, Number($<HTMLInputElement>('graine').value));
  } catch (e) {
    afficherErreur(e instanceof Error ? e.message : String(e));
    ($('jouer') as HTMLButtonElement).disabled = false;
    info.hidden = true;
  }
}

function nouveauCanvas(): HTMLCanvasElement {
  const ancien = $('canvas');
  const neuf = document.createElement('canvas');
  neuf.id = 'canvas';
  ancien.replaceWith(neuf);
  return neuf as HTMLCanvasElement;
}

function demarrer(carte: Carte, tribus: number, graineSaisie: number): void {
  $('accueil').hidden = true;
  $('jeu').hidden = false;
  const canvas = nouveauCanvas();
  try {
    rendu = new Rendu(canvas, carte.largeur, carte.hauteur, carte.terrain);
  } catch (e) {
    quitter();
    afficherErreur(e instanceof Error ? e.message : String(e));
    return;
  }
  (window as unknown as Record<string, unknown>).__rendu = rendu; // aide au débogage
  rendu.redimensionner();
  rendu.cadrer();
  branchesEntrees(canvas);
  tuileDepart = -1;
  dernieresStats = null;
  aCentre = false;
  finAffichee = false;
  enPause = false;
  vitesseChoisie = 1;
  historiqueOr = [];
  derniereAttaquesJson = '';
  $('fin').hidden = true;
  $('btn-pause').textContent = '⏸';
  $('btn-vitesse').textContent = '×1';
  ($('repere') as HTMLElement).hidden = true;
  $('bandeau-phase').hidden = false;
  $('bandeau-phase').textContent = 'Préparation…';

  worker = new Worker('sim.worker.js');
  worker.onmessage = (e: MessageEvent<DepuisWorker>) => surMessage(e.data);
  worker.onerror = (e) => afficherErreurJeu(e.message);
  demandees = tribus;
  const graine = Number.isFinite(graineSaisie) && graineSaisie !== 0 ? Math.floor(graineSaisie) : Math.floor(Math.random() * 2 ** 31);
  envoyer({ type: 'init', largeur: carte.largeur, hauteur: carte.hauteur, terrain: carte.terrain, nom: carte.nom, config: { graine, tribus, pseudo } });
}

function afficherErreurJeu(msg: string): void {
  quitter();
  afficherErreur(`Erreur dans la simulation : ${msg}`);
}

function surMessage(m: DepuisWorker): void {
  if (m.type === 'erreur') return afficherErreurJeu(m.message);
  if (!rendu) return;
  if (m.type === 'pret') {
    rendu.definirPalette(construirePalette(m.tribusPlacees + 2));
    $('chargement').hidden = true;
    ($('jouer') as HTMLButtonElement).disabled = false;
    if (m.tribusPlacees < demandees) toast(`${m.tribusPlacees} tribus placées sur ${demandees} demandées : pas assez de place sur la carte.`);
    else if (demandees > 0) toast(`${m.tribusPlacees} tribus en jeu.`);
    return;
  }
  rendu.appliquer(m.modifs);
  for (const r of m.refus) toast(r === 'immunite' ? "Tu es encore protégé : l'attaque est impossible pendant l'immunité." : r === 'troupes' ? "Pas assez de troupes pour attaquer." : "Cette cible ne touche pas ton territoire.");
  if (m.stats) majInterface(m.stats);
}

// --- Interface -------------------------------------------------------------

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')} M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(0)} k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace('.', ',')} k`;
  return String(Math.floor(n));
}

let toastTimer = 0;
function toast(msg: string): void {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.hidden = true; }, 2800);
}

function majInterface(s: Stats): void {
  dernieresStats = s;
  // Bandeau
  $('or').textContent = fmt(s.moi.or);
  historiqueOr.push([s.tick, s.moi.or]);
  while (historiqueOr.length > 2 && s.tick - historiqueOr[0][0] > 50) historiqueOr.shift();
  const [t0, o0] = historiqueOr[0];
  $('or-s').textContent = s.tick > t0 ? `(+${fmt(((s.moi.or - o0) / (s.tick - t0)) * 10)}/s)` : '';
  const max = Math.max(1, s.moi.max);
  const dispo = Math.min(100, (100 * s.moi.troupes) / max);
  const eng = Math.min(100 - dispo, (100 * s.moi.engagees) / max);
  ($('barre-dispo') as HTMLElement).style.width = `${dispo}%`;
  ($('barre-engagees') as HTMLElement).style.left = `${dispo}%`;
  ($('barre-engagees') as HTMLElement).style.width = `${eng}%`;
  $('barre-dispo').parentElement!.classList.toggle('alerte', dispo >= 80);
  $('troupes-texte').textContent = `${fmt(s.moi.troupes)} / ${fmt(s.moi.max)}`;
  const jeuTicks = Math.max(0, s.tick - 100);
  const sec = Math.floor(jeuTicks / 10);
  $('chrono').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  // Bandeau de phase
  const ph = $('bandeau-phase');
  if (s.phase === 'apparition') {
    ph.hidden = false;
    ph.textContent = `Touche la terre pour choisir ton départ — ${Math.ceil(s.apparitionRestante / 10)} s` + (tuileDepart < 0 ? ' (sans choix, tu seras placé au hasard)' : '');
  } else if (s.immuniteRestante > 0 && s.moi.vivant) {
    ph.hidden = false;
    ph.textContent = `🛡 Protégé encore ${Math.ceil(s.immuniteRestante / 10)} s`;
  } else ph.hidden = true;
  if (s.phase === 'jeu') ($('repere') as HTMLElement).hidden = true;

  if (s.phase === 'jeu' && !aCentre && rendu) {
    aCentre = true;
    centrerSurMoi(Math.max(rendu.zoomMin, 5));
  }

  // Attaques en cours
  const json = JSON.stringify(s.attaques);
  if (json !== derniereAttaquesJson) {
    derniereAttaquesJson = json;
    const zone = $('attaques');
    zone.textContent = '';
    for (const a of s.attaques) zone.append(ligneAttaque(a));
  }

  // Classement
  const liste = $('classement-liste');
  liste.textContent = '';
  const lignes = montrerTout ? s.classement : s.classement.slice(0, 5);
  const ids = new Set(lignes.map((l) => l.id));
  const rangDe = (id: number): number => s.classement.findIndex((l) => l.id === id) + 1;
  const affichees = [...lignes];
  const moi = s.classement.find((l) => l.humain);
  if (moi && !ids.has(moi.id)) affichees.push(moi);
  for (const l of affichees) {
    const li = document.createElement('li');
    if (l.humain) li.className = 'moi';
    const r = document.createElement('span');
    r.textContent = String(l.humain && s.rang ? s.rang : rangDe(l.id));
    const n = document.createElement('span');
    n.className = 'nom';
    n.textContent = (rangDe(l.id) === 1 ? '👑 ' : '') + l.nom;
    const p = document.createElement('span');
    p.textContent = `${l.pct < 10 ? l.pct.toFixed(1).replace('.', ',') : Math.round(l.pct)} %`;
    li.append(r, n, p);
    li.title = `${l.nom} — ${fmt(l.troupes)} troupes, ${fmt(l.or)} or`;
    liste.append(li);
  }

  if (s.fin && !finAffichee) afficherFin(s);
}

function ligneAttaque(a: AttaqueVue): HTMLElement {
  const d = document.createElement('div');
  d.className = 'attaque';
  const t = document.createElement('span');
  t.textContent = `→ ${a.nomCible} ${fmt(a.troupes)}`;
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = '✕';
  b.title = 'Annuler (25 % de pertes)';
  b.onclick = () => envoyer({ type: 'annuler', id: a.id });
  d.append(t, b);
  return d;
}

function afficherFin(s: Stats): void {
  finAffichee = true;
  const victoire = s.fin!.resultat === 'victoire';
  $('fin-titre').textContent = victoire ? '🏆 Victoire !' : 'Défaite';
  $('fin-texte').textContent = victoire
    ? 'Tu possèdes 80 % des terres.'
    : s.moi.vivant ? 'Une tribu a conquis 80 % des terres.' : "Tu n'as plus aucune tuile.";
  const ol = $('fin-classement');
  ol.textContent = '';
  s.classement.slice(0, 5).forEach((l, i) => {
    const li = document.createElement('li');
    if (l.humain) li.className = 'moi';
    const a = document.createElement('span'); a.textContent = String(i + 1);
    const b = document.createElement('span'); b.className = 'nom'; b.textContent = l.nom;
    const c = document.createElement('span'); c.textContent = `${Math.round(l.pct)} %`;
    li.append(a, b, c);
    ol.append(li);
  });
  const sec = Math.floor(Math.max(0, s.fin!.tick - 100) / 10);
  $('fin-duree').textContent = `Durée de la partie : ${Math.floor(sec / 60)} min ${sec % 60} s`;
  $('fin').hidden = false;
}

function quitter(): void {
  worker?.terminate();
  worker = null;
  rendu = null;
  $('jeu').hidden = true;
  $('accueil').hidden = false;
  ($('jouer') as HTMLButtonElement).disabled = false;
  $('chargement').hidden = true;
}

// --- Caméra et entrées -----------------------------------------------------

function centrerSurMoi(zoom?: number): void {
  if (!rendu) return;
  const W = rendu.largeur;
  const p = rendu.proprio;
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] === 1) { const x = i % W; sx += x; sy += (i - x) / W; n++; }
  }
  if (n === 0) return;
  rendu.camera.x = sx / n;
  rendu.camera.y = sy / n;
  if (zoom) rendu.camera.zoom = zoom;
  rendu.limiter();
}

function tuileSousPointeur(px: number, py: number): number {
  if (!rendu) return -1;
  const t = rendu.ecranVersTuile(px, py);
  const x = Math.floor(t.x);
  const y = Math.floor(t.y);
  if (x < 0 || y < 0 || x >= rendu.largeur || y >= rendu.hauteur) return -1;
  return y * rendu.largeur + x;
}

function cliquer(px: number, py: number): void {
  if (!rendu || !dernieresStats) return;
  const t = tuileSousPointeur(px, py);
  if (t < 0 || !(rendu.terrain[t] & 0x80) || (rendu.terrain[t] & 7) === 4) return;
  if (dernieresStats.phase === 'apparition') {
    if (rendu.proprio[t] !== 0) return toast('Cette terre est déjà prise.');
    tuileDepart = t;
    envoyer({ type: 'apparaitre', tuile: t });
    return;
  }
  const o = rendu.proprio[t];
  if (o === 1 || !dernieresStats.moi.vivant) return;
  envoyer({ type: 'attaquer', cible: o, ratio });
}

const touches = new Set<string>();
let branche = false;

function branchesEntrees(canvas: HTMLCanvasElement): void {
  const pointeurs = new Map<number, { x: number; y: number }>();
  let depart: { x: number; y: number } | null = null;
  let bouge = false;
  let distPincement = 0;
  const pos = (e: PointerEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointeurs.set(e.pointerId, pos(e));
    if (pointeurs.size === 1) { depart = pos(e); bouge = false; }
    else { bouge = true; const [a, b] = [...pointeurs.values()]; distPincement = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pos(e);
    if (e.pointerType === 'mouse') { survolEcran = p; survolSale = true; }
    const avant = pointeurs.get(e.pointerId);
    if (!avant || !rendu) return;
    if (pointeurs.size === 1) {
      if (depart && !bouge && Math.hypot(p.x - depart.x, p.y - depart.y) > 6) bouge = true;
      if (bouge) {
        rendu.camera.x -= (p.x - avant.x) / rendu.camera.zoom;
        rendu.camera.y -= (p.y - avant.y) / rendu.camera.zoom;
        rendu.limiter();
      }
      pointeurs.set(e.pointerId, p);
    } else if (pointeurs.size === 2) {
      const ancien = [...pointeurs.values()];
      const ancienCentre = { x: (ancien[0].x + ancien[1].x) / 2, y: (ancien[0].y + ancien[1].y) / 2 };
      pointeurs.set(e.pointerId, p);
      const [a, b] = [...pointeurs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      rendu.camera.x -= (centre.x - ancienCentre.x) / rendu.camera.zoom;
      rendu.camera.y -= (centre.y - ancienCentre.y) / rendu.camera.zoom;
      if (distPincement > 0 && d > 0) rendu.zoomer(d / distPincement, centre.x, centre.y);
      distPincement = d;
      rendu.limiter();
    }
  });
  const fin = (e: PointerEvent): void => {
    const p = pointeurs.get(e.pointerId);
    pointeurs.delete(e.pointerId);
    if (p && e.type === 'pointerup' && !bouge && pointeurs.size === 0 && e.button !== 1) cliquer(p.x, p.y);
    if (pointeurs.size === 0) depart = null;
  };
  canvas.addEventListener('pointerup', fin);
  canvas.addEventListener('pointercancel', fin);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = pos(e as unknown as PointerEvent);
    rendu?.zoomer(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false });

  if (branche) return;
  branche = true;
  window.addEventListener('resize', () => rendu?.redimensionner());
  window.addEventListener('keydown', (e) => {
    if (!rendu || (e.target instanceof HTMLInputElement && e.target.type !== 'range')) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); basculerVue(); }
    else if (k === 'c') centrerSurMoi();
    else if (k === 't') fixerRatio(ratio - 10);
    else if (k === 'y') fixerRatio(ratio + 10);
    else if (k === '+' || k === '=' || k === 'e') rendu.zoomer(1.25, rendu.cssCentre().x, rendu.cssCentre().y);
    else if (k === '-' || k === 'r') rendu.zoomer(0.8, rendu.cssCentre().x, rendu.cssCentre().y);
    else touches.add(k);
  });
  window.addEventListener('blur', () => touches.clear());
  window.addEventListener('keyup', (e) => touches.delete(e.key.toLowerCase()));
}

function fixerRatio(v: number): void {
  ratio = Math.max(1, Math.min(100, Math.round(v)));
  $<HTMLInputElement>('ratio').value = String(ratio);
  $('ratio-valeur').textContent = String(ratio);
}

function basculerVue(): void {
  if (rendu) rendu.vue = rendu.vue === 'pays' ? 'terrain' : 'pays';
}

function brancherBoutons(): void {
  $<HTMLInputElement>('ratio').oninput = (e) => fixerRatio(Number((e.target as HTMLInputElement).value));
  $('btn-vue').onclick = basculerVue;
  $('btn-centrer').onclick = () => centrerSurMoi();
  $('btn-plein').onclick = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); };
  $('btn-quitter').onclick = () => { if (confirm('Quitter la partie ?')) quitter(); };
  $('btn-pause').onclick = () => {
    enPause = !enPause;
    $('btn-pause').textContent = enPause ? '▶' : '⏸';
    envoyer({ type: 'vitesse', valeur: enPause ? 0 : vitesseChoisie });
  };
  $('btn-vitesse').onclick = () => {
    const cycle = [1, 2, 4, 8, 0.5];
    vitesseChoisie = cycle[(cycle.indexOf(vitesseChoisie) + 1) % cycle.length];
    $('btn-vitesse').textContent = `×${vitesseChoisie}`;
    if (!enPause) envoyer({ type: 'vitesse', valeur: vitesseChoisie });
  };
  $('btn-tout').onclick = () => { montrerTout = !montrerTout; if (dernieresStats) majInterface(dernieresStats); };
  $('fin-suite').onclick = () => { $('fin').hidden = true; };
  $('fin-quitter').onclick = quitter;
}

let dernierImage = 0;
function boucleAffichage(t: number): void {
  requestAnimationFrame(boucleAffichage);
  if (!rendu) return;
  const dt = Math.min(0.1, (t - dernierImage) / 1000);
  dernierImage = t;
  if (touches.size) {
    const v = (900 / rendu.camera.zoom) * dt;
    if (touches.has('arrowleft') || touches.has('q') || touches.has('a')) rendu.camera.x -= v;
    if (touches.has('arrowright') || touches.has('d')) rendu.camera.x += v;
    if (touches.has('arrowup') || touches.has('z') || touches.has('w')) rendu.camera.y -= v;
    if (touches.has('arrowdown') || touches.has('s')) rendu.camera.y += v;
    rendu.limiter();
  }
  rendu.dessiner();
  // Repère du point de départ choisi
  const rep = $('repere') as HTMLElement;
  if (tuileDepart >= 0 && dernieresStats?.phase === 'apparition') {
    const x = tuileDepart % rendu.largeur;
    const p = rendu.tuileVersEcran(x + 0.5, (tuileDepart - x) / rendu.largeur + 0.5);
    rep.hidden = false;
    rep.style.left = `${p.x}px`;
    rep.style.top = `${p.y}px`;
  }
  if (survolSale && survolEcran) {
    survolSale = false;
    const t2 = tuileSousPointeur(survolEcran.x, survolEcran.y);
    if (t2 >= 0) {
      const v = rendu.terrain[t2];
      const type = v & 0x80 ? ['', 'Plaine', 'Hauteurs', 'Montagne', 'Terre infranchissable'][v & 7] ?? 'Terre' : 'Eau';
      $('survol').textContent = `${type}${v & 0x80 ? ' — ' + nomJoueur(rendu.proprio[t2]) : ''}`;
    }
  }
}

brancherBoutons();
requestAnimationFrame(boucleAffichage);
void initAccueil();
