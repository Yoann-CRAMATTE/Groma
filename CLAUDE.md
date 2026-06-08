# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documents de référence

Lire ces fichiers **avant toute session de développement** — ils sont le système de contrôle du projet :

- `ARCHITECTURE.md` — schéma du protocole manifeste, dépendances entre composants, machine à états UI, critères du spike 48h
- `DECISIONS.md` — pourquoi Rust pour l'UI, pourquoi Ollama seul au MVP, ce qui est exclu et pourquoi

---

## Rôle de Claude

Co-développeur rigoureux. Analyser, anticiper, alerter — pas exécuter aveuglément.
Avant tout code : analyser les risques, proposer une architecture, valider ensemble.
**Changements un à la fois** — jamais de bulk edit.

---

## Qu'est-ce que Synapse ?

Shell desktop AI-native qui tourne par-dessus un OS existant (Windows en priorité, puis Linux/macOS).
L'IA n'est pas un assistant adjacent — elle est la couche de contrôle native de chaque application.

**Philosophie** : interface minimaliste géométrique, navigation par orbes (ronds), zéro chrome inutile. Chaque app expose un `manifest.json` qui dit à l'IA comment la piloter (inspiré MCP, appliqué à un OS entier).

---

## Stack technique

| Couche | Techno | Raison |
|--------|--------|--------|
| Core UI / shell / animations | **Rust** | Performances, sécurité mémoire, 60 fps sans GIL |
| Orchestration IA / manifestes | **Python** | Écosystème AI imbattable (Ollama, OpenAI, Anthropic) |
| Apps tierces | Python ou tout langage | Via le protocole manifest — pas de contrainte |
| IA locale | Ollama (Llama 3.2 ou léger) | Inférence locale sans dépendance cloud |
| IA cloud | API configurable (OpenAI, Anthropic…) | Fallback ou modèles plus puissants |
| IPC core ↔ IA | IPC léger (socket Unix / named pipe) | Pont Rust ↔ Python sans overhead |
| Packaging | Cargo + PyInstaller bundlé | `.exe` Windows pour le MVP |
| Stockage | SQLite local | Simple, embarqué, sans serveur |

> **Règle d'or** : tout ce qui touche au rendu, aux animations et à la réactivité de l'UI s'écrit en Rust. Tout ce qui touche à l'IA, aux manifestes et à la logique des apps s'écrit en Python.

---

## Architecture UI

### Bureau (idle)
- Fond sombre quasi vide
- Un seul élément : **orbe central** bas/centre, affiche `HH:MM` + `JEU 8 JUN`
- Sous l'orbe : 3 toggles — WiFi, Bluetooth, Dark/Light mode

### Navigation (clic orbe)
- Menu monte depuis l'orbe avec animation
- **Niveau 1** : barre IA en haut + 5 catégories en ronds (Bureau, Jeux, IA, Store, Système)
- **Niveau 2** : clic catégorie → ligne d'apps s'affiche au-dessus en remplacement ; 2e clic referme ; clic ailleurs ferme tout

### Mode travail (app ouverte)
- Tout disparaît (bureau, orbe, menu)
- Visible uniquement : **bourrelet** — petit onglet arrondi collé au bord bas, affiche heure + jour abrégé
- **Clic bourrelet** → monte et se morphe en orbe (350 ms) → menu s'ouvre automatiquement par-dessus l'app
- 2e clic → menu ferme, bourrelet redescend et reprend sa forme

La maquette HTML interactive `synapse-desktop.html` est la **référence visuelle et comportementale** pour tout développement Rust UI.

---

## Protocole app ↔ IA (concept central)

Chaque app livre un `manifest.json` décrivant ses capacités à l'IA :

```json
{
  "app": "paint",
  "version": "1.0",
  "capabilities": [
    {
      "action": "draw_circle",
      "description": "Dessine un cercle sur le canvas",
      "params": { "x": "int", "y": "int", "radius": "int", "color": "hex" },
      "trigger": { "type": "api_call", "method": "canvas.drawCircle" }
    },
    {
      "action": "set_color",
      "description": "Change la couleur active",
      "params": { "color": "hex" },
      "trigger": { "type": "ui_element", "id": "color-picker", "event": "setValue" }
    }
  ]
}
```

L'IA lit le manifeste et pilote l'app sans la "voir" — en appelant les actions décrites.

---

## Configuration IA (premier démarrage)

1. **Mode local** : Ollama installé ? → sélection du modèle disponible
2. **Mode cloud** : saisie clé API (OpenAI / Anthropic / autre)
3. Modifiable dans Système > IA Config

---

## Structure projet

```
synapse/
├── config.json
├── runtime.json
├── checklist.md
├── dev-notes.md
├── projet.md
├── modules/
│   ├── desktop/
│   ├── menu/
│   ├── bourrelet/
│   ├── ia-core/
│   └── apps/
│       └── paint/
│           ├── paint.py
│           └── manifest.json
├── design/
│   └── design-system.css
├── lib/
├── assets/
├── tests/
├── dist/
└── docs/
```

---

## Conventions

- Indentation : 4 espaces (Python), 2 espaces (JS/HTML/CSS), style Rust standard (`rustfmt`)
- Nommage fichiers : `kebab-case`
- Variables : `snake_case` (Python & Rust), `camelCase` (JS)
- Pas de `print()` / `println!()` dans le code livré
- Commenter le **pourquoi**, jamais le quoi

---

## Ordre de développement MVP

> Décision issue du LLM Council (08/06/2026) — consensus total.

**Ne pas commencer par les animations d'orbes.** C'est de la dette émotionnelle déguisée en avancement.

### Étape 0 — Spike 48h (PREMIÈRE CHOSE)
- [ ] `manifest.json` Paint : 3 actions (`new_canvas`, `set_color`, `draw_line`)
- [ ] `intent_parser.py` : texte naturel → Ollama → action JSON
- [ ] `paint.py` reçoit l'action et l'exécute
- [ ] Fenêtre Qt basique pour visualiser — **pas d'orbe, pas d'animation**
- **Critère de succès :** `"dessine une ligne rouge"` → Paint trace une ligne rouge

### Étape 1 — UI minimale (après spike validé)
- [ ] Orbe minimal (heure/date, clic, menu 2 niveaux plat)
- [ ] Mode travail avec bourrelet d'état simple
- [ ] Machine à états explicite (cf. `ARCHITECTURE.md`)

### Étape 2 — Intégration
- [ ] Manifeste Paint dans l'UI Synapse
- [ ] Écran config IA (Ollama uniquement)
- [ ] Protocole `manifest.json` v1 documenté

### Étape 3 — Polish (en dernier)
- [ ] Animations d'orbes et morphose bourrelet
- [ ] PyInstaller testé et validé sur Windows

### V1.1
- [ ] Interface abstraite IA (cloud API en option)
- [ ] App Store
- [ ] Sandbox apps
- [ ] Apps natives : Notes, Texte, Terminal léger

### V2
- [ ] Port multi-plateforme (Linux, macOS)
- [ ] Modèle IA embarqué < 1B params
- [ ] Exploration Wear OS / watchOS

### V1.1
- [ ] App Store (téléchargement apps compatibles Synapse)
- [ ] Sandbox (isolation apps)
- [ ] Apps natives : Notes, Texte, Terminal léger, Assistant IA

### V2
- [ ] Port multi-plateforme (Linux, macOS)
- [ ] Modèle IA embarqué < 1B params
- [ ] Exploration Wear OS / watchOS
