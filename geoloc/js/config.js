/**
 * Schéma unique du projet : il pilote à la fois les formulaires, les colonnes CSV
 * et les filtres. Ajouter un champ ici suffit, aucun HTML à toucher.
 */
(function (global) {
  'use strict';

  // Champs présents sur les trois filières, avant les champs métier.
  var CHAMPS_COMMUNS = [
    { cle: 'reference', label: 'Référence', type: 'text', placeholder: 'auto si vide' },
    { cle: 'commune', label: 'Commune', type: 'text', liste: 'communes', requis: true }
  ];

  // Champ libre commun, toujours placé en dernier.
  var CHAMP_OBSERVATIONS = { cle: 'observations', label: 'Observations', type: 'textarea' };

  var ETATS = ['Bon', 'Moyen', 'Mauvais', 'Hors service', 'Non évalué'];

  var FILIERES = [
    {
      id: 'eau',
      label: 'EAU',
      labelCourt: 'EAU',
      titre: 'Eau potable (AEP)',
      couleur: '#0ea5e9',
      prefixe: 'AEP',
      fichier: 'eau.csv',
      champs: [
        {
          cle: 'type_ouvrage', label: "Type d'ouvrage", type: 'select', requis: true,
          options: ['Vanne', 'Poteau incendie', 'Bouche incendie', 'Compteur', 'Regard de comptage',
            'Ventouse', 'Purge / vidange', 'Réducteur de pression', 'Stabilisateur', 'Réservoir',
            'Captage', 'Surpresseur', 'Branchement', 'Autre']
        },
        { cle: 'diametre_mm', label: 'Diamètre (mm)', type: 'number', min: 0, step: 1 },
        {
          cle: 'materiau', label: 'Matériau', type: 'select',
          options: ['Fonte', 'Fonte ductile', 'PVC', 'PEHD', 'Acier', 'Amiante-ciment', 'Plomb', 'Inconnu']
        },
        { cle: 'annee_pose', label: 'Année de pose', type: 'number', min: 1800, max: 2100, step: 1 },
        { cle: 'etat', label: 'État', type: 'select', options: ETATS },
        {
          cle: 'accessibilite', label: 'Accessibilité', type: 'select',
          options: ['Accessible', 'Difficile', 'Enterré / inaccessible', 'Sous chaussée']
        }
      ]
    },
    {
      id: 'assainissement',
      label: 'ASSAINISSEMENT',
      labelCourt: 'ASSAIN.',
      titre: 'Assainissement collectif',
      couleur: '#22c55e',
      prefixe: 'AC',
      fichier: 'assainissement.csv',
      champs: [
        {
          cle: 'type_ouvrage', label: "Type d'ouvrage", type: 'select', requis: true,
          options: ['Regard de visite', 'Tampon', 'Grille avaloir', 'Boîte de branchement',
            'Poste de relevage', "Déversoir d'orage", "Bassin d'orage", "Station d'épuration",
            'Exutoire', 'Siphon', 'Autre']
        },
        {
          cle: 'reseau', label: 'Type de réseau', type: 'select',
          options: ['Eaux usées', 'Eaux pluviales', 'Unitaire', 'Inconnu']
        },
        { cle: 'diametre_mm', label: 'Diamètre (mm)', type: 'number', min: 0, step: 1 },
        {
          cle: 'materiau', label: 'Matériau', type: 'select',
          options: ['Béton', 'PVC', 'PEHD', 'Grès', 'Fonte', 'Amiante-ciment', 'Maçonnerie', 'Inconnu']
        },
        { cle: 'profondeur_m', label: 'Profondeur (m)', type: 'number', min: 0, step: 0.01 },
        { cle: 'etat', label: 'État', type: 'select', options: ETATS }
      ]
    },
    {
      id: 'spanc',
      label: 'SPANC',
      labelCourt: 'SPANC',
      titre: 'Assainissement non collectif',
      couleur: '#a855f7',
      prefixe: 'ANC',
      fichier: 'spanc.csv',
      // Adresse + propriétaire = données à caractère personnel (RGPD) : cf. docs/RGPD.md
      donneesPersonnelles: true,
      champs: [
        {
          cle: 'type_installation', label: "Type d'installation", type: 'select', requis: true,
          options: ['Fosse toutes eaux', 'Fosse septique', 'Micro-station', 'Filtre à sable vertical drainé',
            'Filtre à sable vertical non drainé', "Tranchées d'épandage", 'Lit filtrant', 'Filtre compact',
            'Filtre planté de roseaux', 'Puits perdu', "Absence d'installation", 'Autre']
        },
        { cle: 'adresse', label: 'Adresse', type: 'text' },
        { cle: 'proprietaire', label: 'Propriétaire', type: 'text' },
        { cle: 'parcelle', label: 'Parcelle cadastrale', type: 'text', placeholder: 'ex. AB 0142' },
        { cle: 'nb_eh', label: 'Capacité (EH)', type: 'number', min: 0, step: 1 },
        {
          cle: 'conformite', label: 'Conformité', type: 'select',
          options: ['Conforme', 'Non conforme sans danger ni risque', 'Non conforme - danger pour la santé',
            'Non conforme - risque environnemental', 'Installation absente', 'Non contrôlé']
        },
        { cle: 'date_controle', label: 'Date du contrôle', type: 'date' },
        {
          cle: 'exutoire', label: 'Exutoire', type: 'select',
          options: ['Infiltration sur parcelle', 'Fossé', 'Réseau pluvial', "Cours d'eau", "Puits d'infiltration", 'Inconnu']
        }
      ]
    }
  ];

  // Colonnes techniques injectées automatiquement (non saisies).
  // Le bloc méthode / mesures / dispersion trace COMMENT le point a été pris :
  // sans lui, impossible de savoir si une coordonnée vaut 3 m ou 30 m.
  var COLONNES_TECHNIQUES = [
    'id', 'filiere', 'date_saisie', 'operateur',
    'latitude', 'longitude', 'altitude_m',
    'precision_m', 'dispersion_m', 'methode_gps', 'nb_mesures', 'duree_gps_s',
    'position_ajustee', 'ecart_ajustement_m',
    'x_l93', 'y_l93'
  ];

  /**
   * Colonnes du CSV d'une filière : chaque onglet a son propre fichier, donc
   * seulement ses colonnes — pas de colonnes vides héritées des autres filières.
   * La colonne « filiere » reste présente : elle sert de garde-fou à l'import.
   */
  function colonnesCsv(filiereId) {
    var f = filiere(filiereId);
    if (!f) return [];
    var cols = COLONNES_TECHNIQUES.slice();
    CHAMPS_COMMUNS.forEach(function (c) { if (cols.indexOf(c.cle) === -1) cols.push(c.cle); });
    f.champs.forEach(function (c) { if (cols.indexOf(c.cle) === -1) cols.push(c.cle); });
    cols.push(CHAMP_OBSERVATIONS.cle);
    return cols;
  }

  /** Union de toutes les colonnes — utilisée par le filtre plein texte, pas par les CSV. */
  function toutesColonnes() {
    var cols = [];
    FILIERES.forEach(function (f) {
      colonnesCsv(f.id).forEach(function (c) { if (cols.indexOf(c) === -1) cols.push(c); });
    });
    return cols;
  }

  function filiere(id) {
    return FILIERES.filter(function (f) { return f.id === id; })[0] || null;
  }

  /** Champs saisis pour une filière, dans l'ordre d'affichage. */
  function champsDe(id) {
    var f = filiere(id);
    if (!f) return [];
    return CHAMPS_COMMUNS.concat(f.champs).concat([CHAMP_OBSERVATIONS]);
  }

  var CONFIG_DEFAUT = {
    operateur: '',
    collectivite: '',
    communes: [],
    precisionMax: 20,
    hautePrecision: true,
    timeoutGps: 20,
    dureeAffinage: 30,
    afficherLambert: true,
    fondCarte: 'photo',
    separateur: ';'
  };

  global.GeoLocConfig = {
    FILIERES: FILIERES,
    CHAMPS_COMMUNS: CHAMPS_COMMUNS,
    CHAMP_OBSERVATIONS: CHAMP_OBSERVATIONS,
    COLONNES_TECHNIQUES: COLONNES_TECHNIQUES,
    CONFIG_DEFAUT: CONFIG_DEFAUT,
    colonnesCsv: colonnesCsv,
    toutesColonnes: toutesColonnes,
    filiere: filiere,
    champsDe: champsDe
  };
})(window);
