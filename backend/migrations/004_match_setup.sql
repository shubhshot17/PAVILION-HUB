ALTER TABLE tournaments ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0
  CHECK (is_system IN (0, 1));

CREATE TABLE match_setup (
  match_id TEXT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  overs_per_innings INTEGER NOT NULL CHECK (overs_per_innings BETWEEN 1 AND 50),
  toss_winner_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  toss_decision TEXT NOT NULL CHECK (toss_decision IN ('bat', 'field'))
);

CREATE TABLE match_players (
  match_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  is_captain INTEGER NOT NULL DEFAULT 0 CHECK (is_captain IN (0, 1)),
  is_wicketkeeper INTEGER NOT NULL DEFAULT 0 CHECK (is_wicketkeeper IN (0, 1)),
  PRIMARY KEY (match_id, team_id, player_id),
  FOREIGN KEY (match_id, team_id)
    REFERENCES match_teams(match_id, team_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_match_players_captain
  ON match_players(match_id, team_id) WHERE is_captain = 1;
CREATE UNIQUE INDEX idx_match_players_wicketkeeper
  ON match_players(match_id, team_id) WHERE is_wicketkeeper = 1;
CREATE INDEX idx_match_players_player ON match_players(player_id);
CREATE INDEX idx_match_setup_toss_winner ON match_setup(toss_winner_team_id);
