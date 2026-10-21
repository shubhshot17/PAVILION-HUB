/**
 * PAVILION HUB — Points / NRR engine
 * ------------------------------------
 * Pure-function helpers that compute a tournament standings table from
 * persisted match results.  These functions are deliberately free of
 * Express/HTTP concerns so they can be imported by both the HTTP layer
 * and the test suite.
 *
 * Rules (all configurable via tournament.win_points / tie_points / no_result_points):
 *  • completed, NOT abandoned, NOT tie  → winner gets win_points,  loser 0
 *  • completed, is_tie = 1              → both teams get tie_points
 *  • abandoned / status = 'abandoned'   → both teams get no_result_points,
 *                                         NOT counted in NRR
 *  • any other status (live/upcoming)   → ignored entirely
 *
 * NRR = (total runs scored / total overs batted) − (total runs conceded / total overs bowled)
 * Only fully-completed innings from completed non-abandoned matches count.
 * When a team is all-out before the allotted overs, the FULL allotted overs
 * are used as the denominator (standard ICC rule).
 */

import { database } from '../db/database.js'

/**
 * Convert fractional overs (e.g. 19.3) to a pure ball count.
 * 19.3 → 19 overs × 6 + 3 balls = 117 balls.
 */
function overs2balls(overs) {
  const full = Math.floor(overs)
  const balls = Math.round((overs - full) * 10) // tenths digit = balls in partial over
  return full * 6 + balls
}

/**
 * Convert a ball count back to fractional overs (117 → 19.3).
 */
function balls2overs(balls) {
  return Math.floor(balls / 6) + (balls % 6) / 10
}

/**
 * Compute the fractional overs used as the NRR denominator for one innings.
 * If the team was all-out, use the full allotted overs.
 */
function nrrOvers(inningsRow, allocatedOvers) {
  if (inningsRow.is_all_out) {
    return allocatedOvers
  }
  return inningsRow.overs_faced
}

/**
 * Build the standings table for a given tournament.
 *
 * @param {string} tournamentId
 * @returns {Array<StandingRow>}  sorted by points desc, NRR desc
 */
export function computeStandings(tournamentId) {
  const tournament = database
    .prepare('SELECT * FROM tournaments WHERE id = ?')
    .get(tournamentId)
  if (!tournament) return []

  const { win_points, tie_points, no_result_points, overs_per_innings } = tournament

  // All registered teams (even those with no matches yet)
  const teams = database.prepare(`
    SELECT t.id, t.name, t.short_name
    FROM tournament_registrations tr
    JOIN teams t ON t.id = tr.team_id
    WHERE tr.tournament_id = ? AND tr.status = 'registered'
  `).all(tournamentId)

  // Accumulator keyed by teamId
  const acc = {}
  for (const t of teams) {
    acc[t.id] = {
      teamId: t.id,
      teamName: t.name,
      shortName: t.short_name,
      played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0,
      // NRR components (in balls)
      runsFor: 0, ballsFor: 0, runsAgainst: 0, ballsAgainst: 0,
    }
  }

  // All completed matches in this tournament
  const completedMatches = database.prepare(`
    SELECT m.id, m.is_tie, m.is_abandoned, m.win_team_id, m.status
    FROM matches m
    WHERE m.tournament_id = ? AND m.status = 'completed'
  `).all(tournamentId)

  for (const match of completedMatches) {
    const matchTeams = database.prepare(`
      SELECT team_id FROM match_teams WHERE match_id = ? ORDER BY batting_order
    `).all(match.id)

    if (matchTeams.length !== 2) continue  // malformed, skip

    const [teamA, teamB] = matchTeams.map((r) => r.team_id)

    // Skip teams not (or no longer) registered in this tournament
    if (!acc[teamA] || !acc[teamB]) continue

    acc[teamA].played++
    acc[teamB].played++

    if (match.is_abandoned) {
      // No-result: both get no_result_points, excluded from NRR
      acc[teamA].noResult++
      acc[teamB].noResult++
      acc[teamA].points += no_result_points
      acc[teamB].points += no_result_points
      continue
    }

    if (match.is_tie) {
      acc[teamA].tied++
      acc[teamB].tied++
      acc[teamA].points += tie_points
      acc[teamB].points += tie_points
    } else if (match.win_team_id) {
      const loser = match.win_team_id === teamA ? teamB : teamA
      if (acc[match.win_team_id]) {
        acc[match.win_team_id].won++
        acc[match.win_team_id].points += win_points
      }
      if (acc[loser]) acc[loser].lost++
    }

    // NRR — use innings totals for completed innings only
    const innings = database.prepare(`
      SELECT i.innings_number, i.batting_team_id, i.total_runs, i.overs_faced, i.is_all_out, i.status
      FROM innings i
      WHERE i.match_id = ? AND i.status IN ('completed', 'declared')
      ORDER BY i.innings_number
    `).all(match.id)

    // For limited-overs formats: innings 1 = team batting first, innings 2 = team batting second
    // Only the first two innings count for NRR in T20/ODI
    const inning1 = innings.find((i) => i.innings_number === 1)
    const inning2 = innings.find((i) => i.innings_number === 2)
    if (!inning1 || !inning2) continue // incomplete, skip NRR

    const overs1 = nrrOvers(inning1, overs_per_innings)
    const overs2 = nrrOvers(inning2, overs_per_innings)
    const balls1 = overs2balls(overs1)
    const balls2 = overs2balls(overs2)

    // Team that batted in innings 1
    const battingFirst  = inning1.batting_team_id
    const battingSecond = inning2.batting_team_id

    if (acc[battingFirst]) {
      acc[battingFirst].runsFor      += inning1.total_runs
      acc[battingFirst].ballsFor     += balls1
      acc[battingFirst].runsAgainst  += inning2.total_runs
      acc[battingFirst].ballsAgainst += balls2
    }
    if (acc[battingSecond]) {
      acc[battingSecond].runsFor      += inning2.total_runs
      acc[battingSecond].ballsFor     += balls2
      acc[battingSecond].runsAgainst  += inning1.total_runs
      acc[battingSecond].ballsAgainst += balls1
    }
  }

  // Compute NRR and sort
  const rows = Object.values(acc).map((row) => {
    const nrrFor     = row.ballsFor     > 0 ? (row.runsFor     / row.ballsFor)     * 6 : 0
    const nrrAgainst = row.ballsAgainst > 0 ? (row.runsAgainst / row.ballsAgainst) * 6 : 0
    return {
      teamId:     row.teamId,
      teamName:   row.teamName,
      shortName:  row.shortName,
      played:     row.played,
      won:        row.won,
      lost:       row.lost,
      tied:       row.tied,
      noResult:   row.noResult,
      points:     row.points,
      netRunRate: Math.round((nrrFor - nrrAgainst) * 1000) / 1000,
    }
  })

  rows.sort((a, b) =>
    b.points - a.points || b.netRunRate - a.netRunRate || a.teamName.localeCompare(b.teamName),
  )

  return rows
}

/**
 * Compute the knockout bracket for a tournament.
 * Returns rounds (array of arrays of fixture rows), ordered from earliest to latest.
 * Stages are distinguished by fixture.stage.
 *
 * @param {string} tournamentId
 * @returns {Array<{stage: string, matches: Array}>}
 */
export function computeBracket(tournamentId) {
  const fixtures = database.prepare(`
    SELECT f.*,
      ht.name AS home_name, ht.short_name AS home_short,
      at.name AS away_name, at.short_name AS away_short,
      m.status AS match_status, m.result AS match_result,
      m.win_team_id
    FROM fixtures f
    JOIN teams ht ON ht.id = f.home_team_id
    JOIN teams at ON at.id = f.away_team_id
    LEFT JOIN matches m ON m.id = f.linked_match_id
    WHERE f.tournament_id = ? AND f.stage != 'League'
    ORDER BY f.round_number, f.bracket_slot
  `).all(tournamentId)

  const stages = {}
  for (const f of fixtures) {
    if (!stages[f.stage]) stages[f.stage] = []
    stages[f.stage].push({
      id:           f.id,
      stage:        f.stage,
      roundNumber:  f.round_number,
      bracketSlot:  f.bracket_slot,
      scheduledAt:  f.scheduled_at,
      venue:        f.venue,
      homeTeam:     { id: f.home_team_id, name: f.home_name, shortName: f.home_short },
      awayTeam:     { id: f.away_team_id, name: f.away_name, shortName: f.away_short },
      status:       f.status,
      matchStatus:  f.match_status,
      matchResult:  f.match_result,
      winTeamId:    f.win_team_id,
    })
  }

  return Object.entries(stages)
    .sort(([, a], [, b]) => a[0].roundNumber - b[0].roundNumber)
    .map(([stage, matches]) => ({ stage, matches }))
}

