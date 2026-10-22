/**
 * PAVILION HUB — Tournament management tests
 * ------------------------------------------
 * Tests covering:
 *   • Points calculation (win, loss, tie, no-result/abandoned)
 *   • Net Run Rate computation (including all-out vs overs-used denominator)
 *   • Double-counting guard (abandoned matches excluded from NRR)
 *   • Fixture scheduling (validates registered teams, blocks same-team fixtures)
 *   • Team registration (idempotency, duplicate guard, re-register after withdrawal)
 *   • Player stats aggregates
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'

const testDirectory = mkdtempSync(path.join(tmpdir(), 'pavilion-hub-tournament-test-'))
const databasePath = path.join(testDirectory, 'test.sqlite')
process.env.DATABASE_PATH = databasePath

const [{ default: app }, { database }] = await Promise.all([
  import('../app.js'),
  import('../db/database.js'),
])
const { computeStandings } = await import('../lib/pointsEngine.js')
let tournamentSequence = 0

// ── HTTP helper ───────────────────────────────────────────────────────────────

let server
let baseUrl

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}/api`
})

async function req(endpoint, options = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    signal: AbortSignal.timeout(5000),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}
const post = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
const patch = (body) => ({
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

// ── Shared fixture setup ──────────────────────────────────────────────────────

async function buildTournament() {
  tournamentSequence += 1
  const suffix = String(tournamentSequence)
  const tRes = await req('/tournaments', post({
    name: `Test Premier League ${suffix}`,
    season: '2026',
    format: 'T20',
    isActive: true,
    tournamentType: 'round_robin',
    oversPerInnings: 20,
    winPoints: 2,
    tiePoints: 1,
    noResultPoints: 1,
  }))
  assert.equal(tRes.status, 201)
  const tournament = tRes.body

  // Create three teams
  const teams = []
  for (const [name, shortName] of [
    [`Alpha XI ${suffix}`, `A${suffix}X`],
    [`Beta Warriors ${suffix}`, `B${suffix}W`],
    [`Gamma Stars ${suffix}`, `G${suffix}S`],
  ]) {
    const t = await req('/teams', post({ name, shortName, color: '#ffffff' }))
    assert.equal(t.status, 201)
    teams.push(t.body)
  }

  // Register all three
  for (const team of teams) {
    const r = await req(`/tournaments/${tournament.id}/registrations`, post({ teamId: team.id }))
    assert.equal(r.status, 201)
  }

  return { tournament, teams }
}

async function buildMatch(tournament, home, away, opts = {}) {
  const m = await req('/matches', post({
    tournament: tournament.name,
    tournamentId: tournament.id,
    format: tournament.format,
    venue: 'Test Ground',
    date: opts.date ?? '2026-10-01T10:00:00Z',
    status: 'live',
    teams: [{ id: home.id }, { id: away.id }],
  }))
  assert.equal(m.status, 201, `Failed to create match: ${JSON.stringify(m.body)}`)
  return m.body
}

/**
 * Insert a minimal innings directly into the DB for NRR testing.
 * overs: fractional (e.g. 20.0 = 20 full overs, 19.3 = 19 overs 3 balls)
 */


function setMatchCompleted(matchId, winTeamId, opts = {}) {
  database.prepare(`
    UPDATE matches SET
      status = 'completed',
      win_team_id = ?,
      is_tie = ?,
      is_abandoned = ?,
      result = ?
    WHERE id = ?
  `).run(
    winTeamId ?? null,
    Number(opts.isTie ?? false),
    Number(opts.isAbandoned ?? false),
    opts.result ?? (winTeamId ? 'Team won' : 'No result'),
    matchId,
  )
}

function insertInnings(matchId, inningsNumber, battingTeamId, bowlingTeamId, runs, overs, isAllOut = false) {
  const existing = database.prepare(
    'SELECT id FROM innings WHERE match_id = ? AND innings_number = ?',
  ).get(matchId, inningsNumber)

  if (existing) {
    database.prepare(`
      UPDATE innings SET total_runs = ?, overs_faced = ?, is_all_out = ?, status = 'completed'
      WHERE id = ?
    `).run(runs, overs, Number(isAllOut), existing.id)
    return existing.id
  }

  database.prepare(`
    INSERT INTO innings (id, match_id, innings_number, batting_team_id, bowling_team_id, status, total_runs, overs_faced, is_all_out)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, 'completed', ?, ?, ?)
  `).run(matchId, inningsNumber, battingTeamId, bowlingTeamId, runs, overs, Number(isAllOut))

  return database.prepare(
    'SELECT id FROM innings WHERE match_id = ? AND innings_number = ?',
  ).get(matchId, inningsNumber).id
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test('tournament creation with extended fields', async () => {
  const res = await req('/tournaments', post({
    name: 'Extended Fields Cup',
    season: '2026',
    format: 'T20',
    isActive: true,
    tournamentType: 'round_robin_knockout',
    oversPerInnings: 10,
    winPoints: 3,
    tiePoints: 1,
    noResultPoints: 0,
  }))
  assert.equal(res.status, 201)
  assert.equal(res.body.tournamentType, 'round_robin_knockout')
  assert.equal(res.body.oversPerInnings, 10)
  assert.equal(res.body.winPoints, 3)
  assert.equal(res.body.tiePoints, 1)
  assert.equal(res.body.noResultPoints, 0)
})

test('team registration: register, duplicate rejection, withdrawal, re-register', async () => {
  const { tournament, teams } = await buildTournament()

  // Duplicate registration should fail
  const dup = await req(`/tournaments/${tournament.id}/registrations`, post({ teamId: teams[0].id }))
  assert.equal(dup.status, 409)
  assert.ok(dup.body.error.message.includes('already registered'))

  // Withdraw
  const regs = await req(`/tournaments/${tournament.id}/registrations`)
  assert.equal(regs.status, 200)
  const reg = regs.body.find((r) => r.teamId === teams[0].id)
  assert.ok(reg)
  const del = await req(`/tournaments/${tournament.id}/registrations/${reg.id}`, { method: 'DELETE' })
  assert.equal(del.status, 204)

  // Re-register after withdrawal
  const reReg = await req(`/tournaments/${tournament.id}/registrations`, post({ teamId: teams[0].id }))
  assert.equal(reReg.status, 201)
  assert.equal(reReg.body.status, 'registered')
})

test('fixture scheduling validates registered teams', async () => {
  const { tournament, teams } = await buildTournament()

  // Valid fixture
  const ok = await req(`/tournaments/${tournament.id}/fixtures`, post({
    homeTeamId: teams[0].id,
    awayTeamId: teams[1].id,
    scheduledAt: '2026-11-01T10:00:00Z',
    venue: 'Test Ground',
  }))
  assert.equal(ok.status, 201)

  // Same-team fixture should fail
  const sameTeam = await req(`/tournaments/${tournament.id}/fixtures`, post({
    homeTeamId: teams[0].id,
    awayTeamId: teams[0].id,
    scheduledAt: '2026-11-01T10:00:00Z',
    venue: 'Test Ground',
  }))
  assert.equal(sameTeam.status, 400)

  // Unregistered team should fail
  const unregRes = await req('/teams', post({ name: 'Outsider FC', shortName: 'OFC', color: '#f0f0f0' }))
  const outsider = unregRes.body
  const unregd = await req(`/tournaments/${tournament.id}/fixtures`, post({
    homeTeamId: teams[0].id,
    awayTeamId: outsider.id,
    scheduledAt: '2026-11-01T10:00:00Z',
    venue: 'Test Ground',
  }))
  assert.equal(unregd.status, 400)
  assert.ok(unregd.body.error.message.includes('registered in the tournament'))
})

test('points table: win = 2pts, loss = 0', async () => {
  const { tournament, teams } = await buildTournament()
  const match = await buildMatch(tournament, teams[0], teams[1])

  insertInnings(match.id, 1, teams[0].id, teams[1].id, 160, 20.0, false)
  insertInnings(match.id, 2, teams[1].id, teams[0].id, 155, 20.0, false)
  setMatchCompleted(match.id, teams[0].id, { result: 'Alpha XI won by 5 runs' })

  const standings = computeStandings(tournament.id)
  const alpha = standings.find((r) => r.teamId === teams[0].id)
  const beta  = standings.find((r) => r.teamId === teams[1].id)

  assert.equal(alpha.points, 2, 'winner should have 2 points')
  assert.equal(alpha.won, 1)
  assert.equal(beta.points, 0, 'loser should have 0 points')
  assert.equal(beta.lost, 1)
})

test('points table: tie = 1pt each', async () => {
  const { tournament, teams } = await buildTournament()
  const match = await buildMatch(tournament, teams[0], teams[1])

  insertInnings(match.id, 1, teams[0].id, teams[1].id, 150, 20.0, false)
  insertInnings(match.id, 2, teams[1].id, teams[0].id, 150, 20.0, false)
  setMatchCompleted(match.id, null, { isTie: true, result: 'Match tied' })

  const standings = computeStandings(tournament.id)
  const alpha = standings.find((r) => r.teamId === teams[0].id)
  const beta  = standings.find((r) => r.teamId === teams[1].id)

  assert.equal(alpha.points, 1)
  assert.equal(alpha.tied, 1)
  assert.equal(beta.points, 1)
  assert.equal(beta.tied, 1)
})

test('points table: abandoned / no-result = 1pt each, excluded from NRR', async () => {
  const { tournament, teams } = await buildTournament()
  const match = await buildMatch(tournament, teams[0], teams[1])

  // Partial innings (only 5 overs bowled) — shouldn't count for NRR
  insertInnings(match.id, 1, teams[0].id, teams[1].id, 45, 5.0, false)
  setMatchCompleted(match.id, null, { isAbandoned: true, result: 'Match abandoned — rain' })

  const standings = computeStandings(tournament.id)
  const alpha = standings.find((r) => r.teamId === teams[0].id)
  const beta  = standings.find((r) => r.teamId === teams[1].id)

  // Each gets noResultPoints (1 by default)
  assert.equal(alpha.points, 1)
  assert.equal(alpha.noResult, 1)
  assert.equal(beta.points, 1)

  // NRR must be 0 (abandoned match excluded)
  assert.equal(alpha.netRunRate, 0, 'abandoned match must NOT affect NRR')
  assert.equal(beta.netRunRate, 0)
})

test('NRR calculation: standard overs used', async () => {
  const { tournament, teams } = await buildTournament()
  const match = await buildMatch(tournament, teams[0], teams[1])

  // Alpha score 180/4 in 20 overs; Beta score 170/6 in 20 overs → Alpha wins
  insertInnings(match.id, 1, teams[0].id, teams[1].id, 180, 20.0, false)
  insertInnings(match.id, 2, teams[1].id, teams[0].id, 170, 20.0, false)
  setMatchCompleted(match.id, teams[0].id, { result: 'Alpha XI won by 10 runs' })

  const standings = computeStandings(tournament.id)
  const alpha = standings.find((r) => r.teamId === teams[0].id)
  const beta  = standings.find((r) => r.teamId === teams[1].id)

  // Alpha: scored 180 in 120 balls = 9.0 rpo; conceded 170 in 120 balls = 8.5 rpo → NRR = 0.5
  assert.ok(alpha.netRunRate > 0, `Alpha NRR should be positive, got ${alpha.netRunRate}`)
  assert.ok(beta.netRunRate  < 0, `Beta  NRR should be negative, got ${beta.netRunRate}`)
  assert.ok(Math.abs(alpha.netRunRate - 0.5) < 0.01, `Alpha NRR should be ~0.5, got ${alpha.netRunRate}`)
})

test('NRR calculation: all-out team uses full allotted overs as denominator', async () => {
  const { tournament, teams } = await buildTournament()
  const match = await buildMatch(tournament, teams[0], teams[1])

  // Alpha score 120 all out in 18 overs; Beta chase 121 in 15 overs (not all out)
  // ICC rule: Alpha's NRR denominator = 20 (allotted overs), not 18
  insertInnings(match.id, 1, teams[0].id, teams[1].id, 120, 18.0, true)  // all out
  insertInnings(match.id, 2, teams[1].id, teams[0].id, 121, 15.0, false) // not all out
  setMatchCompleted(match.id, teams[1].id, { result: 'Beta Warriors won by wickets' })

  const standings = computeStandings(tournament.id)
  const alpha = standings.find((r) => r.teamId === teams[0].id)

  // Alpha scored 120 runs; denominator = 20 overs (120 balls) = 6.0 rpo
  // Alpha conceded 121 runs; denominator = 15 overs (90 balls) = 8.067 rpo
  // Alpha NRR = 6.0 - 8.067 = -2.067 (approx)
  assert.ok(alpha.netRunRate < -1, `Alpha all-out NRR should be heavily negative, got ${alpha.netRunRate}`)
})

test('incomplete innings are excluded from NRR (only completed status counts)', async () => {
  const { tournament, teams } = await buildTournament()
  const match = await buildMatch(tournament, teams[0], teams[1])

  // Only insert innings 1, leave innings 2 missing → both innings needed for NRR
  insertInnings(match.id, 1, teams[0].id, teams[1].id, 180, 20.0, false)
  // Manually set match completed but innings 2 is still in_progress / missing
  setMatchCompleted(match.id, teams[0].id, { result: 'Alpha XI won (incomplete innings 2 test)' })

  const standings = computeStandings(tournament.id)
  const alpha = standings.find((r) => r.teamId === teams[0].id)

  // Points should still be awarded
  assert.equal(alpha.points, 2, 'points awarded even with incomplete innings')
  // NRR should be 0 because innings 2 is missing (engine skips NRR when both innings not available)
  assert.equal(alpha.netRunRate, 0, 'NRR should be 0 when 2nd innings is missing')
})

test('player stats endpoint returns batting/bowling aggregates', async () => {
  const teamRes = await req('/teams', post({ name: 'Stats Test Team', shortName: 'STT', color: '#abc123' }))
  const player  = await req('/players', post({ teamId: teamRes.body.id, name: 'Stat Batter', role: 'batter' }))
  const pId = player.body.id

  const statsRes = await req(`/players/${pId}/stats`)
  assert.equal(statsRes.status, 200)
  assert.equal(statsRes.body.batting.innings, 0)  // no innings yet
  assert.equal(statsRes.body.bowling.wickets, 0)
  assert.equal(statsRes.body.playerOfTheMatch, 0)
})

test('match result endpoint sets winner, POTM, and updates match', async () => {
  const { tournament, teams } = await buildTournament()
  const match = await buildMatch(tournament, teams[0], teams[1])

  // Create a player on teams[0] to be POTM
  const potmRes = await req('/players', post({ teamId: teams[0].id, name: 'POTM Player', role: 'all-rounder' }))
  const potmId = potmRes.body.id

  const result = await req(`/matches/${match.id}/result`, patch({
    result:              'Alpha XI won by 10 runs',
    winTeamId:           teams[0].id,
    isTie:               false,
    isAbandoned:         false,
    playerOfTheMatchId:  potmId,
  }))
  assert.equal(result.status, 200)

  // Verify standings
  const standings = computeStandings(tournament.id)
  const alpha = standings.find((r) => r.teamId === teams[0].id)
  assert.equal(alpha.won, 1)
})

test('scoring events refresh completed innings and feed tournament NRR', async () => {
  const { tournament, teams } = await buildTournament()
  const match = await buildMatch(tournament, teams[0], teams[1])

  const record = (innings, ball, runs, eventType = 'run', legalBall = true) =>
    req('/scoring-events', post({
      matchId: match.id,
      innings,
      over: 0,
      ball,
      runs,
      eventType,
      legalBall,
    }))

  const boundary = await record(1, 1, 4, 'boundary')
  assert.equal(boundary.status, 201)
  const wideWithAdditionalRun = await record(1, 2, 2, 'wide', false)
  assert.equal(wideWithAdditionalRun.status, 201)
  const illegalWide = await record(1, 3, 1, 'wide', true)
  assert.equal(illegalWide.status, 400)
  for (let ball = 2; ball <= 6; ball++) {
    assert.equal((await record(1, ball, 0)).status, 201)
  }
  for (let ball = 1; ball <= 6; ball++) {
    assert.equal((await record(2, ball, ball === 1 ? 3 : 0)).status, 201)
  }

  const result = await req(`/matches/${match.id}/result`, patch({
    result: 'Alpha XI won by 3 runs',
    winTeamId: teams[0].id,
  }))
  assert.equal(result.status, 200)

  const inningsRows = database.prepare(`
    SELECT total_runs, wickets, overs_faced, is_all_out, status
    FROM innings WHERE match_id = ? ORDER BY innings_number
  `).all(match.id)
  assert.deepEqual(inningsRows.map(({ total_runs, wickets, overs_faced, status }) => ({
    total_runs, wickets, overs_faced, status,
  })), [
    { total_runs: 6, wickets: 0, overs_faced: 1, status: 'completed' },
    { total_runs: 3, wickets: 0, overs_faced: 1, status: 'completed' },
  ])

  const standings = await req(`/tournaments/${tournament.id}/standings`)
  assert.equal(standings.status, 200)
  assert.equal(standings.body.find(({ teamId }) => teamId === teams[0].id).points, 2)
  assert.equal(standings.body.find(({ teamId }) => teamId === teams[0].id).netRunRate, 3)
  assert.equal(standings.body.find(({ teamId }) => teamId === teams[1].id).netRunRate, -3)

  const invalidWinner = await req(`/matches/${match.id}/result`, patch({
    result: 'Invalid winner',
    winTeamId: teams[2].id,
  }))
  assert.equal(invalidWinner.status, 400)
})

test('teams page: GET /api/tournaments/:id/registrations returns registered teams', async () => {
  const { tournament, teams } = await buildTournament()
  const res = await req(`/tournaments/${tournament.id}/registrations`)
  assert.equal(res.status, 200)
  assert.equal(res.body.length, 3, 'three teams registered')
  for (const team of teams) {
    assert.ok(res.body.some((r) => r.teamId === team.id), `Team ${team.name} should be in registrations`)
  }
})

test('knockout bracket returns staged fixtures', async () => {
  const { tournament, teams } = await buildTournament()

  // Create a semi-final fixture
  const sfRes = await req(`/tournaments/${tournament.id}/fixtures`, post({
    homeTeamId:  teams[0].id,
    awayTeamId:  teams[1].id,
    scheduledAt: '2026-11-10T14:00:00Z',
    venue:       'Finals Oval',
    stage:       'Semi-Final',
    roundNumber: 2,
  }))
  assert.equal(sfRes.status, 201)

  const bracket = await req(`/tournaments/${tournament.id}/bracket`)
  assert.equal(bracket.status, 200)
  assert.equal(bracket.body.length, 1)
  assert.equal(bracket.body[0].stage, 'Semi-Final')
  assert.equal(bracket.body[0].matches.length, 1)
})

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
  database.close()
  rmSync(testDirectory, { recursive: true, force: true })
})
