/**
 * Conversion WGS84 (GPS) -> Lambert 93 (EPSG:2154).
 * Utile parce que les SIG des collectivites francaises travaillent en Lambert 93,
 * alors que le GPS du navigateur ne rend que du WGS84 decimal.
 * Constantes officielles IGN (NTG_71, projection conique conforme secante, ellipsoide GRS80).
 */
(function (global) {
  'use strict';

  var GRS80_E = 0.0818191910428158; // premiere excentricite
  var N = 0.7256077650;
  var C = 11754255.426;
  var XS = 700000.0;
  var YS = 12655612.05;
  var LON0 = 3.0 * Math.PI / 180.0; // meridien d'origine Greenwich +3

  function latitudeIsometrique(phi, e) {
    var s = e * Math.sin(phi);
    return Math.log(Math.tan(Math.PI / 4 + phi / 2) * Math.pow((1 - s) / (1 + s), e / 2));
  }

  /**
   * @param {number} lat latitude WGS84 en degres decimaux
   * @param {number} lon longitude WGS84 en degres decimaux
   * @returns {{x:number, y:number}} coordonnees planes en metres
   */
  function wgs84ToLambert93(lat, lon) {
    var phi = lat * Math.PI / 180.0;
    var lambda = lon * Math.PI / 180.0;
    var L = latitudeIsometrique(phi, GRS80_E);
    var R = C * Math.exp(-N * L);
    var gamma = N * (lambda - LON0);
    return {
      x: XS + R * Math.sin(gamma),
      y: YS - R * Math.cos(gamma)
    };
  }

  global.Lambert93 = { wgs84ToLambert93: wgs84ToLambert93 };
})(typeof window !== 'undefined' ? window : globalThis);
