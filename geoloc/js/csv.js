/**
 * Sérialisation / lecture CSV (RFC 4180) avec séparateur configurable.
 * BOM UTF-8 en tête : sans lui, Excel FR casse les accents à l'ouverture.
 */
(function (global) {
  'use strict';

  var BOM = '﻿';

  function echapper(valeur, sep) {
    var s = valeur === null || valeur === undefined ? '' : String(valeur);
    if (s.indexOf('"') !== -1 || s.indexOf(sep) !== -1 || /[\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /**
   * @param {string[]} colonnes en-têtes, dans l'ordre
   * @param {Object[]} lignes objets indexés par nom de colonne
   * @param {string} sep séparateur
   */
  function serialiser(colonnes, lignes, sep) {
    var s = sep || ';';
    var out = [colonnes.map(function (c) { return echapper(c, s); }).join(s)];
    lignes.forEach(function (l) {
      out.push(colonnes.map(function (c) { return echapper(l[c], s); }).join(s));
    });
    return BOM + out.join('\r\n') + '\r\n';
  }

  /** Découpe un CSV complet en tableau de tableaux, en respectant les guillemets. */
  function decouper(texte, sep) {
    var s = sep || ';';
    var t = texte.charAt(0) === BOM ? texte.slice(1) : texte;
    var lignes = [];
    var champ = '';
    var ligne = [];
    var dansGuillemets = false;
    var i = 0;

    while (i < t.length) {
      var c = t.charAt(i);
      if (dansGuillemets) {
        if (c === '"') {
          if (t.charAt(i + 1) === '"') { champ += '"'; i += 2; continue; }
          dansGuillemets = false; i++; continue;
        }
        champ += c; i++; continue;
      }
      if (c === '"') { dansGuillemets = true; i++; continue; }
      if (c === s) { ligne.push(champ); champ = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; i++; continue; }
      champ += c; i++;
    }
    if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
    return lignes;
  }

  /** Devine le séparateur d'après la première ligne : ';' ou ',' ou tabulation. */
  function detecterSeparateur(texte) {
    var premiere = texte.split(/\r?\n/)[0] || '';
    var candidats = [';', ',', '\t'];
    var meilleur = ';';
    var max = -1;
    candidats.forEach(function (c) {
      var n = premiere.split(c).length - 1;
      if (n > max) { max = n; meilleur = c; }
    });
    return max > 0 ? meilleur : ';';
  }

  /** @returns {Object[]} lignes converties en objets via la ligne d'en-tête */
  function parser(texte, sep) {
    var s = sep || detecterSeparateur(texte);
    var brut = decouper(texte, s);
    if (!brut.length) return [];
    var entetes = brut[0];
    return brut.slice(1)
      .filter(function (l) { return l.some(function (v) { return v !== ''; }); })
      .map(function (l) {
        var o = {};
        entetes.forEach(function (e, idx) { o[e] = l[idx] === undefined ? '' : l[idx]; });
        return o;
      });
  }

  global.GeoLocCsv = {
    serialiser: serialiser,
    parser: parser,
    detecterSeparateur: detecterSeparateur
  };
})(window);
