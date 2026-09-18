# GéoLoc

Application web **vanilla** (aucune dépendance, aucun build) pour relever la position GPS
d'ouvrages de terrain et les consigner dans **un fichier CSV par filière**.

Trois filières de relevé — **EAU**, **ASSAINISSEMENT**, **SPANC** — plus un onglet
**CONFIGURATION**. Les trois filières partagent exactement le même écran ; seuls leurs
champs métier, leur couleur et leurs données diffèrent.

| Onglet | Couleur | Fichier | Références | Colonnes |
|---|---|---|---|---|
| EAU | `#0ea5e9` bleu | `eau.csv` | `AEP-0001` | 25 |
| ASSAINISSEMENT | `#22c55e` vert | `assainissement.csv` | `AC-0001` | 25 |
| SPANC | `#a855f7` violet | `spanc.csv` | `ANC-0001` | 27 |
| CONFIGURATION | `#94a3b8` gris | — | — | — |

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

**Un fichier par onglet**, lié et exporté indépendamment depuis Configuration.
Chaque CSV ne porte que les colonnes de sa filière — aucune colonne vide héritée
des autres. La colonne `filiere` est conservée : elle sert de garde-fou à l'import.

Format : **UTF-8 avec BOM**, séparateur `;` par défaut (configurable `;` / `,` / tabulation),
fins de ligne CRLF, échappement RFC 4180. Ouvrable directement dans Excel français.

### Colonnes communes aux trois fichiers

```
id;filiere;date_saisie;operateur;
latitude;longitude;altitude_m;
precision_m;dispersion_m;methode_gps;nb_mesures;duree_gps_s;
position_ajustee;ecart_ajustement_m;
x_l93;y_l93;reference;commune;<champs métier de la filière>;observations
```

| Fichier | Champs métier |
|---|---|
| `eau.csv` | `type_ouvrage;diametre_mm;materiau;annee_pose;etat;accessibilite` |
| `assainissement.csv` | `type_ouvrage;reseau;diametre_mm;materiau;profondeur_m;etat` |
| `spanc.csv` | `type_installation;adresse;proprietaire;parcelle;nb_eh;conformite;date_controle;exutoire` |

### Deux modes d'écriture

| Mode | Navigateurs | Comportement |
|---|---|---|
| **Fichier lié** (File System Access API) | Chrome, Edge (bureau et Android) | Configuration → carte de la filière → *Créer / remplacer* ou *Lier un existant*. Le CSV de cette filière est réécrit intégralement à chaque enregistrement, suppression ou import. Les trois liaisons sont indépendantes. |
| **Export manuel** | Firefox, Safari, iOS | *Exporter* par filière, ou *Exporter les 3*. |

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

---

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

- Fonds fournis : **photo aérienne** et **plan IGN** (Géoplateforme), plus
  **OpenStreetMap** en secours — voir la section suivante.
- La position mesurée reste affichée en bleu, entourée de son rayon de précision.
- L'écart au GPS s'affiche en direct et passe en orange dès qu'il dépasse ce rayon.
- **Revenir au GPS** annule le recalage.

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

## Affichage — petits smartphones

Contrainte de conception : l'application doit rester utilisable sur les plus petits
écrans du parc. Elle est vérifiée à **280, 320, 360, 390, 412, 430, 480 et 540 px**
de large, ainsi qu'en **orientation paysage** (568×320 et 653×280).

| Palier | Adaptation |
|---|---|
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

Le script parcourt les quatre onglets à chaque largeur et signale débordement, texte
tronqué, cible tactile trop petite et erreur JavaScript. Sortie non nulle en cas de
défaut. **Playwright n'est pas une dépendance de l'application** : il ne sert qu'à ce
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
│   ├── lambert93.js     # WGS84 → Lambert 93
│   ├── carte.js         # visualiseur de tuiles WMTS/XYZ, sans dépendance
│   ├── csv.js           # sérialisation / lecture RFC 4180
│   ├── store.js         # localStorage + IndexedDB + fichier lié
│   ├── geo.js           # API Geolocation
│   └── app.js           # construction de l'interface
├── docs/RGPD.md
└── memoire/             # suivi du projet entre sessions
```

## Ajouter un champ

Tout passe par `js/config.js` : ajouter une entrée dans `champs` de la filière
concernée. Formulaire, colonne CSV, filtre et affichage suivent automatiquement.
Aucun HTML à modifier.

## Limites connues

- La carte d'ajustement exige du réseau ; aucune tuile n'est mise en cache pour
  l'instant (pas de mode hors-ligne cartographique).
- Pas de photo rattachée aux points (incompatible avec un CSV unique).
- Pas de saisie hors-ligne installable (pas de service worker) — à ajouter si le
  besoin terrain le confirme.
- L'import fusionne sur l'identifiant `id` ; deux relevés du même ouvrage saisis sur
  deux appareils différents produisent deux lignes.
- Les trois fichiers sont indépendants : aucune vue consolidée des trois filières
  n'est produite. À faire dans le SIG ou le tableur si besoin.
