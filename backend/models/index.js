import { randomUUID } from 'node:crypto'
import { database } from '../db/database.js'
import { HttpError } from '../middleware/errorHandler.js'

const id = () => randomUUID()

function teamRecord(row) {
  return row && {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    color: row.color,
    ...(row.city ? { city: row.city } : {}),
    ...(row.home_ground ? { homeGround: row.home_ground } : {}),
    isDemo: Boolean(row.is_demo ?? 0),
  }
}

function playerRecord(row) {
  return row && {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    role: row.role,
    ...(row.jersey_number === null || row.jersey_number === undefined
      ? {} : { jerseyNumber: row.jersey_number }),
    ...(row.batting_style ? { battingStyle: row.batting_style } : {}),
    ...(row.bowling_style ? { bowlingStyle: row.bowling_style } : {}),
    isCaptain: Boolean(row.is_captain ?? 0),
    isWicketkeeper: Boolean(row.is_wicketkeeper ?? 0),
    isActive: Boolean(row.is_active ?? 1),
    isDemo: Boolean(row.is_demo ?? 0),
  }
}

function tournamentRecord(row) {
  return row && {
    id: row.id,
    name: row.name,
    season: row.season,
    format: row.format,
    isActive: Boolean(row.is_active),
  }
}

function findTournament(data) {
  if (data.tournamentId) {
    const tournament = database.prepare('SELECT * FROM tournaments WHERE id = ?').get(data.tournamentId)
    if (!tournament) {
      throw new HttpError(400, 'tournamentId must reference an existing tournament')
    }
    return tournament
  }

  if (data.tournament) {
    const matches = database.prepare('SELECT * FROM tournaments WHERE name = ?').all(data.tournament)
    if (matches.length !== 1) {
      throw new HttpError(400, matches.length
        ? 'tournamentId is required when the tournament name is not unique'
        : 'tournament must reference an existing tournament')
    }
    return matches[0]
  }

  const season = String(new Date(data.date).getFullYear())
  const name = `Friendly ${data.format} Matches`
  let tournament = database.prepare(`
    SELECT * FROM tournaments WHERE name = ? AND season = ? AND is_system = 1
  `).get(name, season)
  if (!tournament) {
    const tournamentId = id()
    database.prepare(`
      INSERT INTO tournaments (
        id, name, season, format, is_active, is_system
      ) VALUES (?, ?, ?, ?, 0, 1)
    `).run(tournamentId, name, season, data.format)
    tournament = database.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId)
  }
  return tournament
}

function getMatchSetup(matchId) {
  const setup = database.prepare('SELECT * FROM match_setup WHERE match_id = ?').get(matchId)
  if (!setup) return undefined
  const playingXIs = database.prepare(`
    SELECT mp.team_id, mp.player_id, mp.is_captain, mp.is_wicketkeeper, p.name
    FROM match_players mp
    JOIN players p ON p.id = mp.player_id
    WHERE mp.match_id = ?
    ORDER BY mp.team_id, mp.player_id
  `).all(matchId)
  const grouped = new Map()
  for (const row of playingXIs) {
    if (!grouped.has(row.team_id)) {
      grouped.set(row.team_id, {
        teamId: row.team_id,
        playerIds: [],
        selectedPlayers: [],
        captainId: null,
        captainName: null,
        wicketkeeperId: null,
        wicketkeeperName: null,
      })
    }
    const xi = grouped.get(row.team_id)
    xi.playerIds.push(row.player_id)
    xi.selectedPlayers.push({ id: row.player_id, name: row.name })
    if (row.is_captain) {
      xi.captainId = row.player_id
      xi.captainName = row.name
    }
    if (row.is_wicketkeeper) {
      xi.wicketkeeperId = row.player_id
      xi.wicketkeeperName = row.name
    }
  }
  return {
    oversPerInnings: setup.overs_per_innings,
    tossWinnerTeamId: setup.toss_winner_team_id,
    tossDecision: setup.toss_decision,
    playingXIs: [...grouped.values()],
  }
}

function persistMatchSetup(matchId, teamIds, setup) {
  if (!setup) return
  const setupTeams = new Set()
  for (const xi of setup.playingXIs) {
    if (setupTeams.has(xi.teamId)) {
      throw new HttpError(400, 'A team may only have one playing XI')
    }
    setupTeams.add(xi.teamId)
    if (!teamIds.includes(xi.teamId)) {
      throw new HttpError(400, 'Every playing XI must belong to a match team')
    }
    const players = database.prepare(`
      SELECT id, team_id FROM players WHERE id IN (${xi.playerIds.map(() => '?').join(',')})
    `).all(...xi.playerIds)
    if (players.length !== xi.playerIds.length
      || players.some((player) => player.team_id !== xi.teamId)) {
      throw new HttpError(400, `Every selected player must belong to team ${xi.teamId}`)
    }
  }
  if (setupTeams.size !== 2) {
    throw new HttpError(400, 'A playing XI is required for each match team')
  }

  database.prepare(`
    INSERT INTO match_setup (match_id, overs_per_innings, toss_winner_team_id, toss_decision)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(match_id) DO UPDATE SET
      overs_per_innings = excluded.overs_per_innings,
      toss_winner_team_id = excluded.toss_winner_team_id,
      toss_decision = excluded.toss_decision
  `).run(matchId, setup.oversPerInnings, setup.tossWinnerTeamId, setup.tossDecision)
  database.prepare('DELETE FROM match_players WHERE match_id = ?').run(matchId)
  const insertPlayer = database.prepare(`
    INSERT INTO match_players (match_id, team_id, player_id, is_captain, is_wicketkeeper)
    VALUES (?, ?, ?, ?, ?)
  `)
  for (const xi of setup.playingXIs) {
    for (const playerId of xi.playerIds) {
      insertPlayer.run(
        matchId, xi.teamId, playerId,
        Number(playerId === xi.captainId),
        Number(playerId === xi.wicketkeeperId),
      )
    }
  }
}

function getMatch(idValue) {
  const row = database.prepare(`
    SELECT m.*, t.name AS tournament_name, t.season AS tournament_season
    FROM matches m
    JOIN tournaments t ON t.id = m.tournament_id
    WHERE m.id = ?
  `).get(idValue)
  if (!row) {
    return null
  }

  const teams = database.prepare(`
    SELECT t.id, t.name, t.short_name, t.color
    FROM match_teams mt
    JOIN teams t ON t.id = mt.team_id
    WHERE mt.match_id = ?
    ORDER BY mt.batting_order
  `).all(idValue).map(teamRecord)

  const setup = getMatchSetup(idValue)
  // Live/completed matches display their score from the persisted innings ledger.
  const inningsRows = database.prepare(`
    SELECT batting_team_id,
      COALESCE(SUM(e.batter_runs + e.extra_runs), 0) AS runs,
      COALESCE(SUM(CASE WHEN e.wicket_type IS NOT NULL THEN 1 ELSE 0 END), 0) AS wickets,
      COALESCE(SUM(e.legal_ball), 0) AS legal_balls
    FROM innings i
    LEFT JOIN ball_by_ball_events e ON e.innings_id = i.id
      AND NOT EXISTS (SELECT 1 FROM scoring_event_undos u WHERE u.event_id = e.id)
    WHERE i.match_id = ?
    GROUP BY i.id
    ORDER BY i.innings_number
  `).all(idValue)
  const scores = inningsRows.length
    ? inningsRows.map((innings) => ({
        teamId: innings.batting_team_id,
        runs: innings.runs,
        wickets: innings.wickets,
        overs: Math.floor(innings.legal_balls / 6) + (innings.legal_balls % 6) / 10,
      }))
    : undefined

  return {
    id: row.id,
    title: row.title ?? undefined,
    tournament: row.tournament_name,
    tournamentId: row.tournament_id,
    format: row.format,
    venue: row.venue,
    date: row.started_at,
    status: row.status,
    teams,
    ...(scores ? { scores: mapScoresToTeams(scores, teams) } : {}),
    ...(row.result ? { result: row.result } : {}),
    ...(row.is_tie ? { isTie: true } : {}),
    ...(row.is_abandoned ? { isAbandoned: true } : {}),
    ...(row.win_team_id ? { winTeamId: row.win_team_id } : {}),
    ...(row.player_of_the_match_id ? { playerOfTheMatchId: row.player_of_the_match_id } : {}),
    ...(setup ? { setup } : {}),
    isDemo: Boolean(row.is_demo ?? 0),
  }
}

function resolveMatchTeamIds(data) {
  return data.teams.map((team) => {
    const found = database.prepare('SELECT id FROM teams WHERE id = ?').get(team.id)
    if (!found) {
      throw new HttpError(400, `Team ${team.id} must exist before it can be added to a match`)
    }
    return team.id
  })
}

/**
 * Innings rows come back in batting order; score cards must be indexed by
 * match-team order (teams[0] first) so the UI can render teams[0] vs teams[1].
 */
function mapScoresToTeams(scores, teams) {
  const byTeam = new Map(scores.map((score) => [score.teamId, score]))
  return [0, 1].map((index) => {
    const teamId = teams[index]?.id
    const score = byTeam.get(teamId)
    if (!score) return undefined
    const { teamId: _ignored, ...rest } = score
    return rest
  })
}

function createMatch(data) {
  const matchId = id()
  const teamIds = resolveMatchTeamIds(data)

  database.transaction(() => {
    const tournament = findTournament(data)
    database.prepare(`
      INSERT INTO matches (id, tournament_id, format, venue, started_at, status, result, title)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      matchId, tournament.id, data.format, data.venue, data.date, data.status,
      data.result ?? null, data.title?.trim() || null,
    )
    const insertTeam = database.prepare(`
      INSERT INTO match_teams (match_id, team_id, batting_order) VALUES (?, ?, ?)
    `)
    teamIds.forEach((teamId, index) => insertTeam.run(matchId, teamId, index + 1))
    persistMatchSetup(matchId, teamIds, data.setup)
  })()

  return getMatch(matchId)
}

function updateMatch(matchId, data) {
  const existing = getMatch(matchId)
  if (!existing) {
    return null
  }

  const hasInnings = database.prepare('SELECT 1 FROM innings WHERE match_id = ? LIMIT 1').get(matchId)
  const teamsChanged = JSON.stringify(data.teams.map(({ id: teamId }) => teamId))
    !== JSON.stringify(existing.teams.map(({ id: teamId }) => teamId))
  const setup = data.setup ?? existing.setup
  if (hasInnings && (teamsChanged || data.tournamentId !== existing.tournamentId
    || data.tournament !== existing.tournament || data.format !== existing.format
    || JSON.stringify(setup) !== JSON.stringify(existing.setup))) {
    throw new HttpError(409, 'Match teams, setup, and format cannot change after scoring starts')
  }

  const tournament = findTournament(data)
  const teamIds = resolveMatchTeamIds(data)
  database.transaction(() => {
    database.prepare(`
      UPDATE matches
      SET tournament_id = ?, format = ?, venue = ?, started_at = ?, status = ?, result = ?, title = ?
      WHERE id = ?
    `).run(tournament.id, data.format, data.venue, data.date, data.status, data.result ?? null,
      data.title?.trim() || null, matchId)

    if (!hasInnings && teamsChanged) {
      database.prepare('DELETE FROM match_teams WHERE match_id = ?').run(matchId)
      const insertTeam = database.prepare(`
        INSERT INTO match_teams (match_id, team_id, batting_order) VALUES (?, ?, ?)
      `)
      teamIds.forEach((teamId, index) => insertTeam.run(matchId, teamId, index + 1))
    }
    if (!hasInnings && setup) {
      persistMatchSetup(matchId, teamIds, setup)
    }
  })()

  return getMatch(matchId)
}

function listMatches() {
  return database.prepare('SELECT id FROM matches ORDER BY started_at DESC')
    .all().map(({ id: matchId }) => getMatch(matchId))
}

function getInnings(matchId, inningsNumber, create = false) {
  let row = database.prepare(`
    SELECT * FROM innings WHERE match_id = ? AND innings_number = ?
  `).get(matchId, inningsNumber)

  if (!row && create) {
    const matchTeams = database.prepare(`
      SELECT team_id FROM match_teams WHERE match_id = ? ORDER BY batting_order
    `).all(matchId)
    if (matchTeams.length !== 2) {
      throw new HttpError(409, 'The match must have exactly two teams before scoring')
    }
    const battingTeamId = matchTeams[(inningsNumber - 1) % 2].team_id
    const bowlingTeamId = matchTeams[inningsNumber % 2].team_id
    const inningsId = id()
    database.prepare(`
      INSERT INTO innings (id, match_id, innings_number, batting_team_id, bowling_team_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(inningsId, matchId, inningsNumber, battingTeamId, bowlingTeamId)
    row = database.prepare('SELECT * FROM innings WHERE id = ?').get(inningsId)
  }
  return row
}

function playerBelongsTo(playerId, teamId, label) {
  if (!playerId) {
    return
  }
  const player = database.prepare('SELECT team_id FROM players WHERE id = ?').get(playerId)
  if (!player || player.team_id !== teamId) {
    throw new HttpError(400, `${label} must reference a player on the correct team`)
  }
}

function eventRecord(row) {
  if (!row) {
    return null
  }
  const innings = database.prepare('SELECT match_id, innings_number FROM innings WHERE id = ?')
    .get(row.innings_id)
  const runs = row.batter_runs + row.extra_runs
  const eventType = row.wicket_type
    ? 'wicket'
    : row.extras_type || (runs === 4 || runs === 6 ? 'boundary' : 'run')
  const delivery = database.prepare(`
    SELECT delivery_json FROM scoring_delivery_details WHERE event_id = ?
  `).get(row.id)

  return {
    id: row.id,
    matchId: innings.match_id,
    innings: innings.innings_number,
    over: row.over_number,
    ball: row.ball_number,
    runs,
    eventType,
    ...(row.batter_id ? { batterId: row.batter_id } : {}),
    ...(row.bowler_id ? { bowlerId: row.bowler_id } : {}),
    ...(row.non_striker_id ? { nonStrikerId: row.non_striker_id } : {}),
    batterRuns: row.batter_runs,
    extraRuns: row.extra_runs,
    extrasType: row.extras_type,
    legalBall: Boolean(row.legal_ball),
    ...(row.wicket_type ? { wicketType: row.wicket_type, playerOutId: row.player_out_id } : {}),
    ...(delivery ? { delivery: JSON.parse(delivery.delivery_json) } : {}),
    sequence: row.sequence_number,
    recordedAt: row.recorded_at,
  }
}

function createScoringEvent(data) {
  const match = getMatch(data.matchId)
  if (!match) {
    throw new HttpError(400, 'matchId must reference an existing match')
  }
  if (match.status === 'completed' || match.status === 'abandoned') {
    throw new HttpError(409, 'Cannot add scoring events to a finished match')
  }

  const eventId = id()
  const extrasType = ['wide', 'no-ball', 'bye', 'leg-bye'].includes(data.eventType)
    ? data.eventType
    : null
  const batterRuns = extrasType ? 0 : data.runs
  const extraRuns = extrasType ? data.runs : 0
  const legalBall = data.legalBall ?? !['wide', 'no-ball'].includes(data.eventType)
  const inningsNumber = data.innings

  database.transaction(() => {
    const innings = getInnings(data.matchId, inningsNumber, true)
    if (innings.status !== 'in_progress') {
      throw new HttpError(409, 'Cannot add scoring events to a completed innings')
    }
    playerBelongsTo(data.batterId, innings.batting_team_id, 'batterId')
    playerBelongsTo(data.nonStrikerId, innings.batting_team_id, 'nonStrikerId')
    playerBelongsTo(data.playerOutId, innings.batting_team_id, 'playerOutId')
    playerBelongsTo(data.bowlerId, innings.bowling_team_id, 'bowlerId')

    const sequence = database.prepare(`
      SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence
      FROM ball_by_ball_events WHERE innings_id = ?
    `).get(innings.id).next_sequence

    database.prepare(`
      INSERT INTO ball_by_ball_events (
        id, innings_id, sequence_number, over_number, ball_number, batter_id, bowler_id,
        non_striker_id, batter_runs, extra_runs, extras_type, wicket_type, player_out_id, legal_ball
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId, innings.id, sequence, data.over, data.ball, data.batterId ?? null,
      data.bowlerId ?? null, data.nonStrikerId ?? null, batterRuns, extraRuns, extrasType,
      data.wicketType ?? null, data.playerOutId ?? null, Number(legalBall),
    )

    const upsertBattingFigure = (playerId, runs, ballsFaced, dismissal) => {
      database.prepare(`
        INSERT INTO batting_figures (innings_id, player_id, runs, balls_faced, fours, sixes, dismissal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (innings_id, player_id) DO UPDATE SET
          runs = runs + excluded.runs,
          balls_faced = balls_faced + excluded.balls_faced,
          fours = fours + excluded.fours,
          sixes = sixes + excluded.sixes,
          dismissal = COALESCE(excluded.dismissal, dismissal)
      `).run(
        innings.id, playerId, runs, ballsFaced, Number(runs === 4),
        Number(runs === 6), dismissal,
      )
    }

    if (data.batterId) {
      upsertBattingFigure(
        data.batterId,
        batterRuns,
        extrasType !== 'wide' ? 1 : 0,
        data.batterId === data.playerOutId ? data.wicketType ?? null : null,
      )
    }
    if (data.playerOutId && data.playerOutId !== data.batterId) {
      upsertBattingFigure(data.playerOutId, 0, 0, data.wicketType)
    }

    if (data.bowlerId) {
      const chargedRuns = ['bye', 'leg-bye'].includes(extrasType) ? 0 : batterRuns + extraRuns
      const creditedWicket = ['bowled', 'caught', 'lbw', 'stumped', 'hit-wicket']
        .includes(data.wicketType) ? 1 : 0
      database.prepare(`
        INSERT INTO bowling_figures (
          innings_id, player_id, legal_balls, runs_conceded, wickets, wides, no_balls
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (innings_id, player_id) DO UPDATE SET
          legal_balls = legal_balls + excluded.legal_balls,
          runs_conceded = runs_conceded + excluded.runs_conceded,
          wickets = wickets + excluded.wickets,
          wides = wides + excluded.wides,
          no_balls = no_balls + excluded.no_balls
      `).run(
        innings.id, data.bowlerId, Number(legalBall), chargedRuns, creditedWicket,
        Number(extrasType === 'wide'), Number(extrasType === 'no-ball'),
      )
    }
  })()

  const row = database.prepare('SELECT * FROM ball_by_ball_events WHERE id = ?').get(eventId)
  return eventRecord(row)
}

function listScoringEvents(matchId) {
  const rows = database.prepare(`
    SELECT e.* FROM ball_by_ball_events e
    JOIN innings i ON i.id = e.innings_id
    WHERE (? IS NULL OR i.match_id = ?)
      AND NOT EXISTS (SELECT 1 FROM scoring_event_undos u WHERE u.event_id = e.id)
    ORDER BY i.innings_number, e.sequence_number
  `).all(matchId ?? null, matchId ?? null)
  return rows.map(eventRecord)
}

function getScoringEvent(eventId) {
  const row = database.prepare(`
    SELECT e.* FROM ball_by_ball_events e
    WHERE e.id = ? AND NOT EXISTS (
      SELECT 1 FROM scoring_event_undos u WHERE u.event_id = e.id
    )
  `).get(eventId)
  return eventRecord(row)
}

function getScorecard(matchId) {
  const match = getMatch(matchId)
  if (!match) {
    return null
  }
  const inningsRows = database.prepare(`
    SELECT i.*,
      COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN e.batter_runs + e.extra_runs ELSE 0 END), 0) AS total_runs,
      COALESCE(SUM(CASE WHEN e.id IS NOT NULL AND e.wicket_type IS NOT NULL THEN 1 ELSE 0 END), 0) AS wickets,
      COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN e.legal_ball ELSE 0 END), 0) AS legal_balls
    FROM innings i
    LEFT JOIN ball_by_ball_events e ON e.innings_id = i.id
      AND NOT EXISTS (SELECT 1 FROM scoring_event_undos u WHERE u.event_id = e.id)
    WHERE i.match_id = ?
    GROUP BY i.id
    ORDER BY i.innings_number
  `).all(matchId)

  return {
    match,
    innings: inningsRows.map((innings) => {
      const battingFigures = database.prepare(`
        SELECT bf.player_id AS playerId, p.name, bf.runs, bf.balls_faced AS ballsFaced,
          bf.fours, bf.sixes, bf.dismissal
        FROM batting_figures bf
        JOIN players p ON p.id = bf.player_id
        WHERE bf.innings_id = ?
        ORDER BY bf.runs DESC, p.name
      `).all(innings.id)
      const bowlingFigures = database.prepare(`
        SELECT bf.player_id AS playerId, p.name, bf.legal_balls AS legalBalls,
          bf.runs_conceded AS runsConceded, bf.wickets, bf.wides, bf.no_balls AS noBalls
        FROM bowling_figures bf
        JOIN players p ON p.id = bf.player_id
        WHERE bf.innings_id = ?
        ORDER BY bf.wickets DESC, p.name
      `).all(innings.id)
      const battingTeam = teamRecord(database.prepare('SELECT * FROM teams WHERE id = ?').get(innings.batting_team_id))
      const bowlingTeam = teamRecord(database.prepare('SELECT * FROM teams WHERE id = ?').get(innings.bowling_team_id))

      return {
        innings: innings.innings_number,
        battingTeam,
        bowlingTeam,
        runs: innings.total_runs,
        wickets: innings.wickets,
        legalBalls: innings.legal_balls,
        battingFigures,
        bowlingFigures,
        events: database.prepare(`
          SELECT e.* FROM ball_by_ball_events e
          WHERE e.innings_id = ? AND NOT EXISTS (
            SELECT 1 FROM scoring_event_undos u WHERE u.event_id = e.id
          )
          ORDER BY e.sequence_number
        `).all(innings.id).map(eventRecord),
      }
    }),
  }
}

function createSimpleStore(table, mapRecord, columns) {
  const selectColumns = ['id', ...columns.map(([column]) => column)].join(', ')
  return {
    list() {
      return database.prepare(`SELECT ${selectColumns} FROM ${table} ORDER BY rowid`).all().map(mapRecord)
    },
    get(recordId) {
      const row = database.prepare(`SELECT ${selectColumns} FROM ${table} WHERE id = ?`).get(recordId)
      return mapRecord(row)
    },
    create(data) {
      const recordId = id()
      const values = columns.map(([, field]) => data[field] ?? null)
      const insertColumns = ['id', ...columns.map(([column]) => column)]
      database.prepare(`
        INSERT INTO ${table} (${insertColumns.join(', ')})
        VALUES (${insertColumns.map(() => '?').join(', ')})
      `).run(recordId, ...values)
      return this.get(recordId)
    },
    update(recordId, data) {
      if (!this.get(recordId)) {
        return null
      }
      database.prepare(`
        UPDATE ${table} SET ${columns.map(([column]) => `${column} = ?`).join(', ')} WHERE id = ?
      `).run(...columns.map(([, field]) => data[field] ?? null), recordId)
      return this.get(recordId)
    },
    remove(recordId) {
      return database.prepare(`DELETE FROM ${table} WHERE id = ?`).run(recordId).changes > 0
    },
  }
}

export const teams = {
  list() {
    return database.prepare(`
      SELECT id, name, short_name, color, city, home_ground, is_demo
      FROM teams ORDER BY name COLLATE NOCASE
    `).all().map(teamRecord)
  },
  get(teamId) {
    return teamRecord(database.prepare(`
      SELECT id, name, short_name, color, city, home_ground, is_demo
      FROM teams WHERE id = ?
    `).get(teamId))
  },
  findDuplicateName(name, exceptId) {
    return database.prepare(`
      SELECT id FROM teams
      WHERE lower(trim(name)) = lower(trim(?)) AND (? IS NULL OR id <> ?)
      LIMIT 1
    `).get(name, exceptId ?? null, exceptId ?? null)
  },
  create(data) {
    const teamId = id()
    const name = data.name.trim()
    const shortName = data.shortName?.trim() || name
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 8)
      .toUpperCase()
    database.prepare(`
      INSERT INTO teams (id, name, short_name, color, city, home_ground)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      teamId, name, shortName, data.color ?? '#c6f24e',
      data.city?.trim() || null, data.homeGround?.trim() || null,
    )
    return this.get(teamId)
  },
  update(teamId, data) {
    const existing = this.get(teamId)
    if (!existing) return null
    // Partial PATCH bodies (e.g. { name }) must not wipe the other fields.
    const pick = (field, fallback) => (data[field] === undefined ? fallback : data[field])
    const name = pick('name', existing.name)
    database.prepare(`
      UPDATE teams
      SET name = ?, short_name = ?, color = ?, city = ?, home_ground = ?
      WHERE id = ?
    `).run(
      name.trim(),
      pick('shortName', existing.shortName)?.trim() || name.trim()
        .split(/\s+/).map((part) => part[0]).join('').slice(0, 8).toUpperCase(),
      pick('color', existing.color),
      pick('city', existing.city)?.trim() || null,
      pick('homeGround', existing.homeGround)?.trim() || null,
      teamId,
    )
    return this.get(teamId)
  },
  remove(teamId) {
    if (database.prepare(`
      SELECT 1 FROM players WHERE team_id = ?
      UNION ALL SELECT 1 FROM tournament_registrations WHERE team_id = ?
      UNION ALL SELECT 1 FROM fixtures WHERE home_team_id = ? OR away_team_id = ?
      UNION ALL SELECT 1 FROM match_teams WHERE team_id = ?
      LIMIT 1
    `).get(teamId, teamId, teamId, teamId, teamId)) {
      throw new HttpError(409, 'Cannot delete a team that has players or is referenced by a tournament, fixture, or match')
    }
    return database.prepare('DELETE FROM teams WHERE id = ?').run(teamId).changes > 0
  },
}

export const players = {
  list() {
    return database.prepare(`
      SELECT * FROM players ORDER BY name COLLATE NOCASE
    `).all().map(playerRecord)
  },
  get(playerId) {
    return playerRecord(database.prepare('SELECT * FROM players WHERE id = ?').get(playerId))
  },
  findDuplicateName(teamId, name, exceptId) {
    return database.prepare(`
      SELECT id FROM players
      WHERE team_id = ? AND lower(trim(name)) = lower(trim(?))
        AND (? IS NULL OR id <> ?)
      LIMIT 1
    `).get(teamId, name, exceptId ?? null, exceptId ?? null)
  },
  create(data) {
    const playerId = id()
    database.prepare(`
      INSERT INTO players (
        id, team_id, name, role, jersey_number, batting_style, bowling_style,
        is_captain, is_wicketkeeper
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      playerId, data.teamId, data.name.trim(), data.role ?? 'all-rounder',
      data.jerseyNumber ?? null,
      data.battingStyle?.trim() || null,
      data.bowlingStyle?.trim() || null,
      Number(data.isCaptain ?? false), Number(data.isWicketkeeper ?? false),
    )
    return this.get(playerId)
  },
  /**
   * Updates a player. Only the caller's known fields are written so a PATCH
   * body cannot silently clear unrelated columns; `undefined` keeps the
   * existing value, `null` clears an optional field.
   */
  update(playerId, data) {
    const existing = this.get(playerId)
    if (!existing) {
      return null
    }
    const pick = (field, fallback) => (data[field] === undefined ? fallback : data[field])
    database.prepare(`
      UPDATE players
      SET team_id = ?, name = ?, role = ?, jersey_number = ?,
        batting_style = ?, bowling_style = ?, is_captain = ?, is_wicketkeeper = ?
      WHERE id = ?
    `).run(
      data.teamId, data.name.trim(), data.role ?? 'all-rounder',
      pick('jerseyNumber', existing.jerseyNumber ?? null),
      pick('battingStyle', existing.battingStyle ?? null)?.trim() || null,
      pick('bowlingStyle', existing.bowlingStyle ?? null)?.trim() || null,
      Number(pick('isCaptain', existing.isCaptain ?? false)),
      Number(pick('isWicketkeeper', existing.isWicketkeeper ?? false)),
      playerId,
    )
    return this.get(playerId)
  },
  remove(playerId) {
    const referenced = database.prepare(`
      SELECT 1 FROM ball_by_ball_events
      WHERE batter_id = ? OR bowler_id = ? OR non_striker_id = ? OR player_out_id = ?
      UNION ALL SELECT 1 FROM batting_figures WHERE player_id = ?
      UNION ALL SELECT 1 FROM bowling_figures WHERE player_id = ?
      UNION ALL SELECT 1 FROM matches WHERE player_of_the_match_id = ?
      UNION ALL SELECT 1 FROM match_players WHERE player_id = ?
      LIMIT 1
    `).get(playerId, playerId, playerId, playerId, playerId, playerId, playerId, playerId)
    if (referenced) {
      throw new HttpError(409, 'Cannot delete a player referenced by a recorded match or scorecard')
    }
    return database.prepare('DELETE FROM players WHERE id = ?').run(playerId).changes > 0
  },
}

function tournamentFullRecord(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    season: row.season,
    format: row.format,
    isActive: Boolean(row.is_active),
    tournamentType: row.tournament_type ?? 'round_robin',
    oversPerInnings: row.overs_per_innings ?? 20,
    winPoints: row.win_points ?? 2,
    tiePoints: row.tie_points ?? 1,
    noResultPoints: row.no_result_points ?? 1,
    isDemo: Boolean(row.is_demo ?? 0),
  }
}

export const tournaments = {
  list() {
    return database.prepare('SELECT * FROM tournaments WHERE is_system = 0 ORDER BY season DESC, name')
      .all().map(tournamentFullRecord)
  },
  get(tournamentId) {
    return tournamentFullRecord(
      database.prepare('SELECT * FROM tournaments WHERE id = ? AND is_system = 0').get(tournamentId)
    )
  },
  create(data) {
    const tournamentId = id()
    database.prepare(`
      INSERT INTO tournaments (
        id, name, season, format, is_active,
        tournament_type, overs_per_innings,
        win_points, tie_points, no_result_points, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tournamentId,
      data.name, data.season, data.format,
      Number(data.isActive),
      data.tournamentType ?? 'round_robin',
      data.oversPerInnings ?? 20,
      data.winPoints ?? 2,
      data.tiePoints ?? 1,
      data.noResultPoints ?? 1,
      Number(data.isDemo ?? false),
    )
    return this.get(tournamentId)
  },
  update(tournamentId, data) {
    if (!this.get(tournamentId)) {
      return null
    }
    database.prepare(`
      UPDATE tournaments SET
        name = ?, season = ?, format = ?, is_active = ?,
        tournament_type = ?, overs_per_innings = ?,
        win_points = ?, tie_points = ?, no_result_points = ?
      WHERE id = ?
    `).run(
      data.name, data.season, data.format, Number(data.isActive),
      data.tournamentType ?? 'round_robin',
      data.oversPerInnings ?? 20,
      data.winPoints ?? 2,
      data.tiePoints ?? 1,
      data.noResultPoints ?? 1,
      tournamentId,
    )
    return this.get(tournamentId)
  },
  remove(tournamentId) {
    return database.prepare('DELETE FROM tournaments WHERE id = ?').run(tournamentId).changes > 0
  },
}

function parseScoringSession(row) {
  return row && {
    matchId: row.match_id,
    version: row.version,
    ...JSON.parse(row.state_json),
  }
}

function getScoringSession(matchId) {
  const match = getMatch(matchId)
  if (!match) return null
  return parseScoringSession(database.prepare(`
    SELECT match_id, version, state_json FROM scoring_sessions WHERE match_id = ?
  `).get(matchId)) ?? { matchId, version: 0, matchState: null, deliveries: [], bowlerSelections: [], eventIds: [] }
}

function scoringTeams(match) {
  if (!match.setup) {
    throw new HttpError(409, 'This match needs a saved playing XI before scoring can begin')
  }
  const byTeam = new Map(match.setup.playingXIs.map((xi) => [
    xi.teamId,
    xi.selectedPlayers.map(({ id: playerId, name }) => ({ id: playerId, name })),
  ]))
  return match.teams.map((team) => ({
    id: team.id,
    name: team.name,
    players: byTeam.get(team.id) ?? [],
  }))
}

function validateScoringState(match, state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)
    || !Array.isArray(state.innings) || !Array.isArray(state.teamA?.players)
    || !Array.isArray(state.teamB?.players) || !Number.isInteger(state.currentInningsIndex)
    || state.currentInningsIndex < 0 || state.currentInningsIndex > 1) {
    throw new HttpError(400, 'A valid scoring state is required')
  }
  const expectedTeams = scoringTeams(match)
  const stateTeams = [state.teamA, state.teamB]
  if (stateTeams.some((team) => team.players.some((player) =>
    !player || typeof player.id !== 'string' || typeof player.name !== 'string',
  ) || !expectedTeams.some((expected) =>
    expected.id === team.id && expected.name === team.name
    && JSON.stringify(expected.players) === JSON.stringify(team.players),
  ))) {
    throw new HttpError(400, 'Scoring state teams and players must match the saved playing XIs')
  }
  if (state.totalOvers !== match.setup.oversPerInnings) {
    throw new HttpError(400, 'Scoring state overs must match the saved match setup')
  }
  if (state.tossWinnerId !== match.setup.tossWinnerTeamId
    || state.tossDecision !== (match.setup.tossDecision === 'bat' ? 'bat' : 'bowl')) {
    throw new HttpError(400, 'Scoring state toss details must match the saved match setup')
  }
  if (state.innings.length < 1 || state.innings.length > 2
    || state.innings.length !== state.currentInningsIndex + 1) {
    throw new HttpError(400, 'Scoring state innings are inconsistent')
  }
  const teamIds = new Set(expectedTeams.map((team) => team.id))
  for (const innings of state.innings) {
    if (!teamIds.has(innings.battingTeamId) || !teamIds.has(innings.bowlingTeamId)
      || innings.battingTeamId === innings.bowlingTeamId
      || !Array.isArray(innings.battingOrder)
      || !Array.isArray(innings.overs)
      || !Array.isArray(innings.deliveries)
      || !innings.extras || !['total', 'wides', 'noBalls', 'byes', 'legByes', 'penalty']
        .every((field) => Number.isInteger(innings.extras[field]) && innings.extras[field] >= 0)
      || !Array.isArray(innings.overBowlers)
      || !Array.isArray(innings.outIds)
      || !Number.isInteger(innings.runs) || innings.runs < 0
      || !Number.isInteger(innings.wickets) || innings.wickets < 0
      || !Number.isInteger(innings.legalBalls) || innings.legalBalls < 0) {
      throw new HttpError(400, 'Scoring state contains invalid innings data')
    }
    const battingXI = expectedTeams.find((team) => team.id === innings.battingTeamId).players
    const bowlingXI = expectedTeams.find((team) => team.id === innings.bowlingTeamId).players
    const battingIds = battingXI.map((player) => player.id)
    const bowlingIds = bowlingXI.map((player) => player.id)
    if (JSON.stringify(innings.battingOrder) !== JSON.stringify(battingIds)
      || !battingIds.includes(innings.strikerId)
      || !battingIds.includes(innings.nonStrikerId)
      || innings.strikerId === innings.nonStrikerId
      || (innings.bowlerId && !bowlingIds.includes(innings.bowlerId))
      || innings.overBowlers.some((bowlerId) => !bowlingIds.includes(bowlerId))
      || innings.outIds.some((playerId) => !battingIds.includes(playerId))
      || new Set(innings.outIds).size !== innings.outIds.length) {
      throw new HttpError(400, 'Scoring state includes players outside the saved playing XIs')
    }
  }
  return expectedTeams
}

function validateScoringEnvelope(match, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || !Array.isArray(body.deliveries) || !Array.isArray(body.bowlerSelections)
    || !body.matchState) {
    throw new HttpError(400, 'matchState, deliveries, and bowlerSelections are required')
  }
  const teams = validateScoringState(match, body.matchState)
  return {
    matchState: body.matchState,
    deliveries: body.deliveries,
    bowlerSelections: body.bowlerSelections,
    teams,
  }
}

function assertScoringVersion(body, currentVersion) {
  if (!Number.isInteger(body.expectedVersion) || body.expectedVersion !== currentVersion) {
    throw new HttpError(409, 'Scoring state changed; reload the match before recording another action')
  }
}

function assertSameHistory(next, current) {
  if (next.deliveries.length !== current.deliveries.length
    || JSON.stringify(next.deliveries) !== JSON.stringify(current.deliveries)
    || JSON.stringify(next.bowlerSelections) !== JSON.stringify(current.bowlerSelections)) {
    throw new HttpError(400, 'A bowler change cannot alter the saved delivery history')
  }
}

function normalizeWicketType(type) {
  return ({
    runout: 'run-out',
    hitwicket: 'hit-wicket',
    caughtfielder: 'caught',
    other: 'retired-out',
  })[type] ?? type
}

function normalizeExtraType(type) {
  return ({ noball: 'no-ball', legbye: 'leg-bye' })[type] ?? type ?? null
}

function ensureManagedInnings(matchId, inningsNumber, innings) {
  let row = database.prepare(`
    SELECT * FROM innings WHERE match_id = ? AND innings_number = ?
  `).get(matchId, inningsNumber)
  if (!row) {
    const inningsId = id()
    database.prepare(`
      INSERT INTO innings (id, match_id, innings_number, batting_team_id, bowling_team_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(inningsId, matchId, inningsNumber, innings.battingTeamId, innings.bowlingTeamId)
    row = database.prepare('SELECT * FROM innings WHERE id = ?').get(inningsId)
  }
  if (row.batting_team_id !== innings.battingTeamId || row.bowling_team_id !== innings.bowlingTeamId) {
    throw new HttpError(409, 'Saved innings teams do not match the match toss and playing XIs')
  }
  return row
}

function rebuildFigures(inningsId) {
  database.prepare('DELETE FROM batting_figures WHERE innings_id = ?').run(inningsId)
  database.prepare('DELETE FROM bowling_figures WHERE innings_id = ?').run(inningsId)
  const rows = database.prepare(`
    SELECT e.*, d.delivery_json FROM ball_by_ball_events e
    LEFT JOIN scoring_delivery_details d ON d.event_id = e.id
    WHERE e.innings_id = ?
      AND NOT EXISTS (SELECT 1 FROM scoring_event_undos u WHERE u.event_id = e.id)
    ORDER BY e.sequence_number
  `).all(inningsId)
  const batting = new Map()
  const bowling = new Map()
  const getBatting = (playerId) => {
    if (!batting.has(playerId)) {
      batting.set(playerId, { runs: 0, balls: 0, fours: 0, sixes: 0, dismissal: null })
    }
    return batting.get(playerId)
  }
  const getBowling = (playerId) => {
    if (!bowling.has(playerId)) {
      bowling.set(playerId, { legalBalls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 })
    }
    return bowling.get(playerId)
  }
  for (const row of rows) {
    if (row.batter_id) {
      const figure = getBatting(row.batter_id)
      figure.runs += row.batter_runs
      if (row.extras_type !== 'wide') figure.balls += 1
      if (row.batter_runs === 4) figure.fours += 1
      if (row.batter_runs === 6) figure.sixes += 1
    }
    if (row.player_out_id) {
      getBatting(row.player_out_id).dismissal = row.wicket_type
    }
    if (row.bowler_id) {
      const figure = getBowling(row.bowler_id)
      figure.legalBalls += row.legal_ball
      const delivery = row.delivery_json ? JSON.parse(row.delivery_json) : null
      const noBallByes = row.extras_type === 'no-ball'
        && ['bye', 'legbye'].includes(delivery?.secondaryExtraType)
      if (!['bye', 'leg-bye'].includes(row.extras_type) || noBallByes) {
        figure.runs += row.batter_runs + row.extra_runs
        if (noBallByes) figure.runs -= delivery.extraRuns ?? 0
      }
      if (row.wicket_type && !['run-out', 'retired-out'].includes(row.wicket_type)) {
        figure.wickets += 1
      }
      if (row.extras_type === 'wide') figure.wides += 1
      if (row.extras_type === 'no-ball') figure.noBalls += 1
    }
  }
  const insertBatting = database.prepare(`
    INSERT INTO batting_figures (innings_id, player_id, runs, balls_faced, fours, sixes, dismissal)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  for (const [playerId, figure] of batting) {
    insertBatting.run(
      inningsId, playerId, figure.runs, figure.balls, figure.fours, figure.sixes, figure.dismissal,
    )
  }
  const insertBowling = database.prepare(`
    INSERT INTO bowling_figures (innings_id, player_id, legal_balls, runs_conceded, wickets, wides, no_balls)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  for (const [playerId, figure] of bowling) {
    insertBowling.run(
      inningsId, playerId, figure.legalBalls, figure.runs, figure.wickets, figure.wides, figure.noBalls,
    )
  }
}

function syncMatchScoringState(matchId, state) {
  const { matchState } = state
  matchState.innings.forEach((innings, index) => {
    const row = ensureManagedInnings(matchId, index + 1, innings)
    const totals = database.prepare(`
      SELECT
        COALESCE(SUM(batter_runs + extra_runs), 0) AS runs,
        COALESCE(SUM(wicket_type IS NOT NULL), 0) AS wickets,
        COALESCE(SUM(legal_ball), 0) AS legal_balls
      FROM ball_by_ball_events e
      WHERE e.innings_id = ? AND NOT EXISTS (
        SELECT 1 FROM scoring_event_undos u WHERE u.event_id = e.id
      )
    `).get(row.id)
    const oversFaced = Math.floor(totals.legal_balls / 6) + (totals.legal_balls % 6) / 10
    database.prepare(`
      UPDATE innings SET status = ?, total_runs = ?, wickets = ?, overs_faced = ?, is_all_out = ?
      WHERE id = ?
    `).run(
      innings.completed ? 'completed' : 'in_progress',
      totals.runs,
      totals.wickets,
      oversFaced,
      Number(totals.wickets >= 10),
      row.id,
    )
    rebuildFigures(row.id)
  })
  database.prepare(`
    DELETE FROM innings
    WHERE match_id = ? AND innings_number > ?
      AND NOT EXISTS (
        SELECT 1 FROM ball_by_ball_events e WHERE e.innings_id = innings.id
      )
  `).run(matchId, matchState.innings.length)
  const first = matchState.innings[0]
  const second = matchState.innings[1]
  const isTie = Boolean(matchState.result && matchState.result === 'Match tied')
  const winnerId = !matchState.result || isTie
    ? null
    : second.runs > first.runs ? second.battingTeamId : first.battingTeamId
  database.prepare(`
    UPDATE matches SET status = ?, result = ?, win_team_id = ?, is_tie = ?, is_abandoned = 0
    WHERE id = ?
  `).run(
    matchState.result ? 'completed' : 'live',
    matchState.result ?? null,
    winnerId,
    Number(isTie),
    matchId,
  )
}

function beginScoring(matchId, body) {
  const match = getMatch(matchId)
  if (!match) return null
  if (match.status === 'completed' || match.status === 'abandoned') {
    throw new HttpError(409, 'A completed or abandoned match cannot be scored')
  }
  const current = getScoringSession(matchId)
  assertScoringVersion(body, current.version)
  if (current.matchState) {
    throw new HttpError(409, 'Scoring has already started for this match')
  }
  if (database.prepare(`
    SELECT 1 FROM innings i
    JOIN ball_by_ball_events e ON e.innings_id = i.id
    WHERE i.match_id = ? LIMIT 1
  `).get(matchId)) {
    throw new HttpError(409, 'This match already has legacy scoring events and cannot be initialized')
  }
  const teams = validateScoringState(match, body.matchState)
  if (body.matchState.innings.length !== 1 || body.matchState.currentInningsIndex !== 0) {
    throw new HttpError(400, 'A match must start with its first innings')
  }
  const battingFirstId = match.setup.tossDecision === 'bat'
    ? match.setup.tossWinnerTeamId
    : match.teams.find((team) => team.id !== match.setup.tossWinnerTeamId).id
  const firstInnings = body.matchState.innings[0]
  if (firstInnings.battingTeamId !== battingFirstId
    || firstInnings.runs !== 0 || firstInnings.wickets !== 0 || firstInnings.legalBalls !== 0) {
    throw new HttpError(400, 'Initial innings must be scoreless and follow the saved toss decision')
  }
  const battingXI = teams.find((team) => team.id === firstInnings.battingTeamId).players
  const bowlingXI = teams.find((team) => team.id === firstInnings.bowlingTeamId).players
  if (!battingXI.some((player) => player.id === firstInnings.strikerId)
    || !battingXI.some((player) => player.id === firstInnings.nonStrikerId)
    || firstInnings.strikerId === firstInnings.nonStrikerId
    || !bowlingXI.some((player) => player.id === firstInnings.bowlerId)) {
    throw new HttpError(400, 'Opening batters and bowler must be distinct players in their saved playing XIs')
  }
  if (!Array.isArray(body.deliveries) || body.deliveries.length !== 0
    || !Array.isArray(body.bowlerSelections) || body.bowlerSelections.length !== 0) {
    throw new HttpError(400, 'A new scoring session cannot contain prior deliveries or bowler selections')
  }
  const stateJson = JSON.stringify({
    matchState: body.matchState,
    deliveries: [],
    bowlerSelections: [],
    eventIds: [],
  })
  database.transaction(() => {
    database.prepare(`
      INSERT INTO scoring_sessions (match_id, version, state_json) VALUES (?, 1, ?)
    `).run(matchId, stateJson)
    syncMatchScoringState(matchId, JSON.parse(stateJson))
  })()
  return getScoringSession(matchId)
}

function recordManagedDelivery(matchId, body) {
  const match = getMatch(matchId)
  if (!match) return null
  const current = getScoringSession(matchId)
  assertScoringVersion(body, current.version)
  if (!current.matchState || match.status === 'completed' || match.status === 'abandoned') {
    throw new HttpError(409, 'Scoring has not started or this match has finished')
  }
  const next = validateScoringEnvelope(match, body)
  if (next.deliveries.length !== current.deliveries.length + 1
    || JSON.stringify(next.deliveries.slice(0, -1)) !== JSON.stringify(current.deliveries)
    || JSON.stringify(next.bowlerSelections) !== JSON.stringify(current.bowlerSelections)) {
    throw new HttpError(400, 'A delivery must append exactly one event without changing prior scoring history')
  }
  const delivery = next.deliveries.at(-1)
  if (!delivery || !body.delivery || typeof body.delivery !== 'object'
    || JSON.stringify(body.delivery) !== JSON.stringify(delivery)) {
    throw new HttpError(400, 'The recorded delivery must match the final delivery in the scoring state')
  }
  const previousState = current.matchState
  const previousInnings = previousState.innings[previousState.currentInningsIndex]
  if (previousState.result || previousInnings.completed || !previousInnings.bowlerId
    || !Number.isInteger(delivery.runsOffBat) || delivery.runsOffBat < 0 || delivery.runsOffBat > 6
    || (delivery.extraRuns !== undefined
      && (!Number.isInteger(delivery.extraRuns) || delivery.extraRuns < 0 || delivery.extraRuns > 6))
    || !['wide', 'noball', 'bye', 'legbye', 'penalty', undefined].includes(delivery.extraType)) {
    throw new HttpError(400, 'Delivery data is invalid or the innings is complete')
  }
  if (delivery.extraRuns !== undefined && delivery.extraType === undefined) {
    throw new HttpError(400, 'extraRuns requires an extra type')
  }
  if (delivery.extraType !== undefined && delivery.extraType !== 'noball'
    && delivery.runsOffBat > 0) {
    throw new HttpError(400, 'Runs off the bat can only accompany a no-ball extra')
  }
  if (delivery.secondaryExtraType !== undefined
    && (delivery.extraType !== 'noball'
      || !['bye', 'legbye'].includes(delivery.secondaryExtraType)
      || delivery.runsOffBat > 0)) {
    throw new HttpError(400, 'A secondary bye or leg-bye can only accompany a no-ball')
  }
  if (delivery.extraType === 'penalty') {
    throw new HttpError(400, 'Penalty runs are not supported as a delivery action')
  }
  if (delivery.wicket !== undefined && (!delivery.wicket || typeof delivery.wicket !== 'object'
    || typeof delivery.wicket.dismissedPlayerId !== 'string'
    || !delivery.wicket.dismissedPlayerId.trim())) {
    throw new HttpError(400, 'A wicket requires a dismissed batter')
  }
  if (delivery.wicket && !['bowled', 'caught', 'lbw', 'runout', 'stumped',
    'hitwicket', 'caughtfielder', 'other'].includes(delivery.wicket.type)) {
    throw new HttpError(400, 'Wicket type is invalid')
  }
  const inningsState = previousInnings
  const battingXI = next.teams.find((team) => team.id === inningsState.battingTeamId).players
  const bowlingXI = next.teams.find((team) => team.id === inningsState.bowlingTeamId).players
  const validBatterIds = [inningsState.strikerId, inningsState.nonStrikerId]
  if (!battingXI.some((player) => player.id === inningsState.strikerId)
    || !battingXI.some((player) => player.id === inningsState.nonStrikerId)
    || !bowlingXI.some((player) => player.id === inningsState.bowlerId)
    || (delivery.wicket && !validBatterIds.includes(delivery.wicket.dismissedPlayerId))) {
    throw new HttpError(400, 'Delivery players must belong to the current saved playing XIs')
  }
  if (delivery.wicket && delivery.wicket.type !== 'runout'
    && delivery.wicket.type !== 'other'
    && delivery.wicket.dismissedPlayerId !== inningsState.strikerId) {
    throw new HttpError(400, 'Only a run-out or retired dismissal can dismiss the non-striker')
  }
  if (delivery.wicket && delivery.wicket.type !== 'runout'
    && delivery.wicket.type !== 'other' && delivery.runsOffBat > 0) {
    throw new HttpError(400, 'Runs off the bat on a wicket delivery are only supported for run-outs')
  }
  if (delivery.wicket && delivery.extraType === 'noball'
    && !['runout', 'other'].includes(delivery.wicket.type)) {
    throw new HttpError(400, 'A no-ball only permits a run-out or retired dismissal')
  }
  if (delivery.wicket && delivery.extraType === 'wide'
    && !['runout', 'stumped', 'hitwicket', 'other'].includes(delivery.wicket.type)) {
    throw new HttpError(400, 'A wide only permits a run-out, stumping, hit wicket, or retired dismissal')
  }
  if (delivery.wicket && ['bye', 'legbye'].includes(delivery.extraType)
    && !['runout', 'stumped', 'hitwicket', 'other'].includes(delivery.wicket.type)) {
    throw new HttpError(400, 'A bye or leg-bye only permits a run-out, stumping, hit wicket, or retired dismissal')
  }
  const scoredRuns = delivery.runsOffBat
    + (delivery.extraType === 'wide' || delivery.extraType === 'noball'
      ? 1 + (delivery.extraRuns ?? 0)
      : delivery.extraRuns ?? 0)
  const legalBall = delivery.extraType !== 'wide' && delivery.extraType !== 'noball'
  const scoredInnings = body.matchState.innings[previousState.currentInningsIndex]
  const expectedExtras = {
    total: previousInnings.extras.total + scoredRuns - delivery.runsOffBat,
    wides: previousInnings.extras.wides
      + (delivery.extraType === 'wide' ? 1 + (delivery.extraRuns ?? 0) : 0),
    noBalls: previousInnings.extras.noBalls + (delivery.extraType === 'noball'
      ? 1 + (delivery.secondaryExtraType ? 0 : (delivery.extraRuns ?? 0))
      : 0),
    byes: previousInnings.extras.byes
      + (delivery.extraType === 'bye' || delivery.secondaryExtraType === 'bye'
        ? delivery.extraRuns ?? 0 : 0),
    legByes: previousInnings.extras.legByes
      + (delivery.extraType === 'legbye' || delivery.secondaryExtraType === 'legbye'
        ? delivery.extraRuns ?? 0 : 0),
    penalty: previousInnings.extras.penalty,
  }
  if (scoredInnings.runs !== previousInnings.runs + scoredRuns
    || scoredInnings.wickets !== previousInnings.wickets + Number(Boolean(delivery.wicket))
    || scoredInnings.legalBalls !== previousInnings.legalBalls + Number(legalBall)
    || scoredInnings.deliveries.length !== previousInnings.deliveries.length + 1
    || JSON.stringify(next.deliveries) !== JSON.stringify([...current.deliveries, delivery])
    || JSON.stringify(scoredInnings.extras) !== JSON.stringify(expectedExtras)) {
    throw new HttpError(400, 'Saved innings totals must match the recorded delivery')
  }
  const afterState = {
    matchState: body.matchState,
    deliveries: next.deliveries,
    bowlerSelections: next.bowlerSelections,
    eventIds: [...current.eventIds],
  }
  const eventId = id()
  afterState.eventIds.push(eventId)
  const inningsNumber = previousState.currentInningsIndex + 1
  const extraType = normalizeExtraType(delivery.extraType)
  const extraRuns = delivery.extraType === 'wide' || delivery.extraType === 'noball'
    ? 1 + (delivery.extraRuns ?? 0)
    : delivery.extraRuns ?? 0
  const wicketType = delivery.wicket ? normalizeWicketType(delivery.wicket.type) : null
  const nextVersion = current.version + 1
  const stateJson = JSON.stringify(afterState)
  database.transaction(() => {
    const dbInnings = ensureManagedInnings(matchId, inningsNumber, inningsState)
    const sequence = database.prepare(`
      SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence
      FROM ball_by_ball_events WHERE innings_id = ?
    `).get(dbInnings.id).next_sequence
    database.prepare(`
      INSERT INTO ball_by_ball_events (
        id, innings_id, sequence_number, over_number, ball_number, batter_id, bowler_id,
        non_striker_id, batter_runs, extra_runs, extras_type, wicket_type, player_out_id, legal_ball
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId, dbInnings.id, sequence,
      Math.floor(inningsState.legalBalls / 6),
      (inningsState.legalBalls % 6) + 1,
      inningsState.strikerId, inningsState.bowlerId, inningsState.nonStrikerId,
      delivery.runsOffBat, extraRuns, extraType, wicketType,
      delivery.wicket?.dismissedPlayerId ?? null, Number(legalBall),
    )
    database.prepare(`
      INSERT INTO scoring_delivery_details (event_id, delivery_json, state_before_json, state_after_json)
      VALUES (?, ?, ?, ?)
    `).run(
      eventId, JSON.stringify(delivery),
      JSON.stringify({
        matchState: current.matchState,
        deliveries: current.deliveries,
        bowlerSelections: current.bowlerSelections,
        eventIds: current.eventIds,
      }),
      stateJson,
    )
    const update = database.prepare(`
      UPDATE scoring_sessions SET version = ?, state_json = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE match_id = ? AND version = ?
    `).run(nextVersion, stateJson, matchId, current.version)
    if (update.changes !== 1) {
      throw new HttpError(409, 'Scoring state changed; reload the match before recording another action')
    }
    syncMatchScoringState(matchId, afterState)
  })()
  return getScoringSession(matchId)
}

function chooseScoringBowler(matchId, body) {
  const match = getMatch(matchId)
  if (!match) return null
  const current = getScoringSession(matchId)
  assertScoringVersion(body, current.version)
  if (!current.matchState || match.status === 'completed' || match.status === 'abandoned') {
    throw new HttpError(409, 'Scoring has not started or this match has finished')
  }
  const next = validateScoringEnvelope(match, body)
  assertSameHistory(next, current)
  const innings = current.matchState.innings[current.matchState.currentInningsIndex]
  const nextInnings = next.matchState.innings[next.matchState.currentInningsIndex]
  const team = next.teams.find((entry) => entry.id === innings.bowlingTeamId)
  const bowlerSelections = body.bowlerSelections
  if (bowlerSelections.length !== current.bowlerSelections.length + 1
    || !team.players.some((player) => player.id === nextInnings.bowlerId)
    || innings.completed || innings.overs.at(-1)?.length !== 0
    || nextInnings.bowlerId === innings.bowlerId
    || bowlerSelections.at(-1)?.afterDeliveryCount !== current.deliveries.length
    || bowlerSelections.at(-1)?.bowlerId !== nextInnings.bowlerId
    || innings.overBowlers.at(-1) === nextInnings.bowlerId
    || innings.overBowlers.filter((id) => id === nextInnings.bowlerId).length
      >= Math.ceil(current.matchState.totalOvers / 5)) {
    throw new HttpError(400, 'Bowler can only be changed to an eligible player between overs')
  }
  const state = {
    matchState: next.matchState,
    deliveries: next.deliveries,
    bowlerSelections: next.bowlerSelections,
    eventIds: current.eventIds,
  }
  const version = current.version + 1
  database.transaction(() => {
    const result = database.prepare(`
      UPDATE scoring_sessions SET version = ?, state_json = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE match_id = ? AND version = ?
    `).run(version, JSON.stringify(state), matchId, current.version)
    if (result.changes !== 1) {
      throw new HttpError(409, 'Scoring state changed; reload the match before recording another action')
    }
    syncMatchScoringState(matchId, state)
  })()
  return getScoringSession(matchId)
}

function undoScoringDelivery(matchId, body) {
  const match = getMatch(matchId)
  if (!match) return null
  const current = getScoringSession(matchId)
  assertScoringVersion(body, current.version)
  const eventId = current.eventIds.at(-1)
  if (!eventId) {
    throw new HttpError(409, 'There is no delivery to undo')
  }
  const details = database.prepare(`
    SELECT state_before_json FROM scoring_delivery_details WHERE event_id = ?
  `).get(eventId)
  if (!details) {
    throw new HttpError(409, 'The last delivery cannot be safely undone')
  }
  const previous = JSON.parse(details.state_before_json)
  const previousState = {
    matchState: previous.matchState,
    deliveries: previous.deliveries,
    bowlerSelections: previous.bowlerSelections,
    eventIds: previous.eventIds,
  }
  database.transaction(() => {
    database.prepare('INSERT INTO scoring_event_undos (event_id) VALUES (?)').run(eventId)
    const result = database.prepare(`
      UPDATE scoring_sessions SET version = ?, state_json = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE match_id = ? AND version = ?
    `).run(current.version + 1, JSON.stringify(previousState), matchId, current.version)
    if (result.changes !== 1) {
      throw new HttpError(409, 'Scoring state changed; reload the match before undoing')
    }
    syncMatchScoringState(matchId, previousState)
  })()
  return getScoringSession(matchId)
}

export const matches = {
  list: listMatches,
  get: getMatch,
  create: createMatch,
  update: updateMatch,
  remove(matchId) {
    return database.prepare('DELETE FROM matches WHERE id = ?').run(matchId).changes > 0
  },
  scorecard: getScorecard,
}

export const scoringSessions = {
  get: getScoringSession,
  start: beginScoring,
  recordDelivery: recordManagedDelivery,
  chooseBowler: chooseScoringBowler,
  undo: undoScoringDelivery,
}

export const scoringEvents = {
  list: listScoringEvents,
  get: getScoringEvent,
  create: createScoringEvent,
  update() {
    throw new HttpError(405, 'Scoring events are immutable; record a new delivery instead')
  },
  remove() {
    throw new HttpError(405, 'Scoring events are immutable and cannot be deleted')
  },
}
