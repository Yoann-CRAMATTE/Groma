from .manifest_loader import load_manifest

PARAM_TYPES = {
    "int": int,
    "float": float,
    "str": str,
    "hex": str,
    "bool": bool,
}


def validate_and_dispatch(action: dict, app_name: str) -> dict:
    """Valide l'action contre le manifeste et retourne l'action normalisée."""
    manifest = load_manifest(app_name)
    capabilities = {cap["action"]: cap for cap in manifest["capabilities"]}

    action_name = action.get("action")
    if action_name not in capabilities:
        known = list(capabilities.keys())
        raise ValueError(f"Action inconnue: '{action_name}'. Actions disponibles: {known}")

    cap = capabilities[action_name]
    params = action.get("params", {})

    # Vérifie et convertit les paramètres requis
    validated_params = {}
    for param_name, param_type_str in cap["params"].items():
        if param_name not in params:
            # Applique des valeurs par défaut raisonnables
            validated_params[param_name] = _default_value(param_type_str)
        else:
            converter = PARAM_TYPES.get(param_type_str, str)
            try:
                validated_params[param_name] = converter(params[param_name])
            except (ValueError, TypeError) as e:
                raise ValueError(f"Paramètre '{param_name}' invalide: {e}")

    return {"action": action_name, "params": validated_params}


def _default_value(type_str: str):
    defaults = {"int": 0, "float": 0.0, "str": "", "hex": "#000000", "bool": False}
    return defaults.get(type_str, None)
