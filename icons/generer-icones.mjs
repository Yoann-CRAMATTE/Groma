/**
 * Dérive les icônes PNG de icons/logo.svg. Outil de fabrication, hors
 * application : Playwright sert à rasteriser le SVG, rien d'autre.
 *
 *   node icons/generer-icones.mjs
 *
 * L'icône « maskable » réduit le motif à 80 % : Android découpe l'icône selon
 * le masque du lanceur (cercle, goutte…) et ne garantit que le disque central
 * de 40 % de rayon. Le fond, lui, va jusqu'aux bords.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ICI = dirname(fileURLToPath(import.meta.url));
const logo = readFileSync(join(ICI, 'logo.svg'), 'utf8');
const masquable = logo.replace('<g id="motif">', '<g id="motif" transform="translate(256 256) scale(0.8) translate(-256 -256)">');

const SORTIES = [
  { nom: 'icone-192.png', taille: 192, svg: logo },
  { nom: 'icone-512.png', taille: 512, svg: logo },
  { nom: 'icone-maskable-512.png', taille: 512, svg: masquable },
  // iOS arrondit lui-même les coins et refuse la transparence : fond plein.
  { nom: 'icone-apple-180.png', taille: 180, svg: logo }
];

const nav = await chromium.launch();
for (const s of SORTIES) {
  const page = await nav.newPage({ viewport: { width: s.taille, height: s.taille } });
  await page.setContent('<style>html,body{margin:0}svg{display:block;width:' + s.taille + 'px;height:' + s.taille + 'px}</style>' + s.svg);
  await page.screenshot({ path: join(ICI, s.nom), omitBackground: false });
  await page.close();
  console.log('✓ ' + s.nom);
}
await nav.close();
