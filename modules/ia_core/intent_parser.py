import json
import re
from .manifest_loader import load_manifest, get_capabilities_prompt
from .ollama_client import query

SYSTEM_PROMPT = """Tu es un assistant qui traduit des instructions en langage naturel en actions JSON pour contrôler une application.

Tu reçois :
1. La liste des actions disponibles avec leurs paramètres
2. Une instruction en langage naturel

Tu dois répondre UNIQUEMENT avec un objet JSON valide correspondant à l'action à exécuter.
Aucun texte avant ou après le JSON. Aucune explication.

Format de réponse :
{{"action": "nom_action", "params": {{"param1": valeur1, "param2": valeur2}}}}

Pour les couleurs hexadécimales : utilise le format #RRGGBB.
Si l'instruction est ambiguë, choisis les paramètres les plus raisonnables."""


def parse_intent(user_text: str, app_name: str) -> dict:
    """Traduit un texte naturel en action JSON pour l'app donnée."""
    manifest = load_manifest(app_name)
    capabilities = get_capabilities_prompt(manifest)

    prompt = f"""{SYSTEM_PROMPT}

{capabilities}

Instruction : {user_text}

JSON :"""

    raw = query(prompt)
    return _extract_json(raw)


def _extract_json(raw: str) -> dict:
    """Extrait le premier objet JSON valide de la réponse Ollama."""
    raw = raw.strip()

    # Cas idéal : la réponse est directement du JSON
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Cherche un bloc JSON dans la réponse
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Impossible d'extraire un JSON valide de la réponse : {raw!r}")
