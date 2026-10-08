# Groma — état du projet

> Mémoire de travail. À relire en début de session **avant** d'ouvrir le code,
> à mettre à jour en fin de session. Évite de relire toute l'application à chaque fois.

**Dernière mise à jour :** 30/09/2026 — **incrément 1, étape 1/3** (socle = incrément 0)
**Branche :** `claude/geoloc-web-app-duccxo`, fusionnée dans `main`
**En ligne :** https://yoann-cramatte.github.io/Groma/ — dépôt public, licence AGPL-3.0

> **Le dépôt est désormais Groma seul.** Le projet Synapse qu'il portait (shell
> desktop AI-native, resté au stade du spike) a été supprimé le 24/09/2026 : il est
> caduc. L'application est remontée à la racine — plus de sous-dossier `geoloc/`.
> **L'état décrit ici est le socle, l'incrément 0.** La numérotation v0.1 → v0.9 est
> abandonnée ; les incréments se comptent à partir de 1. L'historique reste dans
> `journal.md`, il explique les invariants ci-dessous.
>
> **Groma est une PWA publiée sur GitHub Pages**, en ligne depuis le 29/09/2026 :
> installable sur l'écran d'accueil, démarrable sans réseau, servie en HTTPS — ce
> qui débloque le GPS sur un téléphone de terrain. Vérifiée en conditions réelles
> par Yoann : 33 mesures, précision 2 m, dispersion 1.7 m, fond IGN.
>
> **Rien de ce qui touche aux réglages GitHub n'est faisable depuis Claude Code.**
> Création de dépôt, renommage, description, visibilité, activation de Pages,
> déclenchement d'un workflow : tous répondent `403 Resource not accessible by
> integration`. L'App GitHub installée n'a que les droits sur le contenu, les
> issues et les pull requests. Ne pas perdre de temps à réessayer — passer la main.

**Statut :** socle fonctionnel. L'écran d'un onglet = **bouton « Créer une mesure »,
recherche, liste**. Toute la saisie est passée dans une fenêtre par-dessus, et cette
fenêtre est **carte-first** : la carte s'ouvre en haut au zoom maximal, viseur fixe au
centre, l'acquisition GPS part seule, puis viennent position, cascade et observation.
Étoile par ligne : elle met en favori **la combinaison** type/modèle/détail. Testée en
navigateur headless sur quinze formats, de 280 px à 1180 px, portrait et paysage.

---

## Ce qui existe

| Fichier | Rôle | Stable ? |
|---|---|---|
| `CLAUDE.md` | Consignes de développement — à relire avant de coder | oui |
| `LICENSE` | AGPL-3.0, texte canonique (661 lignes) vérifié sur deux sources | oui |
| `README.md` | Documentation complète : GeoJSON, GPS, carte, PWA, affichage, limites | oui |
| `index.html` | Coquille : en-tête, nav, conteneur, toast, manifeste, enregistrement du SW | oui |
| `manifest.webmanifest` | PWA : nom, icônes, plein écran. `start_url`/`scope` **relatifs** | oui |
| `service-worker.js` | Cache hors ligne, stratégie cache-d'abord + revalidation | oui |
| `icons/` | Icônes PWA dérivées de `favicon.svg` (192, 512, maskable, apple) | oui |
| `.github/workflows/pages.yml` | Publication GitHub Pages à chaque passage sur `main` | oui |
| `css/style.css` | Feuille unique, réglée pour la tablette, paliers 768 / 480 / 360 px + paysage court | oui |
| `js/config.js` | **Source de vérité du schéma** : filières, cascade, couleurs, champs, `DECIMALES` | oui |
| `js/catalogue.js` | Catalogue matériel 3 niveaux, graine livrée, lecture/écriture `parametres.csv` | oui |
| `js/lambert93.js` | WGS84 → EPSG:2154, constantes IGN | oui, vérifié |
| `js/csv.js` | RFC 4180, BOM UTF-8, détection de séparateur — **catalogue uniquement** | oui, aller-retour testé |
| `js/geojson.js` | RFC 7946 — **seul format des relevés** : export, fichier lié, import | oui, aller-retour testé |
| `js/store.js` | `localStorage` (points, config, compteurs, favoris) + IndexedDB (handles) | oui |
| `js/geo.js` | API Geolocation, relevé ponctuel et série affinée | oui, agrégation testée |
| `js/carte.js` | Visualiseur de tuiles WMTS/XYZ, fonds gratuits, validation | oui, projection vérifiée |
| `js/app.js` | Construction du DOM, formulaires, liste, configuration | oui |
| `serveur.py` | Serveur local — indispensable, le GPS refuse `file://` | oui |
| `AppInfo.json` | Identité de l'app (nom, version, éditeur, licence) et changelog — convention EuropaSoft, **pas encore lu par l'application** | oui |
| `docs/RGPD.md` | Point de vigilance sur les données SPANC | oui |
| `tests/audit-responsive.mjs` | Affichage sur 15 formats (tablettes + téléphones) + contrôle de la cascade | oui |
| `tests/audit-pwa.mjs` | Manifeste, icônes, service worker, cohérence `index.html` ↔ `COQUILLE`, démarrage hors réseau | oui |

## Invariants à ne pas casser

1. **La saisie se limite à la cascade et à la note.** Trois listes liées plus
   `observations`, rien d'autre. Toute donnée structurée nouvelle est soit produite
   par l'application (`COLONNES_TECHNIQUES`), soit un niveau de cascade — le
   formulaire ne se regarnit pas champ par champ. La note est l'exception assumée :
   elle porte ce qu'aucune nomenclature ne prévoit.
2. **Un GeoJSON par filière** (`eau.geojson`, `assainissement.geojson`,
   `spanc.geojson`). Les trois ont aujourd'hui les mêmes vingt et un champs, mais
   gardent chacune leur fichier : le champ `filiere` est le garde-fou à l'import, et
   rien n'oblige les trois à rester alignées. Le stockage interne, lui, reste un stock
   unique.
   **`parametres.csv` est le quatrième fichier** : il porte le catalogue, pas des
   relevés, et ne se mélange jamais aux trois autres.
2 bis. **Le GeoJSON est le seul format des relevés** — export, fichier lié et import.
   Le CSV a été retiré des relevés le 30/09/2026 : un `eau.csv` réenregistré par un
   tableur français transformait `47.5` en `47,5` et rendait les coordonnées
   illisibles, sans message. Ne pas le réintroduire comme « format de confort ».
2 ter. **`Cfg.DECIMALES` est la seule table de décimales.** Deux chemins produisent
   des relevés — la saisie et l'import d'un fichier — et deux écritures d'une même
   valeur (`47.5175` d'un côté, `47.5175000` de l'autre) rendent deux exports
   incomparables à mesure identique. Toute nouvelle colonne numérique s'y inscrit.
2 quater. **La clé IndexedDB des handles reste `csv-<filiere>`**, malgré le passage au
   GeoJSON. La renommer perdrait toutes les liaisons déjà enregistrées sur les
   tablettes, sans aucun message, et il faudrait relier chaque fichier à la main.
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
9 bis. **Ordre de la fenêtre de mesure, non négociable** : carte au zoom maximal avec
   viseur fixe, barre de carte (fonds, zoom, GPS), coordonnées et écart, état GPS,
   tableau de position, cascade, observation, boutons. La carte **est** l'outil de
   positionnement : aucun bouton d'acquisition, l'agent recale en déplaçant le fond
   sous le viseur.
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
12 bis. **Le viseur fait foi, la mesure GPS reste la référence.** Ce qui est écrit,
   c'est le centre de la carte (`positionRetenue()`). Au-delà de 50 cm d'écart avec
   la mesure, `position_ajustee` passe à `oui` et l'écart est tracé. Deux drapeaux
   pilotent ça dans `carteEtat` : `adopte` (la série GPS remplace la mesure de
   référence) et `recentre` (la carte suit la mesure). Un geste sur la carte coupe
   `recentre` mais pas `adopte` : le GPS continue d'affiner pendant que le viseur
   reste où l'agent l'a posé.
13. **La carte est la seule dépendance réseau.** Tout le reste fonctionne hors
   ligne. Une panne de tuiles doit rester un message, jamais un blocage.
14. **Uniquement des fonds gratuits et sans clé.** Aucun service payant, aucun
   quota, aucun compte. Tout fond ajouté passe quatre contrôles, dont
   **attribution non vide** : c'est une obligation de licence.
15. **L'attribution s'affiche en permanence sur la carte**, jamais dans un menu
   ni derrière un geste.
16. **Tout fichier chargé par `index.html` s'inscrit dans `COQUILLE`**
   (`service-worker.js`). L'oublier ne se voit pas en ligne et casse le
   démarrage hors réseau. `tests/audit-pwa.mjs` le vérifie.
17. **`start_url` et `scope` du manifeste restent relatifs (`.`).** Sur GitHub
   Pages l'application vit sous `/<dépôt>/` : un `/` absolu la sortirait de sa
   portée et empêcherait l'installation.
18. **Les tuiles ne sont jamais mises en cache.** Les conditions d'usage de l'IGN
   et d'OpenStreetMap proscrivent la constitution de réserves locales. Le service
   worker n'intercepte que le même domaine, délibérément.
19. **Toute mutation de relevés appelle `marquerModifie`**, toute sortie réussie
   `marquerSauvegarde`. C'est ce qui pilote le bandeau « relevés encore dans ce
   seul navigateur ». Une mutation qui l'oublie rend le bandeau menteur, ce qui
   est pire que pas de bandeau. Modèle à deux états par filière : horodatage
   présent = tout est sorti, absent = il reste des modifications. Compter les
   points en attente se tromperait dès qu'on modifie ou supprime un relevé déjà
   exporté.
20. **Une proposition se refuse, une panne non.** Le bandeau de liaison au CSV
   distingue les deux : `absent` est une offre, refusable une fois pour toutes ;
   `a-autoriser` et `introuvable` sont des défauts, ils restent affichés même
   après un refus antérieur. Un défaut qui se cache est pire que pas
   d'avertissement.
21. **Une permission ou un sélecteur de fichier se réclame depuis un clic.** Le
   navigateur exige un geste de l'utilisateur et refuse **en silence** sinon —
   une chaîne de promesses partie d'un clic l'a déjà consommé. `ecrireFichier`
   ne fait que constater et renvoie `'permission'` ; c'est le bouton du bandeau
   qui demande.
22. **`etatLiaison` touche réellement le fichier.** Une poignée survit à la
   suppression de sa cible et `queryPermission` répond `granted` sur un fichier
   disparu : sans `getFile()`, l'application se croit reliée et chaque écriture
   échoue sans rien dire.
23. **Marges d'encoche partout où quelque chose colle au bord.** En-tête, bas de
   page, quatre côtés des fenêtres. `viewport-fit=cover` étend la page sous les
   barres système : sans `env(safe-area-inset-*)`, le titre passe sous l'heure.
   Une hauteur en `vh` ignore ces marges — utiliser `100%` du conteneur déjà
   décalé. iOS reste en `black-translucent` : l'en-tête est une bande d'encre
   sombre dans les deux thèmes, l'heure s'y écrit en blanc. Si un jour l'en-tête
   devient clair, passer à `default`, sinon l'heure disparaît.
24. **Aucune couleur en dur hors des jetons de `:root`.** Le thème sombre est
   déclaré deux fois (appareil en sombre + choix explicite) : un jeton ajouté à
   l'un s'ajoute aux trois blocs. Seules exceptions, commentées : les voiles et
   repères posés sur la carte, qui se lisent sur la photo aérienne ; les
   pastilles de la bande d'en-tête (sombre dans les deux thèmes) ; l'étoile de
   favori et la pastille « affiné », lisibles sur les deux fonds de fiche ; la
   pastille du message de confirmation, qui se lit sur son fond inversé.
25. **Une couleur de filière ne sert jamais telle quelle en texte.** Passer par
   `--accent-texte` ou un `color-mix(... var(--texte))` : en brut, le vert et le
   bleu ciel tombent sous 3:1 sur le papier clair.

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
- **Thème clair par défaut** (08/10/2026) : l'outil sert dehors, et les reflets
  écrasent un écran sombre bien avant un écran clair. Le sombre reste au choix dans
  Configuration › Affichage, ou suit l'appareil (`auto`). La préférence s'enregistre
  dès le choix, sans passer par « Enregistrer la configuration ».
- **Style « carte topo »** (08/10/2026), choisi par Yoann parmi trois maquettes
  (pixel art, verre, topo). Le verre a été écarté pour la lisibilité au soleil et le
  coût du flou sur tablette, le pixel art parce que ses chiffres se lisaient mal.
  Contours de 2 à 3 px et relief plein `--relief` : ils restent visibles dehors.
- **Une seule police embarquée**, Bricolage Grotesque (OFL), dans `fonts/` et dans
  `COQUILLE`. Elle sert aux titres, à la marque et aux boutons. Le texte courant
  reste en police système, les coordonnées en `ui-monospace`. Une police distante
  casserait le hors-ligne.

## Reste à faire (par ordre d'utilité)

- [ ] **Valider le catalogue livré** avec les services Eau / Assainissement / SPANC.
      Les 316 lignes fournies sont plausibles et couvrent les cas courants, mais
      **elles ne sont pas validées métier** : c'est une amorce à corriger, pas une
      nomenclature de référence.
- [x] ~~Déploiement HTTPS~~ — GitHub Pages, 27/09/2026.
- [x] ~~Service worker~~ — coquille en cache, démarrage hors réseau, 27/09/2026.
- [x] ~~Avertir avant la perte des données~~ — bandeau par filière + stockage
      persistant, 27/09/2026.
- [x] ~~Export GeoJSON~~ — RFC 7946, un bouton par filière, 29/09/2026.
- [x] ~~Retirer le CSV des relevés~~ — 30/09/2026. Export, fichier lié et import sont
      passés au GeoJSON ; `analyser()` ajouté à `geojson.js` ; aller-retour vérifié sans
      perte sur les dix-sept champs. Le CSV ne sert plus qu'au catalogue.
- [ ] **Catalogue en JSON hiérarchique** (étape 2/3 de l'incrément 1), import CSV
      conservé : une nomenclature arrive souvent en tableur.
- [ ] **Onglet mobilier urbain** (étape 3/3) — lampadaire, banc, barrière. Nom
      **MOBILIER** proposé, **pas encore confirmé par Yoann**. Attention :
      `.onglets { grid-template-columns: repeat(4, 1fr) }` est codé en dur dans
      `css/style.css` et doit devenir dynamique pour un cinquième onglet.
- [ ] Dédoublonnage à l'import sur `reference` en plus de `id` (saisie multi-appareils).
- [ ] Export consolidé des trois filières, si le besoin d'une vue unique revient.
- [ ] Mise en cache des tuiles pour l'ajustement hors réseau.
- [x] ~~Vérifier les flux IGN sur le terrain~~ — Plan IGN et photo aérienne
      confirmés en usage réel le 29/09/2026.
- [ ] **Vérifier si Chrome Android expose `showSaveFilePicker`.** L'API n'a
      longtemps existé que sur le bureau, et le README affirme « bureau et
      Android » sans que ce soit établi. Les bandeaux de liaison sont
      conditionnés à sa présence : s'ils n'apparaissent jamais sur la tablette,
      c'est la réponse, et il faut corriger le README. Non vérifiable ici, la
      sortie réseau générale est fermée.
- [ ] Champ photo — travail commencé puis mis de côté, à reprendre sur demande.
- [ ] Renommage global d'un type de matériel depuis l'interface (aujourd'hui : tableur).
- [ ] Consigne aux agents sur ce qu'on n'écrit pas dans `observations` (cf. RGPD).
- [ ] Réordonner les favoris (aujourd'hui : ordre d'ajout).
- [ ] **Arbitrer le disque de précision au zoom maximal** : à 5 cm/px, un rayon de
      6 m couvre tout le cadre et teinte l'orthophoto qu'on cherche justement à
      lire. L'information est juste, mais elle gêne le geste de recalage. Options :
      contour seul au-delà d'un seuil, ou disque conservé. À trancher avec l'usage.

## Points de vigilance

- **Playwright ne trouve pas son Chromium dans ce conteneur** : il attend le build
  1243, seul le 1194 est installé, et `npx playwright install` n'a pas de réseau.
  Les deux audits lisent `CHROMIUM_PATH` — l'exporter avant de lancer :
  `export CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
  Sans ça, `audit-pwa` échoue au lancement du navigateur et non sur un défaut réel.
- **RGPD / SPANC** : ni nom ni adresse ne sont saisis — mais une
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
