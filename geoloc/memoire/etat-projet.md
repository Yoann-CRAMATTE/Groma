# GéoLoc — état du projet

> Mémoire de travail. À relire en début de session **avant** d'ouvrir le code,
> à mettre à jour en fin de session. Évite de relire toute l'application à chaque fois.

**Dernière mise à jour :** 18/09/2026 (v0.4)
**Branche :** `claude/geoloc-web-app-duccxo`
**Statut :** v0.4 fonctionnelle, testée en navigateur headless de 280 px à 1100 px, portrait et paysage.

---

## Ce qui existe

| Fichier | Rôle | Stable ? |
|---|---|---|
| `index.html` | Coquille : en-tête, nav, conteneur, datalist, toast | oui |
| `css/style.css` | Feuille unique, mobile d'abord, paliers 480 / 400 / 360 px + paysage court | oui |
| `js/config.js` | **Source de vérité du schéma** : filières, champs, couleurs, colonnes CSV | oui |
| `js/lambert93.js` | WGS84 → EPSG:2154, constantes IGN | oui, vérifié |
| `js/csv.js` | Sérialisation / lecture RFC 4180, BOM UTF-8, détection de séparateur | oui, aller-retour testé |
| `js/store.js` | `localStorage` (points, config, compteurs) + IndexedDB (un handle par filière) | oui |
| `js/geo.js` | API Geolocation, relevé ponctuel et série affinée | oui, agrégation testée |
| `js/carte.js` | Visualiseur de tuiles WMTS/XYZ écrit à la main | oui, projection vérifiée |
| `js/app.js` | Construction du DOM, formulaires, liste, configuration | oui |
| `serveur.py` | Serveur local — indispensable, le GPS refuse `file://` | oui |
| `docs/RGPD.md` | Point de vigilance sur les données SPANC | oui |
| `tests/audit-responsive.mjs` | Contrôle d'affichage, 280 → 540 px, paysage, modale | oui |

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
6. **Cibles tactiles ≥ 44 px** pour la saisie, ≥ 36 px pour les actions secondaires —
   saisie au téléphone, parfois avec des gants.
7. **Aucune largeur ni hauteur codée en dur pour le chrome collant.** La hauteur de
   l'en-tête est mesurée par `suivreHauteurEntete()` et publiée dans `--h-entete`.
   Un `top: 53px` en dur avait déjà cassé au palier 360 px.
8. **Plancher de support : 280 px de large.** Toute modification d'interface se
   vérifie à cette largeur avant d'être poussée.
9. **Ne jamais présenter une précision meilleure que celle annoncée par le
   récepteur.** `precision_m` = meilleure `accuracy` observée. La dispersion est
   mesurée et stockée à part. Un recalage cartographique ne touche pas
   `precision_m` : il alimente `ecart_ajustement_m`.
10. **La carte est la seule dépendance réseau.** Tout le reste fonctionne hors
   ligne. Une panne de tuiles doit rester un message, jamais un blocage.

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
- **Double libellé d'onglet** plutôt que troncature par ellipsis : « ASSAINISSEMENT »
  coupé en « ASSAINISS… » n'apprend rien. Le libellé complet reste dans `aria-label`.
- **En paysage court, l'en-tête glisse hors écran** au lieu de rester collé : sur
  320 px de haut, 84 px de barres fixes rendaient le formulaire inutilisable.
- **Visualiseur de tuiles écrit à la main** plutôt que Leaflet : le besoin se limite
  à déplacer un fond et lire le centre, soit environ 250 lignes contre une
  dépendance de 140 ko à suivre dans le temps.
- **Fond IGN plutôt qu'OSM** : l'orthophoto permet de voir le regard ou le tampon,
  et c'est le service public destiné à cet usage. Les URL restent remplaçables.
- **Repère fixe, carte mobile** : sur un téléphone, déplacer un marqueur au doigt
  le cache sous le doigt. Déplacer le fond sous une croix fixe, non.
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
- [ ] Mise en cache des tuiles pour l'ajustement hors réseau.
- [ ] Vérifier sur le terrain les URL des flux IGN : non testables depuis
      l'environnement de développement, dont la sortie réseau est fermée.
- [ ] Champ photo si le besoin se confirme — implique de sortir du CSV unique.

## Points de vigilance

- **RGPD / SPANC** : nom, adresse, parcelle, position d'un domicile. Cf. `docs/RGPD.md`.
  Base légale, durée de conservation et information des personnes relèvent de la
  collectivité.
- **Contexte sécurisé obligatoire** pour le GPS. Cause n°1 de « ça ne marche pas ».
- **Précision GPS** : seuil d'alerte configurable (20 m par défaut). Un smartphone
  en ville dense descend rarement sous 5 m ; sous couvert forestier, 30 m et plus.
- **La mesure affinée ne fait pas de miracle.** Les fixes successifs sont corrélés :
  le gain vient de la convergence du récepteur, pas du moyennage. Ne pas laisser
  croire à une précision centimétrique.
- **Un champ `number` avec `step` incompatible bloque le formulaire en silence.**
  C'est arrivé une fois (`step: 5`, `min: 5`, valeur 6) : toute la configuration
  n'était plus enregistrée, sans message. Un écouteur `invalid` le signale désormais.
- **Vidage du cache navigateur = perte des données** si aucun CSV n'est lié.
- **Trois liaisons à faire**, une par filière : un seul fichier lié ne couvre pas
  les autres onglets. Le badge d'en-tête indique l'état du fichier de l'onglet actif.
- **Tout ajout d'interface se teste avec `tests/audit-responsive.mjs`** avant d'être
  poussé : il détecte débordement, texte tronqué, cible tactile trop petite et erreur
  JavaScript, sur dix configurations d'écran. C'est lui qui a révélé le défaut des
  430 px, invisible sur les largeurs testées à la main.
