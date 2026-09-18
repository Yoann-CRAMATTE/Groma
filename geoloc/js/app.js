/**
 * Assemblage de l'interface. Tout le DOM est construit par programme à partir du
 * schéma de config.js : les trois onglets de relevé partagent strictement le même
 * code, seules leurs données et leur couleur diffèrent.
 */
(function (global) {
  'use strict';

  var Cfg = global.GeoLocConfig;
  var Store = global.GeoLocStore;
  var Csv = global.GeoLocCsv;
  var Geo = global.GeoLocGeo;
  var Carte = global.GeoLocCarte;
  var L93 = global.Lambert93;

  var etat = {
    config: null,
    points: [],
    ongletActif: null,
    positions: {},   // filiereId -> dernière position relevée
    edition: {},     // filiereId -> id du point en cours de modification
    affinage: {}     // filiereId -> série d'acquisition en cours
  };

  // ---------------------------------------------------------------- utilitaires

  function el(balise, attrs, enfants) {
    var n = document.createElement(balise);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'texte') n.textContent = attrs[k];
      else if (k === 'classe') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    });
    (enfants || []).forEach(function (e) {
      if (e === null || e === undefined) return;
      n.appendChild(typeof e === 'string' ? document.createTextNode(e) : e);
    });
    return n;
  }

  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  var minuterieToast = null;
  function toast(message, type) {
    var t = document.getElementById('toast');
    t.textContent = message;
    t.setAttribute('data-type', type || 'info');
    t.setAttribute('data-visible', 'true');
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(function () { t.setAttribute('data-visible', 'false'); }, 3600);
  }

  function nombre(valeur, decimales) {
    if (valeur === null || valeur === undefined || valeur === '') return '';
    var n = Number(valeur);
    return isNaN(n) ? '' : n.toFixed(decimales);
  }

  function dateCourteFr(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  function idUnique() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // ---------------------------------------------------------------- fichier CSV

  function contenuCsv(filiereId) {
    return Csv.serialiser(Cfg.colonnesCsv(filiereId), pointsDe(filiereId), etat.config.separateur);
  }

  /** Réécrit intégralement le CSV d'une filière ; silencieux si aucun fichier n'est lié. */
  function synchroniserFichier(filiereId) {
    if (!Store.fsaDisponible()) return Promise.resolve('absent');
    return Store.ecrireFichier(filiereId, contenuCsv(filiereId)).then(function (r) {
      var f = Cfg.filiere(filiereId);
      if (r === 'permission') toast('Accès au CSV ' + f.label + ' refusé : reliez le fichier dans Configuration.', 'erreur');
      else if (r === 'erreur') toast('Écriture du CSV ' + f.label + ' impossible. Les données restent enregistrées dans le navigateur.', 'erreur');
      rafraichirBadgeFichier();
      return r;
    });
  }

  /** Après une purge ou un changement de séparateur : les trois fichiers sont concernés. */
  function synchroniserTout() {
    return Promise.all(Cfg.FILIERES.map(function (f) { return synchroniserFichier(f.id); }));
  }

  /** Le badge suit l'onglet actif : chaque filière a son propre fichier. */
  function rafraichirBadgeFichier() {
    var badge = document.getElementById('badge-fichier');
    var filiereId = etat.ongletActif;

    if (!filiereId || filiereId === 'configuration') {
      badge.setAttribute('data-etat', 'neutre');
      badge.textContent = '3 fichiers CSV';
      badge.title = 'Un fichier par filière, géré ci-dessous.';
      return;
    }
    if (!Store.fsaDisponible()) {
      badge.setAttribute('data-etat', 'absent');
      badge.textContent = 'Export manuel';
      badge.title = "Ce navigateur n'écrit pas directement sur le disque : utilisez Exporter le CSV.";
      return;
    }
    Store.handleCourant(filiereId).then(function (h) {
      if (etat.ongletActif !== filiereId) return; // l'utilisateur a changé d'onglet entre-temps
      if (h) {
        badge.setAttribute('data-etat', 'lie');
        badge.textContent = h.name;
        badge.title = 'Fichier lié pour cette filière — mis à jour à chaque enregistrement.';
      } else {
        badge.setAttribute('data-etat', 'absent');
        badge.textContent = 'CSV non lié';
        badge.title = 'Liez un fichier CSV pour cette filière dans Configuration.';
      }
    });
  }

  function telechargerCsv(filiereId) {
    var f = Cfg.filiere(filiereId);
    var blob = new Blob([contenuCsv(filiereId)], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var nom = f.fichier.replace(/\.csv$/, '') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    var a = el('a', { href: url, download: nom });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** Téléchargements échelonnés : Chrome bloque les déclenchements simultanés. */
  function telechargerTousCsv() {
    Cfg.FILIERES.forEach(function (f, i) {
      setTimeout(function () { telechargerCsv(f.id); }, i * 350);
    });
  }

  // ---------------------------------------------------------------- onglets

  function appliquerCouleur(couleur) {
    document.documentElement.style.setProperty('--accent', couleur);
  }

  function construireOnglets() {
    var nav = document.getElementById('onglets');
    vider(nav);
    var entrees = Cfg.FILIERES.map(function (f) {
      return { id: f.id, label: f.label, labelCourt: f.labelCourt, couleur: f.couleur };
    }).concat([{ id: 'configuration', label: 'CONFIGURATION', labelCourt: 'CONFIG', couleur: '#94a3b8' }]);

    entrees.forEach(function (e) {
      // Deux libellés : sous 400 px, « ASSAINISSEMENT » ne tient pas sans être coupé.
      var b = el('button', {
        classe: 'onglet',
        type: 'button',
        role: 'tab',
        id: 'onglet-' + e.id,
        'aria-controls': 'vue-' + e.id,
        'aria-selected': 'false',
        'aria-label': e.label,
        style: '--couleur-onglet:' + e.couleur,
        onclick: function () { activerOnglet(e.id); }
      }, [
        el('span', { classe: 'onglet-long', texte: e.label }),
        el('span', { classe: 'onglet-court', texte: e.labelCourt })
      ]);
      nav.appendChild(b);
    });
  }

  function activerOnglet(id) {
    etat.ongletActif = id;
    var entree = Cfg.filiere(id);
    appliquerCouleur(entree ? entree.couleur : '#94a3b8');

    Array.prototype.forEach.call(document.querySelectorAll('.onglet'), function (b) {
      b.setAttribute('aria-selected', b.id === 'onglet-' + id ? 'true' : 'false');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.vue'), function (v) {
      v.hidden = v.id !== 'vue-' + id;
    });
    rafraichirBadgeFichier();
    if (id === 'configuration') { rafraichirStats(); rafraichirFonds(); }
    else rafraichirListe(id);
    try { localStorage.setItem('geoloc.onglet', id); } catch (e) { /* mode privé */ }
  }

  // ---------------------------------------------------------------- vue filière

  function construireChamp(filiereId, champ) {
    var idChamp = filiereId + '-' + champ.cle;
    var saisie;

    if (champ.type === 'select') {
      saisie = el('select', { id: idChamp, name: champ.cle },
        [el('option', { value: '', texte: '—' })].concat(
          champ.options.map(function (o) { return el('option', { value: o, texte: o }); })
        ));
    } else if (champ.type === 'textarea') {
      saisie = el('textarea', { id: idChamp, name: champ.cle, rows: 3 });
    } else {
      var attrs = { id: idChamp, name: champ.cle, type: champ.type };
      if (champ.placeholder) attrs.placeholder = champ.placeholder;
      if (champ.min !== undefined) attrs.min = champ.min;
      if (champ.max !== undefined) attrs.max = champ.max;
      if (champ.step !== undefined) attrs.step = champ.step;
      if (champ.liste === 'communes') attrs.list = 'liste-communes';
      if (champ.type === 'text') attrs.autocomplete = 'off';
      saisie = el('input', attrs);
    }

    var etiquette = el('label', { for: idChamp }, [champ.label]);
    if (champ.requis) etiquette.appendChild(el('span', { classe: 'requis', texte: ' *' }));

    var classe = 'champ' + (champ.type === 'textarea' ? ' champ--large' : '');
    return el('div', { classe: classe }, [etiquette, saisie]);
  }

  function blocPosition(filiereId) {
    var lignes = [
      ['Latitude', 'lat'], ['Longitude', 'lon'], ['Altitude', 'alt'], ['Précision', 'prec'],
      ['Dispersion', 'disp'], ['Mesures', 'nb'], ['X Lambert 93', 'x93'], ['Y Lambert 93', 'y93']
    ];
    var dl = el('dl', { classe: 'position' });
    lignes.forEach(function (l) {
      dl.appendChild(el('div', {}, [
        el('dt', { texte: l[0] }),
        el('dd', { id: filiereId + '-pos-' + l[1], classe: 'vide', texte: '—' })
      ]));
    });

    return el('section', { classe: 'bloc' }, [
      el('h2', { texte: 'Position' }),
      el('div', { classe: 'actions-gps' }, [
        el('button', {
          classe: 'btn-gps', type: 'button', id: filiereId + '-btn-gps',
          texte: '⌖  Relevé rapide',
          title: 'Une seule mesure, immédiate',
          onclick: function () { lancerLocalisation(filiereId); }
        }),
        el('button', {
          classe: 'btn-primaire btn-gps', type: 'button', id: filiereId + '-btn-precis',
          texte: '◎  Précision maximale',
          title: 'Mesure continue puis agrégation des meilleures positions',
          onclick: function () { basculerAffinage(filiereId); }
        })
      ]),
      el('div', { classe: 'progression', id: filiereId + '-progression', hidden: 'hidden' }, [
        el('div', { classe: 'progression-barre', id: filiereId + '-progression-barre' })
      ]),
      el('button', {
        classe: 'btn-carte btn-plein', type: 'button', id: filiereId + '-btn-carte',
        texte: '🗺  Ajuster sur la carte', disabled: 'disabled',
        onclick: function () { ouvrirCarte(filiereId); }
      }),
      dl,
      el('p', { classe: 'etat-gps', id: filiereId + '-etat-gps' })
    ]);
  }

  function construireVueFiliere(f) {
    var grille = el('div', { classe: 'grille' });
    Cfg.champsDe(f.id).forEach(function (c) { grille.appendChild(construireChamp(f.id, c)); });

    var formulaire = el('form', { id: f.id + '-form', autocomplete: 'off' }, [
      grille,
      el('div', { classe: 'actions' }, [
        el('button', { classe: 'btn-primaire', type: 'submit', id: f.id + '-btn-valider', texte: 'Enregistrer le point' }),
        el('button', {
          type: 'button', texte: 'Réinitialiser',
          onclick: function () { reinitialiserFormulaire(f.id); }
        })
      ])
    ]);
    formulaire.addEventListener('submit', function (ev) {
      ev.preventDefault();
      enregistrerPoint(f.id);
    });

    return el('section', { classe: 'vue', id: 'vue-' + f.id, role: 'tabpanel', 'aria-labelledby': 'onglet-' + f.id, hidden: 'hidden' }, [
      blocPosition(f.id),
      el('section', { classe: 'bloc' }, [
        el('h2', { texte: f.titre }),
        formulaire
      ]),
      el('section', { classe: 'bloc' }, [
        el('div', { classe: 'bloc-titre' }, [
          el('h2', { texte: 'Points relevés' }),
          el('span', { classe: 'compteur', id: f.id + '-compteur', texte: '0' })
        ]),
        el('input', {
          type: 'search', id: f.id + '-recherche', placeholder: 'Filtrer (référence, commune, type, observations)…',
          oninput: function () { rafraichirListe(f.id); }
        }),
        el('ul', { classe: 'liste', id: f.id + '-liste' })
      ])
    ]);
  }

  // ---------------------------------------------------------------- GPS

  function lancerLocalisation(filiereId) {
    var bouton = document.getElementById(filiereId + '-btn-gps');
    var info = document.getElementById(filiereId + '-etat-gps');
    bouton.disabled = true;
    bouton.textContent = '⌖  Acquisition…';
    info.setAttribute('data-niveau', 'info');
    info.textContent = 'Recherche du signal GPS…';

    Geo.localiser(etat.config).then(function (pos) {
      pos.methode = 'ponctuelle';
      pos.mesures = 1;
      pos.dispersion = null;
      pos.duree = null;
      etat.positions[filiereId] = pos;
      afficherPosition(filiereId, pos);
      if (pos.precision > etat.config.precisionMax) {
        info.setAttribute('data-niveau', 'alerte');
        info.textContent = 'Précision ' + Math.round(pos.precision) + ' m — au-delà du seuil de '
          + etat.config.precisionMax + ' m. Relevé possible, mais à contrôler.';
      } else {
        info.setAttribute('data-niveau', 'ok');
        info.textContent = 'Position acquise à ' + dateCourteFr(pos.horodatage)
          + ' — précision ' + Math.round(pos.precision) + ' m.';
      }
    }).catch(function (err) {
      info.setAttribute('data-niveau', 'erreur');
      info.textContent = err.message;
    }).then(function () {
      bouton.disabled = false;
      bouton.textContent = '⌖  Localiser';
    });
  }

  /** Démarre la série, ou la clôt si elle tourne déjà. */
  function basculerAffinage(filiereId) {
    var serie = etat.affinage[filiereId];
    if (serie) { serie.arreter(); return; }

    var bouton = document.getElementById(filiereId + '-btn-precis');
    var rapide = document.getElementById(filiereId + '-btn-gps');
    var info = document.getElementById(filiereId + '-etat-gps');
    var barre = document.getElementById(filiereId + '-progression-barre');
    var jauge = document.getElementById(filiereId + '-progression');

    rapide.disabled = true;
    bouton.textContent = '■  Arrêter et valider';
    bouton.classList.add('btn-actif');
    jauge.hidden = false;
    barre.style.width = '0%';
    info.setAttribute('data-niveau', 'info');
    info.textContent = 'Acquisition en cours… restez immobile au-dessus de l\'ouvrage.';

    // Rafraîchit la barre même sans nouvelle mesure : le GPS peut rester muet.
    var debut = Date.now();
    var total = Math.max(5, etat.config.dureeAffinage || 30);
    var tic = setInterval(function () {
      var part = Math.min(100, (Date.now() - debut) / (total * 1000) * 100);
      barre.style.width = part + '%';
    }, 200);

    function nettoyer() {
      clearInterval(tic);
      etat.affinage[filiereId] = null;
      rapide.disabled = false;
      bouton.textContent = '◎  Précision maximale';
      bouton.classList.remove('btn-actif');
      jauge.hidden = true;
    }

    var serie2 = Geo.localiserPrecis(etat.config, function (p) {
      info.textContent = p.mesures + ' mesure(s) — meilleure ' + Math.round(p.meilleure)
        + ' m, dernière ' + Math.round(p.derniere) + ' m';
    });
    etat.affinage[filiereId] = serie2;

    serie2.promesse.then(function (pos) {
      etat.positions[filiereId] = pos;
      afficherPosition(filiereId, pos);

      var messages = [Math.round(pos.duree) + ' s, ' + pos.mesures + ' mesure(s) dont '
        + pos.retenues + ' retenue(s)', 'précision ' + Math.round(pos.precision) + ' m',
        'dispersion ' + pos.dispersion.toFixed(1) + ' m'];

      if (pos.precision > etat.config.precisionMax) {
        info.setAttribute('data-niveau', 'alerte');
        info.textContent = messages.join(' — ') + '. Au-delà du seuil de '
          + etat.config.precisionMax + ' m : à contrôler.';
      } else {
        info.setAttribute('data-niveau', 'ok');
        info.textContent = messages.join(' — ') + '.';
      }
    }).catch(function (err) {
      info.setAttribute('data-niveau', 'erreur');
      info.textContent = err.message;
    }).then(nettoyer);
  }

  function afficherPosition(filiereId, pos) {
    var boutonCarte = document.getElementById(filiereId + '-btn-carte');
    if (boutonCarte) boutonCarte.disabled = !pos;

    function poser(suffixe, valeur) {
      var n = document.getElementById(filiereId + '-pos-' + suffixe);
      n.textContent = valeur === '' || valeur === null ? '—' : valeur;
      n.className = (valeur === '' || valeur === null) ? 'vide' : '';
    }
    if (!pos) {
      ['lat', 'lon', 'alt', 'prec', 'disp', 'nb', 'x93', 'y93'].forEach(function (s) { poser(s, null); });
      return;
    }
    poser('lat', nombre(pos.latitude, 6));
    poser('lon', nombre(pos.longitude, 6));
    poser('alt', pos.altitude === null ? null : nombre(pos.altitude, 1) + ' m');
    poser('prec', Math.round(pos.precision) + ' m');
    poser('disp', pos.dispersion === null || pos.dispersion === undefined ? null : pos.dispersion.toFixed(1) + ' m');
    poser('nb', pos.mesures ? String(pos.mesures) + (pos.methode === 'affinee' ? ' (affiné)' : '') : null);

    if (etat.config.afficherLambert) {
      var l = L93.wgs84ToLambert93(pos.latitude, pos.longitude);
      poser('x93', nombre(l.x, 2));
      poser('y93', nombre(l.y, 2));
    } else {
      poser('x93', null);
      poser('y93', null);
    }
  }

  // ---------------------------------------------------------------- formulaire

  function lireFormulaire(filiereId) {
    var valeurs = {};
    Cfg.champsDe(filiereId).forEach(function (c) {
      var n = document.getElementById(filiereId + '-' + c.cle);
      valeurs[c.cle] = n ? n.value.trim() : '';
    });
    return valeurs;
  }

  function ecrireFormulaire(filiereId, valeurs) {
    Cfg.champsDe(filiereId).forEach(function (c) {
      var n = document.getElementById(filiereId + '-' + c.cle);
      if (n) n.value = valeurs[c.cle] === undefined ? '' : valeurs[c.cle];
    });
  }

  function validerFormulaire(filiereId, valeurs) {
    var manquants = [];
    Cfg.champsDe(filiereId).forEach(function (c) {
      var n = document.getElementById(filiereId + '-' + c.cle);
      var vide = c.requis && !valeurs[c.cle];
      if (n) n.setAttribute('aria-invalid', vide ? 'true' : 'false');
      if (vide) manquants.push(c.label);
    });
    return manquants;
  }

  function reinitialiserFormulaire(filiereId) {
    var serie = etat.affinage[filiereId];
    if (serie) { serie.arreter(); etat.affinage[filiereId] = null; }
    ecrireFormulaire(filiereId, {});
    Cfg.champsDe(filiereId).forEach(function (c) {
      var n = document.getElementById(filiereId + '-' + c.cle);
      if (n) n.setAttribute('aria-invalid', 'false');
    });
    etat.edition[filiereId] = null;
    etat.positions[filiereId] = null;
    afficherPosition(filiereId, null);
    var info = document.getElementById(filiereId + '-etat-gps');
    info.textContent = '';
    info.removeAttribute('data-niveau');
    document.getElementById(filiereId + '-btn-valider').textContent = 'Enregistrer le point';
  }

  function enregistrerPoint(filiereId) {
    var valeurs = lireFormulaire(filiereId);
    var manquants = validerFormulaire(filiereId, valeurs);
    if (manquants.length) {
      toast('Champs obligatoires manquants : ' + manquants.join(', ') + '.', 'erreur');
      return;
    }

    var enEdition = etat.edition[filiereId];
    var pos = etat.positions[filiereId];
    if (!pos && !enEdition) {
      toast('Relevez la position avant d\'enregistrer.', 'erreur');
      return;
    }

    var point;
    if (enEdition) {
      point = etat.points.filter(function (p) { return p.id === enEdition; })[0];
      if (!point) { toast('Point introuvable, modification annulée.', 'erreur'); reinitialiserFormulaire(filiereId); return; }
    } else {
      point = { id: idUnique(), filiere: filiereId, date_saisie: new Date().toISOString() };
      etat.points.push(point);
    }

    point.operateur = etat.config.operateur;
    Object.keys(valeurs).forEach(function (k) { point[k] = valeurs[k]; });
    if (!point.reference) point.reference = Store.prochaineReference(filiereId);

    if (pos) {
      point.latitude = nombre(pos.latitude, 7);
      point.longitude = nombre(pos.longitude, 7);
      point.altitude_m = pos.altitude === null ? '' : nombre(pos.altitude, 2);
      point.precision_m = nombre(pos.precision, 1);
      point.dispersion_m = pos.dispersion === null || pos.dispersion === undefined ? '' : nombre(pos.dispersion, 2);
      point.methode_gps = pos.methode || 'ponctuelle';
      point.nb_mesures = pos.mesures ? String(pos.mesures) : '';
      point.duree_gps_s = pos.duree === null || pos.duree === undefined ? '' : nombre(pos.duree, 1);
      point.position_ajustee = pos.ajustee ? 'oui' : 'non';
      point.ecart_ajustement_m = pos.ajustee ? nombre(pos.ecartAjustement, 2) : '';
      var l = L93.wgs84ToLambert93(pos.latitude, pos.longitude);
      point.x_l93 = nombre(l.x, 2);
      point.y_l93 = nombre(l.y, 2);
    }

    Store.ecrirePoints(etat.points);
    var reference = point.reference;
    reinitialiserFormulaire(filiereId);
    rafraichirListe(filiereId);

    synchroniserFichier(filiereId).then(function (r) {
      if (r === 'ok') toast(reference + ' enregistré et écrit dans ' + Cfg.filiere(filiereId).fichier + '.', 'succes');
      else if (r === 'absent') toast(reference + ' enregistré. Aucun CSV lié pour cette filière : pensez à exporter.', 'info');
      else toast(reference + ' enregistré localement.', 'info');
    });
  }

  // ---------------------------------------------------------------- liste

  function pointsDe(filiereId) {
    return etat.points.filter(function (p) { return p.filiere === filiereId; });
  }

  function resumePoint(filiereId, p) {
    var f = Cfg.filiere(filiereId);
    var parts = [];
    f.champs.slice(0, 3).forEach(function (c) {
      if (p[c.cle]) parts.push(c.label + ' : ' + p[c.cle]);
    });
    return parts.join(' · ');
  }

  function construireLignePoint(filiereId, p) {
    var f = Cfg.filiere(filiereId);
    var enfants = [
      el('div', { classe: 'point-entete' }, [
        el('span', { classe: 'point-ref', texte: [p.reference || '(sans référence)', p.commune].filter(Boolean).join(' — ') }),
        el('span', { classe: 'point-date', texte: dateCourteFr(p.date_saisie) })
      ])
    ];

    var resume = resumePoint(filiereId, p);
    if (resume) enfants.push(el('div', { classe: 'point-detail', texte: resume }));
    if (p.observations) enfants.push(el('div', { classe: 'point-detail', texte: '« ' + p.observations + ' »' }));

    if (p.latitude && p.longitude) {
      enfants.push(el('div', { classe: 'point-coord' }, [
        el('a', {
          classe: 'lien-carte',
          href: Geo.lienCarte(p.latitude, p.longitude),
          target: '_blank', rel: 'noopener noreferrer',
          title: 'Ouvrir dans OpenStreetMap',
          texte: '⌖ ' + p.latitude + ', ' + p.longitude
        }),
        el('span', { classe: 'point-precision', texte: '±' + (p.precision_m || '?') + ' m' }),
        p.methode_gps === 'affinee'
          ? el('span', {
              classe: 'point-methode',
              title: p.nb_mesures + ' mesures sur ' + p.duree_gps_s + ' s, dispersion ' + p.dispersion_m + ' m',
              texte: '◎ affiné'
            })
          : null
      ]));
    }

    enfants.push(el('div', { classe: 'point-actions' }, [
      el('button', { type: 'button', texte: 'Modifier', onclick: function () { editerPoint(filiereId, p.id); } }),
      el('button', { type: 'button', texte: 'Dupliquer', onclick: function () { dupliquerPoint(filiereId, p.id); } }),
      el('button', { type: 'button', classe: 'btn-danger', texte: 'Supprimer', onclick: function () { supprimerPoint(filiereId, p.id); } })
    ]));

    return el('li', { classe: 'point', style: 'border-left-color:' + f.couleur }, enfants);
  }

  function rafraichirListe(filiereId) {
    var liste = document.getElementById(filiereId + '-liste');
    var compteur = document.getElementById(filiereId + '-compteur');
    var recherche = document.getElementById(filiereId + '-recherche');
    if (!liste) return;

    var q = (recherche ? recherche.value : '').trim().toLowerCase();
    var tous = pointsDe(filiereId);
    var visibles = tous.filter(function (p) {
      if (!q) return true;
      return Cfg.colonnesCsv(filiereId).some(function (c) {
        return p[c] && String(p[c]).toLowerCase().indexOf(q) !== -1;
      });
    }).sort(function (a, b) { return (b.date_saisie || '').localeCompare(a.date_saisie || ''); });

    compteur.textContent = q
      ? visibles.length + ' / ' + tous.length + ' point(s)'
      : tous.length + ' point(s)';

    vider(liste);
    if (!visibles.length) {
      liste.appendChild(el('li', {
        classe: 'vide-message',
        texte: tous.length ? 'Aucun point ne correspond au filtre.' : 'Aucun point relevé pour cette filière.'
      }));
      return;
    }
    visibles.forEach(function (p) { liste.appendChild(construireLignePoint(filiereId, p)); });
  }

  function editerPoint(filiereId, id) {
    var p = etat.points.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    etat.edition[filiereId] = id;
    ecrireFormulaire(filiereId, p);
    if (p.latitude && p.longitude) {
      etat.positions[filiereId] = {
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        altitude: p.altitude_m === '' ? null : Number(p.altitude_m),
        precision: Number(p.precision_m || 0),
        dispersion: p.dispersion_m === '' || p.dispersion_m === undefined ? null : Number(p.dispersion_m),
        methode: p.methode_gps || 'ponctuelle',
        mesures: p.nb_mesures ? Number(p.nb_mesures) : 1,
        duree: p.duree_gps_s === '' || p.duree_gps_s === undefined ? null : Number(p.duree_gps_s),
        ajustee: p.position_ajustee === 'oui',
        ecartAjustement: p.ecart_ajustement_m ? Number(p.ecart_ajustement_m) : 0,
        horodatage: p.date_saisie
      };
      afficherPosition(filiereId, etat.positions[filiereId]);
    }
    document.getElementById(filiereId + '-btn-valider').textContent = 'Mettre à jour ' + (p.reference || '');
    var info = document.getElementById(filiereId + '-etat-gps');
    info.setAttribute('data-niveau', 'info');
    info.textContent = 'Modification en cours. « Localiser » remplace la position enregistrée.';
    document.getElementById(filiereId + '-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Reprend les attributs métier sans la position : cas des ouvrages en série. */
  function dupliquerPoint(filiereId, id) {
    var p = etat.points.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    reinitialiserFormulaire(filiereId);
    var copie = {};
    Cfg.champsDe(filiereId).forEach(function (c) { copie[c.cle] = p[c.cle]; });
    copie.reference = '';
    ecrireFormulaire(filiereId, copie);
    toast('Attributs repris. Relevez la nouvelle position.', 'info');
    document.getElementById(filiereId + '-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function supprimerPoint(filiereId, id) {
    var p = etat.points.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (!confirm('Supprimer définitivement ' + (p.reference || 'ce point') + ' ?')) return;
    etat.points = etat.points.filter(function (x) { return x.id !== id; });
    Store.ecrirePoints(etat.points);
    if (etat.edition[filiereId] === id) reinitialiserFormulaire(filiereId);
    rafraichirListe(filiereId);
    synchroniserFichier(filiereId);
    toast('Point supprimé.', 'info');
  }

  // ---------------------------------------------------------------- carte

  var carte = null;
  var carteEtat = null; // { filiereId, origine, declencheur }

  /**
   * Fonds réellement utilisés : ceux saisis en configuration, sinon ceux fournis
   * par carte.js. Un fond invalide est écarté plutôt que de casser la carte.
   */
  function fondsUtilisables() {
    var perso = etat.config.fondsCarte || [];
    if (!perso.length) return Carte.FONDS;

    var sortie = {};
    perso.forEach(function (f, i) {
      if (Carte.validerFond(f)) return;
      sortie[f.id || ('fond' + i)] = {
        libelle: f.libelle, url: f.url, zoomMax: Number(f.zoomMax), credit: f.credit
      };
    });
    return Object.keys(sortie).length ? sortie : Carte.FONDS;
  }

  function formaterEchelle(metresParPixel) {
    var cm = metresParPixel * 100;
    return cm < 100 ? Math.round(cm) + ' cm/px' : metresParPixel.toFixed(1) + ' m/px';
  }

  function rafraichirInfosCarte() {
    if (!carte || !carteEtat) return;
    var c = carte.centre();
    document.getElementById('carte-lat').textContent = nombre(c.latitude, 6);
    document.getElementById('carte-lon').textContent = nombre(c.longitude, 6);
    document.getElementById('carte-echelle').textContent = formaterEchelle(carte.resolution());

    var ecart = Carte.distance(c, carteEtat.origine);
    var champ = document.getElementById('carte-ecart');
    champ.textContent = ecart < 0.5 ? 'position GPS' : ecart.toFixed(1) + ' m';
    champ.className = ecart > carteEtat.origine.precision ? 'ecart-fort' : '';

    document.getElementById('carte-moins').disabled = false;
    document.getElementById('carte-plus').disabled = carte.zoom() >= carte.zoomMax();
  }

  function construireChoixFonds() {
    var hote = document.getElementById('carte-fonds');
    vider(hote);
    carte.fonds().forEach(function (f) {
      hote.appendChild(el('button', {
        type: 'button',
        classe: 'carte-fond' + (f.id === carte.fond() ? ' carte-fond--actif' : ''),
        texte: f.libelle,
        onclick: function () {
          carte.fond(f.id);
          etat.config.fondCarte = f.id;
          Store.ecrireConfig(etat.config);
          construireChoixFonds();
          rafraichirInfosCarte();
        }
      }));
    });
  }

  function ouvrirCarte(filiereId) {
    var pos = etat.positions[filiereId];
    if (!pos) { toast('Relevez d\'abord une position.', 'erreur'); return; }

    var modale = document.getElementById('modale-carte');
    var hote = document.getElementById('carte-hote');
    var message = document.getElementById('carte-message');

    carteEtat = {
      filiereId: filiereId,
      origine: {
        latitude: pos.latitude,
        longitude: pos.longitude,
        precision: pos.precision || 0
      },
      declencheur: document.getElementById(filiereId + '-btn-carte')
    };

    modale.hidden = false;
    message.textContent = '';

    var fonds = fondsUtilisables();
    carte = Carte.creerCarte(hote, {
      urls: fonds,
      fond: fonds[etat.config.fondCarte] ? etat.config.fondCarte : Object.keys(fonds)[0],
      surChangement: rafraichirInfosCarte,
      surTuiles: function (t) {
        message.textContent = t.perdu
          ? 'Fond de carte indisponible — réseau absent ou service injoignable. '
            + 'Le repère et les coordonnées restent utilisables.'
          : '';
      }
    });

    carte.marqueurs([
      { latitude: pos.latitude, longitude: pos.longitude, type: 'gps', titre: 'Position mesurée' },
      { latitude: pos.latitude, longitude: pos.longitude, type: 'precision',
        rayonM: Math.max(pos.precision || 0, 0.5), titre: 'Rayon de précision annoncé' }
    ]);
    carte.centrer(pos.latitude, pos.longitude, carte.zoomMax());

    construireChoixFonds();
    rafraichirInfosCarte();
    document.getElementById('carte-valider').focus();
  }

  function fermerCarte() {
    var modale = document.getElementById('modale-carte');
    if (modale.hidden) return;
    modale.hidden = true;
    if (carte) { carte.detruire(); carte = null; }
    var declencheur = carteEtat && carteEtat.declencheur;
    carteEtat = null;
    if (declencheur) declencheur.focus();
  }

  function validerCarte() {
    if (!carte || !carteEtat) return;
    var c = carte.centre();
    var filiereId = carteEtat.filiereId;
    var pos = etat.positions[filiereId];
    var ecart = Carte.distance(c, carteEtat.origine);

    if (ecart >= 0.5) {
      // La précision GPS décrit la qualité de la MESURE : un recalage manuel ne
      // l'améliore pas et ne la dégrade pas. On trace l'écart séparément.
      pos.latitude = c.latitude;
      pos.longitude = c.longitude;
      pos.ajustee = true;
      pos.ecartAjustement = ecart;
    }

    afficherPosition(filiereId, pos);

    var info = document.getElementById(filiereId + '-etat-gps');
    if (ecart >= 0.5) {
      info.setAttribute('data-niveau', 'info');
      info.textContent = 'Position recalée sur la carte : ' + ecart.toFixed(1)
        + ' m par rapport à la mesure GPS (précision annoncée '
        + Math.round(carteEtat.origine.precision) + ' m).';
      toast('Position ajustée de ' + ecart.toFixed(1) + ' m.', 'succes');
    } else {
      toast('Position GPS conservée.', 'info');
    }
    fermerCarte();
  }

  function brancherCarte() {
    document.getElementById('modale-fermer').addEventListener('click', fermerCarte);
    document.getElementById('modale-fond').addEventListener('click', fermerCarte);
    document.getElementById('carte-valider').addEventListener('click', validerCarte);

    document.getElementById('carte-recentrer').addEventListener('click', function () {
      if (!carte || !carteEtat) return;
      carte.centrer(carteEtat.origine.latitude, carteEtat.origine.longitude);
      rafraichirInfosCarte();
    });

    document.getElementById('carte-plus').addEventListener('click', function () {
      if (carte) { carte.zoomer(1); rafraichirInfosCarte(); }
    });
    document.getElementById('carte-moins').addEventListener('click', function () {
      if (carte) { carte.zoomer(-1); rafraichirInfosCarte(); }
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') fermerCarte();
    });
  }

  // ---------------------------------------------------------------- configuration

  function champConfig(id, label, type, attrs) {
    var a = Object.assign({ id: 'cfg-' + id, type: type }, attrs || {});
    return el('div', { classe: 'champ' }, [
      el('label', { for: 'cfg-' + id, texte: label }),
      el('input', a)
    ]);
  }

  function construireVueConfiguration() {
    var identite = el('div', { classe: 'grille' }, [
      champConfig('operateur', 'Opérateur (agent)', 'text', { placeholder: 'Nom reporté sur chaque point' }),
      champConfig('collectivite', 'Collectivité', 'text', { placeholder: 'ex. CC Sundgau' })
    ]);

    var communes = el('div', { classe: 'champ champ--large' }, [
      el('label', { for: 'cfg-communes', texte: 'Communes proposées (séparées par une virgule)' }),
      el('textarea', { id: 'cfg-communes', rows: 3, placeholder: 'Réchésy, Altkirch, Dannemarie…' })
    ]);

    var gps = el('div', { classe: 'grille' }, [
      champConfig('precisionMax', 'Seuil d\'alerte de précision (m)', 'number', { min: 1, max: 500, step: 1 }),
      champConfig('timeoutGps', 'Délai maximal d\'acquisition (s)', 'number', { min: 5, max: 120, step: 1 }),
      champConfig('dureeAffinage', 'Durée de la mesure affinée (s)', 'number', { min: 5, max: 300, step: 1 }),
      el('div', { classe: 'champ' }, [
        el('label', { texte: 'Options' }),
        el('div', { classe: 'case' }, [
          el('input', { type: 'checkbox', id: 'cfg-hautePrecision' }),
          el('label', { for: 'cfg-hautePrecision', texte: 'Haute précision GPS' })
        ]),
        el('div', { classe: 'case' }, [
          el('input', { type: 'checkbox', id: 'cfg-afficherLambert' }),
          el('label', { for: 'cfg-afficherLambert', texte: 'Calculer les coordonnées Lambert 93' })
        ])
      ]),
      el('div', { classe: 'champ' }, [
        el('label', { for: 'cfg-separateur', texte: 'Séparateur CSV' }),
        el('select', { id: 'cfg-separateur' }, [
          el('option', { value: ';', texte: '; (Excel français)' }),
          el('option', { value: ',', texte: ', (standard international)' }),
          el('option', { value: '\t', texte: 'Tabulation' })
        ])
      ])
    ]);

    var blocFichier = el('section', { classe: 'bloc' }, [
      el('div', { classe: 'bloc-titre' }, [
        el('h2', { texte: 'Fichiers CSV' }),
        el('button', { type: 'button', classe: 'btn-compact', texte: 'Exporter les 3', onclick: telechargerTousCsv })
      ]),
      el('p', { classe: 'note', texte: 'Un fichier par filière. Chaque CSV ne contient que les colonnes de sa filière.' }),
      el('div', { classe: 'fichiers' }, Cfg.FILIERES.map(construireCarteFichier)),
      el('p', { classe: 'note', id: 'cfg-note-fsa' }),
      el('input', {
        type: 'file', id: 'cfg-import', accept: '.csv,text/csv',
        style: 'display:none', onchange: actionImporter
      })
    ]);

    var blocDonnees = el('section', { classe: 'bloc' }, [
      el('h2', { texte: 'Données' }),
      el('div', { classe: 'stats', id: 'cfg-stats' }),
      el('div', { classe: 'actions' }, [
        el('button', { type: 'button', classe: 'btn-danger', texte: 'Effacer toutes les données', onclick: actionPurger })
      ]),
      el('p', { classe: 'note', texte: "L'import ajoute les lignes au stock existant ; les identifiants déjà présents sont ignorés, et un CSV d'une autre filière est refusé." })
    ]);

    var blocFonds = el('section', { classe: 'bloc' }, [
      el('div', { classe: 'bloc-titre' }, [
        el('h2', { texte: 'Fonds de carte' }),
        el('button', {
          type: 'button', classe: 'btn-compact', texte: 'Rétablir les fonds gratuits',
          onclick: actionRetablirFonds
        })
      ]),
      el('p', {
        classe: 'note',
        texte: "Seuls des services gratuits et sans clé d'accès sont fournis par défaut : "
          + "photo aérienne et plan IGN (Géoplateforme), OpenStreetMap en secours. "
          + "L'attribution est affichée en permanence sur la carte, comme l'exige la licence de ces fonds."
      }),
      el('div', { classe: 'fonds', id: 'cfg-fonds' }),
      el('div', { classe: 'actions' }, [
        el('button', { type: 'button', classe: 'btn-compact', texte: '+ Ajouter un fond', onclick: actionAjouterFond }),
        el('button', { type: 'button', classe: 'btn-primaire btn-compact', texte: 'Enregistrer les fonds', onclick: enregistrerFonds })
      ]),
      el('p', {
        classe: 'note note-alerte',
        texte: "Gratuit ne veut pas dire sans conditions. Les tuiles d'openstreetmap.org "
          + "interdisent les usages applicatifs intensifs, et un service public peut modifier "
          + "ses conditions. Vérifiez celles du fond retenu avant un déploiement en service."
      })
    ]);

    var blocRgpd = el('section', { classe: 'bloc' }, [
      el('h2', { texte: 'Données personnelles' }),
      el('p', {
        classe: 'note note-alerte',
        texte: "L'onglet SPANC enregistre un nom de propriétaire, une adresse et une parcelle : ce sont des données à caractère personnel au sens du RGPD. Elles restent dans ce navigateur et dans le fichier CSV. Durée de conservation, base légale et information des personnes relèvent de la collectivité."
      })
    ]);

    var formulaire = el('form', { id: 'cfg-form' }, [
      identite,
      el('div', { classe: 'grille' }, [communes]),
      gps,
      el('div', { classe: 'actions' }, [
        el('button', { classe: 'btn-primaire', type: 'submit', texte: 'Enregistrer la configuration' })
      ])
    ]);
    formulaire.addEventListener('submit', function (ev) {
      ev.preventDefault();
      enregistrerConfiguration();
    });

    // Le navigateur bloque le submit sans émettre d'événement : on le dit.
    // Message reconstruit plutôt que `validationMessage`, qui suit la langue du navigateur.
    formulaire.addEventListener('invalid', function (ev) {
      var champ = ev.target;
      var etiquette = formulaire.querySelector('label[for="' + champ.id + '"]');
      var nom = etiquette ? etiquette.textContent : champ.id;
      var v = champ.validity;
      var cause;

      if (v.valueMissing) cause = 'valeur obligatoire';
      else if (v.rangeUnderflow) cause = 'minimum ' + champ.min;
      else if (v.rangeOverflow) cause = 'maximum ' + champ.max;
      else if (v.stepMismatch) cause = 'doit être un multiple de ' + champ.step;
      else if (v.badInput) cause = 'nombre attendu';
      else cause = champ.validationMessage;

      toast(nom + ' : ' + cause + '.', 'erreur');
      champ.setAttribute('aria-invalid', 'true');
    }, true);

    formulaire.addEventListener('input', function (ev) {
      if (ev.target.checkValidity && ev.target.checkValidity()) ev.target.setAttribute('aria-invalid', 'false');
    });

    return el('section', { classe: 'vue', id: 'vue-configuration', role: 'tabpanel', 'aria-labelledby': 'onglet-configuration', hidden: 'hidden' }, [
      el('section', { classe: 'bloc' }, [el('h2', { texte: 'Paramètres' }), formulaire]),
      blocFichier,
      blocDonnees,
      blocFonds,
      blocRgpd
    ]);
  }

  /** Une carte par filière : nom du fichier, état de liaison et actions associées. */
  function construireCarteFichier(f) {
    return el('div', { classe: 'fichier', style: 'border-left-color:' + f.couleur }, [
      el('div', { classe: 'fichier-entete' }, [
        el('span', { classe: 'fichier-nom', texte: f.fichier }),
        el('span', { classe: 'fichier-filiere', style: 'color:' + f.couleur, texte: f.label })
      ]),
      el('p', { classe: 'note', id: 'cfg-etat-' + f.id }),
      el('div', { classe: 'actions' }, [
        el('button', {
          type: 'button', classe: 'btn-compact', 'data-fsa': 'true',
          texte: 'Créer / remplacer', onclick: function () { actionCreerFichier(f.id); }
        }),
        el('button', {
          type: 'button', classe: 'btn-compact', 'data-fsa': 'true',
          texte: 'Lier un existant', onclick: function () { actionOuvrirFichier(f.id); }
        }),
        el('button', {
          type: 'button', classe: 'btn-compact', 'data-fsa': 'true',
          texte: 'Délier', onclick: function () { actionDelierFichier(f.id); }
        }),
        el('button', {
          type: 'button', classe: 'btn-compact', texte: 'Exporter',
          onclick: function () { telechargerCsv(f.id); }
        }),
        el('button', {
          type: 'button', classe: 'btn-compact', texte: 'Importer',
          onclick: function () {
            var entree = document.getElementById('cfg-import');
            entree.setAttribute('data-filiere', f.id);
            entree.click();
          }
        })
      ])
    ]);
  }

  /** Fonds affichés dans l'éditeur : ceux de la configuration, sinon les défauts. */
  function fondsEdition() {
    var perso = etat.config.fondsCarte || [];
    if (perso.length) return perso.map(function (f) { return Object.assign({}, f); });
    return Object.keys(Carte.FONDS).map(function (id) {
      var f = Carte.FONDS[id];
      return { id: id, libelle: f.libelle, url: f.url, zoomMax: f.zoomMax, credit: f.credit };
    });
  }

  var fondsBrouillon = null;

  /** Chaque champ porte un identifiant : sans `for`, le libellé n'est lié à rien. */
  function idFond(fond, cle) { return 'cfg-fond-' + fond.id + '-' + cle; }

  function champFond(fond, cle, label, attrs) {
    var saisie = el('input', Object.assign({
      id: idFond(fond, cle),
      type: 'text', value: fond[cle] === undefined ? '' : String(fond[cle]),
      oninput: function (ev) { fond[cle] = ev.target.value; }
    }, attrs || {}));
    return el('div', { classe: 'champ' }, [
      el('label', { for: idFond(fond, cle), texte: label }), saisie
    ]);
  }

  /** `el()` pose des attributs ; un textarea veut sa valeur par propriété. */
  function zoneUrl(fond, noeud) {
    noeud.value = fond.url || '';
    return noeud;
  }

  function rafraichirFonds() {
    var hote = document.getElementById('cfg-fonds');
    if (!hote) return;
    if (!fondsBrouillon) fondsBrouillon = fondsEdition();
    vider(hote);

    fondsBrouillon.forEach(function (fond, index) {
      var probleme = Carte.validerFond(fond);
      hote.appendChild(el('div', { classe: 'fond' + (probleme ? ' fond--invalide' : '') }, [
        el('div', { classe: 'grille' }, [
          champFond(fond, 'libelle', 'Libellé', { placeholder: 'Photo aérienne' }),
          champFond(fond, 'zoomMax', 'Zoom maximal', { type: 'number', min: 1, max: 22, step: 1 }),
          el('div', { classe: 'champ champ--large' }, [
            el('label', { for: idFond(fond, 'url'), texte: 'URL de tuile (repères {z}, {x}, {y})' }),
            // Une URL WMTS dépasse deux cents caractères : illisible dans un champ d'une ligne.
            zoneUrl(fond, el('textarea', {
              id: idFond(fond, 'url'),
              rows: 2, spellcheck: 'false', classe: 'champ-url',
              placeholder: 'https://exemple.fr/{z}/{x}/{y}.png',
              oninput: function (ev) { fond.url = ev.target.value; }
            }))
          ]),
          el('div', { classe: 'champ champ--large' }, [
            el('label', { for: idFond(fond, 'credit'), texte: 'Attribution (obligatoire)' }),
            el('input', {
              id: idFond(fond, 'credit'),
              type: 'text', value: fond.credit || '', placeholder: '© Fournisseur — licence',
              oninput: function (ev) { fond.credit = ev.target.value; }
            })
          ])
        ]),
        probleme ? el('p', { classe: 'note fond-probleme', texte: probleme }) : null,
        el('div', { classe: 'actions' }, [
          el('button', {
            type: 'button', classe: 'btn-compact btn-danger', texte: 'Retirer',
            onclick: function () { fondsBrouillon.splice(index, 1); rafraichirFonds(); }
          })
        ])
      ]));
    });

    if (!fondsBrouillon.length) {
      hote.appendChild(el('p', { classe: 'vide-message', texte: 'Aucun fond : la carte utilisera les fonds gratuits par défaut.' }));
    }
  }

  function actionAjouterFond() {
    if (!fondsBrouillon) fondsBrouillon = fondsEdition();
    fondsBrouillon.push({ id: 'fond' + Date.now().toString(36), libelle: '', url: '', zoomMax: 19, credit: '' });
    rafraichirFonds();
  }

  function actionRetablirFonds() {
    etat.config.fondsCarte = [];
    Store.ecrireConfig(etat.config);
    fondsBrouillon = null;
    rafraichirFonds();
    toast('Fonds gratuits par défaut rétablis.', 'succes');
  }

  function enregistrerFonds() {
    if (!fondsBrouillon) return;

    var invalides = fondsBrouillon
      .map(function (f, i) { var m = Carte.validerFond(f); return m ? (f.libelle || 'Fond ' + (i + 1)) + ' : ' + m : null; })
      .filter(Boolean);

    if (invalides.length) {
      rafraichirFonds();
      toast(invalides[0], 'erreur');
      return;
    }

    etat.config.fondsCarte = fondsBrouillon.map(function (f) {
      return { id: f.id, libelle: f.libelle, url: f.url, zoomMax: Number(f.zoomMax), credit: f.credit };
    });
    Store.ecrireConfig(etat.config);
    rafraichirFonds();
    toast(etat.config.fondsCarte.length + ' fond(s) enregistré(s).', 'succes');
  }

  function remplirConfiguration() {
    var c = etat.config;
    document.getElementById('cfg-operateur').value = c.operateur;
    document.getElementById('cfg-collectivite').value = c.collectivite;
    document.getElementById('cfg-communes').value = c.communes.join(', ');
    document.getElementById('cfg-precisionMax').value = c.precisionMax;
    document.getElementById('cfg-timeoutGps').value = c.timeoutGps;
    document.getElementById('cfg-dureeAffinage').value = c.dureeAffinage;
    document.getElementById('cfg-hautePrecision').checked = !!c.hautePrecision;
    document.getElementById('cfg-afficherLambert').checked = !!c.afficherLambert;
    document.getElementById('cfg-separateur').value = c.separateur;
  }

  function enregistrerConfiguration() {
    etat.config = {
      operateur: document.getElementById('cfg-operateur').value.trim(),
      collectivite: document.getElementById('cfg-collectivite').value.trim(),
      communes: document.getElementById('cfg-communes').value
        .split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      precisionMax: Math.max(1, Number(document.getElementById('cfg-precisionMax').value) || 20),
      timeoutGps: Math.max(5, Number(document.getElementById('cfg-timeoutGps').value) || 20),
      dureeAffinage: Math.max(5, Number(document.getElementById('cfg-dureeAffinage').value) || 30),
      hautePrecision: document.getElementById('cfg-hautePrecision').checked,
      afficherLambert: document.getElementById('cfg-afficherLambert').checked,
      separateur: document.getElementById('cfg-separateur').value
    };
    Store.ecrireConfig(etat.config);
    remplirCommunes();
    synchroniserTout();
    toast('Configuration enregistrée.', 'succes');
  }

  function remplirCommunes() {
    var dl = document.getElementById('liste-communes');
    vider(dl);
    etat.config.communes.forEach(function (c) { dl.appendChild(el('option', { value: c })); });
  }

  function rafraichirStats() {
    var hote = document.getElementById('cfg-stats');
    if (!hote) return;
    vider(hote);
    Cfg.FILIERES.forEach(function (f) {
      hote.appendChild(el('div', { classe: 'stat', style: 'border-left:3px solid ' + f.couleur }, [
        el('div', { classe: 'stat-valeur', texte: String(pointsDe(f.id).length) }),
        el('div', { classe: 'stat-label', texte: f.label })
      ]));
    });
    hote.appendChild(el('div', { classe: 'stat' }, [
      el('div', { classe: 'stat-valeur', texte: String(etat.points.length) }),
      el('div', { classe: 'stat-label', texte: 'Total' })
    ]));
    rafraichirEtatFichier();
  }

  function rafraichirEtatFichier() {
    var note = document.getElementById('cfg-note-fsa');
    if (!note) return;

    if (!Store.fsaDisponible()) {
      note.textContent = "Ce navigateur ne permet pas l'écriture directe dans un fichier. Les données restent dans le navigateur ; utilisez « Exporter ».";
      Array.prototype.forEach.call(document.querySelectorAll('[data-fsa]'), function (b) { b.disabled = true; });
      Cfg.FILIERES.forEach(function (f) {
        var n = document.getElementById('cfg-etat-' + f.id);
        if (n) n.textContent = 'Export manuel uniquement.';
      });
      return;
    }

    note.textContent = "L'écriture directe n'existe que sur Chrome et Edge (bureau et Android). Un fichier lié est réécrit intégralement à chaque enregistrement, suppression ou import de sa filière.";
    Cfg.FILIERES.forEach(function (f) {
      Store.handleCourant(f.id).then(function (h) {
        var n = document.getElementById('cfg-etat-' + f.id);
        if (!n) return;
        n.textContent = h ? 'Lié à ' + h.name : 'Aucun fichier lié.';
      });
    });
  }

  function actionCreerFichier(filiereId) {
    Store.choisirFichier(filiereId).then(function () {
      return synchroniserFichier(filiereId);
    }).then(function () {
      rafraichirBadgeFichier();
      rafraichirEtatFichier();
      toast('CSV ' + Cfg.filiere(filiereId).label + ' lié et initialisé.', 'succes');
    }).catch(function () { /* l'utilisateur a annulé le sélecteur */ });
  }

  function actionOuvrirFichier(filiereId) {
    Store.ouvrirFichierExistant(filiereId).then(function () {
      return Store.lireFichier(filiereId);
    }).then(function (texte) {
      if (texte && texte.trim()) fusionnerCsv(texte, filiereId);
      return synchroniserFichier(filiereId);
    }).then(function () {
      rafraichirBadgeFichier();
      rafraichirEtatFichier();
      rafraichirStats();
      rafraichirListe(filiereId);
    }).catch(function () { /* annulé */ });
  }

  function actionDelierFichier(filiereId) {
    Store.oublierFichier(filiereId).then(function () {
      rafraichirBadgeFichier();
      rafraichirEtatFichier();
      toast('CSV ' + Cfg.filiere(filiereId).label + ' délié. Les données restent dans le navigateur.', 'info');
    });
  }

  /**
   * Ajoute les lignes d'un CSV à une filière sans écraser l'existant.
   * Une ligne portant une autre filière est rejetée : chaque fichier est mono-filière.
   */
  function fusionnerCsv(texte, filiereId) {
    var lignes = Csv.parser(texte, Csv.detecterSeparateur(texte));
    var connus = {};
    etat.points.forEach(function (p) { connus[p.id] = true; });

    var ajoutes = 0;
    var ignores = 0;
    var horsFiliere = 0;

    lignes.forEach(function (l) {
      if (l.filiere && l.filiere !== filiereId) { horsFiliere++; return; }
      if (l.id && connus[l.id]) { ignores++; return; }
      if (!l.id) l.id = idUnique();
      l.filiere = filiereId;
      connus[l.id] = true;
      etat.points.push(l);
      ajoutes++;
    });

    Store.ecrirePoints(etat.points);
    Store.resynchroniserCompteurs(etat.points);

    if (horsFiliere && !ajoutes) {
      toast('Fichier refusé : ' + horsFiliere + " ligne(s) d'une autre filière.", 'erreur');
    } else {
      var details = [];
      if (ignores) details.push(ignores + ' doublon(s)');
      if (horsFiliere) details.push(horsFiliere + ' hors filière');
      toast(ajoutes + ' point(s) importé(s) dans ' + Cfg.filiere(filiereId).label
        + (details.length ? ' — ' + details.join(', ') + ' ignoré(s)' : '') + '.', ajoutes ? 'succes' : 'info');
    }
    return ajoutes;
  }

  function actionImporter(ev) {
    var filiereId = ev.target.getAttribute('data-filiere');
    var fichier = ev.target.files && ev.target.files[0];
    if (!fichier || !Cfg.filiere(filiereId)) { ev.target.value = ''; return; }

    fichier.text().then(function (texte) {
      fusionnerCsv(texte, filiereId);
      return synchroniserFichier(filiereId);
    }).then(function () {
      rafraichirStats();
      rafraichirListe(filiereId);
    }).catch(function () {
      toast('Lecture du fichier impossible.', 'erreur');
    }).then(function () { ev.target.value = ''; });
  }

  function actionPurger() {
    if (!etat.points.length) { toast('Aucune donnée à effacer.', 'info'); return; }
    if (!confirm('Effacer les ' + etat.points.length + ' point(s) enregistrés ? Cette action est irréversible.')) return;
    if (!confirm('Confirmation définitive : tout effacer ?')) return;
    etat.points = [];
    Store.toutEffacer();
    Cfg.FILIERES.forEach(function (f) { reinitialiserFormulaire(f.id); rafraichirListe(f.id); });
    rafraichirStats();
    synchroniserTout();
    toast('Données effacées.', 'info');
  }

  // ---------------------------------------------------------------- amorçage

  /**
   * Publie la hauteur mesurée de l'en-tête. En paysage court, la barre haute se cale
   * sur cette valeur en négatif : l'en-tête glisse hors écran, les onglets restent
   * collés. Mesuré plutôt que codé en dur, car la hauteur varie selon la largeur.
   */
  function suivreHauteurEntete() {
    var entete = document.querySelector('.entete');
    if (!entete) return;

    function poser() {
      document.documentElement.style.setProperty(
        '--h-entete', Math.round(entete.getBoundingClientRect().height) + 'px');
    }
    poser();

    if (typeof ResizeObserver === 'function') new ResizeObserver(poser).observe(entete);
    else global.addEventListener('resize', poser);
    global.addEventListener('orientationchange', poser);
  }

  function avertirContexte() {
    if (!Geo.contexteSecurise()) {
      toast('Page non servie en HTTPS ou localhost : le GPS sera refusé par le navigateur.', 'erreur');
    }
  }

  function demarrer() {
    etat.config = Store.lireConfig();
    etat.points = Store.lirePoints();

    construireOnglets();
    var hote = document.getElementById('vues');
    Cfg.FILIERES.forEach(function (f) { hote.appendChild(construireVueFiliere(f)); });
    hote.appendChild(construireVueConfiguration());

    remplirCommunes();
    remplirConfiguration();
    Store.migrerAncienHandle();

    var dernier = null;
    try { dernier = localStorage.getItem('geoloc.onglet'); } catch (e) { /* mode privé */ }
    var valide = dernier === 'configuration' || Cfg.filiere(dernier);
    activerOnglet(valide ? dernier : Cfg.FILIERES[0].id);

    suivreHauteurEntete();
    brancherCarte();
    avertirContexte();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})(window);
