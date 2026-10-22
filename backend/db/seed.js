import { database } from './database.js'

database.transaction(() => {
  database.exec(`
    INSERT OR IGNORE INTO teams (id, name, short_name, color, is_demo) VALUES
      ('demo-team-rangers', 'Westport Rangers', 'WPR', '#c6f24e', 1),
      ('demo-team-falcons', 'Eastvale Falcons', 'EVF', '#7fd8ff', 1);

    INSERT OR IGNORE INTO players (id, team_id, name, role, jersey_number, is_demo) VALUES
      ('demo-player-ranger', 'demo-team-rangers', 'Alex Rivers', 'batter', 7, 1),
      ('demo-player-falcon', 'demo-team-falcons', 'Sam Taylor', 'bowler', 12, 1);

    INSERT OR IGNORE INTO tournaments (id, name, season, format, is_active, is_demo)
    VALUES ('demo-tournament', 'National Premier T20 Cup', '2026', 'T20', 1, 1);

    INSERT OR IGNORE INTO tournament_registrations (id, tournament_id, team_id) VALUES
      ('demo-registration-rangers', 'demo-tournament', 'demo-team-rangers'),
      ('demo-registration-falcons', 'demo-tournament', 'demo-team-falcons');

    INSERT OR IGNORE INTO fixtures (
      id, tournament_id, home_team_id, away_team_id, scheduled_at, venue, status, is_demo
    ) VALUES (
      'demo-fixture', 'demo-tournament', 'demo-team-rangers', 'demo-team-falcons',
      '2026-10-21T19:00:00Z', 'Westport Oval', 'completed', 1
    );

    INSERT OR IGNORE INTO matches (
      id, tournament_id, fixture_id, format, venue, started_at, status, result, is_demo
    ) VALUES (
      'demo-match', 'demo-tournament', 'demo-fixture', 'T20', 'Westport Oval',
      '2026-10-21T19:00:00Z', 'completed', 'Westport Rangers won by 4 runs', 1
    );

    UPDATE matches
    SET win_team_id = 'demo-team-rangers'
    WHERE id = 'demo-match';

    INSERT OR IGNORE INTO match_teams (match_id, team_id, batting_order) VALUES
      ('demo-match', 'demo-team-rangers', 1),
      ('demo-match', 'demo-team-falcons', 2);

    INSERT OR IGNORE INTO innings (
      id, match_id, innings_number, batting_team_id, bowling_team_id, status
    ) VALUES
      ('demo-innings-one', 'demo-match', 1, 'demo-team-rangers', 'demo-team-falcons', 'completed'),
      ('demo-innings-two', 'demo-match', 2, 'demo-team-falcons', 'demo-team-rangers', 'completed');

    INSERT OR IGNORE INTO ball_by_ball_events (
      id, innings_id, sequence_number, over_number, ball_number, batter_id, bowler_id,
      batter_runs, legal_ball
    ) VALUES
      ('demo-event-one', 'demo-innings-one', 1, 0, 1, 'demo-player-ranger', 'demo-player-falcon', 4, 1),
      ('demo-event-two', 'demo-innings-two', 1, 0, 1, 'demo-player-falcon', 'demo-player-ranger', 0, 1);

    INSERT OR IGNORE INTO batting_figures (innings_id, player_id, runs, balls_faced, fours, sixes)
    VALUES ('demo-innings-one', 'demo-player-ranger', 4, 1, 1, 0);

    INSERT OR IGNORE INTO bowling_figures (innings_id, player_id, legal_balls, runs_conceded)
    VALUES ('demo-innings-one', 'demo-player-falcon', 1, 4);

    INSERT OR IGNORE INTO points_table_entries (
      tournament_id, team_id, played, won, lost, points, net_run_rate
    ) VALUES
      ('demo-tournament', 'demo-team-rangers', 1, 1, 0, 2, 0.2),
      ('demo-tournament', 'demo-team-falcons', 1, 0, 1, 0, -0.2);
  `)
})()

console.log('Demo teams, players, tournament, fixture, match, innings, events, figures, and standings are ready.')
database.close()
