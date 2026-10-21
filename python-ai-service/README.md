# PAVILION HUB Python AI service

This separate FastAPI service provides experimental baseline T20 predictions
using scikit-learn. **The included training data is generated synthetic data;
it is not sourced from historical matches.** The outputs are not validated
against real matches and must not be presented as reliable or calibrated
forecasts.

## Models and evaluation

- Win probability: logistic regression using runs, wickets, legal balls
  remaining, target, required/current run rates, venue, and batting/bowling
  strength estimates.
- First-innings score: histogram gradient boosting regression using runs,
  wickets, legal balls, venue, and team-strength estimate. The returned
  approximate range is based on held-out synthetic MAE; it is not a calibrated
  prediction interval.
- The training script uses deterministic generated data and an 80/20 random
  train/test split. It reports accuracy, Brier score, and log loss alongside
  a constant training-prevalence win-probability baseline. It also reports
  score MAE/RMSE alongside the training-mean score baseline. These are
  synthetic-only evaluation metrics, not historical accuracy.
- The response explicitly marks win probabilities as uncalibrated and
  qualifies both predictions as synthetic experiments.

No third-party or historical dataset is downloaded or embedded. The generator
is a controlled toy process for proving the training, serialization, API, and
evaluation workflow. Its synthetic test metrics do not show real-world skill.

## Install and train locally (PowerShell)

From the repository root:

```powershell
cd python-ai-service
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m training.train --output artifacts/models.joblib --samples 20000
```

Python 3.12 is a recommended environment for broad scientific Python wheel
availability. A compatible newer Python may work if wheels for the pinned
dependency ranges are available.

The artifact and metrics report are written under `artifacts/`, which is
Git-ignored. `joblib` artifacts must only be loaded from a trusted local source.
The training module is not imported by the serving app.

## Run and verify the API

Copy the example environment file and keep the trained artifact path
consistent with `MODEL_PATH` (relative to the service working directory unless
absolute):

```powershell
Copy-Item .env.example .env
python -m uvicorn app.main:app --env-file .env --host 127.0.0.1 --port 8000
```

The service binds to localhost by default and does not enable browser CORS.
The Node backend calls it server-side. In another terminal:

```powershell
cd backend
Copy-Item .env.example .env
npm run dev
```

The Node proxy uses `AI_SERVICE_URL` and `AI_SERVICE_TIMEOUT_MS` from its
environment. The browser must call the Node API, not port 8000:

- `POST http://localhost:3000/api/ai/win-probability`
- `POST http://localhost:3000/api/ai/first-innings-score`

Check service readiness and its synthetic-only metrics with
`GET http://127.0.0.1:8000/health` or `/model-info`. Before training, the
health endpoint reports `ready: false` and prediction requests return `503`.
FastAPI's generated schema is available at `http://127.0.0.1:8000/docs`.

### Example win-probability request

```json
{
  "runs": 92,
  "wickets": 3,
  "legal_balls_remaining": 42,
  "target": 171,
  "required_run_rate": 11.29,
  "current_run_rate": 7.08,
  "venue": "Westport Oval",
  "batting_team_strength": 0.6,
  "bowling_team_strength": 0.55
}
```

The response includes `probability_is_calibrated: false`, a model version,
data source, and an explicit limitation statement. Inputs are bounded and
unknown JSON fields are rejected.

### Example first-innings projection request

```json
{
  "runs": 124,
  "wickets": 4,
  "legal_balls": 90,
  "venue": "Westport Oval",
  "team_strength": 0.65
}
```

## Tests

With the virtual environment active and dependencies installed:

```powershell
python -m pytest
```

The tests train a small temporary synthetic model, validate both prediction
schemas and bounds, check that uncalibrated/synthetic qualifiers are returned,
and verify missing-model and invalid-input behavior. The Node backend proxy
has a separate test at `backend/tests/aiProxy.test.js` for server-side
forwarding, request validation, timeout, and downstream failures.

## Production limitations and next steps

Do not use these models to make real-match claims or decisions. Synthetic
features, labels, venue effects, and team-strength values are artificial;
there is no historical validation, leakage analysis, temporal holdout,
probability calibration, or comparison to a real-match predictor.

Before real use:

1. Select a legally licensed, documented ball-by-ball dataset and retain its
   source, license, attribution, and preprocessing steps.
2. Define outcomes and innings-state features against that source; audit
   missing and inconsistent scoring events.
3. Split by match and season/time (not random balls from the same matches) to
   prevent leakage.
4. Compare against a published/simple baseline on untouched real matches;
   report Brier score, log loss, calibration curves, and score MAE/RMSE.
5. Calibrate probabilities on a separate validation set, quantify uncertainty,
   and monitor drift before serving real-game predictions.
6. Replace synthetic strength estimates with documented, leakage-safe
   historical estimates and add authentication/rate limiting if the service
   is deployed beyond a private network.
