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
  }
}

function playerRecord(row) {
  return row && {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    role: row.role,
    ...(row.jersey_number === null ? {} : { jerseyNumber: row.jersey_number }),
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

  const matches = database.prepare('SELECT * FROM tournaments WHERE name = ?').all(data.tournament)
  if (matches.length !== 1) {
    throw new HttpError(400, matches.length
      ? 'tournamentId is required when the tournament name is not unique'
      : 'tournament must reference an existing tournament')
  }
  return matches[0]
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

  return {
    id: row.id,
    tournament: row.tournament_name,
    tournamentId: row.tournament_id,
    format: row.format,
    venue: row.venue,
    date: row.started_at,
    status: row.status,
    teams,
    ...(row.result ? { result: row.result } : {}),
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

function createMatch(data) {
  const matchId = id()
  const tournament = findTournament(data)
  const teamIds = resolveMatchTeamIds(data)

  database.transaction(() => {
    database.prepare(`
      INSERT INTO matches (id, tournament_id, format, venue, started_at, status, result)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(matchId, tournament.id, data.format, data.venue, data.date, data.status, data.result ?? null)
    const insertTeam = database.prepare(`
      INSERT INTO match_teams (match_id, team_id, batting_order) VALUES (?, ?, ?)
    `)
    teamIds.forEach((teamId, index) => insertTeam.run(matchId, teamId, index + 1))
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
  if (hasInnings && (teamsChanged || data.tournamentId !== existing.tournamentId
    || data.tournament !== existing.tournament || data.format !== existing.format)) {
    throw new HttpError(409, 'Match teams, tournament, and format cannot change after scoring starts')
  }

  const tournament = findTournament(data)
  const teamIds = resolveMatchTeamIds(data)
  database.transaction(() => {
    database.prepare(`
      UPDATE matches
      SET tournament_id = ?, format = ?, venue = ?, started_at = ?, status = ?, result = ?
      WHERE id = ?
    `).run(tournament.id, data.format, data.venue, data.date, data.status, data.result ?? null, matchId)

    if (!hasInnings && teamsChanged) {
      database.prepare('DELETE FROM match_teams WHERE match_id = ?').run(matchId)
      const insertTeam = database.prepare(`
        INSERT INTO match_teams (match_id, team_id, batting_order) VALUES (?, ?, ?)
      `)
      teamIds.forEach((teamId, index) => insertTeam.run(matchId, teamId, index + 1))
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
    sequence: row.sequence_number,
    recordedAt: row.recorded_at,
  }
}

function createScoringEvent(data) {
  const match = getMatch(data.matchId)
  if (!match) {
    throw new HttpError(400, 'matchId must reference an existing match')
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
      const creditedWicket = data.wicketType && data.wicketType !== 'run-out' ? 1 : 0
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
    ORDER BY i.innings_number, e.sequence_number
  `).all(matchId ?? null, matchId ?? null)
  return rows.map(eventRecord)
}

function getScoringEvent(eventId) {
  const row = database.prepare('SELECT * FROM ball_by_ball_events WHERE id = ?').get(eventId)
  return eventRecord(row)
}

function getScorecard(matchId) {
  const match = getMatch(matchId)
  if (!match) {
    return null
  }
  const inningsRows = database.prepare(`
    SELECT i.*,
      COALESCE(SUM(e.batter_runs + e.extra_runs), 0) AS total_runs,
      COALESCE(SUM(e.wicket_type IS NOT NULL), 0) AS wickets,
      COALESCE(SUM(e.legal_ball), 0) AS legal_balls
    FROM innings i
    LEFT JOIN ball_by_ball_events e ON e.innings_id = i.id
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
          SELECT * FROM ball_by_ball_events WHERE innings_id = ? ORDER BY sequence_number
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

export const teams = createSimpleStore('teams', teamRecord, [
  ['name', 'name'], ['short_name', 'shortName'], ['color', 'color'],
])

export const players = {
  list() {
    return database.prepare(`
      SELECT id, team_id, name, role, jersey_number FROM players ORDER BY name
    `).all().map(playerRecord)
  },
  get(playerId) {
    return playerRecord(database.prepare(`
      SELECT id, team_id, name, role, jersey_number FROM players WHERE id = ?
    `).get(playerId))
  },
  create(data) {
    const playerId = id()
    database.prepare(`
      INSERT INTO players (id, team_id, name, role, jersey_number)
      VALUES (?, ?, ?, ?, ?)
    `).run(playerId, data.teamId, data.name, data.role ?? 'all-rounder', data.jerseyNumber ?? null)
    return this.get(playerId)
  },
  update(playerId, data) {
    if (!this.get(playerId)) {
      return null
    }
    database.prepare(`
      UPDATE players SET team_id = ?, name = ?, role = ?, jersey_number = ? WHERE id = ?
    `).run(data.teamId, data.name, data.role ?? 'all-rounder', data.jerseyNumber ?? null, playerId)
    return this.get(playerId)
  },
  remove(playerId) {
    return database.prepare('DELETE FROM players WHERE id = ?').run(playerId).changes > 0
  },
}

export const tournaments = {
  list() {
    return database.prepare(`
      SELECT id, name, season, format, is_active FROM tournaments ORDER BY season DESC, name
    `).all().map(tournamentRecord)
  },
  get(tournamentId) {
    return tournamentRecord(database.prepare(`
      SELECT id, name, season, format, is_active FROM tournaments WHERE id = ?
    `).get(tournamentId))
  },
  create(data) {
    const tournamentId = id()
    database.prepare(`
      INSERT INTO tournaments (id, name, season, format, is_active) VALUES (?, ?, ?, ?, ?)
    `).run(tournamentId, data.name, data.season, data.format, Number(data.isActive))
    return this.get(tournamentId)
  },
  update(tournamentId, data) {
    if (!this.get(tournamentId)) {
      return null
    }
    database.prepare(`
      UPDATE tournaments SET name = ?, season = ?, format = ?, is_active = ? WHERE id = ?
    `).run(data.name, data.season, data.format, Number(data.isActive), tournamentId)
    return this.get(tournamentId)
  },
  remove(tournamentId) {
    return database.prepare('DELETE FROM tournaments WHERE id = ?').run(tournamentId).changes > 0
  },
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
