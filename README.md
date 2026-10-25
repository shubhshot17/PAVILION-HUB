# PAVILION HUB

Simple cricket tournament scoring, in the spirit of CricHeroes: create a
tournament, add teams and players, score matches ball by ball, and share one
link with your WhatsApp group so everyone can follow live scores, the points
table and player stats.

| Part | Stack | Folder |
| ---- | ----- | ------ |
| Web app (+ optional Android shell) | React 19, TypeScript, Vite, Tailwind, shadcn/ui | `frontend/` |
| API | Node.js 22, Express 5, MongoDB | `backend/` |

## Features

- **Tournaments** with teams, fixtures, a points table (2 pts per win, net run rate) and leaderboards.
- **Teams & players** with roles and batting/bowling styles.
- **Ball-by-ball scoring**: runs, wides, no-balls, byes, leg-byes, every kind of dismissal, undo, swap strike,
  and prompts for the next batter, the next bowler and the innings break.
- **Scorecards** with batting, bowling, extras, fall of wickets and over-by-over history.
- **Player profiles** with career batting and bowling stats.
- **Share link** (`/t/<code>`): a read-only public page with live scores, table, stats and squads.

Scorecards, results, tables and stats are all calculated from the stored balls
(`backend/lib/scoring.js`), so undo is always safe.

## Run locally

Requires Node.js 22+ and a MongoDB database (MongoDB Atlas free tier works).

```bash
npm run install:all
cp backend/.env.example backend/.env   # then set MONGODB_URI
npm run seed                           # optional: mock tournament, 4 teams, matches
npm run dev                            # API on :3000, web app on :5173
```

Open http://localhost:5173.

`npm run seed -- --clear` removes the mock data again (teams your own matches
use are kept). `npm test` runs the backend and frontend tests.

### Environment (`backend/.env`)

| Variable | Purpose |
| -------- | ------- |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | Database name (default `pavilion_hub`); use one just for this app |
| `PORT` | API port (default 3000; hosts usually set this for you) |
| `FRONTEND_ORIGIN` | Allowed origin for the Vite dev server (default `http://localhost:5173`) |

## Deploy (one service)

In production the API also serves the built web app, so you deploy a single
Node service and share links work on the same address.

- **Build command:** `npm run build`
- **Start command:** `npm start`
- **Environment:** `MONGODB_URI`, `MONGODB_DB`

This works on Render, Railway, Fly.io or any VPS. On MongoDB Atlas, allow the
host's IP under *Network Access*.

> There is no login yet: the public share pages are read-only, but the API
> itself is open. Add authentication before running a real tournament.

## Android

The `frontend/` folder includes a Capacitor shell for an Android app. See
[`frontend/ANDROID.md`](frontend/ANDROID.md).

## Project layout

```
backend/
  lib/        scoring engine, points table, stats (pure functions)
  services/   match lifecycle + data shaping
  routes/     REST endpoints under /api
  db/         MongoDB connection and the mock-data seed
  tests/      node:test suites (engine + API on in-memory MongoDB)
frontend/src/
  pages/      admin screens and public share pages
  views/      screens shared by admin and public pages
  components/ layout, cards, tables, shadcn/ui primitives
  lib/        API client, types, formatting
```
