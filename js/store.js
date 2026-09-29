/**
 * Persistance. localStorage fait autorité (jamais de perte de saisie terrain),
 * le fichier CSV est une projection réécrite intégralement à chaque modification.
 * Le handle de fichier est gardé en IndexedDB : localStorage ne sait stocker que du texte.
 */
(function (global) {
  'use strict';

  var CLE_POINTS = 'groma.points';
  var CLE_CONFIG = 'groma.config';
  var CLE_COMPTEUR = 'groma.compteurs';
  var CLE_FAVORIS = 'groma.favoris';
  var CLE_SAUVEGARDES = 'groma.sauvegardes';
  var DB_NOM = 'groma';
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

  // --- Favoris ---
  //
  // Une combinaison type / modèle / détail mise de côté pour être reposée d'un
  // geste. Ce sont des raccourcis de saisie propres au poste, pas des données de
  // relevé : ils ne partent dans aucun CSV.

  function lireFavoris() {
    var f = lireJson(CLE_FAVORIS, {});
    return f && typeof f === 'object' && !Array.isArray(f) ? f : {};
  }

  function ecrireFavoris(favoris) {
    ecrireJson(CLE_FAVORIS, favoris);
  }

  // --- Mise à l'abri des relevés ---

  // Deux états par filière, et pas un de plus : soit tout ce qu'elle contient est
  // sorti du navigateur (horodatage présent), soit il reste des modifications qui
  // n'existent que là (absent). Un modèle plus fin — compter les points en
  // attente — se trompe dès qu'on modifie ou supprime un relevé déjà exporté.

  function lireSauvegardes() {
    var s = lireJson(CLE_SAUVEGARDES, {});
    return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  }

  function ecrireSauvegardes(sauvegardes) {
    ecrireJson(CLE_SAUVEGARDES, sauvegardes);
  }

  /**
   * Demande au navigateur de ne pas évincer le stockage sous la pression du
   * disque. Chrome l'accorde en silence à une application installée ; Firefox
   * pose la question. Appelé après un premier enregistrement, jamais au
   * démarrage : une demande d'autorisation sur une page vide n'a aucun sens.
   */
  function demanderPersistance() {
    if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(false);
    return navigator.storage.persisted()
      .then(function (deja) { return deja || navigator.storage.persist(); })
      .catch(function () { return false; });
  }

  // --- Configuration ---

  function lireConfig() {
    var defaut = global.GromaConfig.CONFIG_DEFAUT;
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
    var f = global.GromaConfig.filiere(filiereId);
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
      var f = global.GromaConfig.filiere(p.filiere);
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
    if (cle === 'parametres') return global.GromaCatalogue.FICHIER;
    var f = global.GromaConfig.filiere(cle);
    return f ? f.fichier : 'groma.csv';
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
   * État de la liaison, sans jamais ouvrir de fenêtre :
   *   'absent'       aucune poignée — le fichier n'a jamais été relié
   *   'a-autoriser'  poignée valide, accès expiré
   *   'introuvable'  poignée et accès valides, mais le fichier a disparu du disque
   *   'lie'          tout va bien
   *
   * Le troisième état oblige à toucher réellement le fichier : une poignée
   * survit à la suppression de sa cible, et `queryPermission` répond `granted`
   * sur un fichier qui n'existe plus. Sans ce contrôle, l'application se croit
   * reliée et chaque écriture échoue sans rien dire.
   */
  function etatLiaison(filiereId) {
    return handleCourant(filiereId).then(function (handle) {
      if (!handle) return 'absent';
      return handle.queryPermission({ mode: 'readwrite' }).then(function (etat) {
        if (etat !== 'granted') return 'a-autoriser';
        return handle.getFile().then(
          function () { return 'lie'; },
          function () { return 'introuvable'; }
        );
      });
    }).catch(function () { return 'absent'; });
  }

  /**
   * Redemande l'accès au fichier déjà lié. **À n'appeler que depuis un clic** :
   * le navigateur exige un geste de l'utilisateur et refuse en silence sinon.
   */
  function demanderPermission(filiereId) {
    return handleCourant(filiereId).then(function (handle) {
      if (!handle) return false;
      return handle.requestPermission({ mode: 'readwrite' })
        .then(function (etat) { return etat === 'granted'; });
    }).catch(function () { return false; });
  }

  /**
   * @returns {Promise<'ok'|'permission'|'absent'|'erreur'>} état de l'écriture
   *
   * Ne demande jamais la permission : un enregistrement part d'un clic, mais la
   * chaîne de promesses qui y mène a déjà consommé le geste, et le navigateur
   * rejette alors la demande sans rien afficher. C'est à l'interface de la
   * réclamer, depuis un bouton dédié.
   */
  function ecrireFichier(filiereId, contenu) {
    return handleCourant(filiereId).then(function (handle) {
      if (!handle) return 'absent';
      return handle.queryPermission({ mode: 'readwrite' }).then(function (etat) {
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

  /** Purge les relevés. Favoris et catalogue survivent : ce sont des réglages. */
  function toutEffacer() {
    localStorage.removeItem(CLE_POINTS);
    localStorage.removeItem(CLE_COMPTEUR);
    localStorage.removeItem(CLE_SAUVEGARDES);
  }

  global.GromaStore = {
    nomFichier: nomFichier,
    lirePoints: lirePoints,
    ecrirePoints: ecrirePoints,
    lireFavoris: lireFavoris,
    ecrireFavoris: ecrireFavoris,
    lireSauvegardes: lireSauvegardes,
    ecrireSauvegardes: ecrireSauvegardes,
    demanderPersistance: demanderPersistance,
    lireConfig: lireConfig,
    ecrireConfig: ecrireConfig,
    prochaineReference: prochaineReference,
    resynchroniserCompteurs: resynchroniserCompteurs,
    fsaDisponible: fsaDisponible,
    choisirFichier: choisirFichier,
    ouvrirFichierExistant: ouvrirFichierExistant,
    handleCourant: handleCourant,
    etatLiaison: etatLiaison,
    demanderPermission: demanderPermission,
    oublierFichier: oublierFichier,
    ecrireFichier: ecrireFichier,
    lireFichier: lireFichier,
    migrerAncienHandle: migrerAncienHandle,
    toutEffacer: toutEffacer
  };
})(window);
