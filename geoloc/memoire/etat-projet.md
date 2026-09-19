# GéoLoc — état du projet

> Mémoire de travail. À relire en début de session **avant** d'ouvrir le code,
> à mettre à jour en fin de session. Évite de relire toute l'application à chaque fois.

**Dernière mise à jour :** 19/09/2026 (v0.8)
**Branche :** `claude/geoloc-web-app-duccxo`
**Statut :** v0.8 fonctionnelle. L'écran d'un onglet = **bouton « Créer une mesure »,
recherche, liste**. Toute la saisie est passée dans une fenêtre par-dessus. Étoile par
ligne : elle met en favori **la combinaison** type/modèle/détail, reposable d'un appui
dans la fenêtre. Testée en navigateur headless sur quinze formats, de 280 px à
1180 px, portrait et paysage.

---

## Ce qui existe

| Fichier | Rôle | Stable ? |
|---|---|---|
| `index.html` | Coquille : en-tête, nav, conteneur, datalist, toast | oui |
| `css/style.css` | Feuille unique, réglée pour la tablette, paliers 768 / 480 / 360 px + paysage court | oui |
| `js/config.js` | **Source de vérité du schéma** : filières, cascade, couleurs, colonnes CSV | oui |
| `js/catalogue.js` | Catalogue matériel 3 niveaux, graine livrée, lecture/écriture `parametres.csv` | oui |
| `js/lambert93.js` | WGS84 → EPSG:2154, constantes IGN | oui, vérifié |
| `js/csv.js` | Sérialisation / lecture RFC 4180, BOM UTF-8, détection de séparateur | oui, aller-retour testé |
| `js/store.js` | `localStorage` (points, config, compteurs, favoris) + IndexedDB (handles) | oui |
| `js/geo.js` | API Geolocation, relevé ponctuel et série affinée | oui, agrégation testée |
| `js/carte.js` | Visualiseur de tuiles WMTS/XYZ, fonds gratuits, validation | oui, projection vérifiée |
| `js/app.js` | Construction du DOM, formulaires, liste, configuration | oui |
| `serveur.py` | Serveur local — indispensable, le GPS refuse `file://` | oui |
| `docs/RGPD.md` | Point de vigilance sur les données SPANC | oui |
| `tests/audit-responsive.mjs` | Affichage sur 15 formats (tablettes + téléphones) + contrôle de la cascade | oui |

## Invariants à ne pas casser

1. **La saisie se limite à la cascade et à la note.** Trois listes liées plus
   `observations`, rien d'autre. Toute donnée structurée nouvelle est soit produite
   par l'application (`COLONNES_TECHNIQUES`), soit un niveau de cascade — le
   formulaire ne se regarnit pas champ par champ. La note est l'exception assumée :
   elle porte ce qu'aucune nomenclature ne prévoit.
2. **Un CSV par filière** (`eau.csv`, `assainissement.csv`, `spanc.csv`). Les trois
   ont aujourd'hui les mêmes vingt colonnes, mais gardent chacune leur fichier : la
   colonne `filiere` est le garde-fou à l'import, et rien n'oblige les trois à rester
   alignées. Le stockage interne, lui, reste un stock unique.
   **`parametres.csv` est le quatrième fichier** : il porte le catalogue, pas des
   relevés, et ne se mélange jamais aux trois autres.
3. **`localStorage` fait autorité.** Chaque fichier disque est une projection
   réécrite intégralement ; un échec d'écriture ne doit jamais perdre une saisie
   terrain. Seule la filière touchée est réécrite (sauf purge et changement de
   séparateur, qui réécrivent les trois).
4. **Aucune dépendance, aucun build.** Scripts classiques, pas de modules ES
   (compatibilité maximale, y compris ouverture directe pour inspection).
5. **Aucune donnée utilisateur via `innerHTML`.** Tout passe par `el()` / `textContent`.
6. **Cibles tactiles ≥ 44 px** pour la saisie, ≥ 36 px pour les actions secondaires —
   saisie au doigt sur tablette, parfois avec des gants. À partir de 768 px, 48 px.
7. **Aucune largeur ni hauteur codée en dur pour le chrome collant.** La hauteur de
   l'en-tête est mesurée par `suivreHauteurEntete()` et publiée dans `--h-entete`,
   celle de la barre complète dans `--h-barre` — c'est sur elle que se cale la barre
   de recherche collante. Un `top: 53px` en dur avait déjà cassé au palier 360 px.
8. **Cible principale : la tablette (768 → 1180 px). Plancher de support : 280 px.**
   Toute modification d'interface se vérifie aux deux bouts avant d'être poussée.
9. **Ordre de lecture d'un onglet de relevé, non négociable** : bouton « Créer une
   mesure », recherche, relevés effectués du plus récent au plus ancien. L'écran de
   fond est ce qu'on *consulte* ; la saisie vit dans une fenêtre par-dessus.
   **Les trois onglets partagent ce code** (`construireVueFiliere`) : une
   modification de mise en forme tombe sur les trois sans recopie.
10. **La cascade descend, jamais l'inverse.** Changer le type vide le modèle et le
   détail devenus impossibles. Une valeur venue d'un relevé enregistré échappe seule
   à cette règle : elle est réaffichée marquée *(hors catalogue)* plutôt qu'effacée.
   C'est `remplirSelect()` qui tient les deux régimes, selon que `valeurForcee` est
   fournie ou non — le bug inverse a existé, et la cascade ne se réinitialisait plus.
11. **Le catalogue ne vit pas dans le code.** Ajouter du matériel se fait dans
   Configuration ou dans `parametres.csv`, jamais dans `config.js`.
12. **Ne jamais présenter une précision meilleure que celle annoncée par le
   récepteur.** `precision_m` = meilleure `accuracy` observée. La dispersion est
   mesurée et stockée à part. Un recalage cartographique ne touche pas
   `precision_m` : il alimente `ecart_ajustement_m`.
13. **La carte est la seule dépendance réseau.** Tout le reste fonctionne hors
   ligne. Une panne de tuiles doit rester un message, jamais un blocage.
14. **Uniquement des fonds gratuits et sans clé.** Aucun service payant, aucun
   quota, aucun compte. Tout fond ajouté passe quatre contrôles, dont
   **attribution non vide** : c'est une obligation de licence.
15. **L'attribution s'affiche en permanence sur la carte**, jamais dans un menu
   ni derrière un geste.

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
- **Fond IGN en premier, OSM en secours** : l'orthophoto permet de voir le regard
  ou le tampon, et c'est le service public destiné à cet usage. OSM dépanne si la
  Géoplateforme tombe, mais sa politique d'usage proscrit les usages applicatifs
  intensifs : ce n'est pas un fond de production.
- **Fonds éditables depuis Configuration** plutôt que figés dans le code : un
  service public peut changer ses conditions. Sans cette porte de sortie, il
  faudrait modifier `carte.js` sur chaque poste.
- **Repère fixe, carte mobile** : sur un téléphone, déplacer un marqueur au doigt
  le cache sous le doigt. Déplacer le fond sous une croix fixe, non.
- **Lambert 93 calculé côté client** plutôt qu'importé : la conversion est courte et
  évite une dépendance (`proj4js`) pour une seule projection.
- **Pas de carte embarquée** : tuiles = requêtes réseau et dépendance externe, sans
  valeur ajoutée pour la saisie. Lien OpenStreetMap ouvert à la demande.
- **Formulaire métier supprimé, note conservée** (19/09) : référence, commune,
  diamètre, matériau, année, état, accessibilité ont été retirés en bloc au profit
  d'une saisie en trois gestes. `observations` est revenu le jour même, à la demande
  du terrain : le catalogue dit ce qu'*est* l'ouvrage, jamais ce qui *cloche*, et ce
  constat-là se perd entre le relevé et le bureau s'il n'a pas où s'écrire. Le
  rattachement communal, lui, reste au SIG depuis les coordonnées.
- **La note n'est pas recopiée par « Dupliquer »** : elle vaut pour un ouvrage
  précis. La reprendre en série produirait des constats faux.
- **Saisie en fenêtre plutôt qu'en ligne** (19/09) : le formulaire occupait la moitié
  de l'écran en permanence alors qu'il ne sert qu'au moment de la pose. En fenêtre,
  l'écran de fond redevient ce qu'on regarde vingt fois par tournée — la liste.
- **L'étoile porte sur la combinaison, pas sur le relevé** : c'est « ce matériel-là,
  je le repose souvent » qu'on met de côté, pas « ce point-là est important ». Deux
  relevés du même ensemble s'allument donc ensemble. Conséquence visible et assumée,
  pas un effet de bord.
- **Les favoris ne partent dans aucun CSV** : raccourcis de saisie propres au poste,
  pas des données. Ils survivent à « Effacer toutes les données ».
- **Le fond de la fenêtre de mesure ne ferme pas au clic** : abandonner une position
  affinée trente secondes par un geste de trop serait la faute la plus coûteuse de
  l'application. Croix et *Annuler* demandent confirmation dès qu'il y a de quoi
  perdre quelque chose.
- **Catalogue dans son propre fichier** plutôt que dans `config.js` : la nomenclature
  du matériel change d'une campagne et d'un service à l'autre, le schéma des champs
  non. Les mélanger obligerait à modifier le code pour ajouter un diamètre.
- **Table du catalogue construite au dépliage** : 316 lignes × 3 colonnes rendues
  d'emblée, c'est près de mille nœuds inutiles sur une tablette. Les `<details>`
  ne peuplent leur `<tbody>` qu'une fois ouverts.
- **Édition du catalogue ligne à ligne, pas champ par champ** : un formulaire d'ajout
  en trois cases et une croix par ligne. Rendre 316 lignes éditables coûterait
  neuf cents champs de saisie pour un besoin qui est d'ajouter, pas de réécrire.
  La réécriture en masse passe par le tableur et `parametres.csv`.
- **Sur-zoom assumé sur la carte** : aucun fond gratuit ne descend sous ~50 m de
  large, et la demande était une scène de dix mètres. La tuile la plus fine est
  agrandie jusqu'à ×8, et **le facteur est affiché** : sans cette mention, une image
  lissée se lit comme une mesure précise.
- **Photo mise de côté** à la demande, après la refonte tablette. Le travail
  commencé est dans le stash `WIP photo (mis de cote - redesign tablet)`.
- **Séparateur `;` par défaut** : Excel français découpe sur `;`, pas sur `,`.
- **BOM UTF-8** : sans lui, Excel FR casse les accents.

## Reste à faire (par ordre d'utilité)

- [ ] **Valider le catalogue livré** avec les services Eau / Assainissement / SPANC.
      Les 316 lignes fournies sont plausibles et couvrent les cas courants, mais
      **elles ne sont pas validées métier** : c'est une amorce à corriger, pas une
      nomenclature de référence.
- [ ] Déploiement HTTPS pour l'usage terrain sur téléphone (`localhost` ne suffit pas).
- [ ] Service worker : saisie hors-ligne dans les secteurs sans réseau.
- [ ] Export GeoJSON en plus du CSV, pour injection directe dans un SIG.
- [ ] Dédoublonnage à l'import sur `reference` en plus de `id` (saisie multi-appareils).
- [ ] Export consolidé des trois filières, si le besoin d'une vue unique revient.
- [ ] Mise en cache des tuiles pour l'ajustement hors réseau.
- [ ] **Vérifier sur le terrain les URL des flux IGN et OSM** : non testables
      depuis l'environnement de développement, dont la sortie réseau est fermée.
      Si la Géoplateforme a changé, corriger depuis Configuration, pas dans le code.
- [ ] Champ photo — travail commencé puis mis de côté, à reprendre sur demande.
- [ ] Renommage global d'un type de matériel depuis l'interface (aujourd'hui : tableur).
- [ ] Consigne aux agents sur ce qu'on n'écrit pas dans `observations` (cf. RGPD).
- [ ] Réordonner les favoris (aujourd'hui : ordre d'ajout).

## Points de vigilance

- **RGPD / SPANC** : depuis la v0.7, ni nom ni adresse ne sont saisis — mais une
  position à quelques mètres sur une installation ANC désigne un foyer. Le traitement
  reste soumis au RGPD, seul le risque en cas de fuite baisse. **Le champ
  `observations` rouvre la brèche** : rien n'empêche d'y écrire un nom ou une
  habitude de vie, et l'application ne peut pas le contrôler — c'est une consigne
  d'usage, pas une fonctionnalité. Cf. `docs/RGPD.md`.
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
- **Quatre liaisons à faire** : une par filière, plus le catalogue. Un seul fichier
  lié ne couvre pas les autres onglets. Le badge d'en-tête indique l'état du fichier
  de l'onglet actif.
- **Rétablir le catalogue livré écrase les ajouts.** L'action est confirmée, mais les
  lignes ajoutées à la main sont perdues si `parametres.csv` n'a pas été exporté.
- **Tout ajout d'interface se teste avec `tests/audit-responsive.mjs`** avant d'être
  poussé : il détecte débordement, texte tronqué, cible tactile trop petite et erreur
  JavaScript, sur dix configurations d'écran. C'est lui qui a révélé le défaut des
  430 px, invisible sur les largeurs testées à la main.
