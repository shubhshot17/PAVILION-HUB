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
npm run dev
```

Migrations create the schema but do not add example teams or players. The
separate `npm run db:seed` command is an explicit, optional demo-data action;
seeded records are marked as demo and hidden from normal frontend lists.

`DATABASE_PATH` defaults to `./data/pavilion.sqlite`, relative to `backend`.
Set it to another writable file path to move the database. `FRONTEND_ORIGIN`
must be the frontend's exact origin; CORS allows that origin only. The default
port is `3000`. Use `npm start` for a normal server process.

During local frontend development, Vite proxies `/api` requests to
`http://127.0.0.1:3000`. Set `API_PROXY_TARGET` before starting Vite to use a
different backend origin. For a deployed or mobile build, set `VITE_API_URL`
to the reachable Node API origin; the Python AI service remains server-side
behind the Node proxy.

The local `.env` and database files are ignored by Git. Keep credentials and
other secrets in environment variables; never commit `.env`.

## Schema and scoring model

The forward-only SQL migrations in `migrations/` are the source of truth.
`npm run db:migrate` applies any migration not already listed in
`schema_migrations`. Back up the SQLite file before making schema changes.

The schema includes:

- `users`, with a unique private email and password hash. No public user route
  is provided.
- `teams` and `players`; a player belongs to a team and may optionally link to
  a user account. Team names and player names are checked for duplicates
  (case-insensitive within a team for players); teams store optional city and
  home-ground details. Players support jersey numbers, role, captain, and
  wicketkeeper flags, with at most one captain and wicketkeeper per team.
- `tournaments` and `tournament_registrations`, with a unique registration
  per team and tournament.
- `fixtures`, linked to a tournament and two different teams; `matches` may
  link to a fixture and always belong to a tournament.
- `match_teams`, which records the two sides and batting order.
- `match_setup` and `match_players`, which persist innings overs, toss details,
  each team's playing XI, captain, and wicketkeeper.
- `innings`, linked to a match and its batting/bowling teams.
- `ball_by_ball_events`, one immutable row per delivery, with a per-innings
  sequence number, runs, extras, wickets, players, and timestamp. Database
  triggers reject updates and deletes so the scoring record remains auditable.
- `scoring_sessions`, which persist the current scoring state and optimistic
  version; `scoring_delivery_details`, which records each complete delivery
  and the before/after state snapshots; and `scoring_event_undos`, which marks
  reversed deliveries without deleting or editing the immutable event ledger.
- `batting_figures` and `bowling_figures`, transactionally updated alongside
  each event and rebuilt from active deliveries when a delivery is undone.
- `points_table_entries`, keyed by tournament and team.

Foreign keys, check constraints, unique constraints, and indexes are defined
in the migration. Event insertion and derived figures run in one database
transaction. Scorecards calculate the innings totals from the event ledger.
Undo is an auditable correction: the original delivery remains unchanged and a
separate undo row excludes it from the current scorecard and figures. The
session version prevents two scorers from silently overwriting each other's
state.

When a match result is recorded, normal innings totals are refreshed from the
event ledger and marked complete so the standings engine can calculate NRR.
Tied and abandoned results clear any winner; a winner and player of the match
must belong to the match. Scoring events are rejected after a match is finished.

## Endpoints

- `GET /api/health`
- `GET|POST /api/teams`; `GET|PATCH|DELETE /api/teams/:id`;
  `GET /api/teams/:id/profile`
- `GET|POST /api/players`; `GET|PATCH|DELETE /api/players/:id`;
  `GET /api/players?teamId=:teamId`
- `GET|POST /api/tournaments`; `GET|PATCH|DELETE /api/tournaments/:id`
- `GET|POST /api/matches`; `GET|PATCH|DELETE /api/matches/:id`
- `GET /api/matches/:id/scorecard`
- `GET /api/matches/:id/scoring`
- `POST /api/matches/:id/scoring/start`
- `POST /api/matches/:id/scoring/deliveries`
- `POST /api/matches/:id/scoring/bowler`
- `POST /api/matches/:id/scoring/undo`
- `GET|POST /api/scoring-events`; `GET /api/scoring-events/:id`
- `POST /api/ai/win-probability`
- `POST /api/ai/first-innings-score`

Create teams and at least 11 players for each side before creating a match
with setup. Match requests can use an existing `tournamentId`; when omitted,
the backend assigns the match to a system-managed friendly tournament for its
format and season. These system tournaments are excluded from the user
tournament list. Setup requires a supported format, an innings overs limit
(maximum 10 for T10, 20 for T20, or 50 for ODI), two different teams, exactly
11 distinct players belonging to each team, and a captain and wicketkeeper
selected from each XI. Toss winner must also be one of the match teams.

Matches can be edited while upcoming and before scoring begins; setup and team
selection are locked once innings start. Scoring-event requests retain
`matchId`, `innings`, `over`, `ball`, `runs`, and `eventType`; optional batter,
bowler, non-striker, and dismissal fields contribute to the public scorecard.

The scoring screen uses the saved match setup and playing XIs. Its scoring
session stores the score, innings, deliveries, and bowler changes in SQLite;
selecting that match again after a browser refresh or backend restart restores
the saved state. Each delivery is also written to the immutable event ledger.
The scorer can record batter runs, wides, no-balls, byes, leg-byes, and wickets.
Wide and no-ball penalty runs are automatic; additional completed runs are
entered separately. No-balls count as a ball faced by the batter but do not
count as a legal over ball. No-ball byes and leg-byes are separately attributed
to extras and are not charged to the bowler. A run-out records the dismissed
batter and whether the batters crossed before the wicket was broken. Bowler selections are limited
to the saved bowling XI, prohibit consecutive overs, and enforce the maximum
overs-per-bowler limit for the configured limited-overs match.

The current score model targets T10, T20, and ODI-style two-innings matches.
It does not implement Test-match innings, declarations, follow-ons, DLS,
super-overs, penalty runs, two batters dismissed on one delivery, or the full
set of rare dismissal/run-crossing edge cases. Scoring has no authentication or
multi-user role system yet; version conflicts are rejected rather than
automatically merged.

Scoring events are append-only: `PATCH` and `DELETE` on an event return `405`.
Player and scorecard responses include public player details only, never
account email, password hash, or user-account IDs.

All errors use `{ "error": { "message": "..." } }`. Invalid input returns
`400`, missing records return `404`, uniqueness conflicts return `409`, and a
successful create returns `201`.

Team creation requires a name; short name and color have safe generated/default
values, and city and home ground are optional. Players require a team and name;
role, jersey number, captain, and wicketkeeper are optional. A team or player
cannot be deleted while it is referenced by players, tournaments, or recorded
match data. Remove dependent records first; recorded score events are
intentionally immutable.

## Seed and persistence check

The optional idempotent seed command creates demo teams, players, a tournament,
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
- `migrations/003_team_player_management.sql`: captain/wicketkeeper fields,
  per-team role constraints, and marks legacy seed records as demo.
- `migrations/004_match_setup.sql`, `migrations/005_persistent_scoring.sql`:
  persistent match settings, playing XIs, scoring sessions, event snapshots,
  and audit-preserving undo.
- `db/seed.js`: repeatable development/demo records.
- `models/index.js`: persistent repositories, event ledger, scoring-session
  versioning and undo, figures, and scorecard reconstruction.
- `controllers/validators.js`, `controllers/*Controller.js`: request and
  resource validation, including public scorecards.
- `routes/resourceRoutes.js`, `app.js`, `server.js`: scorecard route,
  database-aware API startup, and health endpoint.
- `middleware/errorHandler.js`: consistent database and HTTP error responses.
- `controllers/aiController.js`, `routes/ai.js`: validated, timeout-bounded
  server-side proxy for the separate Python prediction service.
- `tests/persistence.test.js`: API integration and restart-persistence test.
- `tests/teamPlayerManagement.test.js`: team/player CRUD, duplicate validation,
  role constraints, and protected deletion integration tests.
- `tests/matchSetup.test.js`: match creation, playing-XI validation, listing,
  editing, and persistence after reopening the database.
- `tests/scoringSession.test.js`: saved-match delivery validation, score
  persistence, undo auditing, and database reopen verification.
- `tests/aiProxy.test.js`: Node-to-AI proxy, validation, timeout, and failure tests.
- `routes/matches.js`: scoring-session, delivery, bowler selection, and undo
  endpoints.
- `.gitignore`: local SQLite database and journal files.
- `README.md`: database choice, schema, setup, persistence verification, and
  this changed-file guide.
- `python-ai-service/`: isolated FastAPI/scikit-learn service, synthetic-only
  training/evaluation pipeline, schemas, tests, and its README.
- `frontend/src/scoring/engine.ts`, `engine.test.ts`: innings transitions,
  delivery rules, extras, dismissals, strike rotation, and undo.
- `frontend/src/pages/ScoreScreen.tsx`, `ScoreScreen.css`: saved-match
  selection, persistent scoring controls, and responsive scoring UI.
- `frontend/src/services/api.ts`, `frontend/src/types.ts`,
  `frontend/src/components/Sidebar.tsx`: scoring-session API/types and
  navigation.
