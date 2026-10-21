import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    log_loss,
    mean_absolute_error,
    mean_squared_error,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from training.synthetic_data import (
    SCORE_FEATURES,
    VENUES,
    WIN_FEATURES,
    make_score_data,
    make_win_data,
)

DATA_NOTICE = "Deterministic synthetic data only; no historical data was used."


def make_preprocessor(features: tuple[str, ...]) -> ColumnTransformer:
    numeric = [feature for feature in features if feature != "venue"]
    return ColumnTransformer(
        [
            ("venue", OneHotEncoder(
                categories=[list(VENUES)],
                handle_unknown="ignore",
                sparse_output=False,
            ), ["venue"]),
            ("numeric", StandardScaler(), numeric),
        ],
        verbose_feature_names_out=False,
    )


def train_models(
    output_path: str | Path,
    samples: int = 20_000,
    random_state: int = 42,
) -> dict[str, Any]:
    if samples < 1_000:
        raise ValueError("Use at least 1000 synthetic samples for a meaningful split.")

    win_x, win_y = make_win_data(samples, random_state)
    win_x_train, win_x_test, win_y_train, win_y_test = train_test_split(
        win_x,
        win_y,
        test_size=0.2,
        random_state=random_state,
        stratify=win_y,
    )
    win_model = Pipeline(
        [
            ("features", make_preprocessor(WIN_FEATURES)),
            ("classifier", LogisticRegression(max_iter=1000, random_state=random_state)),
        ]
    )
    win_model.fit(win_x_train, win_y_train)
    win_probabilities = win_model.predict_proba(win_x_test)[:, 1]
    baseline_probabilities = np.full(len(win_y_test), win_y_train.mean())

    score_x, score_y = make_score_data(samples, random_state + 1)
    score_x_train, score_x_test, score_y_train, score_y_test = train_test_split(
        score_x, score_y, test_size=0.2, random_state=random_state
    )
    score_model = Pipeline(
        [
            ("features", make_preprocessor(SCORE_FEATURES)),
            ("regressor", HistGradientBoostingRegressor(
                max_iter=120,
                l2_regularization=1.0,
                random_state=random_state,
            )),
        ]
    )
    score_model.fit(score_x_train, score_y_train)
    score_predictions = score_model.predict(score_x_test)
    baseline_score = float(score_y_train.mean())
    baseline_score_predictions = np.full(len(score_y_test), baseline_score)
    score_mae = float(mean_absolute_error(score_y_test, score_predictions))

    metrics: dict[str, Any] = {
        "data_notice": DATA_NOTICE,
        "split": "80% train / 20% held-out synthetic test; random split",
        "random_state": random_state,
        "samples_per_model": samples,
        "win_probability": {
            "model": "LogisticRegression",
            "test_accuracy": float(accuracy_score(
                win_y_test, win_model.predict(win_x_test)
            )),
            "test_brier_score": float(brier_score_loss(win_y_test, win_probabilities)),
            "baseline_brier_score": float(
                brier_score_loss(win_y_test, baseline_probabilities)
            ),
            "test_log_loss": float(log_loss(win_y_test, win_probabilities)),
            "baseline_log_loss": float(log_loss(win_y_test, baseline_probabilities)),
            "calibrated": False,
        },
        "first_innings_score": {
            "model": "HistGradientBoostingRegressor",
            "test_mae_runs": score_mae,
            "baseline_mean_predictor": baseline_score,
            "baseline_test_mae_runs": float(
                mean_absolute_error(score_y_test, baseline_score_predictions)
            ),
            "test_rmse_runs": float(
                np.sqrt(mean_squared_error(score_y_test, score_predictions))
            ),
        },
    }
    bundle = {
        "win_model": win_model,
        "score_model": score_model,
        "score_mae": score_mae,
        "metrics": metrics,
    }

    artifact = Path(output_path)
    artifact.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, artifact)
    metrics_path = artifact.with_name("metrics.json")
    metrics_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Train experimental synthetic T20 baselines.")
    parser.add_argument("--output", default="artifacts/models.joblib")
    parser.add_argument("--samples", type=int, default=20_000)
    parser.add_argument("--random-state", type=int, default=42)
    arguments = parser.parse_args()
    metrics = train_models(arguments.output, arguments.samples, arguments.random_state)
    print(json.dumps({
        "trained_at_utc": datetime.now(UTC).isoformat(),
        "artifact": str(Path(arguments.output).resolve()),
        "metrics_file": str(Path(arguments.output).with_name("metrics.json").resolve()),
        "metrics": metrics,
    }, indent=2))


if __name__ == "__main__":
    main()
