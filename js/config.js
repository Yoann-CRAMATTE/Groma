/**
 * Schéma du projet : il pilote les formulaires, les colonnes CSV et le filtre.
 * La saisie se réduit à l'identification du matériel et à une note libre — tout
 * le reste d'une ligne est produit par l'application : position, méthode de
 * mesure, horodatage, référence.
 */
(function (global) {
  'use strict';

  /**
   * Identification du matériel en trois listes liées.
   * Les valeurs ne sont pas ici : elles viennent du catalogue (`parametres.csv`),
   * modifiable sans toucher au code. Le niveau 1 seul est obligatoire — beaucoup
   * d'ouvrages anciens n'ont ni modèle ni détail identifiables sur le terrain.
   */
  var CHAMPS_CASCADE = [
    { cle: 'type_materiel', label: 'Type de matériel', type: 'cascade', requis: true },
    { cle: 'modele', label: 'Modèle', type: 'cascade' },
    { cle: 'detail', label: 'Détail', type: 'cascade' }
  ];

  /**
   * La note de terrain. Le catalogue décrit ce qu'est l'ouvrage, jamais ce qui
   * cloche : tampon scellé, accès par la cour du 12, vanne bloquée, repère à
   * reprendre. Sans ce champ, ces constats se perdent entre le relevé et le
   * bureau — c'est ce qui a justifié son retour après la v0.7.
   */
  var CHAMP_OBSERVATIONS = {
    cle: 'observations', label: 'Observations', type: 'textarea',
    placeholder: "Accès, état, repère… ce que le catalogue ne dit pas"
  };

  var FILIERES = [
    {
      id: 'eau',
      label: 'EAU',
      labelCourt: 'EAU',
      titre: 'Eau potable (AEP)',
      couleur: '#0ea5e9',
      prefixe: 'AEP',
      fichier: 'eau.csv'
    },
    {
      id: 'assainissement',
      label: 'ASSAINISSEMENT',
      labelCourt: 'ASSAIN.',
      titre: 'Assainissement collectif',
      couleur: '#22c55e',
      prefixe: 'AC',
      fichier: 'assainissement.csv'
    },
    {
      id: 'spanc',
      label: 'SPANC',
      labelCourt: 'SPANC',
      titre: 'Assainissement non collectif',
      couleur: '#a855f7',
      prefixe: 'ANC',
      // Une installation ANC se trouve chez un particulier : la position seule
      // désigne un foyer, même sans nom ni adresse. Cf. docs/RGPD.md.
      fichier: 'spanc.csv'
    }
  ];

  // Colonnes produites par l'application, jamais saisies.
  // Le bloc méthode / mesures / dispersion trace COMMENT le point a été pris :
  // sans lui, impossible de savoir si une coordonnée vaut 3 m ou 30 m.
  var COLONNES_TECHNIQUES = [
    'id', 'filiere', 'reference', 'date_saisie', 'operateur',
    'latitude', 'longitude', 'altitude_m',
    'precision_m', 'dispersion_m', 'methode_gps', 'nb_mesures', 'duree_gps_s',
    'position_ajustee', 'ecart_ajustement_m',
    'x_l93', 'y_l93'
  ];

  /**
   * Colonnes du CSV d'une filière. Les trois filières ont aujourd'hui les mêmes,
   * mais gardent chacune leur fichier : la colonne « filiere » sert de garde-fou
   * à l'import, et rien n'oblige les trois à rester alignées.
   */
  function colonnesCsv(filiereId) {
    if (!filiere(filiereId)) return [];
    return COLONNES_TECHNIQUES
      .concat(CHAMPS_CASCADE.map(function (c) { return c.cle; }))
      .concat([CHAMP_OBSERVATIONS.cle]);
  }

  function filiere(id) {
    return FILIERES.filter(function (f) { return f.id === id; })[0] || null;
  }

  /** Champs saisis pour une filière, dans l'ordre d'affichage. */
  function champsDe(id) {
    return filiere(id) ? CHAMPS_CASCADE.concat([CHAMP_OBSERVATIONS]) : [];
  }

  var CONFIG_DEFAUT = {
    operateur: '',
    collectivite: '',
    precisionMax: 20,
    hautePrecision: true,
    timeoutGps: 20,
    dureeAffinage: 30,
    afficherLambert: true,
    fondCarte: 'photo',
    // Liste vide = fonds gratuits par défaut de carte.js. Remplie, elle les remplace.
    fondsCarte: [],
    separateur: ';'
  };

  global.GeoLocConfig = {
    FILIERES: FILIERES,
    COLONNES_TECHNIQUES: COLONNES_TECHNIQUES,
    CONFIG_DEFAUT: CONFIG_DEFAUT,
    colonnesCsv: colonnesCsv,
    filiere: filiere,
    champsDe: champsDe
  };
})(window);
