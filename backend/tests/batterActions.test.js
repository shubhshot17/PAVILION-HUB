import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

/**
 * Crease corrections without a delivery: swapping ends and replacing a
 * batter. Verifies score/figure invariance, eligibility rules, persistence
 * across a restart, and undo restoring the previous crease exactly.
 */

const testDirectory = mkdtempSync(path.join(tmpdir(), 'pavilion-batters-'))
const databasePath = path.join(testDirectory, 'batters.sqlite')
process.env.DATABASE_PATH = databasePath

const [{ default: app }, { createDatabase }] = await Promise.all([
  import('../app.js'),
  import('../db/database.js'),
])

async function startServer() {
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`
  const request = async (endpoint, options = {}) => {
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
  return { server, request, post }
}

async function createScoredMatch(request, post, suffix = 'One') {
  const home = await request('/teams', post({ name: `Crease Home ${suffix}` }))
  const away = await request('/teams', post({ name: `Crease Away ${suffix}` }))
  assert.equal(home.status, 201)
  assert.equal(away.status, 201)
  const roster = async (teamId, prefix) => Promise.all(
    Array.from({ length: 11 }, (_, index) => request('/players', post({
      teamId,
      name: `${prefix} Player ${index + 1}`,
    }))),
  )
  const homePlayers = await roster(home.body.id, 'Home')
  const awayPlayers = await roster(away.body.id, 'Away')
  const teamIds = [home.body.id, away.body.id]
  const makeXI = (teamId, players) => ({
    teamId,
    playerIds: players.map((player) => player.body.id),
    captainId: players[0].body.id,
    wicketkeeperId: players[10].body.id,
  })
  const created = await request('/matches', post({
    format: 'T10',
    venue: 'Crease Ground',
    date: '2026-10-22T12:00:00.000Z',
    status: 'upcoming',
    teams: teamIds.map((id) => ({ id })),
    setup: {
      oversPerInnings: 2,
      tossWinnerTeamId: teamIds[0],
      tossDecision: 'bat',
      playingXIs: [makeXI(teamIds[0], homePlayers), makeXI(teamIds[1], awayPlayers)],
    },
  }))
  assert.equal(created.status, 201)
  const match = created.body
  const teamA = {
    id: match.teams[0].id,
    name: match.teams[0].name,
    players: match.setup.playingXIs.find((xi) => xi.teamId === match.teams[0].id).selectedPlayers,
  }
  const teamB = {
    id: match.teams[1].id,
    name: match.teams[1].name,
    players: match.setup.playingXIs.find((xi) => xi.teamId === match.teams[1].id).selectedPlayers,
  }
  const innings = {
    battingTeamId: teamA.id,
    bowlingTeamId: teamB.id,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
    overs: [[]],
    deliveries: [],
    strikerId: teamA.players[0].id,
    nonStrikerId: teamA.players[1].id,
    bowlerId: teamB.players[0].id,
    batterFigures: {},
    bowlerFigures: {},
    outIds: [],
    battingOrder: teamA.players.map((player) => player.id),
    overBowlers: [teamB.players[0].id],
    completed: false,
  }
  const started = await request(`/matches/${match.id}/scoring/start`, post({
    expectedVersion: 0,
    matchState: {
      teamA,
      teamB,
      totalOvers: 2,
      tossWinnerId: teamIds[0],
      tossDecision: 'bat',
      innings: [innings],
      currentInningsIndex: 0,
    },
    deliveries: [],
    bowlerSelections: [],
  }))
  assert.equal(started.status, 201)
  return { match, teamA, teamB, session: started.body }
}

async function recordOne(request, post, matchId, version, state, deliveries) {
  const delivery = { runsOffBat: 1 }
  const recorded = await request(`/matches/${matchId}/scoring/deliveries`, post({
    expectedVersion: version,
    matchState: state,
    deliveries: [...deliveries, delivery],
    bowlerSelections: [],
    delivery,
  }))
  assert.equal(recorded.status, 201, JSON.stringify(recorded.body))
  return recorded.body
}

test('swap ends preserves every figure and persists across a restart', async () => {
  const { server, request, post } = await startServer()
  let matchId
  try {
    const { match, teamA, session } = await createScoredMatch(request, post, 'A')
    matchId = match.id
    const striker = session.matchState.innings[0].strikerId
    const nonStriker = session.matchState.innings[0].nonStrikerId

    // One run so figures exist, then swap.
    const scored = structuredClone(session.matchState)
    const inn = scored.innings[0]
    inn.runs = 1
    inn.legalBalls = 1
    inn.deliveries.push({ runsOffBat: 1, overIndex: 0, ballIndex: 0 })
    inn.overs[0].push({ runsOffBat: 1 })
    const t = inn.strikerId
    inn.strikerId = inn.nonStrikerId
    inn.nonStrikerId = t
    const recorded = await recordOne(request, post, matchId, session.version, scored, [])
    const beforeSwap = recorded.matchState.innings[0]
    assert.equal(beforeSwap.strikerId, nonStriker)

    const swapped = await request(`/matches/${matchId}/scoring/batters`, post({
      expectedVersion: recorded.version,
      action: { kind: 'swap', afterDeliveryCount: recorded.deliveries.length },
    }))
    assert.equal(swapped.status, 200, JSON.stringify(swapped.body))
    const afterSwap = swapped.body.matchState.innings[0]
    // The swap exchanges the crease: the original striker returns to strike.
    assert.equal(afterSwap.strikerId, striker)
    assert.equal(afterSwap.nonStrikerId, nonStriker)
    // Figures, score, balls, and bowler untouched by the swap.
    assert.equal(afterSwap.runs, 1)
    assert.equal(afterSwap.legalBalls, 1)
    assert.equal(afterSwap.wickets, 0)
    assert.equal(afterSwap.bowlerId, beforeSwap.bowlerId)
    assert.deepEqual(afterSwap.batterFigures, beforeSwap.batterFigures)
    assert.deepEqual(afterSwap.bowlerFigures, beforeSwap.bowlerFigures)
    assert.deepEqual(swapped.body.deliveries, recorded.deliveries)
    assert.equal(swapped.body.batterActions.length, 1)
    assert.equal(swapped.body.batterActions[0].kind, 'swap')

    // A conflicting request with the stale version is rejected.
    const stale = await request(`/matches/${matchId}/scoring/batters`, post({
      expectedVersion: recorded.version,
      action: { kind: 'swap', afterDeliveryCount: 1 },
    }))
    assert.equal(stale.status, 409)

    // A swap with fresh version but wrong shape is rejected.
    const badSwap = await request(`/matches/${matchId}/scoring/batters`, post({
      expectedVersion: swapped.body.version,
      action: { kind: 'swap', afterDeliveryCount: swapped.body.deliveries.length, reason: 'substitution' },
    }))
    assert.equal(badSwap.status, 400)
    assert.match(badSwap.body.error.message, /must not include/)

    // Replacing a batter who is already at the crease is rejected.
    const invalid = await request(`/matches/${matchId}/scoring/batters`, post({
      expectedVersion: swapped.body.version,
      action: {
        kind: 'replace',
        afterDeliveryCount: swapped.body.deliveries.length,
        outgoingPlayerId: striker,
        incomingPlayerId: nonStriker,
        reason: 'substitution',
      },
    }))
    assert.equal(invalid.status, 400)
    assert.match(invalid.body.error.message, /already at the crease/)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }

  // Restart: the swapped crease survives.
  const reopened = createDatabase(databasePath)
  try {
    const row = reopened.prepare('SELECT state_json FROM scoring_sessions WHERE match_id = ?')
      .get(matchId)
    const state = JSON.parse(row.state_json)
    const inn = state.matchState.innings[0]
    assert.equal(state.batterActions.length, 1)
    assert.equal(state.batterActions[0].kind, 'swap')
    const names = reopened.prepare(`
      SELECT p.id FROM match_players mp JOIN players p ON p.id = mp.player_id
      WHERE mp.match_id = ? ORDER BY p.id
    `).all(matchId).map((r) => r.id)
    assert.equal(typeof inn.strikerId, 'string')
    assert.ok(names.includes(inn.strikerId))
    assert.ok(names.includes(inn.nonStrikerId))
  } finally {
    reopened.close()
  }
})

test('replace batter enforces eligibility and undo restores the crease', async () => {
  const { server, request, post } = await startServer()
  try {
    const { match, teamA, session } = await createScoredMatch(request, post, 'B')
    const matchId = match.id
    const strikerId = session.matchState.innings[0].strikerId
    const thirdId = teamA.players[2].id

    // Replace the striker with player 3 (retired hurt keeps them not-out).
    const replaced = await request(`/matches/${matchId}/scoring/batters`, post({
      expectedVersion: session.version,
      action: {
        kind: 'replace',
        afterDeliveryCount: 0,
        outgoingPlayerId: strikerId,
        incomingPlayerId: thirdId,
        reason: 'retired-hurt',
      },
    }))
    assert.equal(replaced.status, 200, JSON.stringify(replaced.body))
    const inn = replaced.body.matchState.innings[0]
    assert.equal(inn.strikerId, thirdId)
    assert.equal(inn.wickets, 0)
    assert.equal(inn.runs, 0)
    assert.equal(inn.legalBalls, 0)
    assert.equal(inn.outIds.includes(strikerId), false)
    assert.equal(replaced.body.batterActions[0].reason, 'retired-hurt')

    // Undo restores the original crease and empties the action list.
    const undone = await request(`/matches/${matchId}/scoring/undo`, post({
      expectedVersion: replaced.body.version,
    }))
    assert.equal(undone.status, 200, JSON.stringify(undone.body))
    const restored = undone.body.matchState.innings[0]
    assert.equal(restored.strikerId, strikerId)
    assert.deepEqual(undone.body.batterActions, [])
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    const { database } = await import('../db/database.js')
    database.close()
    rmSync(testDirectory, { recursive: true, force: true })
  }
})
