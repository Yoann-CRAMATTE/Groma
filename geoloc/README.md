# GéoLoc

Application web **vanilla** (aucune dépendance, aucun build) pour relever la position GPS
d'ouvrages de terrain et les consigner dans **un fichier CSV par filière**.
Pensée pour la **tablette**, utilisable jusqu'au petit smartphone.

Trois filières de relevé — **EAU**, **ASSAINISSEMENT**, **SPANC** — plus un onglet
**CONFIGURATION**. Les trois filières partagent exactement le même écran ; seuls leur
catalogue de matériel, leur couleur et leur fichier diffèrent.

| Onglet | Couleur | Fichier | Références | Colonnes |
|---|---|---|---|---|
| EAU | `#0ea5e9` bleu | `eau.csv` | `AEP-0001` | 21 |
| ASSAINISSEMENT | `#22c55e` vert | `assainissement.csv` | `AC-0001` | 21 |
| SPANC | `#a855f7` violet | `spanc.csv` | `ANC-0001` | 21 |
| CONFIGURATION | `#94a3b8` gris | `parametres.csv` | — | 4 |

**La saisie tient en trois listes liées** — type, puis modèle, puis détail —
alimentées par un catalogue éditable stocké dans `parametres.csv`, **plus une note
libre**. Tout le reste d'une ligne est produit par l'application : position, méthode
de mesure, horodatage, référence. Sur le terrain, un relevé = un appui GPS, trois
choix, et une phrase si l'ouvrage la mérite.

---

## Démarrer

```bash
python3 geoloc/serveur.py        # http://localhost:8000
python3 geoloc/serveur.py 8123   # autre port
```

> **Ne pas ouvrir `index.html` par double-clic.** L'API Geolocation exige un
> *contexte sécurisé* : en `file://`, le navigateur refuse le GPS sans message d'erreur
> explicite. Seuls `http://localhost` et HTTPS fonctionnent.

Pour un usage terrain sur téléphone, servir l'application en HTTPS (reverse proxy,
hébergement interne, ou tunnel) — `localhost` ne vaut que sur la machine elle-même.

---

## Fichiers CSV

**Quatre fichiers** : un par onglet de relevé, plus `parametres.csv` qui porte le
catalogue de matériel. Chacun est lié et exporté indépendamment depuis Configuration.
Chaque CSV ne porte que les colonnes de sa filière — aucune colonne vide héritée
des autres. La colonne `filiere` est conservée : elle sert de garde-fou à l'import.

Format : **UTF-8 avec BOM**, séparateur `;` par défaut (configurable `;` / `,` / tabulation),
fins de ligne CRLF, échappement RFC 4180. Ouvrable directement dans Excel français.

### Colonnes — identiques dans les trois fichiers

```
id;filiere;reference;date_saisie;operateur;
latitude;longitude;altitude_m;
precision_m;dispersion_m;methode_gps;nb_mesures;duree_gps_s;
position_ajustee;ecart_ajustement_m;
x_l93;y_l93;
type_materiel;modele;detail;observations
```

Seules les quatre dernières sont saisies. `type_materiel`, `modele` et `detail` sont
les niveaux de la cascade : ils décrivent **ce qu'est** l'ouvrage. `observations` dit
**ce qui cloche** — tampon scellé, accès par la cour du 12, vanne bloquée. Le
catalogue ne peut pas prévoir ça.

Les trois filières ont aujourd'hui les mêmes colonnes mais gardent chacune leur
fichier : `filiere` sert de garde-fou à l'import, et rien n'oblige les trois à rester
alignées si une d'elles a besoin d'un champ propre.

### `parametres.csv` — le catalogue de matériel

Quatre colonnes, une ligne par combinaison atteignable :

```
filiere;type_materiel;modele;detail
eau;Compteur;DN 20;Vitesse
eau;Compteur;DN 20;Volumétrique
eau;Ventouse;DN 60;Triple fonction
```

Il alimente les trois listes liées des onglets de relevé : choisir un type restreint
les modèles, choisir un modèle restreint les détails. `detail` peut rester vide.

Ce fichier est **séparé des relevés** : le catalogue évolue d'une campagne à l'autre
sans toucher aux données déjà saisies. Il s'édite depuis Configuration → *Catalogue
de matériel* (ajout ligne à ligne, suppression, rétablissement du catalogue livré),
ou en masse dans un tableur puis réimporté.

Une valeur enregistrée dans un relevé mais retirée du catalogue depuis n'est jamais
effacée en silence : à la relecture du point, elle réapparaît marquée
*(hors catalogue)*.

### Deux modes d'écriture

| Mode | Navigateurs | Comportement |
|---|---|---|
| **Fichier lié** (File System Access API) | Chrome, Edge (bureau et Android) | Configuration → carte de la filière → *Créer / remplacer* ou *Lier un existant*. Le CSV de cette filière est réécrit intégralement à chaque enregistrement, suppression ou import. Les trois liaisons sont indépendantes. |
| **Export manuel** | Firefox, Safari, iOS | *Exporter* par filière, ou *Exporter les 3*. Le catalogue a son propre *Exporter*. |

Dans les deux cas, `localStorage` fait autorité : aucune saisie n'est perdue si
l'écriture disque échoue. Les fichiers liés survivent au rechargement (handles
conservés en IndexedDB) ; le navigateur peut redemander l'autorisation d'écriture.

### Import

Chaque carte de filière a son bouton *Importer*. Les lignes sont ajoutées au stock
existant ; un identifiant `id` déjà présent est ignoré. **Un CSV portant une autre
filière est refusé** : un `eau.csv` ne peut pas être injecté dans SPANC. Un CSV sans
colonne `filiere` est accepté et rattaché à la filière ciblée.

> Le stockage interne (`localStorage`) reste un stock unique, discriminé par la
> colonne `filiere`. C'est le format d'export qui est éclaté en trois fichiers.
> Le catalogue, lui, est stocké à part : ce n'est pas une donnée de relevé.

---

## Créer une mesure

L'écran d'un onglet ne porte que trois choses : le bouton **Créer une mesure**, une
barre de recherche, et la liste des relevés. La saisie, elle, se fait dans une
fenêtre qui s'ouvre par-dessus — l'écran de fond reste ce qu'on consulte, pas ce
qu'on remplit.

Dans la fenêtre, dans cet ordre :

1. **Relevé rapide** ou **Précision maximale** — la position ;
2. **Centrer sur le point** — la carte, si le GPS est tombé à côté ;
3. les **favoris**, s'il y en a — un appui repose une combinaison connue ;
4. les **trois listes liées**, puis la **note** ;
5. **Enregistrer le relevé**, qui referme la fenêtre.

*Annuler* et la croix demandent confirmation dès qu'une position a été prise ou un
champ rempli. Le clic sur le fond ne ferme rien : un geste de trop effacerait une
position qu'on vient de mettre trente secondes à affiner.

## Favoris

L'étoile d'une ligne ne marque pas *ce relevé-là* : elle met de côté **la combinaison
qui le compose** — type, modèle, détail. Deux relevés du même ensemble s'allument donc
ensemble, et la combinaison apparaît en raccourci en haut de la fenêtre de mesure. Un
appui remplit les trois listes.

C'est ce qui rend tenable une tournée de vingt vannes identiques.

Les favoris vivent dans le navigateur, par poste. **Ils ne partent dans aucun CSV** :
ce sont des raccourcis de saisie, pas des données de relevé. Effacer les données ne
les touche pas.

## Relevé de la position

Trois gestes, du plus rapide au plus sûr :

| Action | Ce qu'elle fait |
|---|---|
| **Relevé rapide** | Une seule mesure, immédiate. Suffit pour un ouvrage bien dégagé. |
| **Précision maximale** | Mesure continue pendant la durée configurée (30 s par défaut), puis agrégation. Bouton d'arrêt anticipé. |
| **Ajuster sur la carte** | Recalage manuel sur photo aérienne ou plan IGN. |

### Ce que fait « Précision maximale », et ce qu'elle ne fait pas

Le récepteur est écouté en continu. Les mesures nettement plus mauvaises que la
meilleure (au-delà du double de son rayon annoncé) sont écartées, les autres sont
moyennées avec une pondération en `1/précision²`.

**La précision enregistrée reste la meilleure `accuracy` annoncée par le récepteur,
jamais une valeur calculée.** Moyenner des fixes GPS successifs ne divise pas
l'erreur par la racine du nombre de mesures : ces fixes sont fortement corrélés
(même constellation, même multitrajet). Le gain réel vient surtout du temps laissé
au récepteur pour converger. Prétendre le contraire produirait des coordonnées
faussement rassurantes.

En contrepartie, chaque point porte de quoi juger sa qualité :

| Colonne | Contenu |
|---|---|
| `precision_m` | Meilleur rayon annoncé par le récepteur |
| `dispersion_m` | Écart quadratique moyen des mesures retenues au point final — mesuré, pas estimé |
| `methode_gps` | `ponctuelle` ou `affinee` |
| `nb_mesures` | Nombre de fixes collectés |
| `duree_gps_s` | Durée réelle de la série |

Une dispersion faible avec une précision annoncée élevée signale un récepteur stable
mais pessimiste ; l'inverse signale une mesure agitée. Les deux valeurs se lisent
ensemble.

---

## Ajustement sur la carte

Le bouton **Ajuster sur la carte** ouvre une fenêtre où **le repère reste fixe au
centre et la carte se déplace dessous** : on amène le point exactement sur le regard,
la vanne ou le tampon visible sur la photo aérienne.

- La fenêtre s'ouvre **au plus serré, sur une scène d'une dizaine de mètres** :
  c'est l'échelle à laquelle on distingue le tampon du regard voisin.
- Fonds fournis : **photo aérienne** et **plan IGN** (Géoplateforme), plus
  **OpenStreetMap** en secours — voir la section suivante.
- La position mesurée reste affichée en bleu, entourée de son rayon de précision.
- L'écart au GPS s'affiche en direct et passe en orange dès qu'il dépasse ce rayon.
- **Revenir au GPS** annule le recalage.

Aucun fond gratuit ne fournit nativement des tuiles à cette échelle. Au-delà de son
zoom maximal, la carte réclame la tuile la plus fine disponible et l'agrandit
(jusqu'à ×8) : le calage géographique reste exact, l'image devient interpolée. Le
facteur est écrit à côté de l'échelle — *image agrandie ×4* — pour qu'une netteté
d'affichage ne se lise pas comme une précision de mesure.

Un recalage ne modifie pas `precision_m` : la précision décrit la qualité de la
*mesure*, qu'un déplacement manuel n'améliore ni ne dégrade. Il est tracé à part :

| Colonne | Contenu |
|---|---|
| `position_ajustee` | `oui` / `non` |
| `ecart_ajustement_m` | Distance entre la mesure GPS et la position validée |

### Fonds de carte — gratuits, et vérifiables

Seuls des services **gratuits et sans clé d'accès** sont fournis par défaut :

| Fond | Source | Zoom max | Attribution |
|---|---|---|---|
| Photo aérienne | Géoplateforme IGN | 20 (≈ 10 cm/px à cette latitude) | © IGN — Géoplateforme |
| Plan IGN | Géoplateforme IGN | 19 | © IGN — Géoplateforme |
| OpenStreetMap | tile.openstreetmap.org | 19 | © Contributeurs OpenStreetMap (ODbL) |

Aucun service payant, aucun quota, aucun compte. L'attribution s'affiche **en
permanence** en bas de la carte : c'est une obligation de licence, pas une mention
décorative reléguée dans un menu.

**Gratuit ne veut pas dire sans conditions :**

- Les tuiles d'`openstreetmap.org` sont servies par une fondation à but non lucratif
  et leur politique d'usage **proscrit les usages applicatifs intensifs**. C'est un
  secours de dépannage, pas un fond de production pour un service qui relève des
  centaines d'ouvrages par semaine.
- Un service public peut modifier ses conditions. **Les URL n'ont pas pu être
  appelées réellement depuis l'environnement de développement** (sortie réseau
  fermée) : à confirmer avant tout déploiement en service.

#### Changer de fond sans toucher au code

Configuration → **Fonds de carte** permet d'ajouter, modifier ou retirer un fond :
libellé, URL de tuile, zoom maximal et attribution. La liste remplace alors les fonds
par défaut ; **Rétablir les fonds gratuits** revient à l'état d'origine.

L'URL accepte n'importe quel service **XYZ ou WMTS** et doit contenir les repères
`{z}`, `{x}` et `{y}` :

```
https://exemple.fr/tuiles/{z}/{x}/{y}.png
```

Quatre contrôles avant enregistrement : HTTPS obligatoire, repères présents, zoom
entre 1 et 22, **attribution non vide**. Un fond sans attribution est refusé — la
licence l'exige, l'application ne laisse pas l'oublier.

Cela permet notamment de basculer sur un serveur de tuiles interne à la collectivité,
ou sur un autre flux public, si la Géoplateforme change de conditions.

### Dépendance réseau

C'est la **seule** partie de l'application qui sort sur le réseau. Sans connexion, la
fenêtre le dit et reste utilisable : repère, coordonnées et validation fonctionnent,
seul le fond manque. Le reste de l'application n'émet aucune requête.

> Les fonds par défaut sont définis dans `js/carte.js` (objet `FONDS`). Les
> remplacer durablement pour un poste se fait depuis Configuration, sans éditer
> le code.

---

## Affichage — tablette d'abord

L'outil de terrain visé est la **tablette** : la mise en page est réglée pour elle
(768×1024, 810×1080, 834×1194, et les deux orientations jusqu'à 1180×820). Chaque
onglet de relevé se lit de haut en bas — **Créer une mesure**, **recherche**,
**relevés déjà effectués** du plus récent au plus ancien.

L'application reste vérifiée à **280, 320, 360, 390, 412, 430, 480 et 540 px** de
large et en **paysage court** (568×320, 653×280) : elle doit rester utilisable au
téléphone quand la tablette n'est pas là.

| Palier | Adaptation |
|---|---|
| ≥ 768 px | Cascade sur trois colonnes, boutons GPS sur un rang, cartes de fichiers sur deux colonnes, champs et boutons à 48 px. |
| ≤ 480 px | Libellés d'onglets abrégés : `EAU` · `ASSAIN.` · `SPANC` · `CONFIG`. Le libellé complet reste exposé aux lecteurs d'écran via `aria-label`. Seuil mesuré : « CONFIGURATION » déborde encore de sa colonne à 430 px. |
| < 480 px | Le message de confirmation passe en bandeau pleine largeur (centré, il se repliait en colonne étroite). |
| < 360 px | Gouttière à 10 px, marges et typographie compactées, boutons des cartes fichier en grille à deux colonnes, en-tête de carte sur deux lignes. |
| Paysage, hauteur < 480 px | L'en-tête glisse hors écran au défilement, la barre d'onglets reste collée : 47 px de barres fixes au lieu de 84. |

Règles tenues à toutes les largeurs :

- **Aucun débordement horizontal** — vérifié automatiquement sur les quatre onglets.
- **Aucun texte tronqué** — libellés, boutons et valeurs tiennent dans leur boîte.
- **Cibles tactiles ≥ 36 px**, champs de saisie à 44 px. Les cases à cocher occupent
  une ligne de 44 px et se basculent en touchant le libellé.

La hauteur de l'en-tête n'est pas codée en dur : `app.js` la mesure et la publie dans
la variable CSS `--h-entete`, que le mode paysage utilise pour se caler.

### Rejouer l'audit

```bash
python3 geoloc/serveur.py 8123 &
npm install playwright
node geoloc/tests/audit-responsive.mjs
```

Le script parcourt les quatre onglets à chaque format — tables du catalogue dépliées
comprises — et signale débordement, texte tronqué, cible tactile trop petite et
erreur JavaScript. Il contrôle aussi que la cascade filtre réellement : le niveau 2
doit dépendre du niveau 1, et le niveau 3 tomber quand le niveau 1 change. Sortie non
nulle en cas de défaut. **Playwright n'est pas une dépendance de l'application** : il ne sert qu'à ce
contrôle.

---

## Coordonnées

Chaque point enregistre la position WGS84 (latitude, longitude, altitude, précision)
et sa conversion en **Lambert 93 / EPSG:2154** (`x_l93`, `y_l93`), format attendu par
les SIG français.

Conversion implémentée dans `js/lambert93.js` d'après les constantes IGN
(projection conique conforme sécante, ellipsoïde GRS80). Contrôle :
Paris Notre-Dame `48.8566 ; 2.3522` → `X = 652 469 m ; Y = 6 862 035 m`.

---

## Structure

```
geoloc/
├── index.html
├── favicon.svg
├── serveur.py           # serveur local (contexte sécurisé pour le GPS)
├── css/style.css
├── js/
│   ├── config.js        # schéma : onglets, champs, couleurs, colonnes CSV
│   ├── catalogue.js     # catalogue matériel 3 niveaux + parametres.csv
│   ├── lambert93.js     # WGS84 → Lambert 93
│   ├── carte.js         # visualiseur de tuiles WMTS/XYZ, sans dépendance
│   ├── csv.js           # sérialisation / lecture RFC 4180
│   ├── store.js         # localStorage + IndexedDB + fichier lié
│   ├── geo.js           # API Geolocation
│   └── app.js           # construction de l'interface
├── docs/RGPD.md
└── memoire/             # suivi du projet entre sessions
```

## Ajouter du matériel

**Ça ne passe pas par le code.** Le catalogue s'édite depuis Configuration, ou en
masse dans `parametres.csv` au tableur.

Ajouter une *colonne* au CSV, en revanche, se fait dans `js/config.js` :
`COLONNES_TECHNIQUES` pour une donnée produite par l'application,
`CHAMPS_CASCADE` pour un niveau de saisie supplémentaire.

## Limites connues

- La carte d'ajustement exige du réseau ; aucune tuile n'est mise en cache pour
  l'instant (pas de mode hors-ligne cartographique).
- Pas de photo rattachée aux points.
- Pas de saisie hors-ligne installable (pas de service worker) — à ajouter si le
  besoin terrain le confirme.
- L'import fusionne sur l'identifiant `id` ; deux relevés du même ouvrage saisis sur
  deux appareils différents produisent deux lignes.
- Les trois fichiers sont indépendants : aucune vue consolidée des trois filières
  n'est produite. À faire dans le SIG ou le tableur si besoin.
- Le catalogue s'édite ligne à ligne : renommer un type partout se fait dans
  `parametres.csv` au tableur, pas dans l'interface.
- `observations` est un champ libre : rien n'y est contrôlé ni normalisé. Pour
  exploiter ces notes en masse, il faudra les lire une à une.
- Aucune commune n'est saisie : le rattachement administratif se fait dans le SIG,
  à partir des coordonnées.
- Aucun fond gratuit ne descend nativement sous ~50 m de large. Pour atteindre les
  dix mètres visés, la carte agrandit la tuile la plus fine disponible : le
  géoréférencement reste juste, l'image est interpolée. Le facteur d'agrandissement
  est affiché pour que personne ne prenne cette netteté apparente pour de la
  précision.
