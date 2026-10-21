# PAVILION HUB API

## Database choice

This backend uses SQLite through `better-sqlite3`. It is free, has no server
to install, and stores the development database in one local file. It is a
good fit for a single-instance development/demo backend. SQLite files must not
be placed on ephemeral hosting storage or shared concurrently between multiple
server instances.

For a hosted, multi-instance deployment, PostgreSQL is the recommended next
step. Neon offers a free PostgreSQL plan (check its current limits). Neon is
not a drop-in `DATABASE_PATH` value: this code currently uses SQLite and would
need a PostgreSQL adapter and equivalent migrations before connecting to it.

## Install and configure

Run these commands in `backend`:

```powershell
npm install
Copy-Item .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

`DATABASE_PATH` defaults to `./data/pavilion.sqlite`, relative to `backend`.
Set it to another writable file path to move the database. `FRONTEND_ORIGIN`
must be the frontend's exact origin; CORS allows that origin only. The default
port is `3000`. Use `npm start` for a normal server process.

The local `.env` and database files are ignored by Git. Keep credentials and
other secrets in environment variables; never commit `.env`.

## Schema and scoring model

The forward-only SQL migration in `migrations/001_initial_schema.sql` is the
source of truth. `npm run db:migrate` applies any migration not already listed
in `schema_migrations`. Back up the SQLite file before making schema changes.

The schema includes:

- `users`, with a unique private email and password hash. No public user route
  is provided.
- `teams` and `players`; a player belongs to a team and may optionally link to
  a user account.
- `tournaments` and `tournament_registrations`, with a unique registration
  per team and tournament.
- `fixtures`, linked to a tournament and two different teams; `matches` may
  link to a fixture and always belong to a tournament.
- `match_teams`, which records the two sides and batting order.
- `innings`, linked to a match and its batting/bowling teams.
- `ball_by_ball_events`, one immutable row per delivery, with a per-innings
  sequence number, runs, extras, wickets, players, and timestamp. Database
  triggers reject updates and deletes so the scoring record remains auditable.
- `batting_figures` and `bowling_figures`, transactionally updated alongside
  each event.
- `points_table_entries`, keyed by tournament and team.

Foreign keys, check constraints, unique constraints, and indexes are defined
in the migration. Event insertion and derived figures run in one database
transaction. Scorecards calculate the innings totals from the event ledger.
There is not yet a correction-event workflow; events cannot be silently edited
or deleted.

## Endpoints

- `GET /api/health`
- `GET|POST /api/teams`; `GET|PATCH|DELETE /api/teams/:id`
- `GET|POST /api/players`; `GET|PATCH|DELETE /api/players/:id`
- `GET|POST /api/tournaments`; `GET|PATCH|DELETE /api/tournaments/:id`
- `GET|POST /api/matches`; `GET|PATCH|DELETE /api/matches/:id`
- `GET /api/matches/:id/scorecard`
- `GET|POST /api/scoring-events`; `GET /api/scoring-events/:id`
- `POST /api/ai/win-probability`
- `POST /api/ai/first-innings-score`

Create a tournament and its teams before creating a match. Match requests
continue to accept the existing `tournament`, `format`, `venue`, `date`,
`status`, and two-team fields; include `tournamentId` when tournament names
are not unique across seasons. Create players before including their IDs on
scoring events. Event input retains `matchId`, `innings`, `over`, `ball`,
`runs`, and `eventType`; optional batter, bowler, non-striker, and dismissal
fields contribute to the public scorecard figures.

Scoring events are append-only: `PATCH` and `DELETE` on an event return `405`.
Player and scorecard responses include public player details only, never
account email, password hash, or user-account IDs.

All errors use `{ "error": { "message": "..." } }`. Invalid input returns
`400`, missing records return `404`, uniqueness conflicts return `409`, and a
successful create returns `201`.

## Seed and persistence check

The idempotent seed command creates demo teams, players, a tournament,
registrations, a fixture, a match, innings, ball events, figures, and points
table rows. Check the demo scorecard:

```powershell
Invoke-RestMethod http://localhost:3000/api/matches/demo-match/scorecard
```

To verify persistence manually, create a team through `POST /api/teams`, note
its returned `id`, stop the server, restart with `npm run dev`, and request
`GET /api/teams/:id`. The record remains because it is in the SQLite file. The
automated test also closes and reopens a temporary database and verifies the
match, event, and reconstructed score remain.

Run tests with `npm test`.

## Changed-file guide

- `package.json`, `package-lock.json`: SQLite dependency and migration, seed,
  and test scripts.
- `.env.example`, `config.js`: database path and environment configuration.
- `migrations/001_initial_schema.sql`, `db/database.js`, `db/migrate.js`:
  versioned schema and migration runner.
- `db/seed.js`: repeatable development/demo records.
- `models/index.js`: persistent repositories, event ledger, figures, and
  scorecard reconstruction; replaces the previous in-memory store.
- `controllers/validators.js`, `controllers/*Controller.js`: request and
  resource validation, including public scorecards.
- `routes/resourceRoutes.js`, `app.js`, `server.js`: scorecard route,
  database-aware API startup, and health endpoint.
- `middleware/errorHandler.js`: consistent database and HTTP error responses.
- `controllers/aiController.js`, `routes/ai.js`: validated, timeout-bounded
  server-side proxy for the separate Python prediction service.
- `tests/persistence.test.js`: API integration and restart-persistence test.
- `tests/aiProxy.test.js`: Node-to-AI proxy, validation, timeout, and failure tests.
- `.gitignore`: local SQLite database and journal files.
- `README.md`: database choice, schema, setup, persistence verification, and
  this changed-file guide.
- `python-ai-service/`: isolated FastAPI/scikit-learn service, synthetic-only
  training/evaluation pipeline, schemas, tests, and its README.
