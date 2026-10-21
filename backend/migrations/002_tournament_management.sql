-- ============================================================
-- 002_tournament_management.sql
-- Adds tournament-management columns and new tables.
-- All ALTER TABLE statements use SQLite's supported subset.
-- ============================================================

-- ── tournaments ──────────────────────────────────────────────
ALTER TABLE tournaments ADD COLUMN tournament_type TEXT NOT NULL DEFAULT 'round_robin'
  CHECK (tournament_type IN ('round_robin', 'knockout', 'round_robin_knockout'));
ALTER TABLE tournaments ADD COLUMN overs_per_innings INTEGER NOT NULL DEFAULT 20
  CHECK (overs_per_innings > 0);
ALTER TABLE tournaments ADD COLUMN win_points    INTEGER NOT NULL DEFAULT 2 CHECK (win_points    >= 0);
ALTER TABLE tournaments ADD COLUMN tie_points    INTEGER NOT NULL DEFAULT 1 CHECK (tie_points    >= 0);
ALTER TABLE tournaments ADD COLUMN no_result_points INTEGER NOT NULL DEFAULT 1 CHECK (no_result_points >= 0);
ALTER TABLE tournaments ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1));

-- ── fixtures ─────────────────────────────────────────────────
ALTER TABLE fixtures ADD COLUMN stage        TEXT NOT NULL DEFAULT 'League';
ALTER TABLE fixtures ADD COLUMN round_number INTEGER NOT NULL DEFAULT 1 CHECK (round_number >= 1);
ALTER TABLE fixtures ADD COLUMN bracket_slot INTEGER;
-- Back-reference to the actual match played for this fixture
ALTER TABLE fixtures ADD COLUMN linked_match_id TEXT REFERENCES matches(id) ON DELETE SET NULL;
ALTER TABLE fixtures ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1));

-- ── matches ──────────────────────────────────────────────────
ALTER TABLE matches ADD COLUMN player_of_the_match_id TEXT REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN win_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN is_tie      INTEGER NOT NULL DEFAULT 0 CHECK (is_tie      IN (0, 1));
ALTER TABLE matches ADD COLUMN is_abandoned INTEGER NOT NULL DEFAULT 0 CHECK (is_abandoned IN (0, 1));
ALTER TABLE matches ADD COLUMN is_demo     INTEGER NOT NULL DEFAULT 0 CHECK (is_demo     IN (0, 1));

-- ── innings (denormalised totals used by NRR engine) ─────────
-- Kept in sync by the model whenever scoring events are saved.
ALTER TABLE innings ADD COLUMN total_runs   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE innings ADD COLUMN wickets      INTEGER NOT NULL DEFAULT 0;
-- overs_faced stored as fractional decimal (e.g. 19.3 = 19 overs 3 balls)
ALTER TABLE innings ADD COLUMN overs_faced  REAL NOT NULL DEFAULT 0.0;
ALTER TABLE innings ADD COLUMN is_all_out   INTEGER NOT NULL DEFAULT 0 CHECK (is_all_out IN (0, 1));

-- ── teams ────────────────────────────────────────────────────
ALTER TABLE teams ADD COLUMN city        TEXT;
ALTER TABLE teams ADD COLUMN home_ground TEXT;
ALTER TABLE teams ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1));

-- ── players ──────────────────────────────────────────────────
ALTER TABLE players ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1));

-- ── partnerships ─────────────────────────────────────────────
CREATE TABLE partnerships (
  id             TEXT PRIMARY KEY,
  innings_id     TEXT NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  wicket_number  INTEGER NOT NULL CHECK (wicket_number BETWEEN 1 AND 11),
  batter1_id     TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  batter2_id     TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  runs           INTEGER NOT NULL DEFAULT 0 CHECK (runs >= 0),
  balls          INTEGER NOT NULL DEFAULT 0 CHECK (balls >= 0),
  is_unbroken    INTEGER NOT NULL DEFAULT 0 CHECK (is_unbroken IN (0, 1)),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (innings_id, wicket_number)
);

CREATE INDEX idx_partnerships_innings ON partnerships(innings_id);
CREATE INDEX idx_matches_potm         ON matches(player_of_the_match_id);
CREATE INDEX idx_matches_win_team     ON matches(win_team_id);
CREATE INDEX idx_fixtures_linked      ON fixtures(linked_match_id);

