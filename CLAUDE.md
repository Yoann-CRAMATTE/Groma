# CLAUDE.md

Consignes de développement pour Claude Code sur ce dépôt.

## Avant toute session

Lire **`memoire/etat-projet.md`** — c'est le système de contrôle du projet :
invariants à ne pas casser, décisions déjà prises et pourquoi, reste à faire.
Il évite de relire toute l'application à chaque fois.

`memoire/journal.md` porte l'historique séance par séance. À consulter quand une
décision surprend : la raison y est presque toujours écrite.

**Mettre les deux à jour en fin de session.** Une modification non consignée est une
modification perdue à la session suivante.

---

## Qu'est-ce que Groma ?

La *groma* est l'instrument des arpenteurs romains : une croix de visée plantée au
sol pour marquer un point précis. Le nom décrit l'interaction centrale de
l'application — un viseur fixe, une carte qui glisse dessous.

Application web de relevé GPS d'ouvrages de terrain, pour quiconque doit noter *où
se trouve quoi* et en ressortir des données propres. Trois filières livrées —
**EAU**, **ASSAINISSEMENT**, **SPANC** — un fichier GeoJSON par filière, plus un
catalogue de matériel dans son propre fichier.

Ces trois filières sont la configuration d'origine, pas une limite : le catalogue
s'édite depuis l'application. Ne jamais coder en dur une hypothèse qui vaudrait
seulement pour un réseau d'eau.

L'outil visé est la **tablette**, utilisée dehors, parfois avec des gants. Le relevé
type : on arrive sur l'ouvrage, la position se prend toute seule, on recale le viseur
sur le tampon visible en photo aérienne, on choisit le matériel dans trois listes
liées, on ajoute une phrase si l'ouvrage la mérite.

---

## Rôle de Claude

Co-développeur exigeant, pas exécutant. Analyser, anticiper, alerter.

- **Avant de coder** : analyser les risques, proposer, valider ensemble.
- **Un changement à la fois.** Jamais de modification en masse.
- **Dire quand c'est faux**, même si la demande vient de Yoann.
- **Ne jamais inventer** un comportement, une URL de service ou une constante
  géodésique. Si ce n'est pas vérifiable ici, le dire.

---

## Stack — et ce qu'on ne fait pas

| Couche | Techno |
|---|---|
| Tout | **HTML, CSS et JavaScript nus** |
| Stockage | `localStorage` + IndexedDB (handles de fichiers) |
| Fichiers | File System Access API, repli export manuel |
| Cartographie | Visualiseur de tuiles maison (`js/carte.js`) |
| Distribution | **PWA** — `manifest.webmanifest` + `service-worker.js`, publiée sur GitHub Pages |
| Serveur de développement | `serveur.py`, bibliothèque standard Python |
| Tests | Playwright — **hors application**, jamais chargé par la page |

**Aucune dépendance, aucune étape de build, aucun framework.** L'application doit
tourner dix ans sans chaîne d'outils à maintenir. Toute proposition d'ajouter une
bibliothèque au *runtime* se discute avant, pas pendant.

ES5 dans les fichiers de `js/` : `var`, `function`, pas de fléchées ni de `class`.
C'est la convention en place, la suivre plutôt que la panacher.

---

## Invariants

Ils sont détaillés dans `memoire/etat-projet.md`. Les quatre qui coûtent le plus cher
à casser :

1. **`localStorage` fait autorité.** Le fichier disque est une projection réécrite
   intégralement. Un échec d'écriture ne doit jamais perdre une saisie terrain.
   Corollaire : **toute mutation de relevés appelle `marquerModifie(filiereId)`**,
   toute sortie réussie `marquerSauvegarde(filiereId)`. C'est ce qui allume le
   bandeau d'alerte. Un ajout de mutation qui l'oublie rend le bandeau menteur —
   pire que pas de bandeau du tout.
2. **Ne jamais annoncer une précision meilleure que celle du récepteur.**
   `precision_m` = meilleure `accuracy` observée, jamais une valeur calculée. La
   dispersion est mesurée et stockée à part. Un recalage manuel ne touche pas
   `precision_m` : il alimente `ecart_ajustement_m`.
3. **La saisie se limite à la cascade et à la note.** Trois listes liées plus
   `observations`. Toute autre donnée est produite par l'application. Le formulaire
   ne se regarnit pas champ par champ.
4. **Le catalogue ne vit pas dans le code.** Ajouter du matériel se fait depuis
   Configuration ou dans `parametres.csv`, jamais dans `config.js`.
5. **Tout fichier ajouté à `index.html` s'inscrit dans `COQUILLE`**
   (`service-worker.js`). L'oublier ne casse rien en ligne et casse tout hors
   ligne — chez l'agent, en tournée, sans message d'erreur. `tests/audit-pwa.mjs`
   monte la garde, encore faut-il le lancer.
6. **Le dépôt est public : aucun workflow ne se déclenche sur `pull_request`.**
   `pages.yml` ne tourne que sur un `push` vers `main` ou un déclenchement
   manuel. Ajouter un déclencheur `pull_request`, et pire `pull_request_target`,
   ferait exécuter du code venu de n'importe quel inconnu avec les droits du
   dépôt. C'est la seule façon dont un tiers pourrait écrire ici.

---

## Vérifier avant de pousser

Le GPS exige un contexte sécurisé : `file://` est refusé sans message clair.

```bash
python3 serveur.py 8123 &
node tests/audit-responsive.mjs
node tests/audit-pwa.mjs
```

`audit-responsive` parcourt les quatre onglets sur quinze formats — de 280 px au
1180×820 — et signale débordement, texte tronqué, cible tactile sous 36 px et
erreur JavaScript.

`audit-pwa` contrôle le manifeste, les icônes, le service worker, la cohérence
entre `index.html` et `COQUILLE`, et **démarre l'application réseau coupé**.

**Sortie non nulle en cas de défaut** pour les deux.

Il ne contrôle que l'affichage. Une modification de comportement se vérifie en plus
par un script Playwright dédié, écrit pour l'occasion et jeté après : ce qui compte,
c'est d'avoir vu l'application faire réellement ce qu'on annonce.

Cible principale : **tablette, 768 → 1180 px.** Plancher de support : **280 px.**
Toute modification d'interface se vérifie aux deux bouts.

---

## Conventions

- Indentation : 2 espaces (JS, HTML, CSS), 4 espaces (Python)
- Fichiers : `kebab-case` — variables : `snake_case` (Python), `camelCase` (JS)
- **Code et interface en français**, y compris les identifiants
- Pas de `console.log` ni de `print()` dans le code livré
- **Commenter le pourquoi, jamais le quoi.** Un commentaire qui paraphrase la ligne
  en dessous est du bruit ; un commentaire qui explique une contrainte cachée, un
  piège déjà rencontré ou un arbitrage, c'est ce qui rend le code relisable.

---

## Données personnelles

L'onglet SPANC relève des installations chez des particuliers. Aucun nom ni adresse
n'est saisi, mais **une position à quelques mètres désigne un foyer** : c'est une
donnée à caractère personnel au sens du RGPD.

Le champ `observations` est le point sensible — rien n'empêche d'y écrire un nom ou
une habitude de vie, et l'application ne peut pas le contrôler. Toute évolution qui
touche à ce champ, à l'export ou au partage se pense avec `docs/RGPD.md` ouvert.
