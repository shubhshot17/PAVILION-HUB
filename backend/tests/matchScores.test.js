import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

const testDirectory = mkdtempSync(path.join(tmpdir(), 'pavilion-match-scores-'))
const databasePath = path.join(testDirectory, 'scores.sqlite')
process.env.DATABASE_PATH = databasePath
const [{ default: app }, { database, createDatabase }] = await Promise.all([
  import('../app.js'),
  import('../db/database.js'),
])


/**
 * A scored match lists its live score from the persisted event ledger, so the
 * matches page can show real runs/wickets/overs for each side.
 */
test('scored matches expose per-team scores from the persisted ledger', async () => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`

  async function request(endpoint, options = {}) {
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

  try {
    const home = await request('/teams', post({ name: 'Score Home' }))
    const away = await request('/teams', post({ name: 'Score Away' }))
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
    const setup = {
      oversPerInnings: 5,
      tossWinnerTeamId: teamIds[0],
      tossDecision: 'bat',
      playingXIs: [makeXI(teamIds[0], homePlayers), makeXI(teamIds[1], awayPlayers)],
    }
    const created = await request('/matches', post({
      title: 'Ledger check',
      format: 'T10',
      venue: 'Ledger Ground',
      date: '2026-10-22T12:00:00.000Z',
      status: 'upcoming',
      teams: teamIds.map((id) => ({ id })),
      setup,
    }))
    assert.equal(created.status, 201)
    const match = created.body
    const matchTeamA = {
      id: match.teams[0].id,
      name: match.teams[0].name,
      players: match.setup.playingXIs.find((xi) => xi.teamId === match.teams[0].id).selectedPlayers,
    }
    const matchTeamB = {
      id: match.teams[1].id,
      name: match.teams[1].name,
      players: match.setup.playingXIs.find((xi) => xi.teamId === match.teams[1].id).selectedPlayers,
    }
    const innings = {
      battingTeamId: matchTeamA.id,
      bowlingTeamId: matchTeamB.id,
      runs: 0,
      wickets: 0,
      legalBalls: 0,
      extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
      overs: [[]],
      deliveries: [],
      strikerId: matchTeamA.players[0].id,
      nonStrikerId: matchTeamA.players[1].id,
      bowlerId: matchTeamB.players[0].id,
      batterFigures: {},
      bowlerFigures: {},
      outIds: [],
      battingOrder: matchTeamA.players.map((player) => player.id),
      overBowlers: [matchTeamB.players[0].id],
      completed: false,
    }
    const started = await request(`/matches/${match.id}/scoring/start`, post({
      expectedVersion: 0,
      matchState: {
        teamA: matchTeamA,
        teamB: matchTeamB,
        totalOvers: 5,
        tossWinnerId: teamIds[0],
        tossDecision: 'bat',
        innings: [innings],
        currentInningsIndex: 0,
      },
      deliveries: [],
      bowlerSelections: [],
    }))
    assert.equal(started.status, 201)

    // 6 legal singles â†’ 6 runs, over complete. The backend verifies each
    // state structurally (totals, history, players), so the state is built
    // step by step exactly as the scoring engine would produce it.
    const delivery = { runs: 1, eventType: 'run' }
    const baseState = started.body.matchState
    let state = structuredClone(baseState)
    let deliveries = []
    for (let i = 0; i < 6; i++) {
      const expected = structuredClone(state)
      const inn = expected.innings[0]
      inn.runs += 1
      inn.legalBalls += 1
      inn.deliveries.push({ ...delivery, runsOffBat: 1, overIndex: 0, ballIndex: i })
      inn.overs[0].push({ runsOffBat: 1 })
      // strike swaps every odd run
      if (i % 2 === 0) {
        const t = inn.strikerId
        inn.strikerId = inn.nonStrikerId
        inn.nonStrikerId = t
      }
      if (i === 5) {
        // end of over: swap ends, open next over bucket
        const t = inn.strikerId
        inn.strikerId = inn.nonStrikerId
        inn.nonStrikerId = t
        inn.overs.push([])
      }
      const recorded = await request(`/matches/${match.id}/scoring/deliveries`, post({
        expectedVersion: started.body.version + i,
        matchState: expected,
        deliveries: [...deliveries, { runsOffBat: 1 }],
        bowlerSelections: [],
        delivery: { runsOffBat: 1 },
      }))
      assert.equal(recorded.status, 201, JSON.stringify(recorded.body))
      state = recorded.body.matchState
      deliveries = recorded.body.deliveries
    }

    const listed = await request('/matches')
    const row = listed.body.find((item) => item.id === match.id)
    assert.ok(Array.isArray(row.scores), 'scored match should expose scores')
    assert.deepEqual(row.scores.filter(Boolean).map((score) => ({
      runs: score.runs, wickets: score.wickets, overs: score.overs,
    })), [{ runs: 6, wickets: 0, overs: 1 }])
    assert.equal(row.status, 'live')
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    const { database } = await import('../db/database.js')
    database.close()
    rmSync(testDirectory, { recursive: true, force: true })
  }
})
