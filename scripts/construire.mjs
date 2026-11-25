// Construction du site statique dans dist/ (esbuild) ; --serve pour le développement.
import { build, context } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const serve = process.argv.includes('--serve');
const regenerer = process.argv.includes('--cartes');
const communs = { bundle: true, format: 'iife', target: 'es2022', sourcemap: true, logLevel: 'info' };
const entrees = [
  { entryPoints: ['src/client/main.ts'], outfile: 'dist/main.js', ...communs },
  { entryPoints: ['src/worker/sim.worker.ts'], outfile: 'dist/sim.worker.js', ...communs },
];

if (!serve) rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });

// Les cartes ne sont pas versionnées : on les génère (déterministe) si elles manquent.
if (regenerer || !existsSync('dist/cartes/index.json')) {
  const r = spawnSync(process.execPath, ['outils/generer-carte.ts', '--tout', '--dossier', 'dist/cartes'], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (serve) {
  const ctxs = await Promise.all(entrees.map((e) => context(e)));
  await Promise.all(ctxs.map((c) => c.watch()));
  const { host, port } = await ctxs[0].serve({ servedir: 'dist', port: 8080 });
  console.log(`Jeu sur http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
} else {
  await Promise.all(entrees.map((e) => build(e)));
}
