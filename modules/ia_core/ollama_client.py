import json
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "llama3.2"


def query(prompt: str, model: str = DEFAULT_MODEL) -> str:
    """Envoie un prompt à Ollama et retourne la réponse complète."""
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    response = requests.post(OLLAMA_URL, json=payload, timeout=30)
    response.raise_for_status()
    return response.json()["response"]


def is_available(model: str = DEFAULT_MODEL) -> bool:
    """Vérifie qu'Ollama tourne et que le modèle est disponible."""
    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=5)
        models = [m["name"] for m in r.json().get("models", [])]
        return any(model in m for m in models)
    except requests.RequestException:
        return False
