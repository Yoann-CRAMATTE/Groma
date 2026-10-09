/**
 * Service worker de Groma — rend l'application installable et utilisable sans
 * réseau. Seules les tuiles de carte manquent hors ligne : elles sont servies
 * par des domaines tiers, volontairement pas interceptées ici (voir plus bas).
 *
 * Stratégie : **cache d'abord, revalidation en arrière-plan**.
 *
 * Un « cache d'abord » pur oblige à incrémenter VERSION à chaque livraison ;
 * l'oublier une fois fige l'application sur le téléphone de l'agent, sans
 * aucun moyen de s'en apercevoir depuis le bureau. Ici, une version oubliée
 * coûte un chargement de retard, pas un blocage définitif : la réponse servie
 * vient du cache, mais le réseau est interrogé en parallèle et le cache mis à
 * jour pour la fois suivante.
 *
 * VERSION reste utile : la changer purge l'ancien cache d'un coup au lieu de
 * laisser les fichiers se remplacer un à un.
 */
'use strict';

var VERSION = 'groma-3';

// Tout ce qu'il faut pour démarrer hors réseau. `addAll` est atomique : si un
// seul fichier manque, l'installation échoue et l'ancien cache reste en place —
// préférable à un cache à moitié rempli qui casserait au premier lancement.
var COQUILLE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './css/style.css',
  // Chargée par la feuille de style, pas par index.html : l'audit ne la voit
  // pas, il faut l'inscrire à la main. Absente, les titres retombent en police
  // système hors réseau, sans rien casser.
  './fonts/bricolage-grotesque-latin.woff2',
  './js/lambert93.js',
  './js/carte.js',
  './js/config.js',
  './js/catalogue.js',
  './js/csv.js',
  './js/geojson.js',
  './js/store.js',
  './js/geo.js',
  './js/app.js',
  './icons/icone-192.png',
  './icons/icone-512.png',
  './icons/icone-maskable-512.png'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(VERSION)
      // cache: 'reload' contourne le cache HTTP du navigateur. GitHub Pages sert
      // ses fichiers avec dix minutes de validité : sans cela, une nouvelle
      // version pouvait précacher l'ancienne feuille de style sous son nom.
      .then(function (cache) {
        return cache.addAll(COQUILLE.map(function (u) { return new Request(u, { cache: 'reload' }); }));
      })
      // Sans cela, la nouvelle version attend la fermeture de tous les onglets.
      // En PWA installée, l'application peut rester ouverte des jours : un
      // correctif n'atteindrait jamais le terrain.
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys()
      .then(function (noms) {
        return Promise.all(noms.map(function (n) {
          return n === VERSION ? null : caches.delete(n);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/** Une réponse partielle ou opaque mise en cache casserait le chargement suivant. */
function conservable(reponse) {
  return reponse && reponse.ok && reponse.type === 'basic';
}

self.addEventListener('fetch', function (ev) {
  var requete = ev.request;
  if (requete.method !== 'GET') return;

  // Les tuiles viennent de data.geopf.fr et tile.openstreetmap.org. Les laisser
  // au navigateur est délibéré : leurs conditions d'usage proscrivent la
  // constitution de réserves locales, et une carte périmée sur un relevé vaut
  // moins qu'une carte absente qui le dit.
  var url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  ev.respondWith(
    caches.match(requete).then(function (enCache) {
      var duReseau = fetch(requete).then(function (reponse) {
        if (!conservable(reponse)) return reponse;
        var copie = reponse.clone();
        return caches.open(VERSION)
          .then(function (cache) { return cache.put(requete, copie); })
          .then(function () { return reponse; });
      }).catch(function () {
        // Hors réseau : ce n'est une erreur que si le cache est vide aussi.
        return enCache || Response.error();
      });

      if (!enCache) return duReseau;
      // La réponse part du cache, mais le worker doit rester en vie le temps
      // que la revalidation aboutisse — sinon la mise à jour est perdue.
      ev.waitUntil(duReseau);
      return enCache;
    })
  );
});
