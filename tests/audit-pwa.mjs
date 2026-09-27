/**
 * Audit PWA. Vérifie que GéoLoc est réellement installable et réellement
 * utilisable sans réseau — les deux promesses que fait une PWA.
 *
 * Le contrôle qui compte le plus est le dernier : la **cohérence entre
 * `index.html` et la liste `COQUILLE` du service worker**. Ajouter un fichier
 * à la page sans l'inscrire dans la coquille ne casse rien en ligne, et casse
 * tout hors ligne — chez l'agent, en tournée, sans message d'erreur. C'est une
 * panne qui ne se voit jamais depuis le bureau.
 *
 *   python3 serveur.py 8123 &
 *   node tests/audit-pwa.mjs
 *
 * Sortie non nulle si un défaut est trouvé.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.GEOLOC_URL || 'http://localhost:8123/';
const POSITION = { latitude: 47.5175, longitude: 7.0803, accuracy: 6 };

let defauts = 0;
const ok = (c, m) => { if (!c) { defauts++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// --- Cohérence page / coquille, lue sur le disque ---------------------------

const page_html = readFileSync(join(RACINE, 'index.html'), 'utf8');
const sw = readFileSync(join(RACINE, 'service-worker.js'), 'utf8');

const references = [
  ...page_html.matchAll(/<script src="([^"]+)"/g),
  ...page_html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)
].map(m => m[1]);

const coquille = [...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]);

console.log('— Coquille hors ligne');
ok(references.length > 0, references.length + ' ressource(s) référencée(s) par index.html');
references.forEach(r => {
  ok(coquille.includes(r), r + (coquille.includes(r) ? ' est dans la coquille' : ' MANQUE dans la coquille du service worker'));
});

// --- Contrôles en navigateur ------------------------------------------------

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await nav.newContext({
  locale: 'fr-FR', viewport: { width: 412, height: 860 },
  permissions: ['geolocation'], geolocation: POSITION
});
const onglet = await ctx.newPage();
const erreurs = [];
onglet.on('pageerror', e => erreurs.push(e.message));
await onglet.goto(BASE, { waitUntil: 'networkidle' });

console.log('\n— Manifeste');
const rep = await onglet.request.get(BASE + 'manifest.webmanifest');
ok(rep.status() === 200, 'servi en 200');
const m = await rep.json();

// start_url et scope relatifs : sur GitHub Pages l'application vit sous
// /<dépôt>/, une valeur absolue « / » sortirait de sa portée et empêcherait
// l'installation.
ok(m.start_url === '.' && m.scope === '.', 'start_url et scope relatifs');
ok(m.display === 'standalone', 'display standalone');
ok(!!m.name && !!m.short_name, 'name et short_name');
ok(m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512'),
  'icônes 192 et 512 — critère d\'installabilité');
ok(m.icons.some(i => i.purpose === 'maskable'), 'icône maskable');

for (const i of m.icons) {
  const r = await onglet.request.get(BASE + i.src);
  ok(r.status() === 200, i.src);
}

console.log('\n— Service worker');
const etat = await onglet.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  const noms = await caches.keys();
  const c = await caches.open(noms[0]);
  return { actif: !!reg.active, controle: !!navigator.serviceWorker.controller,
    caches: noms.length, entrees: (await c.keys()).length };
});
ok(etat.actif && etat.controle, 'actif et contrôlant la page');
ok(etat.caches === 1, etat.caches + ' cache(s) — un seul attendu');
ok(etat.entrees >= references.length, etat.entrees + ' entrées précachées');

console.log('\n— Hors réseau');
await ctx.setOffline(true);
await onglet.reload({ waitUntil: 'load' });
ok(await onglet.$$eval('.onglet', ns => ns.length) === 4, 'les quatre onglets se construisent');

await onglet.click('#eau-btn-creer');
await onglet.waitForSelector('#eau-modale-mesure:not([hidden])', { timeout: 5000 });
await onglet.waitForFunction(
  () => document.querySelector('#eau-pos-lat').textContent !== '—', { timeout: 10000 });
ok(true, 'une mesure peut être prise sans réseau');

// Les tuiles sont servies par des tiers : leur absence doit être dite, pas subie.
await onglet.waitForFunction(
  () => document.querySelector('#eau-carte-message').textContent.length > 0,
  { timeout: 10000 }).catch(() => {});
ok((await onglet.textContent('#eau-carte-message')).length > 0,
  'l\'absence de fond de carte est annoncée');

ok(erreurs.length === 0, erreurs.length ? 'erreurs JS : ' + erreurs.join(' | ') : 'aucune erreur JavaScript');

await nav.close();
console.log(defauts ? '\n' + defauts + ' défaut(s).' : '\nAucun défaut.');
process.exit(defauts ? 1 : 0);
