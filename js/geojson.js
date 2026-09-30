/**
 * Sérialisation GeoJSON (RFC 7946) — le format d'échange avec les SIG.
 *
 * Pourquoi lui plutôt que le CSV : la géométrie, le système de coordonnées et
 * les types des attributs voyagent dans le fichier. QGIS, ArcGIS et GDAL
 * l'ouvrent sans dialogue et sans réglage. Le CSV, lui, oblige à désigner les
 * colonnes X/Y, choisir le séparateur et le SCR à chaque import, et livre
 * toutes les valeurs en texte.
 *
 * Deux pièges que ce format évite, et qui ont coûté cher ailleurs :
 *   - l'encodage : UTF-8 est imposé par la norme, pas négocié ;
 *   - la virgule décimale : `JSON.stringify` écrit toujours un point, alors
 *     qu'un CSV réenregistré par un tableur français transforme `47.5` en
 *     `47,5` et rend les coordonnées illisibles.
 */
(function (global) {
  'use strict';

  /**
   * Colonnes à convertir en nombre. Les laisser en texte est précisément ce
   * qu'on reproche au CSV : sans type, pas de filtre ni de calcul dans le SIG
   * sans conversion manuelle.
   */
  var NOMBRES = [
    'precision_m', 'dispersion_m', 'nb_mesures', 'duree_gps_s',
    'ecart_ajustement_m', 'x_l93', 'y_l93'
  ];

  // Portées par la géométrie : les répéter en attributs inviterait à les
  // modifier d'un côté sans l'autre.
  var DANS_GEOMETRIE = ['latitude', 'longitude', 'altitude_m'];

  function estNombre(valeur) {
    return valeur !== '' && valeur !== null && valeur !== undefined && !isNaN(Number(valeur));
  }

  /**
   * L'ordre est **longitude d'abord**, contrairement à l'usage courant qui dit
   * « latitude, longitude ». La norme l'impose, et l'inversion place les points
   * à l'autre bout du monde sans qu'aucun outil ne proteste.
   */
  function geometrie(point) {
    if (!estNombre(point.latitude) || !estNombre(point.longitude)) return null;
    var coords = [Number(point.longitude), Number(point.latitude)];
    if (estNombre(point.altitude_m)) coords.push(Number(point.altitude_m));
    return { type: 'Point', coordinates: coords };
  }

  function proprietes(point, colonnes) {
    var out = {};
    colonnes.forEach(function (c) {
      if (DANS_GEOMETRIE.indexOf(c) !== -1) return;
      var v = point[c];
      if (v === undefined || v === '') { out[c] = null; return; }
      out[c] = NOMBRES.indexOf(c) !== -1 && estNombre(v) ? Number(v) : String(v);
    });
    return out;
  }

  /**
   * @param {string[]} colonnes colonnes de la filière, dans l'ordre du schéma
   * @param {Object[]} points relevés à écrire
   * @returns {string} document GeoJSON indenté
   *
   * Un relevé sans coordonnées sort avec une géométrie nulle plutôt que d'être
   * écarté : la norme l'autorise, les SIG l'acceptent, et une ligne perdue en
   * silence à l'export est pire qu'une ligne sans position.
   */
  function serialiser(colonnes, points) {
    return JSON.stringify({
      type: 'FeatureCollection',
      features: (points || []).map(function (p) {
        return {
          type: 'Feature',
          geometry: geometrie(p),
          properties: proprietes(p, colonnes)
        };
      })
    }, null, 2);
  }

  /**
   * Relit un document produit par `serialiser`. C'est la moitié qui rend le
   * format utilisable comme **stockage** et pas seulement comme sortie : sans
   * elle, impossible de relier un fichier existant ni de reprendre une tournée
   * commencée sur un autre appareil.
   *
   * Les valeurs reviennent en chaînes, comme celles qu'écrit l'application :
   * une seule représentation interne, sinon deux relevés identiques cesseraient
   * de se comparer selon leur provenance.
   *
   * @returns {Object[]|null} relevés, ou `null` si le document n'est pas une
   *          FeatureCollection — un fichier étranger doit être refusé, pas
   *          absorbé à moitié.
   */
  function analyser(texte) {
    var doc;
    try { doc = JSON.parse(texte); } catch (e) { return null; }
    if (!doc || doc.type !== 'FeatureCollection' || !Array.isArray(doc.features)) return null;

    return doc.features.map(function (f) {
      var p = {};
      var props = (f && f.properties) || {};
      Object.keys(props).forEach(function (c) {
        p[c] = props[c] === null || props[c] === undefined ? '' : String(props[c]);
      });

      var g = f && f.geometry;
      if (g && g.type === 'Point' && Array.isArray(g.coordinates)) {
        p.longitude = String(g.coordinates[0]);
        p.latitude = String(g.coordinates[1]);
        if (g.coordinates.length > 2) p.altitude_m = String(g.coordinates[2]);
      }
      return p;
    });
  }

  global.GromaGeojson = {
    serialiser: serialiser,
    analyser: analyser,
    NOMBRES: NOMBRES
  };
})(window);
