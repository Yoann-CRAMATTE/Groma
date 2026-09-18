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

  // --- Fonds ----------------------------------------------------------------

  var GEOPF = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile'
    + '&STYLE=normal&TILEMATRIXSET=PM&LAYER={couche}&FORMAT={format}'
    + '&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

  var FONDS = {
    photo: {
      libelle: 'Photo aérienne',
      url: GEOPF.replace('{couche}', 'ORTHOIMAGERY.ORTHOPHOTOS').replace('{format}', 'image/jpeg'),
      zoomMax: 20,
      credit: 'IGN — Géoplateforme'
    },
    plan: {
      libelle: 'Plan IGN',
      url: GEOPF.replace('{couche}', 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2').replace('{format}', 'image/png'),
      zoomMax: 19,
      credit: 'IGN — Géoplateforme'
    }
  };

  // --- Carte ----------------------------------------------------------------

  /**
   * @param {HTMLElement} hote conteneur, positionné en relatif par la feuille de style
   * @param {Object} options { fond, zoom, surChangement, urls }
   */
  function creerCarte(hote, options) {
    var o = options || {};
    var fonds = o.urls || FONDS;
    var fondActif = o.fond && fonds[o.fond] ? o.fond : 'photo';
    var zoom = o.zoom || fonds[fondActif].zoomMax;
    var zoomMin = o.zoomMin || 14;

    var centre = { latitude: 0, longitude: 0 };
    var marqueurs = [];
    var detruit = false;

    var couche = document.createElement('div');
    couche.className = 'carte-couche';
    hote.appendChild(couche);

    var surcouche = document.createElement('div');
    surcouche.className = 'carte-surcouche';
    hote.appendChild(surcouche);

    // Compte les tuiles en échec : sans réseau, la carte doit le dire au lieu de rester grise.
    var demandees = 0;
    var echouees = 0;

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

      // Une tuile de marge : évite le vide sur les bords pendant le déplacement.
      var x0 = Math.floor(gauche / TUILE) - 1;
      var y0 = Math.floor(haut / TUILE) - 1;
      var x1 = Math.floor((gauche + largeur) / TUILE) + 1;
      var y1 = Math.floor((haut + hauteur) / TUILE) + 1;
      var max = Math.pow(2, zoom);

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
          img.style.left = (tx * TUILE - gauche) + 'px';
          img.style.top = (ty * TUILE - haut) + 'px';
          // Une tuile en échec laisse sinon une icône de lien brisé sur le fond.
          img.addEventListener('error', function () {
            this.style.display = 'none';
            echouees++;
            signalerEtat();
          });
          img.addEventListener('load', signalerEtat);
          img.src = fonds[fondActif].url
            .replace('{z}', zoom).replace('{x}', wx).replace('{y}', ty);
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
        if (z) zoom = z;
        rendre();
        return api;
      },
      centre: function () { return { latitude: centre.latitude, longitude: centre.longitude }; },
      zoom: function () { return zoom; },
      zoomMax: function () { return fonds[fondActif].zoomMax; },
      zoomer: function (delta) {
        var cible = Math.max(zoomMin, Math.min(fonds[fondActif].zoomMax, zoom + delta));
        if (cible === zoom) return api;
        zoom = cible;
        rendre();
        return api;
      },
      fond: function (id) {
        if (!id) return fondActif;
        if (!fonds[id]) return api;
        fondActif = id;
        if (zoom > fonds[id].zoomMax) zoom = fonds[id].zoomMax;
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

  global.GeoLocCarte = {
    creerCarte: creerCarte,
    distance: distance,
    resolution: resolution,
    FONDS: FONDS
  };
})(window);
