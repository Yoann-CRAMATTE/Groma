# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rôle de Claude

Co-développeur rigoureux. Analyser, anticiper, alerter — pas exécuter aveuglément.
Avant tout code : analyser les risques, proposer une architecture, valider ensemble.
**Changements un à la fois** — jamais de bulk edit.

---

## Qu'est-ce que Synapse ?

Mini OS desktop AI-native développé from scratch en Python/PySide6.
L'IA n'est pas un assistant adjacent — elle est la couche de contrôle native de chaque application.

**Philosophie** : interface minimaliste géométrique, navigation par orbes (ronds), zéro chrome inutile. Chaque app expose un `manifest.json` qui dit à l'IA comment la piloter (inspiré MCP, appliqué à un OS entier).

---

## Stack technique

| Couche | Techno |
|--------|--------|
| Langage | Python |
| UI | PySide6 |
| IA locale | Ollama (Llama 3.2 ou équivalent léger) |
| IA cloud | API configurable (OpenAI, Anthropic, etc.) |
| Packaging | PyInstaller → `.exe` Windows (MVP) |
| Stockage | SQLite local |

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

La maquette HTML interactive `synapse-desktop.html` est la **référence visuelle et comportementale** pour tout développement PySide6.

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

- Indentation : 4 espaces (Python), 2 espaces (JS/HTML/CSS)
- Nommage fichiers : `kebab-case`
- Variables : `snake_case` (Python), `camelCase` (JS)
- Pas de `print()` dans le code livré
- Commenter le **pourquoi**, jamais le quoi

---

## Roadmap

### MVP (en cours)
- [ ] Bureau minimaliste + orbe
- [ ] Menu navigation 2 niveaux
- [ ] Bourrelet mode travail + morphose orbe
- [ ] Écran config IA (Ollama / API)
- [ ] App démo : Paint avec manifeste IA v1
- [ ] Protocole `manifest.json` v1

### V1.1
- [ ] App Store (téléchargement apps compatibles Synapse)
- [ ] Sandbox (isolation apps)
- [ ] Apps natives : Notes, Texte, Terminal léger, Assistant IA

### V2
- [ ] Port multi-plateforme (Linux, macOS)
- [ ] Modèle IA embarqué < 1B params
- [ ] Exploration Wear OS / watchOS
