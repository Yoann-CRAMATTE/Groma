# GéoLoc — état du projet

> Mémoire de travail. À relire en début de session **avant** d'ouvrir le code,
> à mettre à jour en fin de session. Évite de relire toute l'application à chaque fois.

**Dernière mise à jour :** 18/09/2026 (v0.2)
**Branche :** `claude/geoloc-web-app-duccxo`
**Statut :** v0.2 fonctionnelle, testée en navigateur headless.

---

## Ce qui existe

| Fichier | Rôle | Stable ? |
|---|---|---|
| `index.html` | Coquille : en-tête, nav, conteneur, datalist, toast | oui |
| `css/style.css` | Feuille unique, mobile d'abord, `--accent` piloté par l'onglet | oui |
| `js/config.js` | **Source de vérité du schéma** : filières, champs, couleurs, colonnes CSV | oui |
| `js/lambert93.js` | WGS84 → EPSG:2154, constantes IGN | oui, vérifié |
| `js/csv.js` | Sérialisation / lecture RFC 4180, BOM UTF-8, détection de séparateur | oui, aller-retour testé |
| `js/store.js` | `localStorage` (points, config, compteurs) + IndexedDB (un handle par filière) | oui |
| `js/geo.js` | API Geolocation + contrôle du contexte sécurisé | oui |
| `js/app.js` | Construction du DOM, formulaires, liste, configuration | oui |
| `serveur.py` | Serveur local — indispensable, le GPS refuse `file://` | oui |
| `docs/RGPD.md` | Point de vigilance sur les données SPANC | oui |

## Invariants à ne pas casser

1. **`js/config.js` pilote tout.** Ajouter un champ = une entrée dans `champs`.
   Le formulaire, la colonne CSV, le filtre et l'affichage suivent seuls.
2. **Un CSV par filière** (`eau.csv`, `assainissement.csv`, `spanc.csv`), chacun
   limité à ses propres colonnes. La colonne `filiere` reste présente comme
   garde-fou à l'import. Le stockage interne, lui, reste un stock unique.
3. **`localStorage` fait autorité.** Chaque fichier disque est une projection
   réécrite intégralement ; un échec d'écriture ne doit jamais perdre une saisie
   terrain. Seule la filière touchée est réécrite (sauf purge et changement de
   séparateur, qui réécrivent les trois).
4. **Aucune dépendance, aucun build.** Scripts classiques, pas de modules ES
   (compatibilité maximale, y compris ouverture directe pour inspection).
5. **Aucune donnée utilisateur via `innerHTML`.** Tout passe par `el()` / `textContent`.
6. **Cibles tactiles ≥ 44 px** — saisie au téléphone, parfois avec des gants.

## Décisions prises

- **Vanilla strict**, pas de framework : l'application doit tourner dix ans sans
  chaîne de build à maintenir.
- **File System Access API + repli export** : le navigateur ne peut pas écrire
  librement sur le disque. Chrome/Edge écrivent dans le fichier lié ; ailleurs,
  téléchargement manuel. Pas de troisième voie sans serveur.
- **Trois fichiers, un stock** : éclater aussi le `localStorage` n'apporterait rien
  et compliquerait purge, statistiques et filtre. C'est le format d'export qui est
  triple, pas le modèle de données.
- **Import mono-filière** : une ligne portant une autre `filiere` est rejetée. Sans
  ce contrôle, un `eau.csv` importé dans SPANC passerait sans bruit.
- **Lambert 93 calculé côté client** plutôt qu'importé : la conversion est courte et
  évite une dépendance (`proj4js`) pour une seule projection.
- **Pas de carte embarquée** : tuiles = requêtes réseau et dépendance externe, sans
  valeur ajoutée pour la saisie. Lien OpenStreetMap ouvert à la demande.
- **Pas de photo** : incompatible avec la contrainte « un fichier CSV unique ».
- **Séparateur `;` par défaut** : Excel français découpe sur `;`, pas sur `,`.
- **BOM UTF-8** : sans lui, Excel FR casse les accents.

## Reste à faire (par ordre d'utilité)

- [ ] **Valider la nomenclature métier** des listes déroulantes avec les services
      Eau / Assainissement / SPANC — les valeurs actuelles sont plausibles mais
      non validées.
- [ ] Déploiement HTTPS pour l'usage terrain sur téléphone (`localhost` ne suffit pas).
- [ ] Service worker : saisie hors-ligne dans les secteurs sans réseau.
- [ ] Export GeoJSON en plus du CSV, pour injection directe dans un SIG.
- [ ] Dédoublonnage à l'import sur `reference` en plus de `id` (saisie multi-appareils).
- [ ] Export consolidé des trois filières, si le besoin d'une vue unique revient.
- [ ] Champ photo si le besoin se confirme — implique de sortir du CSV unique.

## Points de vigilance

- **RGPD / SPANC** : nom, adresse, parcelle, position d'un domicile. Cf. `docs/RGPD.md`.
  Base légale, durée de conservation et information des personnes relèvent de la
  collectivité.
- **Contexte sécurisé obligatoire** pour le GPS. Cause n°1 de « ça ne marche pas ».
- **Précision GPS** : seuil d'alerte configurable (20 m par défaut). Un smartphone
  en ville dense descend rarement sous 5 m ; sous couvert forestier, 30 m et plus.
- **Vidage du cache navigateur = perte des données** si aucun CSV n'est lié.
- **Trois liaisons à faire**, une par filière : un seul fichier lié ne couvre pas
  les autres onglets. Le badge d'en-tête indique l'état du fichier de l'onglet actif.
