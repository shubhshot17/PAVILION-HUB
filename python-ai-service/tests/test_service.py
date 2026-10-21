from fastapi.testclient import TestClient

from app.main import app


def valid_win_payload() -> dict[str, object]:
    return {
        "runs": 92,
        "wickets": 3,
        "legal_balls_remaining": 42,
        "target": 171,
        "required_run_rate": 11.29,
        "current_run_rate": 7.08,
        "venue": "Westport Oval",
        "batting_team_strength": 0.6,
        "bowling_team_strength": 0.55,
    }


def test_prediction_endpoints_and_schema_validation(tmp_path, monkeypatch) -> None:
    from training.train import train_models

    bundle_path = tmp_path / "models.joblib"
    metrics = train_models(bundle_path, samples=1_200, random_state=7)
    assert metrics["data_notice"].startswith("Deterministic synthetic data")
    monkeypatch.setenv("MODEL_PATH", str(bundle_path))

    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["ready"] is True
        assert "synthetic" in health.json()["data_source"]

        win = client.post("/predict/win-probability", json=valid_win_payload())
        assert win.status_code == 200
        assert 0 <= win.json()["batting_team_win_probability"] <= 1
        assert win.json()["probability_is_calibrated"] is False
        assert "not calibrated" in win.json()["qualification"]

        projection = client.post(
            "/predict/first-innings-score",
            json={
                "runs": 124,
                "wickets": 4,
                "legal_balls": 90,
                "venue": "Westport Oval",
                "team_strength": 0.65,
            },
        )
        assert projection.status_code == 200
        response = projection.json()
        assert 0 <= response["approximate_low"] <= response["projected_total"]
        assert response["projected_total"] <= response["approximate_high"] <= 400
        assert response["range_is_calibrated"] is False

        invalid = client.post(
            "/predict/win-probability",
            json={**valid_win_payload(), "wickets": 11},
        )
        assert invalid.status_code == 422
        extra_field = client.post(
            "/predict/win-probability",
            json={**valid_win_payload(), "email": "private@example.invalid"},
        )
        assert extra_field.status_code == 422
        blank_venue = client.post(
            "/predict/win-probability",
            json={**valid_win_payload(), "venue": "   "},
        )
        assert blank_venue.status_code == 422


def test_service_reports_missing_model_not_ready(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MODEL_PATH", str(tmp_path / "missing-model.joblib"))
    app.state.models = None
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["ready"] is False
        response = client.post("/predict/win-probability", json=valid_win_payload())
        assert response.status_code == 503
