/**
 * PAVILION HUB — Tournament-management models
 * --------------------------------------------
 * Extends the existing models/index.js with:
 *   • fixtures       (CRUD + scheduling)
 *   • registrations  (team sign-up / withdrawal)
 *   • partnerships   (batting partnerships)
 *   • teamProfile    (team + players + history)
 *   • playerStats    (batting/bowling aggregates + POTM)
 *   • matchResult    (set winner / POTM / tie / abandoned)
 *   • innings sync   (keep denorm total_runs / wickets / overs_faced in sync)
 */

import { randomUUID } from 'node:crypto'
import { database } from '../db/database.js'
import { HttpError } from '../middleware/errorHandler.js'

const id = () => randomUUID()

// ── helpers ──────────────────────────────────────────────────────────────────

function teamRecord(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    color: row.color,
    ...(row.city        ? { city: row.city }            : {}),
    ...(row.home_ground ? { homeGround: row.home_ground } : {}),
    isDemo: Boolean(row.is_demo),
  }
}

function playerRecord(row) {
  if (!row) return null
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    role: row.role,
    ...(row.jersey_number !== null && row.jersey_number !== undefined
      ? { jerseyNumber: row.jersey_number } : {}),
    ...(row.batting_style ? { battingStyle: row.batting_style } : {}),
    ...(row.bowling_style ? { bowlingStyle: row.bowling_style } : {}),
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
    isDemo:   Boolean(row.is_demo),
  }
}

function fixtureRecord(row) {
  if (!row) return null
  return {
    id:           row.id,
    tournamentId: row.tournament_id,
    homeTeam:     {
      id: row.home_team_id,
      name: row.home_name,
      shortName: row.home_short,
      color: row.home_color,
    },
    awayTeam:     {
      id: row.away_team_id,
      name: row.away_name,
      shortName: row.away_short,
      color: row.away_color,
    },
    scheduledAt:  row.scheduled_at,
    venue:        row.venue,
    status:       row.status,
    stage:        row.stage       || 'League',
    roundNumber:  row.round_number ?? 1,
    bracketSlot:  row.bracket_slot ?? null,
    linkedMatchId: row.linked_match_id ?? null,
    isDemo:       Boolean(row.is_demo),
  }
}

const FIXTURE_JOIN = `
  SELECT f.*,
    ht.name AS home_name, ht.short_name AS home_short, ht.color AS home_color,
    at.name AS away_name, at.short_name AS away_short, at.color AS away_color
  FROM fixtures f
  JOIN teams ht ON ht.id = f.home_team_id
  JOIN teams at ON at.id = f.away_team_id
`

// ── fixtures ─────────────────────────────────────────────────────────────────

export const fixtures = {
  list(tournamentId) {
    const rows = tournamentId
      ? database.prepare(`${FIXTURE_JOIN} WHERE f.tournament_id = ? ORDER BY f.scheduled_at`).all(tournamentId)
      : database.prepare(`${FIXTURE_JOIN} ORDER BY f.scheduled_at`).all()
    return rows.map(fixtureRecord)
  },

  get(fixtureId) {
    const row = database.prepare(`${FIXTURE_JOIN} WHERE f.id = ?`).get(fixtureId)
    return fixtureRecord(row)
  },

  create(data) {
    // Validate both teams are registered in the tournament
    for (const teamId of [data.homeTeamId, data.awayTeamId]) {
      const reg = database.prepare(`
        SELECT 1 FROM tournament_registrations
        WHERE tournament_id = ? AND team_id = ? AND status = 'registered'
      `).get(data.tournamentId, teamId)
      if (!reg) {
        throw new HttpError(400, `Team ${teamId} must be registered in the tournament`)
      }
    }
    if (data.homeTeamId === data.awayTeamId) {
      throw new HttpError(400, 'A fixture must have two different teams')
    }

    const fixtureId = id()
    database.prepare(`
      INSERT INTO fixtures (
        id, tournament_id, home_team_id, away_team_id,
        scheduled_at, venue, status, stage, round_number, bracket_slot, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fixtureId,
      data.tournamentId,
      data.homeTeamId,
      data.awayTeamId,
      data.scheduledAt,
      data.venue,
      data.status ?? 'scheduled',
      data.stage ?? 'League',
      data.roundNumber ?? 1,
      data.bracketSlot ?? null,
      Number(data.isDemo ?? false),
    )
    return this.get(fixtureId)
  },

  update(fixtureId, data) {
    const existing = this.get(fixtureId)
    if (!existing) return null

    database.prepare(`
      UPDATE fixtures
      SET scheduled_at = ?, venue = ?, status = ?, stage = ?,
          round_number = ?, bracket_slot = ?, linked_match_id = ?
      WHERE id = ?
    `).run(
      data.scheduledAt  ?? existing.scheduledAt,
      data.venue        ?? existing.venue,
      data.status       ?? existing.status,
      data.stage        ?? existing.stage,
      data.roundNumber  ?? existing.roundNumber,
      data.bracketSlot  ?? existing.bracketSlot,
      data.linkedMatchId ?? existing.linkedMatchId,
      fixtureId,
    )
    return this.get(fixtureId)
  },

  remove(fixtureId) {
    return database.prepare('DELETE FROM fixtures WHERE id = ?').run(fixtureId).changes > 0
  },
}

// ── registrations ────────────────────────────────────────────────────────────

export const registrations = {
  list(tournamentId) {
    return database.prepare(`
      SELECT tr.id, tr.tournament_id, tr.team_id, tr.status, tr.registered_at,
        t.name, t.short_name, t.color, t.is_demo
      FROM tournament_registrations tr
      JOIN teams t ON t.id = tr.team_id
      WHERE tr.tournament_id = ?
      ORDER BY tr.registered_at
    `).all(tournamentId).map((row) => ({
      id:           row.id,
      tournamentId: row.tournament_id,
      teamId:       row.team_id,
      teamName:     row.name,
      shortName:    row.short_name,
      color:        row.color,
      isDemo:       Boolean(row.is_demo),
      status:       row.status,
      registeredAt: row.registered_at,
    }))
  },

  register(tournamentId, teamId) {
    const tournament = database.prepare('SELECT 1 FROM tournaments WHERE id = ?').get(tournamentId)
    if (!tournament) throw new HttpError(400, 'Tournament not found')
    const team = database.prepare('SELECT 1 FROM teams WHERE id = ?').get(teamId)
    if (!team) throw new HttpError(400, 'Team not found')

    const existing = database.prepare(`
      SELECT * FROM tournament_registrations WHERE tournament_id = ? AND team_id = ?
    `).get(tournamentId, teamId)

    if (existing) {
      if (existing.status === 'registered') {
        throw new HttpError(409, 'Team is already registered in this tournament')
      }
      // Re-register (was withdrawn / disqualified)
      database.prepare(`
        UPDATE tournament_registrations SET status = 'registered' WHERE id = ?
      `).run(existing.id)
      return this.list(tournamentId).find((r) => r.id === existing.id)
    }

    const regId = id()
    database.prepare(`
      INSERT INTO tournament_registrations (id, tournament_id, team_id, status)
      VALUES (?, ?, ?, 'registered')
    `).run(regId, tournamentId, teamId)
    return this.list(tournamentId).find((r) => r.id === regId)
  },

  withdraw(registrationId) {
    const existing = database.prepare(
      'SELECT * FROM tournament_registrations WHERE id = ?',
    ).get(registrationId)
    if (!existing) return false
    database.prepare(
      "UPDATE tournament_registrations SET status = 'withdrawn' WHERE id = ?",
    ).run(registrationId)
    return true
  },
}

// ── partnerships ──────────────────────────────────────────────────────────────

export const partnerships = {
  list(inningsId) {
    return database.prepare(`
      SELECT p.*,
        p1.name AS batter1_name, p2.name AS batter2_name
      FROM partnerships p
      JOIN players p1 ON p1.id = p.batter1_id
      JOIN players p2 ON p2.id = p.batter2_id
      WHERE p.innings_id = ?
      ORDER BY p.wicket_number
    `).all(inningsId).map((row) => ({
      id:            row.id,
      inningsId:     row.innings_id,
      wicketNumber:  row.wicket_number,
      batter1:       { id: row.batter1_id, name: row.batter1_name },
      batter2:       { id: row.batter2_id, name: row.batter2_name },
      runs:          row.runs,
      balls:         row.balls,
      isUnbroken:    Boolean(row.is_unbroken),
    }))
  },

  upsert(inningsId, data) {
    const partnershipId = data.id ?? id()
    database.prepare(`
      INSERT INTO partnerships (id, innings_id, wicket_number, batter1_id, batter2_id, runs, balls, is_unbroken)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (innings_id, wicket_number) DO UPDATE SET
        runs = excluded.runs,
        balls = excluded.balls,
        is_unbroken = excluded.is_unbroken
    `).run(
      partnershipId, inningsId,
      data.wicketNumber, data.batter1Id, data.batter2Id,
      data.runs, data.balls,
      Number(data.isUnbroken ?? false),
    )
    return this.list(inningsId).find((p) => p.wicketNumber === data.wicketNumber)
  },
}

// ── teamProfile ───────────────────────────────────────────────────────────────

export function getTeamProfile(teamId) {
  const team = database.prepare(`
    SELECT id, name, short_name, color, city, home_ground, is_demo
    FROM teams WHERE id = ?
  `).get(teamId)
  if (!team) return null

  const players = database.prepare(`
    SELECT id, team_id, name, role, jersey_number,
           batting_style, bowling_style, is_active, is_demo
    FROM players WHERE team_id = ? ORDER BY name
  `).all(teamId).map(playerRecord)

  // Match history: matches this team participated in
  const matchRows = database.prepare(`
    SELECT m.id, m.status, m.result, m.started_at, m.is_tie, m.is_abandoned,
      m.win_team_id, t.name AS tournament_name, t.format
    FROM match_teams mt
    JOIN matches m ON m.id = mt.match_id
    JOIN tournaments t ON t.id = m.tournament_id
    WHERE mt.team_id = ?
    ORDER BY m.started_at DESC
    LIMIT 20
  `).all(teamId)

  const recentMatches = matchRows.map((row) => {
    const opponents = database.prepare(`
      SELECT t.id, t.name, t.short_name, t.color
      FROM match_teams mt2
      JOIN teams t ON t.id = mt2.team_id
      WHERE mt2.match_id = ? AND mt2.team_id != ?
    `).all(row.id, teamId).map(teamRecord)

    return {
      id:             row.id,
      status:         row.status,
      result:         row.result,
      date:           row.started_at,
      isAbandoned:    Boolean(row.is_abandoned),
      isTie:          Boolean(row.is_tie),
      won:            row.win_team_id === teamId,
      tournament:     row.tournament_name,
      format:         row.format,
      opponents,
    }
  })

  return {
    ...teamRecord(team),
    players,
    recentMatches,
  }
}

// ── playerStats ───────────────────────────────────────────────────────────────

export function getPlayerStats(playerId) {
  const player = database.prepare(`
    SELECT p.*, t.name AS team_name, t.short_name AS team_short, t.color AS team_color
    FROM players p
    JOIN teams t ON t.id = p.team_id
    WHERE p.id = ?
  `).get(playerId)
  if (!player) return null

  // Batting aggregates (only completed innings)
  const batting = database.prepare(`
    SELECT
      COUNT(*)                              AS innings_count,
      SUM(bf.runs)                          AS total_runs,
      SUM(bf.balls_faced)                   AS total_balls,
      SUM(bf.fours)                         AS total_fours,
      SUM(bf.sixes)                         AS total_sixes,
      MAX(bf.runs)                          AS highest_score,
      SUM(CASE WHEN bf.runs >= 50 AND bf.runs < 100 THEN 1 ELSE 0 END) AS fifties,
      SUM(CASE WHEN bf.runs >= 100 THEN 1 ELSE 0 END)                  AS hundreds,
      SUM(CASE WHEN bf.dismissal IS NOT NULL THEN 1 ELSE 0 END)        AS dismissals
    FROM batting_figures bf
    JOIN innings i ON i.id = bf.innings_id
    WHERE bf.player_id = ?
      AND i.status IN ('completed', 'declared')
  `).get(playerId)

  // Bowling aggregates
  const bowling = database.prepare(`
    SELECT
      COUNT(*)                      AS innings_count,
      SUM(bf.legal_balls)           AS total_balls,
      SUM(bf.runs_conceded)         AS total_runs,
      SUM(bf.wickets)               AS total_wickets,
      SUM(bf.wides)                 AS total_wides,
      SUM(bf.no_balls)              AS total_no_balls,
      MAX(bf.wickets)               AS best_wickets_in_innings,
      MIN(CASE WHEN bf.wickets > 0 THEN bf.runs_conceded ELSE NULL END) AS best_runs_in_innings
    FROM bowling_figures bf
    JOIN innings i ON i.id = bf.innings_id
    WHERE bf.player_id = ?
      AND i.status IN ('completed', 'declared')
  `).get(playerId)

  // Recent innings (batting) with match context
  const recentBatting = database.prepare(`
    SELECT bf.runs, bf.balls_faced, bf.fours, bf.sixes, bf.dismissal,
      m.id AS match_id, m.started_at, i.innings_number,
      t2.name AS opponent_name
    FROM batting_figures bf
    JOIN innings i   ON i.id = bf.innings_id
    JOIN matches  m  ON m.id = i.match_id
    JOIN match_teams mt ON mt.match_id = m.id AND mt.team_id != i.batting_team_id
    JOIN teams t2    ON t2.id = mt.team_id
    WHERE bf.player_id = ?
      AND i.status IN ('completed', 'declared')
    ORDER BY m.started_at DESC
    LIMIT 10
  `).all(playerId)

  // POTM count
  const potmCount = database.prepare(`
    SELECT COUNT(*) AS count FROM matches WHERE player_of_the_match_id = ?
  `).get(playerId).count

  return {
    player:   playerRecord(player),
    teamName: player.team_name,
    teamShort: player.team_short,
    teamColor: player.team_color,
    batting: {
      innings:      batting.innings_count ?? 0,
      runs:         batting.total_runs ?? 0,
      balls:        batting.total_balls ?? 0,
      fours:        batting.total_fours ?? 0,
      sixes:        batting.total_sixes ?? 0,
      highestScore: batting.highest_score ?? 0,
      fifties:      batting.fifties ?? 0,
      hundreds:     batting.hundreds ?? 0,
      average:      batting.dismissals > 0
        ? Math.round((batting.total_runs / batting.dismissals) * 100) / 100
        : null,
      strikeRate:   batting.total_balls > 0
        ? Math.round((batting.total_runs / batting.total_balls) * 10000) / 100
        : null,
    },
    bowling: {
      innings:    bowling.innings_count ?? 0,
      balls:      bowling.total_balls ?? 0,
      runs:       bowling.total_runs ?? 0,
      wickets:    bowling.total_wickets ?? 0,
      wides:      bowling.total_wides ?? 0,
      noBalls:    bowling.total_no_balls ?? 0,
      economy:    bowling.total_balls > 0
        ? Math.round((bowling.total_runs / bowling.total_balls) * 6 * 100) / 100
        : null,
      average:    bowling.total_wickets > 0
        ? Math.round((bowling.total_runs / bowling.total_wickets) * 100) / 100
        : null,
    },
    playerOfTheMatch: potmCount,
    recentBatting: recentBatting.map((r) => ({
      matchId:      r.match_id,
      date:         r.started_at,
      opponent:     r.opponent_name,
      runs:         r.runs,
      balls:        r.balls_faced,
      fours:        r.fours,
      sixes:        r.sixes,
      dismissal:    r.dismissal,
    })),
  }
}

// ── matchResult ───────────────────────────────────────────────────────────────

/**
 * Set the result metadata for a completed match.
 * Also refreshes the denormalised innings totals so NRR is accurate.
 */
export function setMatchResult(matchId, data) {
  const match = database.prepare('SELECT * FROM matches WHERE id = ?').get(matchId)
  if (!match) return null

  database.transaction(() => {
    database.prepare(`
      UPDATE matches SET
        status                  = 'completed',
        result                  = ?,
        win_team_id             = ?,
        is_tie                  = ?,
        is_abandoned            = ?,
        player_of_the_match_id  = ?
      WHERE id = ?
    `).run(
      data.result               ?? match.result,
      data.winTeamId            ?? match.win_team_id,
      Number(data.isTie         ?? Boolean(match.is_tie)),
      Number(data.isAbandoned   ?? Boolean(match.is_abandoned)),
      data.playerOfTheMatchId   ?? match.player_of_the_match_id,
      matchId,
    )

    // Refresh denormalised innings totals
    const inningsRows = database.prepare(
      'SELECT id FROM innings WHERE match_id = ?',
    ).all(matchId)

    for (const { id: inningsId } of inningsRows) {
      const totals = database.prepare(`
        SELECT
          COALESCE(SUM(batter_runs + extra_runs), 0) AS total_runs,
          COALESCE(SUM(CASE WHEN wicket_type IS NOT NULL THEN 1 ELSE 0 END), 0) AS wickets,
          COALESCE(SUM(legal_ball), 0) AS legal_balls
        FROM ball_by_ball_events
        WHERE innings_id = ?
      `).get(inningsId)

      const overs  = Math.floor(totals.legal_balls / 6)
      const balls  = totals.legal_balls % 6
      const oversFaced = overs + balls / 10   // e.g. 19.3

      database.prepare(`
        UPDATE innings SET
          total_runs  = ?,
          wickets     = ?,
          overs_faced = ?
        WHERE id = ?
      `).run(totals.total_runs, totals.wickets, oversFaced, inningsId)
    }
  })()

  return database.prepare('SELECT * FROM matches WHERE id = ?').get(matchId)
}

