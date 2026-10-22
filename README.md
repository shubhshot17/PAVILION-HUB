# PAVILION HUB

PAVILION HUB is a cricket tournament management and live ball-by-ball scoring
platform. It consists of three parts:

| Part | Stack | Location |
| ---- | ----- | -------- |
| Web / Android frontend | React 19, TypeScript, Vite, Capacitor | `frontend/` |
| REST API backend | Node.js, Express, SQLite (`better-sqlite3`) | `backend/` |
| AI prediction service | Python, FastAPI, scikit-learn | `python-ai-service/` |

## Features

- Teams, players, tournaments, fixtures, and matches management.
- Append-only ball-by-ball event ledger with transactional batting/bowling
  figures and reconstructed scorecards.
- Points table per tournament.
- Experimental AI predictions (win probability, first-innings score) served by
  a separate Python service and proxied server-side through the Node API.
  **These models are trained on synthetic data only — see
  [`python-ai-service/README.md`](python-ai-service/README.md).**
- Capacitor wrapper for building a native Android app from the same web build
  (see [`frontend/ANDROID.md`](frontend/ANDROID.md)).

## Repository layout

```
frontend/               React + Vite web app and Capacitor Android shell
  android/              Native Android project (Gradle)
backend/                Express API, SQLite migrations, seed, tests
python-ai-service/      FastAPI + scikit-learn prediction service
```

## Prerequisites

- Node.js 20+
- Python 3.12 (recommended) for the AI service
- For Android builds: Android Studio Ladybug+, JDK 17, Android SDK 36

## Quick start (PowerShell)

### 1. Backend API (port 3000)

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

The SQLite database is created at `backend/data/pavilion.sqlite`. `npm test`
runs API integration, persistence, and AI-proxy tests.

### 2. Frontend (Vite dev server)

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local   # set VITE_API_URL if needed
npm run dev
```

### 3. Python AI service (port 8000, optional)

```powershell
cd python-ai-service
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m training.train --output artifacts/models.joblib --samples 20000
python -m uvicorn app.main:app --env-file .env --host 127.0.0.1 --port 8000
```

The Node backend proxies AI requests server-side; the browser only talks to
port 3000 (`POST /api/ai/win-probability`, `POST /api/ai/first-innings-score`).

## Key API endpoints

- `GET /api/health`
- `GET|POST /api/teams`, `GET|PATCH|DELETE /api/teams/:id`
- `GET|POST /api/players`, `GET|PATCH|DELETE /api/players/:id`
- `GET|POST /api/tournaments`, `GET|PATCH|DELETE /api/tournaments/:id`
- `GET|POST /api/matches`, `GET|PATCH|DELETE /api/matches/:id`
- `GET /api/matches/:id/scorecard`
- `GET|POST /api/scoring-events` (append-only; PATCH/DELETE return 405)
- `POST /api/ai/win-probability`, `POST /api/ai/first-innings-score`

Errors are always `{ "error": { "message": "..." } }`. Full schema and scoring
model details are in [`backend/README.md`](backend/README.md).

## Android app

```powershell
cd frontend
npm run android:apk     # build + cap sync + gradlew assembleDebug
```

The debug APK lands at
`frontend\android\app\build\outputs\apk\debug\app-debug.apk`. Setup
requirements, device testing checklist, API URL handling on devices, and
release signing are covered in [`frontend/ANDROID.md`](frontend/ANDROID.md).

## Documentation

- [`backend/README.md`](backend/README.md) — database choice, schema,
  migrations, endpoints, persistence verification.
- [`frontend/ANDROID.md`](frontend/ANDROID.md) — Capacitor/Android build,
  testing, signing, and troubleshooting.
- [`python-ai-service/README.md`](python-ai-service/README.md) — models,
  synthetic-data limitations, training and API usage.

## Notes

- Keep secrets in environment variables; never commit `.env` or keystore files.
- Scoring events are immutable (database triggers reject updates and deletes)
  so the scoring record stays auditable.
- There is no correction-event workflow yet; treat event data as final.
