# DECISIONS.md

Journal des décisions techniques actées — avec le pourquoi.
Toute modification de ces décisions doit être explicitement validée ici.

---

## Stack

| Décision | Choix acté | Pourquoi | Alternatives rejetées |
|---|---|---|---|
| UI / shell / animations | **Rust** | 60 fps sans GIL, sécurité mémoire, pas de freeze UI pendant les appels IA | PySide6 : animations fragiles, GIL bloque le thread UI pendant l'inférence |
| Orchestration IA / manifestes | **Python** | Écosystème AI imbattable (Ollama, OpenAI, Anthropic SDK) | Rust : bindings AI immatures |
| IA locale MVP | **Ollama uniquement** | Simplicité, pas de clé API, déploiement local zéro friction | API cloud : exclue du MVP — surface de bugs supplémentaire, dépendance réseau |
| IA cloud | **Exclu du MVP** | Distraction. Interface abstraite prévue pour V1.1 | — |
| Stockage | **SQLite** | Embarqué, sans serveur, suffisant pour config + state | PostgreSQL : over-engineering ; fichiers JSON : pas de requêtes |
| Packaging MVP | **Cargo + PyInstaller bundlé** | `.exe` Windows cible MVP. Tester tôt — PyInstaller + PySide6 peut produire des binaires fragiles | Electron : trop lourd ; Flatpak : hors scope Windows |
| IPC Rust ↔ Python | **Socket Unix / Named pipe** | Latence minimale, pas de dépendance externe | gRPC : overhead inutile pour du local ; fichiers partagés : trop lent |

---

## Protocole manifeste

| Décision | Choix acté | Pourquoi |
|---|---|---|
| Format | JSON | Lisible par l'IA sans parsing spécial, universel |
| Versioning | Champ `version` obligatoire dès v1 | Éviter la dette rétrocompatibilité plus tard |
| Types de params v1 | `int, float, str, hex, bool` | Couvre 95% des cas sans complexité |
| Validation | Côté `ia-core`, pas côté app | L'app ne doit pas avoir à se défendre contre l'IA |

---

## UI

| Décision | Choix acté | Pourquoi |
|---|---|---|
| Animations orbes | **Dernière priorité** | Piège de créateur — 3 semaines de cosmétique, zéro architecture |
| Bourrelet / morphose | **Machine à états explicite** | Sans ça : edge cases infinis (double-clic, clic pendant animation, etc.) |
| Maquette de référence | `synapse-desktop.html` | Comportement validé visuellement avant le dev Rust |

---

## Processus

| Décision | Choix acté | Pourquoi |
|---|---|---|
| Ordre de développement | Pipeline IA → UI minimale → intégration | Valider le cœur avant l'enveloppe |
| Première milestone | Spike 48h : `texte → Ollama → action Paint` | Si ça échoue, tout le reste est sans valeur |
| Contexte Claude Code | `CLAUDE.md` + `ARCHITECTURE.md` + `DECISIONS.md` injectés à chaque session | Sans ancre formelle, les implémentations divergent entre sessions |
| Changements | Un à la fois, validés ensemble | Éviter les bulk edits qui cassent silencieusement |

---

## Ce qui n'est PAS acté (décisions futures)

- Framework Rust UI exact (egui, Slint, bindings Qt ?) → à décider au spike UI
- Format IPC exact (JSON lines, MessagePack ?) → à décider au spike IPC
- Modèle Ollama exact → dépend des tests de fiabilité manifeste
- Sandbox apps V1.1 → hors scope MVP
