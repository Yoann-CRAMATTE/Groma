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

  /** Lien vers une carte externe : on ne charge aucune tuile, l'app reste hors-ligne. */
  function lienCarte(lat, lon) {
    return 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=19/' + lat + '/' + lon;
  }

  global.GeoLocGeo = {
    localiser: localiser,
    disponible: disponible,
    contexteSecurise: contexteSecurise,
    lienCarte: lienCarte
  };
})(window);
