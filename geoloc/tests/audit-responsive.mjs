/**
 * Audit d'affichage sur petits écrans.
 *
 * Vérifie, à chaque largeur et sur les quatre onglets :
 *   - aucun débordement horizontal ;
 *   - aucun texte tronqué (scrollWidth > clientWidth) ;
 *   - aucune cible tactile sous 36 px de haut.
 *
 * Playwright n'est PAS une dépendance de l'application : il ne sert qu'ici.
 *
 *   python3 geoloc/serveur.py 8123 &
 *   npm install playwright && node geoloc/tests/audit-responsive.mjs
 *
 * Sortie non nulle si un défaut est trouvé — exploitable en intégration continue.
 */
import { chromium } from 'playwright';

const BASE = process.env.GEOLOC_URL || 'http://localhost:8123/index.html';
const PORTRAIT = [280, 320, 360, 390, 412, 430, 480, 540];
const PAYSAGE = [{ width: 568, height: 320 }, { width: 653, height: 280 }];
const ONGLETS = ['eau', 'assainissement', 'spanc', 'configuration'];
const POSITION = { latitude: 47.5175, longitude: 7.0803, accuracy: 6 };

let defauts = 0;

function signaler(contexte, liste) {
  defauts += liste.length;
  liste.forEach(function (l) { console.log('  ✗ ' + contexte + ' — ' + l); });
}

async function inspecter(page) {
  return page.evaluate(() => {
    const deborde = [];
    const tronque = [];
    const petites = [];

    document.querySelectorAll('*').forEach(n => {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const nom = (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ')[0] : n.tagName);
      const txt = n.textContent.trim().slice(0, 24);

      if (r.right > window.innerWidth + 0.5 || r.left < -0.5) deborde.push(nom + ' « ' + txt + ' »');
      // seulement les feuilles : un conteneur qui défile volontairement n'est pas un défaut
      if (!n.children.length && n.scrollWidth > n.clientWidth + 1) tronque.push(nom + ' « ' + txt + ' »');
    });

    document.querySelectorAll('button, a, select, textarea, input:not([type=checkbox]):not([type=file])').forEach(n => {
      const r = n.getBoundingClientRect();
      if (r.height > 0 && r.height < 36) petites.push(n.tagName + ' ' + Math.round(r.height) + 'px');
    });

    return { deborde, tronque, petites, scroll: document.documentElement.scrollWidth - window.innerWidth };
  });
}

async function parcourir(page, etiquette) {
  for (const onglet of ONGLETS) {
    await page.click('#onglet-' + onglet);
    await page.waitForTimeout(180);
    const r = await inspecter(page);
    const ou = etiquette + ' / ' + onglet;
    if (r.scroll > 0) { defauts++; console.log('  ✗ ' + ou + ' — débordement horizontal de ' + r.scroll + 'px'); }
    signaler(ou, r.deborde.map(x => 'hors viewport : ' + x));
    signaler(ou, r.tronque.map(x => 'texte tronqué : ' + x));
    signaler(ou, r.petites.map(x => 'cible tactile : ' + x));
  }
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined
});

for (const vp of PORTRAIT.map(w => ({ width: w, height: 760 })).concat(PAYSAGE)) {
  const etiquette = vp.width + '×' + vp.height;
  const ctx = await nav.newContext({
    locale: 'fr-FR', viewport: vp,
    permissions: ['geolocation'], geolocation: POSITION
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => { defauts++; console.log('  ✗ ' + etiquette + ' — erreur JS : ' + e.message); });

  await page.goto(BASE, { waitUntil: 'networkidle' });

  // un point relevé : la liste et ses actions font partie de la surface à vérifier
  await page.click('#eau-btn-gps');
  await page.waitForFunction(() => document.querySelector('#eau-pos-lat').textContent !== '—', { timeout: 10000 });
  await page.selectOption('#eau-type_ouvrage', 'Réducteur de pression');
  await page.fill('#eau-commune', 'Réchésy');
  await page.fill('#eau-observations', 'Chambre enterrée sous trottoir, accès par tampon fonte');
  await page.click('#eau-btn-valider');
  await page.waitForTimeout(400);

  console.log('— ' + etiquette);
  await parcourir(page, etiquette);
  await ctx.close();
}

await nav.close();
console.log(defauts ? '\n' + defauts + ' défaut(s).' : '\nAucun défaut.');
process.exit(defauts ? 1 : 0);
