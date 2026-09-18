# GéoLoc

Application web **vanilla** (aucune dépendance, aucun build) pour relever la position GPS
d'ouvrages de terrain et les consigner dans **un fichier CSV unique**.

Trois filières de relevé — **EAU**, **ASSAINISSEMENT**, **SPANC** — plus un onglet
**CONFIGURATION**. Les trois filières partagent exactement le même écran ; seuls leurs
champs métier, leur couleur et leurs données diffèrent.

| Onglet | Couleur | Préfixe des références |
|---|---|---|
| EAU | `#0ea5e9` bleu | `AEP-0001` |
| ASSAINISSEMENT | `#22c55e` vert | `AC-0001` |
| SPANC | `#a855f7` violet | `ANC-0001` |
| CONFIGURATION | `#94a3b8` gris | — |

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

## Fichier CSV unique

Un seul fichier contient les trois filières. Chaque ligne porte une colonne `filiere`
et ne remplit que les colonnes de sa filière ; les autres restent vides.

Format : **UTF-8 avec BOM**, séparateur `;` par défaut (configurable `;` / `,` / tabulation),
fins de ligne CRLF, échappement RFC 4180. Ouvrable directement dans Excel français.

### Colonnes (28)

```
id;filiere;date_saisie;operateur;latitude;longitude;altitude_m;precision_m;x_l93;y_l93;
reference;commune;type_ouvrage;diametre_mm;materiau;annee_pose;etat;accessibilite;
reseau;profondeur_m;type_installation;adresse;proprietaire;parcelle;nb_eh;conformite;
date_controle;exutoire;observations
```

### Deux modes d'écriture

| Mode | Navigateurs | Comportement |
|---|---|---|
| **Fichier lié** (File System Access API) | Chrome, Edge (bureau et Android) | Configuration → *Créer / remplacer* ou *Lier un fichier existant*. Le CSV est réécrit intégralement à chaque enregistrement, suppression ou import. |
| **Export manuel** | Firefox, Safari, iOS | Configuration → *Exporter le CSV* télécharge le fichier complet. |

Dans les deux cas, `localStorage` fait autorité : aucune saisie n'est perdue si
l'écriture disque échoue. Le fichier lié survit au rechargement (handle conservé en
IndexedDB) ; le navigateur peut redemander l'autorisation d'écriture.

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
