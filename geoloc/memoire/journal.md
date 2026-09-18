# GéoLoc — journal des sessions

Une entrée par session de travail, la plus récente en haut.

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
- CSV unique : 28 colonnes, UTF-8 BOM, séparateur configurable, RFC 4180.
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
