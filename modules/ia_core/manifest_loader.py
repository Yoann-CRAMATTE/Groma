import json
from pathlib import Path


def load_manifest(app_name: str) -> dict:
    path = Path(__file__).parent.parent / "apps" / app_name / "manifest.json"
    with open(path) as f:
        return json.load(f)


def get_capabilities_prompt(manifest: dict) -> str:
    """Formatte les capacités en texte lisible pour le prompt Ollama."""
    lines = [f"App: {manifest['app']}", "Actions disponibles:"]
    for cap in manifest["capabilities"]:
        params = ", ".join(f"{k}: {v}" for k, v in cap["params"].items())
        lines.append(f'  - {cap["action"]}({params}): {cap["description"]}')
    return "\n".join(lines)
