import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

const testDirectory = mkdtempSync(path.join(tmpdir(), 'pavilion-scoring-'))
const databasePath = path.join(testDirectory, 'scoring.sqlite')
process.env.DATABASE_PATH = databasePath
const [{ default: app }, { database, createDatabase }] = await Promise.all([
  import('../app.js'),
  import('../db/database.js'),
])

test('persists ball-by-ball scoring, rejects stale updates, and audits undo across reopen', async () => {
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

  let match
  let eventId
  try {
    const home = await request('/teams', post({ name: 'Scoring Home' }))
    const away = await request('/teams', post({ name: 'Scoring Away' }))
    const roster = async (teamId, prefix) => Promise.all(
      Array.from({ length: 11 }, (_, index) => request('/players', post({
        teamId,
        name: `${prefix} Player ${index + 1}`,
      }))),
    )
    const homePlayers = await roster(home.body.id, 'Home')
    const awayPlayers = await roster(away.body.id, 'Away')
    const tournament = await request('/tournaments', post({
      name: 'Scoring Cup',
      season: '2026',
      format: 'T10',
      isActive: true,
    }))
    const teamIds = [home.body.id, away.body.id]
    const makeXI = (teamId, players) => ({
      teamId,
      playerIds: players.map((player) => player.body.id),
      captainId: players[0].body.id,
      wicketkeeperId: players[10].body.id,
    })
    const setup = {
      oversPerInnings: 2,
      tossWinnerTeamId: teamIds[0],
      tossDecision: 'bat',
      playingXIs: [
        makeXI(teamIds[0], homePlayers),
        makeXI(teamIds[1], awayPlayers),
      ],
    }
    const created = await request('/matches', post({
      tournamentId: tournament.body.id,
      format: 'T10',
      venue: 'Scoring Ground',
      date: '2026-10-21T12:00:00.000Z',
      status: 'upcoming',
      teams: teamIds.map((id) => ({ id })),
      setup,
    }))
    assert.equal(created.status, 201)
    match = created.body

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
    const firstBattingTeam = match.setup.tossWinnerTeamId === teamA.id ? teamA : teamB
    const firstBowlingTeam = firstBattingTeam.id === teamA.id ? teamB : teamA
    const innings = {
      battingTeamId: firstBattingTeam.id,
      bowlingTeamId: firstBowlingTeam.id,
      runs: 0,
      wickets: 0,
      legalBalls: 0,
      extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
      overs: [[]],
      deliveries: [],
      strikerId: firstBattingTeam.players[0].id,
      nonStrikerId: firstBattingTeam.players[1].id,
      bowlerId: firstBowlingTeam.players[0].id,
      batterFigures: {},
      bowlerFigures: {},
      outIds: [],
      battingOrder: firstBattingTeam.players.map((player) => player.id),
      overBowlers: [firstBowlingTeam.players[0].id],
      completed: false,
    }
    const initialState = {
      teamA,
      teamB,
      totalOvers: setup.oversPerInnings,
      tossWinnerId: setup.tossWinnerTeamId,
      tossDecision: 'bat',
      innings: [innings],
      currentInningsIndex: 0,
    }
    const invalidStartState = structuredClone(initialState)
    invalidStartState.tossDecision = 'bowl'
    const invalidStart = await request(`/matches/${match.id}/scoring/start`, post({
      expectedVersion: 0,
      matchState: invalidStartState,
      deliveries: [],
      bowlerSelections: [],
    }))
    assert.equal(invalidStart.status, 400)

    const started = await request(`/matches/${match.id}/scoring/start`, post({
      expectedVersion: 0,
      matchState: initialState,
      deliveries: [],
      bowlerSelections: [],
    }))
    assert.equal(started.status, 201)

    const delivery = {
      runsOffBat: 0,
      extraType: 'noball',
      secondaryExtraType: 'bye',
      extraRuns: 2,
    }
    const scoredState = structuredClone(initialState)
    scoredState.innings[0].runs = 3
    scoredState.innings[0].extras.total = 3
    scoredState.innings[0].extras.noBalls = 1
    scoredState.innings[0].extras.byes = 2
    scoredState.innings[0].overs[0].push(delivery)
    scoredState.innings[0].deliveries.push({ ...delivery, overIndex: 0, ballIndex: 0 })
    const invalidScore = structuredClone(scoredState)
    invalidScore.innings[0].runs = 4
    const rejectedScore = await request(`/matches/${match.id}/scoring/deliveries`, post({
      expectedVersion: started.body.version,
      matchState: invalidScore,
      deliveries: [delivery],
      bowlerSelections: [],
      delivery,
    }))
    assert.equal(rejectedScore.status, 400)
    const recorded = await request(`/matches/${match.id}/scoring/deliveries`, post({
      expectedVersion: started.body.version,
      matchState: scoredState,
      deliveries: [delivery],
      bowlerSelections: [],
      delivery,
    }))
    assert.equal(recorded.status, 201)
    eventId = recorded.body.eventIds[0]

    const stale = await request(`/matches/${match.id}/scoring/deliveries`, post({
      expectedVersion: started.body.version,
      matchState: scoredState,
      deliveries: [delivery],
      bowlerSelections: [],
      delivery,
    }))
    assert.equal(stale.status, 409)

    const scorecard = await request(`/matches/${match.id}/scorecard`)
    assert.equal(scorecard.status, 200)
    assert.equal(scorecard.body.innings[0].runs, 3)
    assert.equal(scorecard.body.innings[0].legalBalls, 0)
    assert.equal(scorecard.body.innings[0].battingFigures[0].runs, 0)
    assert.equal(scorecard.body.innings[0].battingFigures[0].ballsFaced, 1)
    assert.equal(scorecard.body.innings[0].bowlingFigures[0].runsConceded, 1)
    assert.deepEqual(scorecard.body.innings[0].events[0].delivery, delivery)

    const undone = await request(`/matches/${match.id}/scoring/undo`, post({
      expectedVersion: recorded.body.version,
    }))
    assert.equal(undone.status, 200)
    assert.equal(undone.body.matchState.innings[0].runs, 0)
    assert.deepEqual(undone.body.deliveries, [])
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM scoring_event_undos')
      .get().count, 1)

    const afterUndo = await request(`/matches/${match.id}/scorecard`)
    assert.equal(afterUndo.body.innings[0].runs, 0)
    assert.deepEqual(afterUndo.body.innings[0].events, [])
    assert.equal(afterUndo.body.innings[0].battingFigures.length, 0)

    const refreshed = await request(`/matches/${match.id}/scoring`)
    assert.equal(refreshed.body.matchState.innings[0].runs, 0)
    assert.deepEqual(refreshed.body.deliveries, [])
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    database.close()
  }

  const reopened = createDatabase(databasePath)
  try {
    const state = JSON.parse(reopened.prepare(
      'SELECT state_json FROM scoring_sessions WHERE match_id = ?',
    ).get(match.id).state_json)
    assert.equal(state.matchState.innings[0].runs, 0)
    assert.deepEqual(state.deliveries, [])
    assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM ball_by_ball_events')
      .get().count, 1)
    assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM scoring_delivery_details')
      .get().count, 1)
    assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM scoring_event_undos')
      .get().count, 1)
    assert.equal(reopened.prepare('SELECT id FROM ball_by_ball_events').get().id, eventId)
  } finally {
    reopened.close()
    rmSync(testDirectory, { recursive: true, force: true })
  }
})
