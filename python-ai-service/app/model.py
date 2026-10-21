import os
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

DATA_SOURCE = "deterministic synthetic training data; not historical match data"
MODEL_VERSION = "synthetic-t20-baseline-v1"
QUALIFICATION = (
    "Experimental baseline trained only on synthetic data. This probability is "
    "not calibrated and is not validated for real matches."
)
PROJECTION_QUALIFICATION = (
    "Experimental score projection trained only on synthetic data. The range "
    "is an approximate training-error band, not a calibrated prediction interval."
)


def load_models(model_path: str | Path | None = None) -> dict[str, Any]:
    path = Path(model_path or os.environ.get("MODEL_PATH", "artifacts/models.joblib"))
    if not path.is_absolute():
        path = Path.cwd() / path
    if not path.is_file():
        raise FileNotFoundError(
            f"Model artifact not found at {path}. Run "
            "'python -m training.train --output artifacts/models.joblib' first."
        )
    bundle = joblib.load(path)
    if not isinstance(bundle, dict) or not {
        "win_model",
        "score_model",
        "metrics",
        "score_mae",
    }.issubset(bundle):
        raise ValueError(f"Model artifact at {path} has an unsupported format")
    return bundle


def predict_win_probability(
    bundle: dict[str, Any], features: dict[str, Any]
) -> dict[str, Any]:
    frame = pd.DataFrame([features])
    model = bundle["win_model"]
    probabilities = model.predict_proba(frame)[0]
    positive_index = list(model.classes_).index(1)
    probability = float(probabilities[positive_index])
    return {
        "batting_team_win_probability": probability,
        "probability_is_calibrated": False,
        "qualification": QUALIFICATION,
        "data_source": DATA_SOURCE,
        "model_version": MODEL_VERSION,
    }


def predict_first_innings_score(
    bundle: dict[str, Any], features: dict[str, Any]
) -> dict[str, Any]:
    projected = float(bundle["score_model"].predict(pd.DataFrame([features]))[0])
    total = max(0, min(400, round(projected)))
    error_band = max(1, round(float(bundle["score_mae"])))
    return {
        "projected_total": total,
        "approximate_low": max(0, total - error_band),
        "approximate_high": min(400, total + error_band),
        "range_is_calibrated": False,
        "qualification": PROJECTION_QUALIFICATION,
        "data_source": DATA_SOURCE,
        "model_version": MODEL_VERSION,
    }
