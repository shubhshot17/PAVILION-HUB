import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongo
let server
let base
let closeDatabase

before(async () => {
  mongo = await MongoMemoryServer.create()
  const database = await import('../db/mongo.js')
  closeDatabase = database.closeDatabase
  await database.connectDatabase(mongo.getUri(), 'pavilion_test')
  const { default: app } = await import('../app.js')
  server = app.listen(0)
  base = `http://127.0.0.1:${server.address().port}/api`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  await closeDatabase()
  await mongo.stop()
})

async function call(method, path, payload) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
  const data = response.status === 204 ? null : await response.json()
  return { status: response.status, data }
}

const ok = async (method, path, payload) => {
  const { status, data } = await call(method, path, payload)
  assert.ok(status < 300, `${method} ${path} → ${status} ${JSON.stringify(data)}`)
  return data
}

test('tournament → match → ball-by-ball scoring → result, table, stats and share link', async () => {
  const lions = await ok('POST', '/teams', { name: 'Lions XI' })
  const tigers = await ok('POST', '/teams', { name: 'Tigers', shortName: 'tgr' })
  assert.equal(lions.shortName, 'LX')
  assert.equal(tigers.shortName, 'TGR')
  const squad = async (team) => Promise.all(['One', 'Two', 'Three'].map((n) => ok('POST', '/players', {
    teamId: team.id, name: `${team.name} ${n}`, role: 'all-rounder',
  })))
  const [l, t] = [await squad(lions), await squad(tigers)]

  const tournament = await ok('POST', '/tournaments', { name: 'Test Cup', overs: 1, teamIds: [lions.id, tigers.id] })
  assert.match(tournament.shareCode, /^[a-z0-9]{8}$/)
  const match = await ok('POST', '/matches', { tournamentId: tournament.id, teamAId: lions.id, teamBId: tigers.id })
  assert.equal(match.overs, 1, 'match inherits tournament overs')

  let state = await ok('POST', `/matches/${match.id}/start`, {
    tossWinnerId: lions.id,
    tossDecision: 'bat',
    playingXI: { [lions.id]: l.map((p) => p.id), [tigers.id]: t.map((p) => p.id) },
    strikerId: l[0].id, nonStrikerId: l[1].id, bowlerId: t[0].id,
  })
  assert.equal(state.status, 'live')
  assert.equal(state.live.strikerId, l[0].id)

  // Bad input is rejected with a readable error.
  const bad = await call('POST', `/matches/${match.id}/balls`, { runs: 9 })
  assert.equal(bad.status, 400)
  assert.ok(bad.data.error.message)

  for (const runs of [4, 1, 0, 6, 2]) state = await ok('POST', `/matches/${match.id}/balls`, { runs })
  assert.equal(state.live.strikerId, l[1].id, 'strike rotated after the single')
  state = await ok('POST', `/matches/${match.id}/balls`, { runs: 1 })
  assert.deepEqual([state.innings[0].runs, state.innings[0].overs], [14, '1.0'])

  // Undo the last ball and replay it.
  state = await ok('DELETE', `/matches/${match.id}/balls/last`)
  assert.equal(state.innings[0].runs, 13)
  state = await ok('POST', `/matches/${match.id}/balls`, { runs: 1 })
  assert.equal(state.live.awaitingNextInnings, true)

  state = await ok('POST', `/matches/${match.id}/next-innings`, {
    strikerId: t[0].id, nonStrikerId: t[1].id, bowlerId: l[2].id,
  })
  assert.equal(state.live.target, 15)
  state = await ok('POST', `/matches/${match.id}/balls`, { runs: 0, wicket: { type: 'bowled', playerOutId: t[0].id } })
  assert.equal(state.live.needsBatter, true)
  assert.equal((await call('POST', `/matches/${match.id}/balls`, { runs: 1 })).status, 409)
  state = await ok('PATCH', `/matches/${match.id}/crease`, { strikerId: t[2].id })
  state = await ok('POST', `/matches/${match.id}/balls`, { runs: 0, wicket: { type: 'caught', playerOutId: t[2].id, fielderId: l[0].id } })

  assert.equal(state.status, 'completed', 'two wickets end a three-player innings')
  assert.equal(state.result.text, 'Lions XI won by 14 runs')

  const shared = await ok('GET', `/tournaments/code/${tournament.shareCode}`)
  assert.equal(shared.name, 'Test Cup')
  assert.deepEqual(shared.standings.map((row) => [row.name, row.points]), [['Lions XI', 2], ['Tigers', 0]])
  assert.equal(shared.leaders.mostRuns[0].name, 'Lions XI Two')
  assert.equal(shared.leaders.mostWickets[0].name, 'Lions XI Three')

  const profile = await ok('GET', `/players/${l[0].id}`)
  assert.equal(profile.stats.batting.runs, 5)
  assert.equal(profile.stats.matches, 1)
  assert.equal(profile.recent[0].result, 'Lions XI won by 14 runs')

  const dashboard = await ok('GET', '/dashboard')
  assert.equal(dashboard.recent.length, 1)
  assert.equal(dashboard.counts.players, 6)

  assert.equal((await call('DELETE', `/players/${l[0].id}`)).status, 409, 'players with records are kept')
  assert.equal((await call('GET', '/tournaments/code/nope')).status, 404)
})
