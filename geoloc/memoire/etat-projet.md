# GéoLoc — état du projet

> Mémoire de travail. À relire en début de session **avant** d'ouvrir le code,
> à mettre à jour en fin de session. Évite de relire toute l'application à chaque fois.

**Dernière mise à jour :** 18/09/2026
**Branche :** `claude/geoloc-web-app-duccxo`
**Statut :** v0.1 fonctionnelle, testée en navigateur headless.

---

## Ce qui existe

| Fichier | Rôle | Stable ? |
|---|---|---|
| `index.html` | Coquille : en-tête, nav, conteneur, datalist, toast | oui |
| `css/style.css` | Feuille unique, mobile d'abord, `--accent` piloté par l'onglet | oui |
| `js/config.js` | **Source de vérité du schéma** : filières, champs, couleurs, colonnes CSV | oui |
| `js/lambert93.js` | WGS84 → EPSG:2154, constantes IGN | oui, vérifié |
| `js/csv.js` | Sérialisation / lecture RFC 4180, BOM UTF-8, détection de séparateur | oui, aller-retour testé |
| `js/store.js` | `localStorage` (points, config, compteurs) + IndexedDB (handle fichier) | oui |
| `js/geo.js` | API Geolocation + contrôle du contexte sécurisé | oui |
| `js/app.js` | Construction du DOM, formulaires, liste, configuration | oui |
| `serveur.py` | Serveur local — indispensable, le GPS refuse `file://` | oui |
| `docs/RGPD.md` | Point de vigilance sur les données SPANC | oui |

## Invariants à ne pas casser

1. **`js/config.js` pilote tout.** Ajouter un champ = une entrée dans `champs`.
   Le formulaire, la colonne CSV, le filtre et l'affichage suivent seuls.
2. **Un seul CSV** pour les trois filières : union des colonnes, colonne `filiere`
   pour discriminer. Ne pas éclater en trois fichiers.
3. **`localStorage` fait autorité.** Le fichier disque est une projection réécrite
   intégralement ; un échec d'écriture ne doit jamais perdre une saisie terrain.
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
- [ ] Champ photo si le besoin se confirme — implique de sortir du CSV unique.

## Points de vigilance

- **RGPD / SPANC** : nom, adresse, parcelle, position d'un domicile. Cf. `docs/RGPD.md`.
  Base légale, durée de conservation et information des personnes relèvent de la
  collectivité.
- **Contexte sécurisé obligatoire** pour le GPS. Cause n°1 de « ça ne marche pas ».
- **Précision GPS** : seuil d'alerte configurable (20 m par défaut). Un smartphone
  en ville dense descend rarement sous 5 m ; sous couvert forestier, 30 m et plus.
- **Vidage du cache navigateur = perte des données** si aucun CSV n'est lié.
