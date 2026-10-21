import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

const testDirectory = mkdtempSync(path.join(tmpdir(), 'pavilion-hub-test-'))
const databasePath = path.join(testDirectory, 'test.sqlite')
process.env.DATABASE_PATH = databasePath

const [{ default: app }, { database, createDatabase }] = await Promise.all([
  import('../app.js'),
  import('../db/database.js'),
])

test('persists score events across database reopen and keeps private user fields out of public APIs', async () => {
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
    return { response, body: text ? JSON.parse(text) : null }
  }

  const post = (body) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  try {
    const home = await request('/teams', post({
      name: 'Persistence Home',
      shortName: 'PHM',
      color: '#123456',
    }))
    const away = await request('/teams', post({
      name: 'Persistence Away',
      shortName: 'PAW',
      color: '#654321',
    }))
    const tournament = await request('/tournaments', post({
      name: 'Persistence Cup',
      season: '2026',
      format: 'T20',
      isActive: true,
    }))
    const batter = await request('/players', post({
      teamId: home.body.id,
      name: 'Private Linked Batter',
      role: 'batter',
    }))
    const bowler = await request('/players', post({
      teamId: away.body.id,
      name: 'Demo Bowler',
      role: 'bowler',
    }))

    assert.equal(home.response.status, 201)
    assert.equal(away.response.status, 201)
    assert.equal(tournament.response.status, 201)
    assert.equal(batter.response.status, 201)
    assert.equal(bowler.response.status, 201)

    const updatedTeam = await request(`/teams/${home.body.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Home' }),
    })
    assert.equal(updatedTeam.response.status, 200)
    assert.equal(updatedTeam.body.name, 'Updated Home')
    assert.equal(updatedTeam.body.shortName, 'PHM')

    database.prepare(`
      INSERT INTO users (id, email, display_name, password_hash)
      VALUES (?, ?, ?, ?)
    `).run('test-private-user', 'private@example.invalid', 'Private Account', 'hash-not-returned')
    database.prepare('UPDATE players SET user_id = ? WHERE id = ?')
      .run('test-private-user', batter.body.id)

    const match = await request('/matches', post({
      tournament: tournament.body.name,
      tournamentId: tournament.body.id,
      format: 'T20',
      venue: 'Test Oval',
      date: '2026-10-21T19:00:00Z',
      status: 'live',
      teams: [{ id: home.body.id }, { id: away.body.id }],
    }))
    assert.equal(match.response.status, 201)

    const invalidReference = await request('/scoring-events', post({
      matchId: match.body.id,
      innings: 1,
      over: 0,
      ball: 1,
      runs: 4,
      eventType: 'boundary',
      batterId: 'unknown-player',
      bowlerId: bowler.body.id,
    }))
    assert.equal(invalidReference.response.status, 400)

    const event = await request('/scoring-events', post({
      matchId: match.body.id,
      innings: 1,
      over: 0,
      ball: 1,
      runs: 4,
      eventType: 'boundary',
      batterId: batter.body.id,
      bowlerId: bowler.body.id,
    }))
    assert.equal(event.response.status, 201)

    const scorecard = await request(`/matches/${match.body.id}/scorecard`)
    assert.equal(scorecard.response.status, 200)
    assert.equal(scorecard.body.innings[0].runs, 4)
    assert.equal(scorecard.body.innings[0].battingFigures[0].runs, 4)
    assert.equal(scorecard.body.innings[0].events[0].id, event.body.id)
    assert.equal(JSON.stringify(scorecard.body).includes('private@example.invalid'), false)
    assert.equal(JSON.stringify(scorecard.body).includes('hash-not-returned'), false)

    const publicPlayer = await request(`/players/${batter.body.id}`)
    assert.equal(JSON.stringify(publicPlayer.body).includes('private@example.invalid'), false)
    assert.equal(Object.hasOwn(publicPlayer.body, 'userId'), false)

    const deleteAttempt = await request(`/scoring-events/${event.body.id}`, { method: 'DELETE' })
    assert.equal(deleteAttempt.response.status, 405)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    database.close()
  }

  const reopened = createDatabase(databasePath)
  try {
    assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM matches').get().count, 1)
    assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM ball_by_ball_events').get().count, 1)
    assert.equal(reopened.prepare('SELECT SUM(batter_runs + extra_runs) AS runs FROM ball_by_ball_events')
      .get().runs, 4)
    assert.ok(reopened.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count >= 1, 'at least one migration applied')
  } finally {
    reopened.close()
    rmSync(testDirectory, { recursive: true, force: true })
  }
})
