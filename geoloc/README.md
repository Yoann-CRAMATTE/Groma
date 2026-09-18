# GéoLoc

Application web **vanilla** (aucune dépendance, aucun build) pour relever la position GPS
d'ouvrages de terrain et les consigner dans **un fichier CSV par filière**.

Trois filières de relevé — **EAU**, **ASSAINISSEMENT**, **SPANC** — plus un onglet
**CONFIGURATION**. Les trois filières partagent exactement le même écran ; seuls leurs
champs métier, leur couleur et leurs données diffèrent.

| Onglet | Couleur | Fichier | Références | Colonnes |
|---|---|---|---|---|
| EAU | `#0ea5e9` bleu | `eau.csv` | `AEP-0001` | 19 |
| ASSAINISSEMENT | `#22c55e` vert | `assainissement.csv` | `AC-0001` | 19 |
| SPANC | `#a855f7` violet | `spanc.csv` | `ANC-0001` | 21 |
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
id;filiere;date_saisie;operateur;latitude;longitude;altitude_m;precision_m;x_l93;y_l93;
reference;commune;<champs métier de la filière>;observations
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

- Pas de carte embarquée : les coordonnées ouvrent un lien OpenStreetMap externe.
- Pas de photo rattachée aux points (incompatible avec un CSV unique).
- Pas de saisie hors-ligne installable (pas de service worker) — à ajouter si le
  besoin terrain le confirme.
- L'import fusionne sur l'identifiant `id` ; deux relevés du même ouvrage saisis sur
  deux appareils différents produisent deux lignes.
- Les trois fichiers sont indépendants : aucune vue consolidée des trois filières
  n'est produite. À faire dans le SIG ou le tableur si besoin.
