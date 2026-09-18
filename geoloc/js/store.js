/**
 * Persistance. localStorage fait autorité (jamais de perte de saisie terrain),
 * le fichier CSV est une projection réécrite intégralement à chaque modification.
 * Le handle de fichier est gardé en IndexedDB : localStorage ne sait stocker que du texte.
 */
(function (global) {
  'use strict';

  var CLE_POINTS = 'geoloc.points';
  var CLE_CONFIG = 'geoloc.config';
  var CLE_COMPTEUR = 'geoloc.compteurs';
  var DB_NOM = 'geoloc';
  var DB_STORE = 'handles';

  function lireJson(cle, defaut) {
    try {
      var brut = localStorage.getItem(cle);
      return brut ? JSON.parse(brut) : defaut;
    } catch (e) {
      return defaut;
    }
  }

  function ecrireJson(cle, valeur) {
    localStorage.setItem(cle, JSON.stringify(valeur));
  }

  // --- IndexedDB : uniquement pour le FileSystemFileHandle ---

  function ouvrirDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NOM, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbSet(cle, valeur) {
    return ouvrirDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(valeur, cle);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function idbGet(cle) {
    return ouvrirDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, 'readonly');
        var req = tx.objectStore(DB_STORE).get(cle);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function idbDel(cle) {
    return ouvrirDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).delete(cle);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  // --- Points ---

  function lirePoints() {
    var p = lireJson(CLE_POINTS, []);
    return Array.isArray(p) ? p : [];
  }

  function ecrirePoints(points) {
    ecrireJson(CLE_POINTS, points);
  }

  // --- Configuration ---

  function lireConfig() {
    var defaut = global.GeoLocConfig.CONFIG_DEFAUT;
    var c = lireJson(CLE_CONFIG, {});
    var out = {};
    Object.keys(defaut).forEach(function (k) {
      out[k] = c[k] === undefined ? defaut[k] : c[k];
    });
    return out;
  }

  function ecrireConfig(config) {
    ecrireJson(CLE_CONFIG, config);
  }

  // --- Références automatiques, un compteur par filière ---

  function prochaineReference(filiereId) {
    var f = global.GeoLocConfig.filiere(filiereId);
    var prefixe = f ? f.prefixe : 'PT';
    var compteurs = lireJson(CLE_COMPTEUR, {});
    var n = (compteurs[filiereId] || 0) + 1;
    compteurs[filiereId] = n;
    ecrireJson(CLE_COMPTEUR, compteurs);
    return prefixe + '-' + String(n).padStart(4, '0');
  }

  /** Recale les compteurs sur le plus grand numéro existant (après un import). */
  function resynchroniserCompteurs(points) {
    var compteurs = {};
    points.forEach(function (p) {
      var f = global.GeoLocConfig.filiere(p.filiere);
      if (!f || !p.reference) return;
      var m = new RegExp('^' + f.prefixe + '-(\\d+)$').exec(p.reference);
      if (!m) return;
      var n = parseInt(m[1], 10);
      if (!compteurs[p.filiere] || n > compteurs[p.filiere]) compteurs[p.filiere] = n;
    });
    ecrireJson(CLE_COMPTEUR, compteurs);
  }

  // --- Fichiers CSV liés, un par filière (File System Access API, Chrome / Edge / Android) ---

  function cleHandle(filiereId) {
    return 'csv-' + filiereId;
  }

  function fsaDisponible() {
    return typeof global.showSaveFilePicker === 'function';
  }

  var TYPES_CSV = [{ description: 'Fichier CSV', accept: { 'text/csv': ['.csv'] } }];

  /**
   * Le catalogue de matériel est un fichier lié comme les autres, sous la clé
   * `parametres` : même mécanique de handle, même écriture intégrale.
   */
  function nomFichier(cle) {
    if (cle === 'parametres') return global.GeoLocCatalogue.FICHIER;
    var f = global.GeoLocConfig.filiere(cle);
    return f ? f.fichier : 'geoloc.csv';
  }

  function choisirFichier(filiereId) {
    return global.showSaveFilePicker({
      suggestedName: nomFichier(filiereId),
      types: TYPES_CSV
    }).then(function (handle) {
      return idbSet(cleHandle(filiereId), handle).then(function () { return handle; });
    });
  }

  function ouvrirFichierExistant(filiereId) {
    return global.showOpenFilePicker({ multiple: false, types: TYPES_CSV }).then(function (handles) {
      var handle = handles[0];
      return idbSet(cleHandle(filiereId), handle).then(function () { return handle; });
    });
  }

  function handleCourant(filiereId) {
    return idbGet(cleHandle(filiereId)).then(function (h) { return h || null; });
  }

  function oublierFichier(filiereId) {
    return idbDel(cleHandle(filiereId));
  }

  /**
   * @returns {Promise<'ok'|'permission'|'absent'|'erreur'>} état de l'écriture
   */
  function ecrireFichier(filiereId, contenu) {
    return handleCourant(filiereId).then(function (handle) {
      if (!handle) return 'absent';
      return handle.queryPermission({ mode: 'readwrite' }).then(function (etat) {
        if (etat === 'granted') return 'granted';
        return handle.requestPermission({ mode: 'readwrite' });
      }).then(function (etat) {
        if (etat !== 'granted') return 'permission';
        return handle.createWritable().then(function (flux) {
          return flux.write(contenu).then(function () { return flux.close(); });
        }).then(function () { return 'ok'; });
      });
    }).catch(function () { return 'erreur'; });
  }

  function lireFichier(filiereId) {
    return handleCourant(filiereId).then(function (handle) {
      if (!handle) return null;
      return handle.getFile().then(function (f) { return f.text(); });
    });
  }

  /** Reliquat de la v0.1 : un handle unique 'csv' pour les trois filières. */
  function migrerAncienHandle() {
    return idbGet('csv').then(function (h) {
      return h ? idbDel('csv') : null;
    }).catch(function () { return null; });
  }

  function toutEffacer() {
    localStorage.removeItem(CLE_POINTS);
    localStorage.removeItem(CLE_COMPTEUR);
  }

  global.GeoLocStore = {
    nomFichier: nomFichier,
    lirePoints: lirePoints,
    ecrirePoints: ecrirePoints,
    lireConfig: lireConfig,
    ecrireConfig: ecrireConfig,
    prochaineReference: prochaineReference,
    resynchroniserCompteurs: resynchroniserCompteurs,
    fsaDisponible: fsaDisponible,
    choisirFichier: choisirFichier,
    ouvrirFichierExistant: ouvrirFichierExistant,
    handleCourant: handleCourant,
    oublierFichier: oublierFichier,
    ecrireFichier: ecrireFichier,
    lireFichier: lireFichier,
    migrerAncienHandle: migrerAncienHandle,
    toutEffacer: toutEffacer
  };
})(window);
