/**
 * Accès au GPS du navigateur.
 * Rappel : l'API Geolocation exige un contexte sécurisé (HTTPS ou localhost).
 * En file:// Chrome refuse silencieusement — d'où le contrôle explicite ci-dessous.
 */
(function (global) {
  'use strict';

  function contexteSecurise() {
    return global.isSecureContext === true;
  }

  function disponible() {
    return !!(global.navigator && global.navigator.geolocation);
  }

  function messageErreur(err) {
    if (!err) return 'Erreur inconnue.';
    switch (err.code) {
      case 1: return 'Autorisation refusée. Autorisez la localisation pour ce site.';
      case 2: return 'Position indisponible. Vérifiez le GPS et la couverture.';
      case 3: return 'Délai dépassé. Réessayez à ciel ouvert.';
      default: return err.message || 'Erreur inconnue.';
    }
  }

  /**
   * @param {{hautePrecision:boolean, timeoutGps:number}} options
   * @returns {Promise<{latitude:number, longitude:number, altitude:?number, precision:number, horodatage:string}>}
   */
  function localiser(options) {
    var o = options || {};
    return new Promise(function (resolve, reject) {
      if (!disponible()) {
        reject(new Error("Ce navigateur n'expose pas l'API de géolocalisation."));
        return;
      }
      if (!contexteSecurise()) {
        reject(new Error('Contexte non sécurisé : servez la page en HTTPS ou http://localhost.'));
        return;
      }
      global.navigator.geolocation.getCurrentPosition(
        function (pos) {
          var c = pos.coords;
          resolve({
            latitude: c.latitude,
            longitude: c.longitude,
            altitude: c.altitude === null || isNaN(c.altitude) ? null : c.altitude,
            precision: c.accuracy,
            horodatage: new Date(pos.timestamp).toISOString()
          });
        },
        function (err) { reject(new Error(messageErreur(err))); },
        {
          enableHighAccuracy: o.hautePrecision !== false,
          timeout: (o.timeoutGps || 20) * 1000,
          maximumAge: 0
        }
      );
    });
  }

  // --- Acquisition affinée -------------------------------------------------

  var RAYON_LAT_M = 110540;  // mètres par degré de latitude
  var RAYON_LON_M = 111320;  // mètres par degré de longitude à l'équateur

  /** Distance plane locale, suffisante pour des écarts de quelques mètres. */
  function distanceM(a, b) {
    var dy = (a.latitude - b.latitude) * RAYON_LAT_M;
    var dx = (a.longitude - b.longitude) * RAYON_LON_M * Math.cos(b.latitude * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Agrège les mesures retenues.
   *
   * Pondération en 1/accuracy² : une mesure annoncée à 4 m pèse vingt-cinq fois
   * plus qu'une mesure à 20 m. La précision retenue reste la MEILLEURE accuracy
   * observée, jamais une valeur calculée : les fixes successifs d'un même
   * récepteur sont corrélés, moyenner ne divise pas l'erreur par la racine du
   * nombre de mesures. La dispersion, elle, est mesurée et dit ce que vaut
   * réellement la série.
   */
  function agreger(mesures, debut) {
    var meilleure = mesures.reduce(function (m, x) { return x.precision < m.precision ? x : m; }, mesures[0]);

    // Écarte les fixes nettement plus mauvais que le meilleur : ils tirent le centroïde.
    var retenues = mesures.filter(function (m) { return m.precision <= meilleure.precision * 2; });
    if (!retenues.length) retenues = [meilleure];

    var poidsTotal = 0;
    var lat = 0;
    var lon = 0;
    var altSomme = 0;
    var altPoids = 0;

    retenues.forEach(function (m) {
      var w = 1 / (m.precision * m.precision);
      poidsTotal += w;
      lat += m.latitude * w;
      lon += m.longitude * w;
      if (m.altitude !== null) { altSomme += m.altitude * w; altPoids += w; }
    });

    var centre = { latitude: lat / poidsTotal, longitude: lon / poidsTotal };

    // Dispersion : écart quadratique moyen des mesures retenues au centroïde.
    var carres = retenues.reduce(function (acc, m) {
      var d = distanceM(m, centre);
      return acc + d * d;
    }, 0);

    return {
      latitude: centre.latitude,
      longitude: centre.longitude,
      altitude: altPoids ? altSomme / altPoids : null,
      precision: meilleure.precision,
      dispersion: Math.sqrt(carres / retenues.length),
      mesures: mesures.length,
      retenues: retenues.length,
      duree: (Date.now() - debut) / 1000,
      methode: 'affinee',
      horodatage: new Date().toISOString()
    };
  }

  /**
   * Acquisition continue pendant `dureeAffinage` secondes, puis agrégation.
   *
   * @returns {{promesse: Promise, arreter: function}} `arreter()` clôt la série
   *          immédiatement et agrège ce qui a été collecté.
   */
  function localiserPrecis(options, surProgres) {
    var o = options || {};
    var duree = Math.max(5, o.dureeAffinage || 30) * 1000;
    var mesures = [];
    var debut = Date.now();
    var veille = null;
    var minuterie = null;
    var termine = false;
    var resoudre;
    var rejeter;

    var promesse = new Promise(function (ok, ko) { resoudre = ok; rejeter = ko; });

    function clore(erreur) {
      if (termine) return;
      termine = true;
      if (veille !== null) global.navigator.geolocation.clearWatch(veille);
      clearTimeout(minuterie);

      if (erreur) { rejeter(erreur); return; }
      if (!mesures.length) { rejeter(new Error('Aucune position obtenue pendant la mesure.')); return; }
      resoudre(agreger(mesures, debut));
    }

    if (!disponible()) {
      clore(new Error("Ce navigateur n'expose pas l'API de géolocalisation."));
      return { promesse: promesse, arreter: function () {} };
    }
    if (!contexteSecurise()) {
      clore(new Error('Contexte non sécurisé : servez la page en HTTPS ou http://localhost.'));
      return { promesse: promesse, arreter: function () {} };
    }

    veille = global.navigator.geolocation.watchPosition(
      function (pos) {
        var c = pos.coords;
        mesures.push({
          latitude: c.latitude,
          longitude: c.longitude,
          altitude: c.altitude === null || isNaN(c.altitude) ? null : c.altitude,
          precision: c.accuracy,
          horodatage: pos.timestamp
        });
        if (surProgres) {
          var meilleure = mesures.reduce(function (m, x) { return x.precision < m ? x.precision : m; }, Infinity);
          surProgres({
            mesures: mesures.length,
            meilleure: meilleure,
            derniere: c.accuracy,
            ecoule: (Date.now() - debut) / 1000,
            total: duree / 1000,
            // Agrégat provisoire : permet de poser le viseur dès le premier fixe
            // et de le laisser se resserrer pendant que la série se poursuit.
            position: agreger(mesures, debut)
          });
        }
      },
      function (err) {
        // Une erreur ponctuelle n'annule pas la série si des mesures existent déjà.
        if (!mesures.length) clore(new Error(messageErreur(err)));
      },
      { enableHighAccuracy: true, timeout: duree, maximumAge: 0 }
    );

    minuterie = setTimeout(function () { clore(null); }, duree);

    return { promesse: promesse, arreter: function () { clore(null); } };
  }

  /** Lien vers une carte externe : on ne charge aucune tuile, l'app reste hors-ligne. */
  function lienCarte(lat, lon) {
    return 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=19/' + lat + '/' + lon;
  }

  global.GromaGeo = {
    localiser: localiser,
    localiserPrecis: localiserPrecis,
    distanceM: distanceM,
    disponible: disponible,
    contexteSecurise: contexteSecurise,
    lienCarte: lienCarte
  };
})(window);
