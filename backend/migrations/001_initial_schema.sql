CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  short_name TEXT NOT NULL UNIQUE CHECK (length(trim(short_name)) > 0),
  color TEXT NOT NULL CHECK (length(trim(color)) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  role TEXT NOT NULL DEFAULT 'all-rounder'
    CHECK (role IN ('batter', 'bowler', 'all-rounder', 'wicket-keeper')),
  jersey_number INTEGER CHECK (jersey_number IS NULL OR jersey_number >= 0),
  batting_style TEXT,
  bowling_style TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (team_id, jersey_number)
);

CREATE TABLE tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  season TEXT NOT NULL CHECK (length(trim(season)) > 0),
  format TEXT NOT NULL CHECK (format IN ('T20', 'ODI', 'Test', 'T10')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (name, season)
);

CREATE TABLE tournament_registrations (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'withdrawn', 'disqualified')),
  registered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tournament_id, team_id)
);

CREATE TABLE fixtures (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  home_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  away_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  scheduled_at TEXT NOT NULL,
  venue TEXT NOT NULL CHECK (length(trim(venue)) > 0),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'postponed', 'cancelled', 'completed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (home_team_id <> away_team_id)
);

CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE RESTRICT,
  fixture_id TEXT UNIQUE REFERENCES fixtures(id) ON DELETE SET NULL,
  format TEXT NOT NULL CHECK (format IN ('T20', 'ODI', 'Test', 'T10')),
  venue TEXT NOT NULL CHECK (length(trim(venue)) > 0),
  started_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('live', 'upcoming', 'completed', 'abandoned')),
  result TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE match_teams (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  batting_order INTEGER NOT NULL CHECK (batting_order IN (1, 2)),
  PRIMARY KEY (match_id, team_id),
  UNIQUE (match_id, batting_order)
);

CREATE TABLE innings (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  innings_number INTEGER NOT NULL CHECK (innings_number BETWEEN 1 AND 4),
  batting_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  bowling_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'declared', 'forfeited')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (match_id, innings_number),
  CHECK (batting_team_id <> bowling_team_id)
);

CREATE TABLE ball_by_ball_events (
  id TEXT PRIMARY KEY,
  innings_id TEXT NOT NULL REFERENCES innings(id) ON DELETE RESTRICT,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  over_number INTEGER NOT NULL CHECK (over_number >= 0),
  ball_number INTEGER NOT NULL CHECK (ball_number BETWEEN 1 AND 6),
  batter_id TEXT REFERENCES players(id) ON DELETE RESTRICT,
  bowler_id TEXT REFERENCES players(id) ON DELETE RESTRICT,
  non_striker_id TEXT REFERENCES players(id) ON DELETE RESTRICT,
  batter_runs INTEGER NOT NULL DEFAULT 0 CHECK (batter_runs >= 0),
  extra_runs INTEGER NOT NULL DEFAULT 0 CHECK (extra_runs >= 0),
  extras_type TEXT CHECK (extras_type IN ('wide', 'no-ball', 'bye', 'leg-bye')),
  wicket_type TEXT CHECK (
    wicket_type IN ('bowled', 'caught', 'lbw', 'run-out', 'stumped', 'hit-wicket', 'retired-out')
  ),
  player_out_id TEXT REFERENCES players(id) ON DELETE RESTRICT,
  legal_ball INTEGER NOT NULL DEFAULT 1 CHECK (legal_ball IN (0, 1)),
  recorded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (innings_id, sequence_number),
  CHECK (wicket_type IS NULL OR player_out_id IS NOT NULL)
);

CREATE TABLE batting_figures (
  innings_id TEXT NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  runs INTEGER NOT NULL DEFAULT 0 CHECK (runs >= 0),
  balls_faced INTEGER NOT NULL DEFAULT 0 CHECK (balls_faced >= 0),
  fours INTEGER NOT NULL DEFAULT 0 CHECK (fours >= 0),
  sixes INTEGER NOT NULL DEFAULT 0 CHECK (sixes >= 0),
  dismissal TEXT,
  PRIMARY KEY (innings_id, player_id)
);

CREATE TABLE bowling_figures (
  innings_id TEXT NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  legal_balls INTEGER NOT NULL DEFAULT 0 CHECK (legal_balls >= 0),
  runs_conceded INTEGER NOT NULL DEFAULT 0 CHECK (runs_conceded >= 0),
  wickets INTEGER NOT NULL DEFAULT 0 CHECK (wickets >= 0),
  wides INTEGER NOT NULL DEFAULT 0 CHECK (wides >= 0),
  no_balls INTEGER NOT NULL DEFAULT 0 CHECK (no_balls >= 0),
  PRIMARY KEY (innings_id, player_id)
);

CREATE TABLE points_table_entries (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  played INTEGER NOT NULL DEFAULT 0 CHECK (played >= 0),
  won INTEGER NOT NULL DEFAULT 0 CHECK (won >= 0),
  lost INTEGER NOT NULL DEFAULT 0 CHECK (lost >= 0),
  drawn INTEGER NOT NULL DEFAULT 0 CHECK (drawn >= 0),
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  net_run_rate REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tournament_id, team_id),
  CHECK (won + lost + drawn <= played)
);

CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_players_user_id ON players(user_id);
CREATE INDEX idx_registrations_team ON tournament_registrations(team_id);
CREATE INDEX idx_fixtures_tournament_schedule ON fixtures(tournament_id, scheduled_at);
CREATE INDEX idx_fixtures_teams ON fixtures(home_team_id, away_team_id);
CREATE INDEX idx_matches_tournament_status ON matches(tournament_id, status);
CREATE INDEX idx_innings_match ON innings(match_id, innings_number);
CREATE INDEX idx_events_innings_sequence ON ball_by_ball_events(innings_id, sequence_number);
CREATE INDEX idx_events_batter ON ball_by_ball_events(batter_id);
CREATE INDEX idx_events_bowler ON ball_by_ball_events(bowler_id);
CREATE INDEX idx_batting_figures_player ON batting_figures(player_id);
CREATE INDEX idx_bowling_figures_player ON bowling_figures(player_id);
CREATE INDEX idx_points_team ON points_table_entries(team_id);

CREATE TRIGGER ball_events_are_immutable_update
BEFORE UPDATE ON ball_by_ball_events
BEGIN
  SELECT RAISE(ABORT, 'ball-by-ball events are immutable');
END;

CREATE TRIGGER ball_events_are_immutable_delete
BEFORE DELETE ON ball_by_ball_events
BEGIN
  SELECT RAISE(ABORT, 'ball-by-ball events are immutable');
END;
