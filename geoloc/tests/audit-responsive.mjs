/**
 * Audit d'affichage. La tablette est la cible principale ; les petites largeurs
 * restent contrôlées parce que l'application doit rester utilisable au téléphone.
 *
 * Vérifie, à chaque format et sur les quatre onglets :
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
// Cible principale : tablettes courantes, dans les deux orientations.
const TABLETTE = [
  { width: 768, height: 1024 }, { width: 810, height: 1080 }, { width: 834, height: 1194 },
  { width: 1024, height: 768 }, { width: 1180, height: 820 }
];
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
    const defile = [];

    const nommer = n => (n.className && typeof n.className === 'string'
      ? '.' + n.className.split(' ')[0] : n.tagName);

    // Un élément écrêté par un ancêtre (carte pannable, zone défilante) sort du
    // cadre par construction : ce n'est pas un défaut de mise en page.
    const ecrete = n => {
      for (let p = n.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p);
        if (o.overflow !== 'visible' || o.overflowX !== 'visible' || o.overflowY !== 'visible') return true;
      }
      return false;
    };

    document.querySelectorAll('*').forEach(n => {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const nom = nommer(n);
      const txt = n.textContent.trim().slice(0, 24);

      if ((r.right > window.innerWidth + 0.5 || r.left < -0.5) && !ecrete(n)) {
        deborde.push(nom + ' « ' + txt + ' »');
      }
      // Feuilles uniquement, champs de saisie exclus : un input fait défiler sa
      // valeur par conception, seul un libellé coupé est un défaut.
      const saisie = /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName);
      if (!saisie && !n.children.length && n.scrollWidth > n.clientWidth + 1) {
        tronque.push(nom + ' « ' + txt + ' »');
      }
    });

    // Un conteneur écrêtant ne doit pas cacher de défilement horizontal, sauf la
    // carte, dont la surface pannable dépasse forcément son cadre.
    document.querySelectorAll('.modale-fenetre, .bloc, .vue, main').forEach(n => {
      if (n.scrollWidth > n.clientWidth + 1) defile.push(nommer(n) + ' (+' + (n.scrollWidth - n.clientWidth) + 'px)');
    });

    document.querySelectorAll('button, a, select, textarea, input:not([type=checkbox]):not([type=file])').forEach(n => {
      const r = n.getBoundingClientRect();
      if (r.height > 0 && r.height < 36) petites.push(n.tagName + ' ' + Math.round(r.height) + 'px');
    });

    return { deborde, tronque, petites, defile, scroll: document.documentElement.scrollWidth - window.innerWidth };
  });
}

async function controler(page, ou) {
  const r = await inspecter(page);
  if (r.scroll > 0) { defauts++; console.log('  ✗ ' + ou + ' — débordement horizontal de ' + r.scroll + 'px'); }
  signaler(ou, r.deborde.map(x => 'hors viewport : ' + x));
  signaler(ou, r.tronque.map(x => 'texte tronqué : ' + x));
  signaler(ou, r.petites.map(x => 'cible tactile : ' + x));
  signaler(ou, r.defile.map(x => 'défilement horizontal caché : ' + x));
}

const valeurs = (page, sel) => page.$$eval(sel + ' option',
  os => os.map(o => o.value).filter(Boolean));

/** La saisie vit dans une fenêtre : rien n'est atteignable sans l'ouvrir. */
async function ouvrirMesure(page) {
  await page.click('#eau-btn-creer');
  await page.waitForSelector('#eau-modale-mesure:not([hidden])', { timeout: 5000 });
  await page.waitForTimeout(160);
}

async function fermerMesure(page) {
  await page.click('#eau-modale-mesure .modale-fermer');
  await page.waitForTimeout(200);
}

async function releverPosition(page) {
  await page.click('#eau-btn-gps');
  await page.waitForFunction(() => document.querySelector('#eau-pos-lat').textContent !== '—', { timeout: 10000 });
}

/** Le niveau 2 ne doit proposer que les modèles du type choisi au niveau 1. */
async function verifierCascade(page, etiquette) {
  await page.click('#onglet-eau');
  await ouvrirMesure(page);
  await page.selectOption('#eau-type_materiel', 'Compteur');
  const compteurs = await valeurs(page, '#eau-modele');
  await page.selectOption('#eau-type_materiel', 'Ventouse');
  const ventouses = await valeurs(page, '#eau-modele');

  if (!compteurs.length || !ventouses.length) {
    defauts++; console.log('  ✗ ' + etiquette + ' — cascade : niveau 2 vide');
  } else if (compteurs.join() === ventouses.join()) {
    defauts++; console.log('  ✗ ' + etiquette + ' — cascade : niveau 2 ne filtre pas sur le niveau 1');
  }

  // Changer le niveau 1 doit invalider un niveau 3 devenu impossible.
  await page.selectOption('#eau-type_materiel', 'Compteur');
  await page.selectOption('#eau-modele', 'DN 20');
  await page.selectOption('#eau-detail', 'Vitesse');
  await page.selectOption('#eau-type_materiel', 'Ventouse');
  if (await page.inputValue('#eau-detail')) {
    defauts++; console.log('  ✗ ' + etiquette + ' — cascade : niveau 3 survit à un changement de niveau 1');
  }
  await page.selectOption('#eau-type_materiel', '');
  await fermerMesure(page);
}

async function parcourir(page, etiquette) {
  for (const onglet of ONGLETS) {
    await page.click('#onglet-' + onglet);
    await page.waitForTimeout(180);
    // Les tables du catalogue ne se construisent qu'une fois dépliées : sans
    // cela l'audit ne verrait jamais la plus dense des surfaces de l'onglet.
    if (onglet === 'configuration') {
      await page.$$eval('.cat-filiere', ns => ns.forEach(n => { n.open = true; }));
      await page.waitForTimeout(220);
    }
    await controler(page, etiquette + ' / ' + onglet);
  }

  // Les deux fenêtres sont des surfaces d'interface à part entière, et la carte
  // s'ouvre par-dessus la mesure : les deux états se contrôlent.
  await page.click('#onglet-eau');
  await ouvrirMesure(page);
  await releverPosition(page);
  await controler(page, etiquette + ' / mesure');

  await page.click('#eau-btn-carte');
  await page.waitForTimeout(500);
  await controler(page, etiquette + ' / carte');
  await page.click('#modale-fermer');
  await page.waitForTimeout(150);

  await fermerMesure(page);
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined
});

// Tuiles simulées : l'audit ne doit dépendre ni du réseau ni du service IGN.
const TUILE_SIMULEE = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">'
  + '<rect width="256" height="256" fill="#31402f"/></svg>';

for (const vp of TABLETTE.concat(PORTRAIT.map(w => ({ width: w, height: 760 }))).concat(PAYSAGE)) {
  const etiquette = vp.width + '×' + vp.height;
  const ctx = await nav.newContext({
    locale: 'fr-FR', viewport: vp,
    permissions: ['geolocation'], geolocation: POSITION
  });
  await ctx.route('**/data.geopf.fr/**', route =>
    route.fulfill({ contentType: 'image/svg+xml', body: TUILE_SIMULEE }));

  const page = await ctx.newPage();
  page.on('pageerror', e => { defauts++; console.log('  ✗ ' + etiquette + ' — erreur JS : ' + e.message); });
  // Abandonner une mesure entamée demande confirmation : sans quoi Playwright
  // refuse le dialogue par défaut et la fenêtre ne se ferme jamais.
  page.on('dialog', d => d.accept());

  await page.goto(BASE, { waitUntil: 'networkidle' });

  // un point relevé : la liste et ses actions font partie de la surface à vérifier
  await ouvrirMesure(page);
  await releverPosition(page);
  await page.selectOption('#eau-type_materiel', 'Réducteur de pression');
  await page.selectOption('#eau-modele', 'DN 65');
  await page.selectOption('#eau-detail', 'À pilote');
  await page.fill('#eau-observations', 'Chambre enterrée sous trottoir, accès par tampon fonte');
  await page.click('#eau-btn-valider');
  await page.waitForTimeout(400);

  // une combinaison en favori : les raccourcis de la fenêtre sont une surface de plus
  await page.click('#eau-liste .point-etoile');
  await page.waitForTimeout(200);

  console.log('— ' + etiquette);
  await verifierCascade(page, etiquette);
  await parcourir(page, etiquette);
  await ctx.close();
}

await nav.close();
console.log(defauts ? '\n' + defauts + ' défaut(s).' : '\nAucun défaut.');
process.exit(defauts ? 1 : 0);
