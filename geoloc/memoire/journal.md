# GéoLoc — journal des sessions

Une entrée par session de travail, la plus récente en haut.

---

## 18/09/2026 — Fonds de carte gratuits et remplaçables (v0.5)

**Demande :** n'utiliser systématiquement qu'un plan ou une vue aérienne gratuits.

**Constat :** c'était déjà le cas (Géoplateforme IGN, sans clé), mais **rien dans
l'application ne le garantissait dans le temps**. Si le service change de conditions
ou tombe, il faut modifier `carte.js` sur chaque poste.

**Fait :**
- Troisième fond gratuit ajouté, **OpenStreetMap**, en secours de la Géoplateforme.
- **Attribution affichée en permanence** en bas de la carte. C'est une obligation de
  licence, elle ne peut pas rester dans une note sous la barre d'outils. La mention
  redondante qui s'y trouvait a été supprimée.
- **Éditeur de fonds dans Configuration** : libellé, URL de tuile, zoom maximal,
  attribution. Fonctionne avec tout service XYZ ou WMTS. Bouton de rétablissement
  des fonds gratuits par défaut.
- **Quatre contrôles avant enregistrement** : HTTPS obligatoire, repères `{z}`,
  `{x}`, `{y}` présents, zoom entre 1 et 22, et **attribution non vide** — un fond
  sans attribution est refusé.
- Champ URL en zone multiligne monospace : une URL WMTS dépasse deux cents
  caractères, illisible dans un champ d'une ligne sur téléphone.

**Défauts corrigés au passage :**
- Les libellés de l'éditeur n'avaient pas d'attribut `for` : aucun lien entre libellé
  et champ pour un lecteur d'écran. Chaque champ porte désormais un identifiant.
- L'audit comptait comme « texte tronqué » le contenu défilant d'un champ de saisie.
  Un `input` fait défiler sa valeur par conception ; seul un libellé coupé est un
  défaut. Règle corrigée.

**Vérifications :** bascule entre les quatre fonds, attribution suivant le fond
actif, refus d'une URL en HTTP, refus d'un fond sans attribution, persistance d'un
fond personnalisé, tuiles réellement demandées à l'URL saisie, rétablissement des
défauts, aucun libellé orphelin, audit d'affichage sans défaut sur dix
configurations.

**Non vérifiable ici :** les appels réels aux services IGN et OSM. La sortie réseau
de l'environnement de développement est fermée ; les tuiles sont simulées par
interception. À confirmer sur le terrain.

---

## 18/09/2026 — Mesure affinée et ajustement cartographique (v0.4)

**Demandes :** un bouton de relevé le plus précis possible sur les trois onglets de
fonctionnement ; puis une fenêtre montrant la carte au zoom maximal avec le repère
sur le point mesuré, l'utilisateur pouvant valider ou repositionner.

### Acquisition affinée

`geo.js` gagne `localiserPrecis()` : écoute continue du récepteur pendant une durée
configurable (30 s par défaut), filtrage des fixes plus de deux fois moins bons que
le meilleur, moyenne pondérée en `1/précision²`, arrêt anticipé possible.

**Position technique tenue :** la précision enregistrée reste la meilleure `accuracy`
annoncée, jamais une valeur calculée. Les fixes successifs d'un même récepteur sont
corrélés, moyenner ne divise pas l'erreur par la racine du nombre de mesures. Ce qui
est mesuré et stocké en plus : dispersion réelle, nombre de mesures, durée, méthode.

Vérifié hors navigateur sur une série contrôlée : mesure aberrante annoncée à 60 m
écartée, écart au point vrai ramené à 0,49 m, dispersion 1,42 m. Cas limites traités
(mesure unique, aucune mesure).

### Carte d'ajustement

`carte.js`, visualiseur de tuiles écrit à la main (Web Mercator, grille PM) :
environ 250 lignes, aucune dépendance. Repère fixe au centre, carte déplacée dessous
au doigt ou à la souris, zoom, bascule photo aérienne / plan IGN, marqueur GPS avec
son rayon de précision, écart au GPS en direct.

Vérifié en navigateur avec des tuiles simulées : la tuile du centre calculée
indépendamment correspond à celle demandée, un déplacement de 120 px donne 12,1 m
pour 12,0 m attendus, le plan plafonne bien au zoom 19 et l'orthophoto au zoom 20.
Mode dégradé testé : sans réseau, message explicite et fenêtre toujours utilisable.

**Les flux IGN n'ont pas pu être appelés réellement** : la sortie réseau de
l'environnement de développement est fermée. À confirmer sur le terrain.

### Défaut corrigé au passage

Le champ « durée de la mesure affinée » avait `min: 5` et `step: 5`, ce qui rendait
la valeur 6 invalide. Le navigateur bloquait alors le `submit` **sans émettre
d'événement** : toute la configuration, opérateur compris, cessait d'être
enregistrée, en silence. Trouvé parce que l'opérateur manquait dans un CSV de test.
Corrigé (`step: 1`) et, surtout, un écouteur `invalid` affiche désormais un message
en français reconstruit depuis les contraintes.

### Faux positif corrigé dans l'audit

L'audit signalait 152 défauts sur les tuiles : elles débordent du cadre par
construction, écrêtées par `overflow: hidden`. La règle « hors viewport » ignore
désormais tout élément écrêté par un ancêtre, et un contrôle distinct vérifie
qu'aucun conteneur ne cache de défilement horizontal.

**Nouvelles colonnes :** `dispersion_m`, `methode_gps`, `nb_mesures`, `duree_gps_s`,
`position_ajustee`, `ecart_ajustement_m`. Les fichiers passent à 25, 25 et 27
colonnes.

**Résultat :** audit sans défaut sur dix configurations, modale comprise, et les
trois suites fonctionnelles passent sans erreur JavaScript.

---

## 18/09/2026 — Affichage petits smartphones (v0.3)

**Demande :** l'application doit obligatoirement être utilisable sur les petits
smartphones.

**Constat avant correction** (mesuré, pas supposé) : aucun débordement horizontal,
la structure était déjà fluide. Mais quatre défauts réels :

1. Onglets « ASSAINISSEMENT » et « CONFIGURATION » tronqués par ellipsis **dès
   360 px**, et jusqu'à 430 px.
2. Message de confirmation centré : à 280 px il se repliait en colonne étroite
   d'environ 170 px, illisible.
3. Lien de coordonnées à **14 px** de haut — inutilisable au doigt.
4. `top: 53px` codé en dur sur la barre d'onglets : bug latent, faux dès que le
   palier 360 px réduit la hauteur de l'en-tête.

Et en paysage (568×320) : **84 px de barres collantes sur 320 px de haut**, soit
26 % de l'écran perdus en permanence.

**Corrigé :**
- Double libellé d'onglet (`onglet-long` / `onglet-court`), bascule à 480 px,
  libellé complet conservé dans `aria-label`.
- Message en bandeau pleine largeur sous 480 px.
- Lien de coordonnées transformé en cible tactile de 36 px ; cases à cocher sur une
  ligne de 44 px, basculables en touchant le libellé.
- Palier 360 px : gouttière à 10 px, typographie et marges compactées, boutons des
  cartes fichier en grille à deux colonnes, en-tête de carte sur deux lignes.
- En-tête et onglets réunis dans `.barre-haute` collante : plus aucune hauteur
  codée en dur.
- Paysage court : l'en-tête glisse hors écran, les onglets restent collés. 47 px de
  barres fixes au lieu de 84. Le décalage s'appuie sur `--h-entete`, mesuré par
  `suivreHauteurEntete()` via `ResizeObserver`.

**Ajouté :** `tests/audit-responsive.mjs`, rejouable, sortie non nulle en cas de
défaut. Il a immédiatement révélé un défaut à **430 px** (iPhone 15 Plus) que les
largeurs testées à la main ne couvraient pas : le seuil de bascule des libellés,
d'abord fixé à 400 px, était trop bas. Relevé à 480 px après mesure.

**Résultat :** aucun défaut sur dix configurations — 280, 320, 360, 390, 412, 430,
480, 540 px en portrait, 568×320 et 653×280 en paysage — et aucune régression
fonctionnelle sur le parcours complet.

---

## 18/09/2026 — Un CSV par onglet (v0.2)

**Demande :** « chaque onglet a son CSV ». Révision de la spec initiale, qui prévoyait
un fichier unique pour les trois filières.

**Modifié :**
- `config.js` : `colonnesCsv(filiereId)` ne rend plus que les colonnes de la filière
  demandée (19 / 19 / 21 au lieu de 28 communes avec des vides). `toutesColonnes()`
  ajoutée pour le seul filtre plein texte. Nom de fichier suggéré par filière.
- `store.js` : un handle IndexedDB par filière (`csv-eau`, `csv-assainissement`,
  `csv-spanc`). `migrerAncienHandle()` efface le handle unique de la v0.1.
- `app.js` : `synchroniserFichier(filiereId)` et `synchroniserTout()` ; le badge
  d'en-tête suit l'onglet actif ; vue Configuration refaite en trois cartes de
  filière (Créer / Lier / Délier / Exporter / Importer) plus « Exporter les 3 ».
- `fusionnerCsv(texte, filiereId)` : rejette les lignes d'une autre filière,
  rattache celles sans colonne `filiere` à la cible.
- `style.css` : cartes `.fichier`, boutons `.btn-compact`, état de badge neutre.

**Choix assumé :** le `localStorage` reste un stock unique discriminé par `filiere`.
Seul le format d'export est éclaté. Éclater le stockage compliquerait purge,
statistiques et filtre sans bénéfice.

**Vérifications :** parcours complet en Chromium headless — trois CSV générés avec
leurs colonnes propres, export unitaire et export des trois, import d'un `eau.csv`
dans SPANC refusé, réimport dans EAU détecté comme doublon, import d'un CSV sans
colonne `filiere` accepté, persistance après rechargement, aucune erreur JavaScript,
aucun débordement horizontal en 390 px.

---

## 18/09/2026 — Création du projet (v0.1)

**Demande :** application web vanilla de relevé de localisation, un CSV unique,
quatre onglets (EAU, ASSAINISSEMENT, SPANC, CONFIGURATION), une couleur par onglet,
mêmes éléments avec des données différentes, géolocalisation sur les trois onglets
de fonctionnement.

**Livré :**
- Squelette complet : `index.html`, `css/style.css`, six modules JS, `serveur.py`.
- Schéma unique dans `js/config.js` pilotant formulaires, colonnes CSV et filtres.
- Trois filières avec champs métier distincts, quatrième onglet de configuration.
- Géolocalisation avec seuil d'alerte de précision et conversion Lambert 93.
- CSV unique : 28 colonnes, UTF-8 BOM, séparateur configurable, RFC 4180 *(éclaté en trois fichiers en v0.2)*.
- Écriture dans un fichier lié (Chrome/Edge) ou export manuel (autres navigateurs).
- Import CSV avec fusion sur `id` et resynchronisation des compteurs de références.
- Modification, duplication et suppression de points ; filtre plein texte.
- `docs/RGPD.md` sur les données personnelles du SPANC.

**Vérifications effectuées :**
- Lambert 93 : Paris Notre-Dame → `X = 652 469 ; Y = 6 862 035`, conforme à la
  référence IGN (`652 469,79 / 6 862 035,2`).
- CSV : aller-retour exact sur une valeur contenant guillemets, séparateur et
  retour ligne.
- Parcours complet en Chromium headless (position simulée à Réchésy) : création
  d'un point sur chacune des trois filières, blocage des champs obligatoires
  manquants, duplication, modification sans doublon, suppression, persistance
  après rechargement, restauration de l'onglet actif, aucune erreur JavaScript.
- Rendu 390 px : aucun débordement horizontal.

**Corrections en cours de route :**
- `h2` dans `.bloc-titre` échappait au sélecteur `.bloc > h2` (titre surdimensionné).
- Onglets tronqués sous 430 px : palier typographique ajouté.
- `favicon.ico` en 404 : `favicon.svg` ajouté.
- Tiret orphelin sur les points sans commune.

**Non traité volontairement :** nomenclature métier non validée auprès des services,
pas de HTTPS de production, pas de mode hors-ligne, pas de photo.
