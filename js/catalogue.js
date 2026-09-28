/**
 * Catalogue de matériel à trois niveaux : type → modèle → détail.
 * Il alimente les trois listes déroulantes en cascade des onglets de relevé et
 * vit dans son propre fichier `parametres.csv`, séparé des relevés : on change
 * le catalogue d'une campagne à l'autre sans toucher aux données déjà saisies.
 */
(function (global) {
  'use strict';

  var CLE = 'groma.catalogue';
  var FICHIER = 'parametres.csv';
  var COLONNES = ['filiere', 'type_materiel', 'modele', 'detail'];

  /**
   * Graine livrée avec l'application. Forme compacte `[modèles, détails]` :
   * le produit des deux donne les lignes. Le catalogue réel, lui, autorise des
   * détails différents par modèle — c'est seulement la graine qui est régulière.
   */
  var GRAINE = {
    eau: {
      'Vanne': [['DN 40', 'DN 50', 'DN 60', 'DN 65', 'DN 80', 'DN 100', 'DN 125', 'DN 150', 'DN 200', 'DN 250', 'DN 300'],
        ['Opercule fonte', 'Papillon', 'Quart de tour']],
      'Poteau incendie': [['DN 100', 'DN 150'],
        ['1 prise', '2 prises + 1 × 100', 'Renversable', 'Non renversable']],
      'Bouche incendie': [['DN 100'], ['Sous coffre', 'Sous bouche à clé']],
      'Compteur': [['DN 15', 'DN 20', 'DN 25', 'DN 32', 'DN 40', 'DN 50', 'DN 65', 'DN 80', 'DN 100'],
        ['Vitesse', 'Volumétrique', 'Ultrasons', 'Télérelevé']],
      'Regard de comptage': [['Béton', 'Polyester', 'Fonte'], ['Simple', 'Double', 'Avec by-pass']],
      'Ventouse': [['DN 50', 'DN 60', 'DN 80'], ['Simple effet', 'Triple fonction']],
      'Purge / vidange': [['DN 40', 'DN 50', 'DN 60', 'DN 80'], ['Sous bouche à clé', 'En regard']],
      'Réducteur de pression': [['DN 40', 'DN 50', 'DN 65', 'DN 80', 'DN 100'], ['À pilote', 'Action directe']],
      'Stabilisateur': [['DN 50', 'DN 80', 'DN 100'], ['Aval', 'Amont']],
      'Réservoir': [['Semi-enterré', 'Sur tour', 'Bâche au sol'], ['1 cuve', '2 cuves']],
      'Captage': [['Source', 'Forage', 'Puits'], ['Périmètre de protection établi', 'Sans périmètre']],
      'Surpresseur': [['1 pompe', '2 pompes', '3 pompes'], ['Variateur de fréquence', 'Démarrage direct']],
      'Branchement': [['DN 20', 'DN 25', 'DN 32', 'DN 40', 'DN 50', 'DN 63'],
        ['PEHD', 'Cuivre', 'Plomb à reprendre']],
      'Autre': [['Non listé'], []]
    },
    assainissement: {
      'Regard de visite': [['Ø 800', 'Ø 1000', 'Ø 1200'], ['Béton', 'PEHD', 'Maçonnerie']],
      'Tampon': [['Ø 600', 'Ø 800', 'Carré 600'], ['Fonte D400', 'Fonte C250', 'Fonte B125', 'Béton']],
      'Grille avaloir': [['Simple', 'Double', 'À gueule de loup'], ['Fonte C250', 'Fonte D400']],
      'Boîte de branchement': [['Ø 315', 'Ø 400', 'Ø 600'], ['PVC', 'Béton']],
      'Poste de relevage': [['1 pompe', '2 pompes'], ['Dilacérateur', 'Vortex', 'Roue monocanal']],
      "Déversoir d'orage": [['Seuil frontal', 'Seuil latéral', 'Siphoïde'], ['Avec autosurveillance', 'Sans mesure']],
      "Bassin d'orage": [['Enterré', 'À ciel ouvert'], ['Béton', 'Structure alvéolaire']],
      "Station d'épuration": [['Boues activées', 'Lit bactérien', 'Filtre planté', 'Lagunage naturel'],
        ['< 200 EH', '200 à 2000 EH', '> 2000 EH']],
      'Exutoire': [['Busé', 'Cadre', 'Naturel'], ['Avec clapet anti-retour', 'Sans clapet']],
      'Siphon': [['Simple', 'Double'], ['Béton', 'Fonte']],
      'Autre': [['Non listé'], []]
    },
    spanc: {
      'Fosse toutes eaux': [['1 000 L', '2 000 L', '3 000 L', '4 000 L', '5 000 L'],
        ['Béton', 'PEHD', 'Polyester']],
      'Fosse septique': [['1 000 L', '2 000 L', '3 000 L'], ['Béton', 'PEHD']],
      'Micro-station': [['4 EH', '5 EH', '6 EH', '8 EH', '10 EH'],
        ['Culture libre', 'Culture fixée', 'SBR']],
      'Filtre à sable vertical drainé': [['5 m²', '10 m²', '15 m²', '20 m²', '25 m²'],
        ['Avec géotextile', 'Sans géotextile']],
      'Filtre à sable vertical non drainé': [['5 m²', '10 m²', '15 m²', '20 m²', '25 m²'],
        ['Avec géotextile', 'Sans géotextile']],
      "Tranchées d'épandage": [['< 30 m', '30 à 60 m', '60 à 90 m', '> 90 m'],
        ['Drains rigides', 'Drains souples']],
      'Lit filtrant': [['Drainé', 'Non drainé'], ['Zéolithe', 'Sable']],
      'Filtre compact': [['4 EH', '5 EH', '6 EH', '8 EH'], ['Fibre de coco', 'Laine de roche', 'Zéolithe']],
      'Filtre planté de roseaux': [['1 étage', '2 étages'], ['4 à 6 EH', '7 à 10 EH']],
      'Puits perdu': [['Maçonné', 'Busé'], ['À supprimer']],
      "Absence d'installation": [['Rejet direct', 'Aucun dispositif'], []],
      'Autre': [['Non listé'], []]
    }
  };

  function defaut() {
    var lignes = [];
    Object.keys(GRAINE).forEach(function (fil) {
      Object.keys(GRAINE[fil]).forEach(function (type) {
        var paire = GRAINE[fil][type];
        paire[0].forEach(function (modele) {
          if (!paire[1].length) {
            lignes.push({ filiere: fil, type_materiel: type, modele: modele, detail: '' });
            return;
          }
          paire[1].forEach(function (detail) {
            lignes.push({ filiere: fil, type_materiel: type, modele: modele, detail: detail });
          });
        });
      });
    });
    return lignes;
  }

  // --- Cache mémoire : les cascades sont relues à chaque frappe, pas la peine
  // de retraverser localStorage et de reparser le JSON à chaque fois.

  var lignes = null;

  function normaliser(brut) {
    if (!Array.isArray(brut)) return [];
    return brut.map(function (l) {
      return {
        filiere: String(l.filiere || '').trim(),
        type_materiel: String(l.type_materiel || '').trim(),
        modele: String(l.modele || '').trim(),
        detail: String(l.detail || '').trim()
      };
    }).filter(function (l) { return l.filiere && l.type_materiel; });
  }

  function charger() {
    var brut;
    try {
      var texte = localStorage.getItem(CLE);
      brut = texte ? JSON.parse(texte) : null;
    } catch (e) {
      brut = null;
    }
    // Absence ≠ catalogue vide : au premier lancement on sert la graine, sinon
    // les trois listes s'ouvrent vides et l'application paraît cassée.
    lignes = brut === null ? defaut() : normaliser(brut);
    return lignes;
  }

  function tout() {
    return lignes === null ? charger() : lignes;
  }

  function definir(nouvelles) {
    lignes = normaliser(nouvelles);
    try {
      localStorage.setItem(CLE, JSON.stringify(lignes));
    } catch (e) { /* quota ou mode privé : le catalogue reste en mémoire */ }
    return lignes;
  }

  function reinitialiser() {
    return definir(defaut());
  }

  // --- Cascade --------------------------------------------------------------

  /** Valeurs distinctes d'une colonne, dans l'ordre de première apparition. */
  function distinctes(sous, colonne) {
    var vus = {};
    var sortie = [];
    sous.forEach(function (l) {
      var v = l[colonne];
      if (!v || vus[v]) return;
      vus[v] = true;
      sortie.push(v);
    });
    return sortie;
  }

  function types(filiere) {
    return distinctes(tout().filter(function (l) { return l.filiere === filiere; }), 'type_materiel');
  }

  function modeles(filiere, type) {
    if (!type) return [];
    return distinctes(tout().filter(function (l) {
      return l.filiere === filiere && l.type_materiel === type;
    }), 'modele');
  }

  function details(filiere, type, modele) {
    if (!type || !modele) return [];
    return distinctes(tout().filter(function (l) {
      return l.filiere === filiere && l.type_materiel === type && l.modele === modele;
    }), 'detail');
  }

  /** Lignes d'une filière, pour l'éditeur de l'onglet Configuration. */
  function parFiliere(filiere) {
    return tout().filter(function (l) { return l.filiere === filiere; });
  }

  // --- Fichier parametres.csv ----------------------------------------------

  function versCsv(separateur) {
    return global.GromaCsv.serialiser(COLONNES, tout(), separateur);
  }

  /** @returns {number} lignes retenues, ou -1 si le fichier n'a pas la bonne forme */
  function depuisCsv(texte, separateur) {
    var brut = global.GromaCsv.parser(texte, separateur || global.GromaCsv.detecterSeparateur(texte));
    if (!brut.length) return -1;
    var manquantes = COLONNES.filter(function (c) { return !(c in brut[0]); });
    if (manquantes.length) return -1;
    var retenues = normaliser(brut).filter(function (l) {
      return !!global.GromaConfig.filiere(l.filiere);
    });
    definir(retenues);
    return retenues.length;
  }

  global.GromaCatalogue = {
    COLONNES: COLONNES,
    FICHIER: FICHIER,
    defaut: defaut,
    charger: charger,
    tout: tout,
    definir: definir,
    reinitialiser: reinitialiser,
    types: types,
    modeles: modeles,
    details: details,
    parFiliere: parFiliere,
    versCsv: versCsv,
    depuisCsv: depuisCsv
  };
})(window);
