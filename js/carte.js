/**
 * Mini-visualiseur de tuiles, écrit à la main plutôt qu'avec une bibliothèque :
 * le projet n'a aucune dépendance et n'a besoin que de déplacer un fond et de
 * lire les coordonnées du centre.
 *
 * Projection Web Mercator (EPSG:3857), grille « PM » — celle des flux WMTS de
 * la Géoplateforme IGN comme des serveurs XYZ classiques.
 */
(function (global) {
  'use strict';

  var TUILE = 256;
  var CIRCONFERENCE = 40075016.686; // mètres, équateur

  // --- Projection -----------------------------------------------------------

  function tailleMonde(z) { return Math.pow(2, z) * TUILE; }

  function lonVersX(lon, z) { return (lon + 180) / 360 * tailleMonde(z); }

  function latVersY(lat, z) {
    var borne = Math.max(-85.05112878, Math.min(85.05112878, lat));
    var s = Math.sin(borne * Math.PI / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * tailleMonde(z);
  }

  function xVersLon(x, z) { return x / tailleMonde(z) * 360 - 180; }

  function yVersLat(y, z) {
    var n = Math.PI - 2 * Math.PI * y / tailleMonde(z);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  /** Mètres par pixel à cette latitude et ce zoom. */
  function resolution(lat, z) {
    return CIRCONFERENCE * Math.cos(lat * Math.PI / 180) / tailleMonde(z);
  }

  /** Zoom le plus fort pour lequel la vue couvre encore `etendueM` mètres. */
  function zoomPourEtendue(etendueM, lat, cotePx) {
    var k = CIRCONFERENCE * Math.cos(lat * Math.PI / 180) * cotePx / (etendueM * TUILE);
    return Math.floor(Math.log(k) / Math.LN2);
  }

  // --- Fonds ----------------------------------------------------------------

  var GEOPF = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile'
    + '&STYLE=normal&TILEMATRIXSET=PM&LAYER={couche}&FORMAT={format}'
    + '&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

  /**
   * Fonds par défaut : uniquement des services gratuits et sans clé d'accès.
   * « Gratuit » ne veut pas dire « sans conditions » : l'attribution est une
   * obligation de licence, elle est affichée en permanence sur la carte.
   * Toute cette liste est remplaçable depuis l'onglet Configuration.
   */
  var FONDS = {
    photo: {
      libelle: 'Photo aérienne',
      url: GEOPF.replace('{couche}', 'ORTHOIMAGERY.ORTHOPHOTOS').replace('{format}', 'image/jpeg'),
      zoomMax: 20,
      credit: '© IGN — Géoplateforme'
    },
    plan: {
      libelle: 'Plan IGN',
      url: GEOPF.replace('{couche}', 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2').replace('{format}', 'image/png'),
      zoomMax: 19,
      credit: '© IGN — Géoplateforme'
    },
    // Secours si la Géoplateforme est injoignable. Attention : la politique d'usage
    // des tuiles d'openstreetmap.org proscrit les usages applicatifs intensifs.
    osm: {
      libelle: 'OpenStreetMap',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      zoomMax: 19,
      credit: '© Contributeurs OpenStreetMap (ODbL)'
    }
  };

  /** Contrôle minimal d'un fond saisi par l'utilisateur. */
  function validerFond(f) {
    if (!f || typeof f.url !== 'string') return 'URL manquante.';
    if (!/^https:\/\//.test(f.url)) return 'URL : HTTPS obligatoire.';
    if (f.url.indexOf('{z}') === -1 || f.url.indexOf('{x}') === -1 || f.url.indexOf('{y}') === -1) {
      return 'URL : les repères {z}, {x} et {y} sont obligatoires.';
    }
    if (!f.libelle) return 'Libellé manquant.';
    if (!f.credit) return 'Attribution manquante : elle est exigée par la licence du fond.';
    var z = Number(f.zoomMax);
    if (!z || z < 1 || z > 22) return 'Zoom maximal attendu entre 1 et 22.';
    return null;
  }

  // --- Carte ----------------------------------------------------------------

  /**
   * @param {HTMLElement} hote conteneur, positionné en relatif par la feuille de style
   * @param {Object} options { fond, zoom, surChangement, urls }
   */
  function creerCarte(hote, options) {
    var o = options || {};
    var fonds = o.urls || FONDS;
    var fondActif = o.fond && fonds[o.fond] ? o.fond : 'photo';
    var zoomMin = o.zoomMin || 14;
    var etendueMin = o.etendueMinM || 0;
    var zoom = o.zoom || fonds[fondActif].zoomMax;

    var centre = { latitude: 0, longitude: 0 };
    var marqueurs = [];
    var detruit = false;

    var couche = document.createElement('div');
    couche.className = 'carte-couche';
    hote.appendChild(couche);

    var surcouche = document.createElement('div');
    surcouche.className = 'carte-surcouche';
    hote.appendChild(surcouche);

    // Attribution affichée en permanence : c'est une obligation de licence,
    // pas une mention d'ambiance reléguée dans un menu.
    var attribution = document.createElement('p');
    attribution.className = 'carte-attribution';
    hote.appendChild(attribution);

    // Compte les tuiles en échec : sans réseau, la carte doit le dire au lieu de rester grise.
    var demandees = 0;
    var echouees = 0;

    function plafond() {
      var base = fonds[fondActif].zoomMax;
      if (!etendueMin) return base;
      var cote = Math.min(hote.clientWidth, hote.clientHeight);
      if (!cote) return base;
      // Aucun fond gratuit ne descend nativement à dix mètres de large. Au-delà
      // de son zoom maximal on réclame quand même la tuile la plus fine et on
      // l'agrandit : l'image devient floue mais le géoréférencement reste juste.
      // Trois niveaux (x8) est la limite au-delà de laquelle il n'y a plus rien
      // à lire dans le pixel.
      return Math.max(base, Math.min(base + 3, zoomPourEtendue(etendueMin, centre.latitude, cote)));
    }

    /** Niveaux d'agrandissement au-delà de la résolution réelle du fond. */
    function surZoom() {
      return Math.max(0, zoom - fonds[fondActif].zoomMax);
    }

    function signalerEtat() {
      var perdu = demandees > 0 && echouees >= demandees;
      hote.setAttribute('data-tuiles', perdu ? 'absentes' : 'ok');
      if (o.surTuiles) o.surTuiles({ demandees: demandees, echouees: echouees, perdu: perdu });
    }

    function rendre() {
      if (detruit) return;
      var largeur = hote.clientWidth;
      var hauteur = hote.clientHeight;
      if (!largeur || !hauteur) return;

      var cx = lonVersX(centre.longitude, zoom);
      var cy = latVersY(centre.latitude, zoom);
      var gauche = cx - largeur / 2;
      var haut = cy - hauteur / 2;

      var zNatif = Math.min(zoom, fonds[fondActif].zoomMax);
      var pas = TUILE * Math.pow(2, zoom - zNatif); // côté de la tuile à l'écran

      // Une tuile de marge : évite le vide sur les bords pendant le déplacement.
      var x0 = Math.floor(gauche / pas) - 1;
      var y0 = Math.floor(haut / pas) - 1;
      var x1 = Math.floor((gauche + largeur) / pas) + 1;
      var y1 = Math.floor((haut + hauteur) / pas) + 1;
      var max = Math.pow(2, zNatif);

      var fragment = document.createDocumentFragment();
      demandees = 0;
      echouees = 0;

      for (var ty = y0; ty <= y1; ty++) {
        if (ty < 0 || ty >= max) continue;
        for (var tx = x0; tx <= x1; tx++) {
          var wx = ((tx % max) + max) % max; // enroulement en longitude
          var img = document.createElement('img');
          img.className = 'carte-tuile';
          img.alt = '';
          img.loading = 'eager';
          img.decoding = 'async';
          img.draggable = false;
          img.style.left = (tx * pas - gauche) + 'px';
          img.style.top = (ty * pas - haut) + 'px';
          img.style.width = pas + 'px';
          img.style.height = pas + 'px';
          // Une tuile en échec laisse sinon une icône de lien brisé sur le fond.
          img.addEventListener('error', function () {
            this.style.display = 'none';
            echouees++;
            signalerEtat();
          });
          img.addEventListener('load', signalerEtat);
          img.src = fonds[fondActif].url
            .replace('{z}', zNatif).replace('{x}', wx).replace('{y}', ty);
          demandees++;
          fragment.appendChild(img);
        }
      }

      marqueurs.forEach(function (m) {
        var n = document.createElement('div');
        n.className = 'carte-marqueur carte-marqueur--' + m.type;
        n.style.left = (lonVersX(m.longitude, zoom) - gauche) + 'px';
        n.style.top = (latVersY(m.latitude, zoom) - haut) + 'px';
        if (m.rayonM) {
          var d = 2 * m.rayonM / resolution(m.latitude, zoom);
          n.style.width = d + 'px';
          n.style.height = d + 'px';
        }
        if (m.titre) n.title = m.titre;
        fragment.appendChild(n);
      });

      attribution.textContent = fonds[fondActif].credit || '';
      couche.style.transform = '';
      couche.replaceChildren(fragment);
      signalerEtat();
      if (o.surChangement) o.surChangement(api.centre(), zoom);
    }

    // --- Déplacement --------------------------------------------------------

    var glisse = null;

    function debutGlisse(ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      glisse = { x: ev.clientX, y: ev.clientY, dx: 0, dy: 0 };
      hote.setPointerCapture(ev.pointerId);
      hote.classList.add('carte--glisse');
    }

    function pendantGlisse(ev) {
      if (!glisse) return;
      glisse.dx = ev.clientX - glisse.x;
      glisse.dy = ev.clientY - glisse.y;
      // Translation pendant le geste, rendu complet au relâchement : évite de
      // recréer les tuiles à chaque pixel.
      couche.style.transform = 'translate(' + glisse.dx + 'px,' + glisse.dy + 'px)';
      ev.preventDefault();
    }

    function finGlisse(ev) {
      if (!glisse) return;
      var dx = glisse.dx;
      var dy = glisse.dy;
      glisse = null;
      hote.classList.remove('carte--glisse');
      if (ev && ev.pointerId !== undefined && hote.hasPointerCapture(ev.pointerId)) {
        hote.releasePointerCapture(ev.pointerId);
      }
      if (!dx && !dy) { rendre(); return; }

      var cx = lonVersX(centre.longitude, zoom) - dx;
      var cy = latVersY(centre.latitude, zoom) - dy;
      centre = { latitude: yVersLat(cy, zoom), longitude: xVersLon(cx, zoom) };
      rendre();
    }

    hote.addEventListener('pointerdown', debutGlisse);
    hote.addEventListener('pointermove', pendantGlisse);
    hote.addEventListener('pointerup', finGlisse);
    hote.addEventListener('pointercancel', finGlisse);
    hote.addEventListener('dragstart', function (ev) { ev.preventDefault(); });

    function molette(ev) {
      ev.preventDefault();
      api.zoomer(ev.deltaY < 0 ? 1 : -1);
    }
    hote.addEventListener('wheel', molette, { passive: false });

    var observateur = null;
    if (typeof ResizeObserver === 'function') {
      observateur = new ResizeObserver(function () { rendre(); });
      observateur.observe(hote);
    }

    // --- Interface publique -------------------------------------------------

    var api = {
      centrer: function (lat, lon, z) {
        centre = { latitude: lat, longitude: lon };
        if (z) zoom = Math.max(zoomMin, Math.min(plafond(), z));
        rendre();
        return api;
      },
      centre: function () { return { latitude: centre.latitude, longitude: centre.longitude }; },
      zoom: function () { return zoom; },
      zoomMax: plafond,
      surZoom: surZoom,
      zoomer: function (delta) {
        var cible = Math.max(zoomMin, Math.min(plafond(), zoom + delta));
        if (cible === zoom) return api;
        zoom = cible;
        rendre();
        return api;
      },
      fond: function (id) {
        if (!id) return fondActif;
        if (!fonds[id]) return api;
        fondActif = id;
        if (zoom > plafond()) zoom = plafond();
        rendre();
        return api;
      },
      fonds: function () {
        return Object.keys(fonds).map(function (k) {
          return { id: k, libelle: fonds[k].libelle, credit: fonds[k].credit };
        });
      },
      marqueurs: function (liste) { marqueurs = liste || []; rendre(); return api; },
      resolution: function () { return resolution(centre.latitude, zoom); },
      rendre: rendre,
      detruire: function () {
        detruit = true;
        if (observateur) observateur.disconnect();
        hote.removeEventListener('pointerdown', debutGlisse);
        hote.removeEventListener('pointermove', pendantGlisse);
        hote.removeEventListener('pointerup', finGlisse);
        hote.removeEventListener('pointercancel', finGlisse);
        hote.removeEventListener('wheel', molette);
        couche.remove();
        surcouche.remove();
      attribution.remove();
      }
    };

    return api;
  }

  /** Distance plane locale entre deux points, en mètres. */
  function distance(a, b) {
    var dy = (a.latitude - b.latitude) * 110540;
    var dx = (a.longitude - b.longitude) * 111320 * Math.cos(b.latitude * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy);
  }

  global.GromaCarte = {
    creerCarte: creerCarte,
    validerFond: validerFond,
    distance: distance,
    resolution: resolution,
    FONDS: FONDS
  };
})(window);
