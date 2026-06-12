"""
Spike 48h — validation du pipeline manifeste → IA → Paint.

Usage:
    python spike.py "dessine une ligne rouge"
    python spike.py "nouvelle toile"
    python spike.py "change la couleur en bleu"
"""
import sys
import json

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))

from modules.ia_core.ollama_client import is_available, DEFAULT_MODEL
from modules.ia_core.intent_parser import parse_intent
from modules.ia_core.action_dispatcher import validate_and_dispatch
from modules.apps.paint.paint import launch


def main():
    if len(sys.argv) < 2:
        print("Usage: python spike.py \"<instruction>\"")
        sys.exit(1)

    instruction = " ".join(sys.argv[1:])
    app_name = "paint"

    # 1. Vérifier Ollama
    if not is_available(DEFAULT_MODEL):
        print(f"[ERREUR] Ollama n'est pas disponible ou le modèle '{DEFAULT_MODEL}' n'est pas installé.")
        print("         Lancer : ollama pull llama3.2")
        sys.exit(1)

    print(f"[1/3] Instruction : {instruction!r}")

    # 2. Parser l'intention
    raw_action = parse_intent(instruction, app_name)
    print(f"[2/3] Action brute  : {json.dumps(raw_action, ensure_ascii=False)}")

    # 3. Valider et dispatcher
    action = validate_and_dispatch(raw_action, app_name)
    print(f"[3/3] Action validée: {json.dumps(action, ensure_ascii=False)}")

    # 4. Lancer Paint et exécuter l'action
    qt_app, window = launch()
    window.canvas.dispatch(action)
    sys.exit(qt_app.exec())


if __name__ == "__main__":
    main()
