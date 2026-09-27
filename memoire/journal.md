# GéoLoc — journal des sessions

Une entrée par session de travail, la plus récente en haut.

---

## 27/09/2026 — Les relevés ne se perdent plus en silence

**Demande :** corriger le point laissé ouvert à la session précédente — les relevés
vivent dans `localStorage`, désinstaller la PWA ou effacer les données du site les
supprime, et rien ne le signalait dans l'interface.

**Fait :**
- Bandeau en haut de l'onglet dès qu'une filière contient des relevés sortis nulle
  part : le compte, ce qu'on risque, et un bouton d'export sur place.
- `Store.lireSauvegardes` / `ecrireSauvegardes` — nouvelle clé `geoloc.sauvegardes`.
- `marquerModifie` / `marquerSauvegarde` branchés sur enregistrement, suppression,
  import, purge, écriture d'un fichier lié et export manuel.
- `Store.demanderPersistance()` — demande au navigateur de ne pas évincer le
  stockage sous la pression du disque.

**Deux états par filière, pas un compteur.** Un modèle « N relevés en attente »
paraît plus informatif et se trompe dès qu'on modifie ou supprime un relevé déjà
exporté : le CSV sur le disque devient périmé alors que le compteur n'a pas bougé.
Un horodatage présent ou absent — tout est sorti, ou il reste quelque chose — est
toujours juste. Le compte affiché est celui de la filière entière, pas d'un delta.

**La persistance est demandée après le premier enregistrement, pas au démarrage.**
Chrome l'accorde en silence à une application installée, Firefox pose la question.
Poser cette question sur une page encore vide n'a aucun sens ; une fois qu'il y a
un relevé à protéger, elle se comprend.

**L'export manuel est marqué optimiste, et c'est assumé.** Rien ne permet de savoir
si un téléchargement a abouti ou si l'agent l'a annulé. L'alternative — ne lever
l'alerte que sur un fichier lié — laisserait un bandeau permanent sous Firefox et
Safari, où l'export manuel est la seule voie. Un avertissement permanent n'avertit
plus : il devient décor. Écrit en commentaire à l'endroit du choix.

**Un vrai bug trouvé par le test.** `marquerModifie` sortait avant de rafraîchir le
bandeau quand la filière n'avait jamais été sauvegardée — c'est-à-dire exactement
au premier relevé, le cas qui compte le plus. Le garde-fou ne se serait allumé
qu'au deuxième export. Corrigé : l'écriture reste conditionnelle, le rafraîchissement
ne l'est plus.

**Vérifié :** script dédié en neuf temps — onglet vierge, accord singulier/pluriel,
compte juste, disparition à l'export, survie au rechargement, retour après ajout
*et* après suppression, indépendance des trois filières, silence après purge. Plus
les trois suites permanentes, dont l'audit responsive qui inspecte le bandeau aux
quinze formats puisqu'un relevé y est enregistré avant le parcours.

---

## 27/09/2026 — PWA installable et dépôt unique publié

**Demande :** un seul et unique dépôt, ouvert, d'où l'application s'exécute —
accessible à tout le monde, en PWA.

**Fait :**
- `manifest.webmanifest` — plein écran, couleurs de l'application, aucune
  orientation imposée (le paysage a été travaillé, le verrouiller le gâcherait).
- `service-worker.js` — coquille en cache, démarrage sans réseau.
- `icons/` — 192, 512, maskable et apple-touch, dérivées de `favicon.svg` par
  Playwright. Pas d'outil graphique ajouté au projet, pas de binaire venu
  d'ailleurs : l'icône reste la même source.
- `.github/workflows/pages.yml` — publication à chaque passage sur `main`, avec
  `enablement: true` pour activer Pages au premier tour sans passer par les
  réglages.
- `tests/audit-pwa.mjs` — nouveau contrôle permanent.
- Branche fusionnée dans `main` : le dépôt n'a plus qu'une seule vérité.

**Cache d'abord, revalidation en arrière-plan — et pas l'inverse.** Un
« cache d'abord » pur oblige à incrémenter `VERSION` à chaque livraison. L'oublier
une seule fois fige l'application sur le téléphone de l'agent, définitivement, sans
que rien ne le signale depuis le bureau. Avec la revalidation, une version oubliée
coûte un chargement de retard au lieu d'un blocage. Le prix assumé : une mise à
jour atteint le terrain au **deuxième lancement** après publication.

**`skipWaiting` + `clients.claim`.** Sans eux, une nouvelle version attend la
fermeture de tous les onglets — en PWA installée, l'application peut rester ouverte
des jours et un correctif n'arriverait jamais. Le risque de décalage en cours de
session est nul ici : tout le JavaScript est chargé au démarrage, rien n'est
récupéré à la demande.

**Les tuiles ne sont pas mises en cache, et c'est délibéré.** Le service worker
n'intercepte que le même domaine. Les conditions d'usage de l'IGN et d'OSM
proscrivent la constitution de réserves locales. Conséquence à assumer : hors
couverture, on relève au GPS sans recaler à l'œil sur la photo aérienne. La fenêtre
le dit, elle ne le subit pas.

**`start_url` et `scope` relatifs.** Sur Pages l'application vit sous `/<dépôt>/`.
Un `/` absolu l'aurait sortie de sa portée et aurait fait échouer l'installation
sans message clair. Le test le vérifie, parce que c'est le genre d'erreur qu'on ne
voit pas en développement à la racine.

**Le garde-fou a été mis à l'épreuve.** Un `js/oublie.js` ajouté à `index.html`
sans être inscrit dans `COQUILLE` fait bien tomber `audit-pwa.mjs`. Un test qu'on
n'a jamais vu échouer ne prouve rien.

**Vérifié :** les trois suites passent — audit responsive quinze formats, test
fonctionnel de la fenêtre de mesure, audit PWA dont le démarrage réseau coupé.

**`enablement: true` ne marche pas, essayé et retiré.** L'idée était d'activer Pages
depuis le workflow pour éviter un aller-retour dans les réglages. Le premier
déploiement a échoué sur `Create Pages site failed — Resource not accessible by
integration` : le jeton du workflow n'a pas le droit de créer le site. L'option a
été retirée plutôt que laissée en fausse promesse.

**Reste à la main de Yoann**, rien de tout cela n'étant accessible depuis Claude
Code (le serveur GitHub disponible n'expose pas les réglages de dépôt) :
1. Renommer le dépôt en `GeoLoc` — pas d'accent possible.
2. **Le rendre public.** Il est privé, et Pages n'existe pas pour un dépôt privé
   sur un compte gratuit : c'est le vrai blocage du déploiement.
3. Settings → Pages → Source : **GitHub Actions**.
4. La description du dépôt est encore celle de Synapse (« Nouveau système
   d'exploitation où l'AI est le système d'exploitation »).

**Point laissé ouvert :** les relevés vivent dans `localStorage`. Désinstaller la
PWA ou effacer les données du site les supprime, et **rien ne l'annonce dans
l'interface** — c'est écrit dans le README, ce qui ne protège personne. Inscrit au
reste à faire.

---

## 24/09/2026 — Le dépôt devient GéoLoc — **incrément 0**

**Demande :** renommer le dépôt GitHub avec le nom de l'application, pour le dépôt
complet. L'ancien projet qui s'y trouvait est caduc et doit être supprimé. Cette
incrémentation devient l'incrémentation 0.

**Fait :**
- **Synapse supprimé** : `ARCHITECTURE.md`, `DECISIONS.md`, `spike.py`,
  `synapse-desktop.html`, `requirements.txt` et les dix fichiers de `modules/`
  (`ia_core/`, `apps/paint/`). Récupérables dans l'historique au commit `b45f653`
  si le projet reprend un jour.
- **GéoLoc remonté à la racine** : plus de sous-dossier `geoloc/`. Git a suivi les
  déplacements comme des renommages, l'historique de chaque fichier est intact.
- **`CLAUDE.md` réécrit** de bout en bout. L'ancien décrivait Synapse — Rust,
  navigation par orbes, protocole de manifestes — et pilotait pourtant chaque
  session sur ce dépôt. C'était la dette la plus coûteuse des trois.
- **`README.md` remis d'aplomb** : il décrivait encore les boutons « Relevé
  rapide », « Précision maximale » et « Centrer sur le point », supprimés à la
  session précédente, et une fenêtre de carte séparée qui n'existe plus.
- Chemins corrigés partout (`python3 serveur.py`, `node tests/audit-responsive.mjs`).

**Pourquoi la racine et pas le sous-dossier.** Un dépôt nommé GeoLoc avec tout dans
`geoloc/` est redondant, et surtout GitHub Pages sert depuis la racine ou depuis
`docs/` : garder le sous-dossier aurait imposé un contorsionnement au moment du
déploiement HTTPS, qui est justement la prochaine étape utile.

**La numérotation v0.1 → v0.9 est abandonnée.** L'état d'aujourd'hui est le socle,
l'incrément 0 ; les suivants se comptent à partir de 1. Les entrées ci-dessous sont
conservées telles quelles : elles portent le *pourquoi* des invariants encore en
vigueur, et une décision qu'on ne sait plus justifier est une décision qu'on
recassera.

**Le renommage GitHub lui-même reste à faire par Yoann** : le serveur GitHub
disponible ici n'expose aucun outil de modification des réglages d'un dépôt, et la
CLI `gh` n'est pas accessible. Settings → General → Repository name. À noter : pas
d'accent possible, ce sera `GeoLoc` ou `geoloc`.

---

# Historique — avant le socle

> Numérotation v0.1 → v0.9, abandonnée le 24/09/2026. Conservée parce qu'elle
> explique les invariants.

## 19/09/2026 — Fenêtre de mesure carte-first (v0.9)

**Demande :** à l'ouverture de la fenêtre de mesure, la géolocalisation se fait tout
de suite et la carte s'affiche, viseur directement sur la position. Instructions et
champs à remplir en dessous, en vertical pour le mobile. Si le positionnement n'est
pas assez juste, on bouge la petite carte pour recentrer. Carte au zoom maximal.
Infos de position (latitude, longitude, altitude, précision) sous la carte, puis
l'observation et le bouton d'envoi. **Plus de boutons « Relevé rapide », « Précision
maximale », « Centrer sur le point »** : la carte elle-même est l'outil de
positionnement.

**Fait :**
- `contenuMesure()` réordonné : carte + viseur, barre de carte, coordonnées et écart,
  état GPS, tableau de position, cascade, observation, boutons.
- Les trois boutons d'acquisition disparaissent. `lancerLocalisation()` et
  `basculerAffinage()` sont remplacés par `demarrerAcquisition()`, appelé par
  `afficherMesure()` : la série part seule à l'ouverture.
- La modale carte séparée (`#modale-carte`) est supprimée d'`index.html`, avec
  `ouvrirCarte` / `fermerCarte` / `validerCarte`. La carte vit dans la fenêtre de
  mesure, une instance à la fois.
- `geo.js` : `surProgres` expose désormais l'agrégat courant (`position`). C'est ce
  qui permet de poser le viseur dès le premier fixe et de le laisser se resserrer
  pendant que la série continue, au lieu d'attendre trente secondes.
- `positionRetenue()` : ce qui est enregistré est le centre de la carte. Au-delà de
  50 cm d'écart avec la mesure, `position_ajustee = oui` et l'écart est tracé.

**Deux drapeaux, pas un.** `adopte` (la série remplace la mesure de référence) et
`recentre` (la carte suit la mesure) sont distincts. Un geste sur la carte coupe
`recentre` seul : le GPS continue d'affiner la précision pendant que le viseur reste
où l'agent l'a posé. Les confondre aurait obligé à choisir entre « recaler à la main »
et « laisser le GPS s'améliorer ».

**En modification, le GPS n'écrase rien.** `afficherMesure(..., { adopte: false })` :
la série tourne pour être disponible, mais la position enregistrée reste en place.
Le bouton GPS de la carte l'adopte si l'agent le décide.

**Deux défauts trouvés au test, corrigés :**
- *La carte n'ouvrait pas au zoom maximal.* Le plafond dépend de la latitude du
  centre, et `centrer()` fixe le centre **avant** de borner le zoom demandé : un
  `zoomMax()` calculé d'avance valait pour la latitude précédente. D'où
  `ZOOM_MAXIMAL = 99`, réclamé et borné par la carte elle-même. Sans position
  connue à l'ouverture, le zoom se pose au premier fixe (`zoomPose`).
- *Un échec GPS laissait l'agent sans issue.* Les boutons d'acquisition ayant
  disparu, rien ne permettait de relancer. Le bouton GPS de la carte devient la
  reprise quand aucune mesure n'existe, et le message d'échec y renvoie.

**Le bouton porte « ⌖ GPS », pas « ⌖ » seul.** Le glyphe U+2316 manque à certaines
polices Android, et le message d'échec renvoie à ce bouton : un carré vide aurait
rendu la consigne incompréhensible.

**Vérifié :** audit responsive sur les quinze formats, aucun défaut, aucune erreur JS.
Test fonctionnel dédié : acquisition sans clic, recalage au doigt, retour au GPS,
écriture de la position recalée avec son écart, conservation de la position en
modification, et comportement complet quand le GPS ne répond pas.

**Laissé de côté :** au zoom maximal (5 cm/px), le disque de précision de 6 m couvre
tout le cadre et teinte l'orthophoto qu'on cherche justement à lire pour recaler.
L'information est juste — elle dit que le GPS ne sait pas mieux — mais elle gêne le
geste. Noté dans le reste à faire plutôt que tranché seul.

---

## 19/09/2026 — Écran allégé, saisie en fenêtre, favoris (v0.8)

**Demande :** sur l'onglet EAU — un bouton « Créer une mesure », la liste en dessous,
une barre de recherche, et une étoile sur une mesure déjà faite pour mettre **les
éléments qui la composent** en favori. Le bouton ouvre la fenêtre où l'on prend la
mesure, où l'on centre sur le point si besoin, et où l'on dit à quoi elle correspond.
Consigne de travail posée avant : on parle d'un onglet, les autres suivent.

**Fait :**
- L'écran d'un onglet ne porte plus que **bouton, recherche, liste**. `blocReleve()`
  devient `contenuMesure()` et part dans `modaleMesure()`, une fenêtre par filière.
- `ouvrirMesure` / `afficherMesure` / `fermerMesure` ; « Modifier » et « Dupliquer »
  ouvrent la même fenêtre au lieu de faire défiler la page.
- Étoile par ligne, favoris dans `localStorage` (`geoloc.favoris`), raccourcis en
  haut de la fenêtre — un appui repose les trois listes.
- Les trois onglets suivent sans recopie : le test fonctionnel le vérifie
  explicitement pour ASSAINISSEMENT et SPANC.

**L'étoile porte sur la combinaison, pas sur le relevé.** C'est la lecture littérale
de la demande — « les éléments qui composent cette mesure ». Conséquence visible :
deux relevés « Compteur › DN 20 › Volumétrique » s'allument ensemble. C'est cohérent
(l'étoile est une vue de l'ensemble des favoris) mais ça se voit, donc c'est dit.

**Deux gardes posées volontairement :**
- Le clic sur le fond de la fenêtre ne ferme rien, et la croix demande confirmation
  dès qu'une position est prise ou un champ rempli. Perdre une position affinée
  trente secondes par un geste de trop serait la faute la plus coûteuse de l'outil.
- `body[data-modale] { overflow: hidden }` : sans ça, le doigt fait défiler la liste
  derrière au lieu d'agir dans la fenêtre.

**Deux défauts trouvés par les tests, pas à la lecture :**
- *z-index inopérant.* `.modale-mesure { z-index: 50 }` était écrasé par
  `.modale { z-index: 60 }`, écrit plus bas dans la feuille à spécificité égale. Ça
  ne se voyait pas — l'ordre du DOM plaçait quand même la carte au-dessus. Corrigé en
  `.modale.modale-mesure`, qui ne dépend plus de l'ordre.
- *Titre escamoté sur téléphone.* Donner le focus au bouton GPS à l'ouverture faisait
  défiler la fenêtre pour l'amener en vue, poussant titre et croix hors écran. Le
  focus va maintenant sur la fenêtre elle-même (`tabindex="-1"`).

Note de méthode : mon propre harnais de test avait un bug symétrique — il jugeait la
visibilité sur `offsetParent`, qui est toujours `null` pour un `position: fixed`.
Quatre « échecs » venaient de là, pas de l'application.

**Vérifié :** audit d'affichage sur quinze formats (fenêtre de mesure et carte
par-dessus comprises), aucun défaut ; test fonctionnel de bout en bout — ouverture,
GPS, carte superposée, enregistrement, étoile, raccourci, abandon confirmé, modifier,
dupliquer, et la même disposition sur les trois onglets.

---

## 19/09/2026 — Retour de la note de terrain (v0.7.1)

**Demande :** « remets les observations, il en faut une sur le terrain. »

Retour immédiat sur la suppression du matin. C'était le cas prévu dans la mémoire du
projet — « si le besoin d'observation revient du terrain, c'est un quatrième niveau de
cascade ou un retour du textarea, à trancher ». Le terrain a tranché.

**Pourquoi c'est justifié et pas un aller-retour pour rien :** le catalogue décrit ce
qu'*est* un ouvrage. Il ne dira jamais que le tampon est scellé, que l'accès passe par
la cour du 12, ou que la vanne est bloquée. Aucune nomenclature ne prévoit ça, et un
quatrième niveau de cascade ne l'aurait pas capturé non plus — ces constats sont par
nature non énumérables. Le champ libre est la bonne forme.

**Fait :**
- `CHAMP_OBSERVATIONS` remis dans `config.js`, avec un placeholder qui oriente vers
  le constat plutôt que vers la description (« Accès, état, repère… »).
- Vingt-et-unième colonne dans les trois CSV.
- `textarea` de deux lignes sous la cascade, redimensionnable. Deux lignes et pas
  trois : plus haut, la note repousse la liste des relevés hors de l'écran, et c'est
  la liste qu'on consulte le plus.
- `ecrireFormulaire()` revient pour poser la cascade puis les champs simples.
- La note reparaît dans la liste, entre guillemets, et **la recherche porte dessus**.
- **« Dupliquer » ne la recopie pas** : elle vaut pour un ouvrage précis. La reprendre
  en série fabriquerait des constats faux sur des points jamais observés.

**Point RGPD rouvert, et c'est le vrai coût de ce champ.** L'onglet SPANC ne saisit ni
nom ni adresse depuis la v0.7. Mais rien n'empêche un agent d'écrire « M. Dupont refuse
le contrôle » ou « absent, revenir après 18 h » dans `observations` — soit un nom et
une habitude de vie dans un fichier qui n'en prévoit pas, sans que rien ne le signale.
L'application ne peut pas l'empêcher sans devenir inutilisable. C'est une consigne à
donner aux agents, ajoutée dans `docs/RGPD.md` et signalée dans l'avertissement de
l'interface. À porter dans la procédure de contrôle, pas dans le code.

**Vérifié :** audit d'affichage sur quinze formats, aucun défaut ; test fonctionnel
étendu — la note se saisit, se vide à l'enregistrement, s'affiche dans la liste, se
retrouve par la recherche et revient intacte à la relecture d'un relevé.

---

## 19/09/2026 — Suppression du formulaire métier (v0.7)

**Demande :** capture d'écran du bloc de champs sous la cascade — « supprime cette
partie ». Après clarification sur la portée : tout, de *Référence* à *Observations*.

**Fait :** le relevé se réduit au bouton GPS et aux trois listes liées.

- `config.js` vidé de `CHAMPS_COMMUNS`, `CHAMP_OBSERVATIONS`, `ETATS` et des tableaux
  `champs` des trois filières. Une filière n'est plus qu'une identité : libellé,
  couleur, préfixe, fichier.
- `reference` passe dans `COLONNES_TECHNIQUES` — elle reste générée automatiquement,
  elle n'est simplement plus saisissable.
- Les trois CSV tombent de 27 / 27 / 29 à **20 colonnes**, désormais identiques.
- Retiré dans la foulée, parce que plus rien ne les alimentait : le champ
  « Communes proposées » de la configuration, la `datalist` associée,
  `remplirCommunes()`, `toutesColonnes()` et `resumePoint()`.
- `construireChamp()` ne traitait plus qu'un seul type : devenu
  `construireChampCascade()`, sans les branches select / textarea / number mortes.

**Effet de bord traité :** la note RGPD de l'onglet SPANC décrivait « un nom de
propriétaire, une adresse et une parcelle » — plus rien de tout cela n'est saisi.
Ce n'est pas pour autant sorti du RGPD : une position à quelques mètres sur une
installation ANC désigne un foyer aussi sûrement qu'une adresse. `docs/RGPD.md` et
l'avertissement de l'interface disent maintenant cela, et pointent le risque de
recoupement cadastral.

**Détail d'interface :** au repos, Modèle et Détail affichaient « (aucun) », ce qui
se lit « il n'existe pas de modèle » au lieu de « choisis d'abord un type ». Uniformisé
sur « — » : le champ désactivé et le niveau parent vide suffisent à dire l'attente.

**Ce que ça coûte, écrit noir sur blanc :** plus de champ libre pour noter ce qui ne
rentre dans aucune case, plus de commune saisie (à retrouver au SIG depuis les
coordonnées). Décision assumée — à rouvrir si le terrain la conteste.

**Vérifié :** audit d'affichage sur quinze formats, aucun défaut ; test fonctionnel
complet — le formulaire ne contient plus que trois champs, la cascade filtre, un
relevé s'enregistre, se retrouve par la recherche et se relit sans perte.

---

## 18/09/2026 — Refonte tablette et catalogue de matériel (v0.6)

**Demande :** interface pensée pour la tablette — dans chaque onglet, la relève en
cours puis les relèves déjà faites en dessous, une barre de recherche en haut. Le
matériel choisi dans des listes déroulantes en cascade : choisir « compteur » au
premier niveau ne doit laisser voir que les compteurs et leurs diamètres au second.
La configuration de ces listes dans un fichier CSV à part. Photo mise de côté.

**Fait :**

- **Disposition refondue** dans les trois onglets : barre de recherche collante en
  haut, bloc « nouveau relevé » (position d'abord, matériel ensuite), puis les
  relevés effectués du plus récent au plus ancien. Palier 768 px ajouté — cascade
  sur trois colonnes, boutons GPS sur un rang, cibles à 48 px.
- **Cascade à trois niveaux** `type_materiel` → `modele` → `detail`, en remplacement
  de la colonne unique `type_ouvrage` / `type_installation`.
- **`js/catalogue.js`** : nouveau module. Graine de 316 lignes couvrant les trois
  filières, requêtes de cascade, aller-retour `parametres.csv`.
- **`parametres.csv`** : quatrième fichier, `filiere;type_materiel;modele;detail`.
  Lié, exporté et importé comme les autres, avec son propre handle.
- **Éditeur de catalogue** dans Configuration : un dépliant par filière, ajout en
  trois cases avec complétion du type, suppression à la croix.
- **Modale carte simplifiée** : le tableau de trois définitions devient une ligne.

**Deux pièges rencontrés :**

- *La cascade ne se réinitialisait plus.* En voulant préserver une valeur absente du
  catalogue — cas d'un relevé relu après refonte du catalogue — `remplirSelect()` la
  réinjectait systématiquement. Conséquence : changer le type de matériel laissait en
  place un détail devenu impossible. La fonction distingue désormais deux régimes
  selon que la valeur est **imposée** (relecture d'un relevé) ou **courante**
  (cascade interactive). C'est l'audit qui l'a attrapé, pas la relecture du code.
- *Dix mètres de côté n'existent pas dans les fonds gratuits.* La photo IGN plafonne
  à z20, soit une cinquantaine de mètres de large sur une tablette. La demande
  supposait donc de sur-zoomer : la tuile la plus fine est réclamée puis agrandie
  (jusqu'à ×8). Le géoréférencement reste exact, l'image est interpolée — et le
  facteur est **affiché à côté de l'échelle**, parce qu'une image lissée se lit
  autrement comme une mesure précise.

**Vérifié :** audit d'affichage sur quinze formats (cinq tablettes, huit téléphones,
deux paysages courts) — aucun défaut ; l'audit contrôle aussi que le niveau 2 dépend
du niveau 1 et que le niveau 3 tombe quand le niveau 1 change. Test fonctionnel
séparé : cascade, enregistrement, recherche, relecture d'un relevé, ajout au
catalogue répercuté dans les listes, en-tête de `parametres.csv`, plafond de zoom.

**Réserve :** les 316 lignes livrées sont plausibles mais **non validées métier**.
C'est une amorce à corriger avec les services, pas une nomenclature de référence.

**Mis de côté :** le travail sur la photo, commencé à la session précédente, est dans
le stash `WIP photo (mis de cote - redesign tablet)`.

---

## 18/09/2026 — Revue visuelle (v0.5.1)

Captures de l'application complète avec un jeu de données réaliste. Deux défauts
visibles seulement à l'usage, corrigés :

- Après un relevé, le bouton « Relevé rapide » se renommait « Localiser » :
  `lancerLocalisation()` restaurait l'ancien libellé, resté en dur depuis la version
  à un seul bouton. Les deux libellés sont désormais des constantes.
- Le bloc Position gardait un espace mort en l'absence de message : la ligne d'état
  réserve sa hauteur. `:empty` la neutralise.

Point signalé sans correction possible : `input type="date"` affiche son format
selon la langue du navigateur, pas selon `lang="fr"` de la page. La valeur stockée
reste au format ISO, le CSV n'est donc pas affecté.

---

## 18/09/2026 — Fonds de carte gratuits et remplaçables (v0.5)

**Demande :** n'utiliser systématiquement qu'un plan ou une vue aérienne gratuits.

**Constat :** c'était déjà le cas (Géoplateforme IGN, sans clé), mais **rien dans
l'application ne le garantissait dans le temps**. Si le service change de conditions
ou tombe, il faut modifier `carte.js` sur chaque poste.

**Fait :**
- Troisième fond gratuit ajouté, **OpenStreetMap**, en secours de la Géoplateforme.
- **Attribution affichée en permanence** en bas de la carte. C'est une obligation de
  licence, elle ne peut pas rester dans une note sous la barre d'outils. La mention
  redondante qui s'y trouvait a été supprimée.
- **Éditeur de fonds dans Configuration** : libellé, URL de tuile, zoom maximal,
  attribution. Fonctionne avec tout service XYZ ou WMTS. Bouton de rétablissement
  des fonds gratuits par défaut.
- **Quatre contrôles avant enregistrement** : HTTPS obligatoire, repères `{z}`,
  `{x}`, `{y}` présents, zoom entre 1 et 22, et **attribution non vide** — un fond
  sans attribution est refusé.
- Champ URL en zone multiligne monospace : une URL WMTS dépasse deux cents
  caractères, illisible dans un champ d'une ligne sur téléphone.

**Défauts corrigés au passage :**
- Les libellés de l'éditeur n'avaient pas d'attribut `for` : aucun lien entre libellé
  et champ pour un lecteur d'écran. Chaque champ porte désormais un identifiant.
- L'audit comptait comme « texte tronqué » le contenu défilant d'un champ de saisie.
  Un `input` fait défiler sa valeur par conception ; seul un libellé coupé est un
  défaut. Règle corrigée.

**Vérifications :** bascule entre les quatre fonds, attribution suivant le fond
actif, refus d'une URL en HTTP, refus d'un fond sans attribution, persistance d'un
fond personnalisé, tuiles réellement demandées à l'URL saisie, rétablissement des
défauts, aucun libellé orphelin, audit d'affichage sans défaut sur dix
configurations.

**Non vérifiable ici :** les appels réels aux services IGN et OSM. La sortie réseau
de l'environnement de développement est fermée ; les tuiles sont simulées par
interception. À confirmer sur le terrain.

---

## 18/09/2026 — Mesure affinée et ajustement cartographique (v0.4)

**Demandes :** un bouton de relevé le plus précis possible sur les trois onglets de
fonctionnement ; puis une fenêtre montrant la carte au zoom maximal avec le repère
sur le point mesuré, l'utilisateur pouvant valider ou repositionner.

### Acquisition affinée

`geo.js` gagne `localiserPrecis()` : écoute continue du récepteur pendant une durée
configurable (30 s par défaut), filtrage des fixes plus de deux fois moins bons que
le meilleur, moyenne pondérée en `1/précision²`, arrêt anticipé possible.

**Position technique tenue :** la précision enregistrée reste la meilleure `accuracy`
annoncée, jamais une valeur calculée. Les fixes successifs d'un même récepteur sont
corrélés, moyenner ne divise pas l'erreur par la racine du nombre de mesures. Ce qui
est mesuré et stocké en plus : dispersion réelle, nombre de mesures, durée, méthode.

Vérifié hors navigateur sur une série contrôlée : mesure aberrante annoncée à 60 m
écartée, écart au point vrai ramené à 0,49 m, dispersion 1,42 m. Cas limites traités
(mesure unique, aucune mesure).

### Carte d'ajustement

`carte.js`, visualiseur de tuiles écrit à la main (Web Mercator, grille PM) :
environ 250 lignes, aucune dépendance. Repère fixe au centre, carte déplacée dessous
au doigt ou à la souris, zoom, bascule photo aérienne / plan IGN, marqueur GPS avec
son rayon de précision, écart au GPS en direct.

Vérifié en navigateur avec des tuiles simulées : la tuile du centre calculée
indépendamment correspond à celle demandée, un déplacement de 120 px donne 12,1 m
pour 12,0 m attendus, le plan plafonne bien au zoom 19 et l'orthophoto au zoom 20.
Mode dégradé testé : sans réseau, message explicite et fenêtre toujours utilisable.

**Les flux IGN n'ont pas pu être appelés réellement** : la sortie réseau de
l'environnement de développement est fermée. À confirmer sur le terrain.

### Défaut corrigé au passage

Le champ « durée de la mesure affinée » avait `min: 5` et `step: 5`, ce qui rendait
la valeur 6 invalide. Le navigateur bloquait alors le `submit` **sans émettre
d'événement** : toute la configuration, opérateur compris, cessait d'être
enregistrée, en silence. Trouvé parce que l'opérateur manquait dans un CSV de test.
Corrigé (`step: 1`) et, surtout, un écouteur `invalid` affiche désormais un message
en français reconstruit depuis les contraintes.

### Faux positif corrigé dans l'audit

L'audit signalait 152 défauts sur les tuiles : elles débordent du cadre par
construction, écrêtées par `overflow: hidden`. La règle « hors viewport » ignore
désormais tout élément écrêté par un ancêtre, et un contrôle distinct vérifie
qu'aucun conteneur ne cache de défilement horizontal.

**Nouvelles colonnes :** `dispersion_m`, `methode_gps`, `nb_mesures`, `duree_gps_s`,
`position_ajustee`, `ecart_ajustement_m`. Les fichiers passent à 25, 25 et 27
colonnes.

**Résultat :** audit sans défaut sur dix configurations, modale comprise, et les
trois suites fonctionnelles passent sans erreur JavaScript.

---

## 18/09/2026 — Affichage petits smartphones (v0.3)

**Demande :** l'application doit obligatoirement être utilisable sur les petits
smartphones.

**Constat avant correction** (mesuré, pas supposé) : aucun débordement horizontal,
la structure était déjà fluide. Mais quatre défauts réels :

1. Onglets « ASSAINISSEMENT » et « CONFIGURATION » tronqués par ellipsis **dès
   360 px**, et jusqu'à 430 px.
2. Message de confirmation centré : à 280 px il se repliait en colonne étroite
   d'environ 170 px, illisible.
3. Lien de coordonnées à **14 px** de haut — inutilisable au doigt.
4. `top: 53px` codé en dur sur la barre d'onglets : bug latent, faux dès que le
   palier 360 px réduit la hauteur de l'en-tête.

Et en paysage (568×320) : **84 px de barres collantes sur 320 px de haut**, soit
26 % de l'écran perdus en permanence.

**Corrigé :**
- Double libellé d'onglet (`onglet-long` / `onglet-court`), bascule à 480 px,
  libellé complet conservé dans `aria-label`.
- Message en bandeau pleine largeur sous 480 px.
- Lien de coordonnées transformé en cible tactile de 36 px ; cases à cocher sur une
  ligne de 44 px, basculables en touchant le libellé.
- Palier 360 px : gouttière à 10 px, typographie et marges compactées, boutons des
  cartes fichier en grille à deux colonnes, en-tête de carte sur deux lignes.
- En-tête et onglets réunis dans `.barre-haute` collante : plus aucune hauteur
  codée en dur.
- Paysage court : l'en-tête glisse hors écran, les onglets restent collés. 47 px de
  barres fixes au lieu de 84. Le décalage s'appuie sur `--h-entete`, mesuré par
  `suivreHauteurEntete()` via `ResizeObserver`.

**Ajouté :** `tests/audit-responsive.mjs`, rejouable, sortie non nulle en cas de
défaut. Il a immédiatement révélé un défaut à **430 px** (iPhone 15 Plus) que les
largeurs testées à la main ne couvraient pas : le seuil de bascule des libellés,
d'abord fixé à 400 px, était trop bas. Relevé à 480 px après mesure.

**Résultat :** aucun défaut sur dix configurations — 280, 320, 360, 390, 412, 430,
480, 540 px en portrait, 568×320 et 653×280 en paysage — et aucune régression
fonctionnelle sur le parcours complet.

---

## 18/09/2026 — Un CSV par onglet (v0.2)

**Demande :** « chaque onglet a son CSV ». Révision de la spec initiale, qui prévoyait
un fichier unique pour les trois filières.

**Modifié :**
- `config.js` : `colonnesCsv(filiereId)` ne rend plus que les colonnes de la filière
  demandée (19 / 19 / 21 au lieu de 28 communes avec des vides). `toutesColonnes()`
  ajoutée pour le seul filtre plein texte. Nom de fichier suggéré par filière.
- `store.js` : un handle IndexedDB par filière (`csv-eau`, `csv-assainissement`,
  `csv-spanc`). `migrerAncienHandle()` efface le handle unique de la v0.1.
- `app.js` : `synchroniserFichier(filiereId)` et `synchroniserTout()` ; le badge
  d'en-tête suit l'onglet actif ; vue Configuration refaite en trois cartes de
  filière (Créer / Lier / Délier / Exporter / Importer) plus « Exporter les 3 ».
- `fusionnerCsv(texte, filiereId)` : rejette les lignes d'une autre filière,
  rattache celles sans colonne `filiere` à la cible.
- `style.css` : cartes `.fichier`, boutons `.btn-compact`, état de badge neutre.

**Choix assumé :** le `localStorage` reste un stock unique discriminé par `filiere`.
Seul le format d'export est éclaté. Éclater le stockage compliquerait purge,
statistiques et filtre sans bénéfice.

**Vérifications :** parcours complet en Chromium headless — trois CSV générés avec
leurs colonnes propres, export unitaire et export des trois, import d'un `eau.csv`
dans SPANC refusé, réimport dans EAU détecté comme doublon, import d'un CSV sans
colonne `filiere` accepté, persistance après rechargement, aucune erreur JavaScript,
aucun débordement horizontal en 390 px.

---

## 18/09/2026 — Création du projet (v0.1)

**Demande :** application web vanilla de relevé de localisation, un CSV unique,
quatre onglets (EAU, ASSAINISSEMENT, SPANC, CONFIGURATION), une couleur par onglet,
mêmes éléments avec des données différentes, géolocalisation sur les trois onglets
de fonctionnement.

**Livré :**
- Squelette complet : `index.html`, `css/style.css`, six modules JS, `serveur.py`.
- Schéma unique dans `js/config.js` pilotant formulaires, colonnes CSV et filtres.
- Trois filières avec champs métier distincts, quatrième onglet de configuration.
- Géolocalisation avec seuil d'alerte de précision et conversion Lambert 93.
- CSV unique : 28 colonnes, UTF-8 BOM, séparateur configurable, RFC 4180 *(éclaté en trois fichiers en v0.2)*.
- Écriture dans un fichier lié (Chrome/Edge) ou export manuel (autres navigateurs).
- Import CSV avec fusion sur `id` et resynchronisation des compteurs de références.
- Modification, duplication et suppression de points ; filtre plein texte.
- `docs/RGPD.md` sur les données personnelles du SPANC.

**Vérifications effectuées :**
- Lambert 93 : Paris Notre-Dame → `X = 652 469 ; Y = 6 862 035`, conforme à la
  référence IGN (`652 469,79 / 6 862 035,2`).
- CSV : aller-retour exact sur une valeur contenant guillemets, séparateur et
  retour ligne.
- Parcours complet en Chromium headless (position simulée à Réchésy) : création
  d'un point sur chacune des trois filières, blocage des champs obligatoires
  manquants, duplication, modification sans doublon, suppression, persistance
  après rechargement, restauration de l'onglet actif, aucune erreur JavaScript.
- Rendu 390 px : aucun débordement horizontal.

**Corrections en cours de route :**
- `h2` dans `.bloc-titre` échappait au sélecteur `.bloc > h2` (titre surdimensionné).
- Onglets tronqués sous 430 px : palier typographique ajouté.
- `favicon.ico` en 404 : `favicon.svg` ajouté.
- Tiret orphelin sur les points sans commune.

**Non traité volontairement :** nomenclature métier non validée auprès des services,
pas de HTTPS de production, pas de mode hors-ligne, pas de photo.
