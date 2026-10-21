ALTER TABLE players ADD COLUMN is_captain INTEGER NOT NULL DEFAULT 0
  CHECK (is_captain IN (0, 1));
ALTER TABLE players ADD COLUMN is_wicketkeeper INTEGER NOT NULL DEFAULT 0
  CHECK (is_wicketkeeper IN (0, 1));

CREATE UNIQUE INDEX idx_players_one_captain_per_team
  ON players(team_id) WHERE is_captain = 1;
CREATE UNIQUE INDEX idx_players_one_wicketkeeper_per_team
  ON players(team_id) WHERE is_wicketkeeper = 1;

UPDATE teams SET is_demo = 1
WHERE id IN ('demo-team-rangers', 'demo-team-falcons');
UPDATE players SET is_demo = 1
WHERE id IN ('demo-player-ranger', 'demo-player-falcon');
UPDATE tournaments SET is_demo = 1 WHERE id = 'demo-tournament';
UPDATE fixtures SET is_demo = 1 WHERE id = 'demo-fixture';
UPDATE matches SET is_demo = 1 WHERE id = 'demo-match';
