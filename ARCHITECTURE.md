# ARCHITECTURE.md

Référence structurelle permanente — injecté en contexte à chaque session Claude Code.

---

## Principe fondateur

Le pipeline `manifeste JSON → IA → action UI` est la colonne vertébrale du projet. Rien d'autre ne doit être construit avant que ce pipeline soit validé.

```
App (manifest.json)
      │
      ▼
  IA Core (Python)
  ┌─────────────────────────────────┐
  │  1. Reçoit texte naturel        │
  │  2. Charge manifest.json        │
  │  3. Ollama → action JSON        │
  │  4. Valide le schéma            │
  │  5. Dispatch vers l'app         │
  └─────────────────────────────────┘
      │
      ▼
  App reçoit l'action → l'exécute
      │
      ▼
  UI Rust reflète le changement
```

---

## Schéma du protocole manifeste v1

### Fichier `manifest.json` (côté app)

```json
{
  "app": "string",
  "version": "semver",
  "capabilities": [
    {
      "action": "snake_case_string",
      "description": "Phrase courte en langage naturel — c'est ce que l'IA lit",
      "params": {
        "param_name": "type"
      },
      "trigger": {
        "type": "api_call | ui_element",
        "method": "module.function",
        "id": "element-id",
        "event": "setValue | click | ..."
      }
    }
  ]
}
```

### Types de paramètres supportés (v1)
`int`, `float`, `str`, `hex`, `bool`

### Format de réponse IA → App

```json
{
  "action": "draw_circle",
  "params": {
    "x": 100,
    "y": 200,
    "radius": 50,
    "color": "#ff0000"
  }
}
```

### Cas d'erreur à gérer impérativement
- Action inconnue (pas dans le manifeste)
- Paramètre manquant ou mauvais type
- Réponse IA non-JSON ou JSON invalide
- Timeout Ollama

---

## Composants et dépendances

```
┌─────────────────────────────────────────────────────┐
│                    COUCHE RUST                      │
│                                                     │
│  shell/          menu/          bourrelet/          │
│  ─ fenêtre       ─ niveau 1     ─ onglet bas        │
│  ─ bureau        ─ niveau 2     ─ morphose orbe     │
│  ─ orbe          ─ apps row     ─ machine à états   │
│                                                     │
│  Reçoit les commandes via IPC ←──────────────────┐  │
└─────────────────────────────────────────────────┼──┘
                                                  │ IPC
┌─────────────────────────────────────────────────┼──┐
│                   COUCHE PYTHON                  │  │
│                                                  │  │
│  ia-core/                                        │  │
│  ─ manifest_loader.py   charge manifest.json     │  │
│  ─ intent_parser.py     texte → action JSON      │  │
│  ─ action_dispatcher.py valide + route           │  │
│  ─ ollama_client.py     interface Ollama         │  │
│  ─ ipc_bridge.py        pont Python ↔ Rust  ─────┘  │
│                                                     │
│  apps/paint/                                        │
│  ─ paint.py             reçoit les actions          │
│  ─ manifest.json        déclare les capacités       │
└─────────────────────────────────────────────────────┘

        Stockage : SQLite local (config, state)
        IA locale : Ollama (socket local)
```

---

## IPC Rust ↔ Python

- **Transport** : socket Unix (Linux/macOS) / named pipe (Windows)
- **Format** : JSON lines (un objet JSON par ligne)
- **Sens** : bidirectionnel
  - Python → Rust : commandes UI (`{"cmd": "open_app", "app": "paint"}`)
  - Rust → Python : événements utilisateur (`{"event": "orb_clicked"}`)

---

## Machine à états : Orbe / Bourrelet

```
IDLE
 │ clic orbe
 ▼
MENU_OPEN
 │ clic catégorie          │ clic ailleurs / 2e clic orbe
 ▼                         ▼
CAT_OPEN ──────────────► IDLE
 │ clic app
 ▼
APP_MODE
 │ (orbe caché, bourrelet visible)
 │ clic bourrelet
 ▼
BOURRELET_MORPHING (350ms)
 │
 ▼
MENU_OVER_APP
 │ 2e clic bourrelet / clic ailleurs
 ▼
APP_MODE
```

---

## Spike de validation (48h — à faire en premier)

**Objectif :** prouver que le pipeline fonctionne de bout en bout.

**Périmètre strict :**
1. `manifest.json` Paint avec 3 actions : `new_canvas`, `set_color`, `draw_line`
2. `intent_parser.py` : envoie le texte à Ollama, reçoit JSON action
3. `paint.py` : reçoit l'action, l'exécute (console ou canvas Qt basique)
4. Fenêtre Qt minimale (pas d'orbe, pas d'animation)

**Critère de succès :** `"dessine une ligne rouge"` → Paint trace une ligne rouge.

Si ce critère n'est pas atteint en 48h, **tout s'arrête** et on diagnostique le blocage avant de continuer.
