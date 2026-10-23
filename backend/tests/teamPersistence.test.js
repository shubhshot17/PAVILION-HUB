import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

/**
 * Verifies the "changes remain after page refresh and backend restart"
 * requirement: every team/player field is written to SQLite and is readable
 * again from a brand-new connection to the same file.
 */

const testDirectory = mkdtempSync(path.join(tmpdir(), 'pavilion-team-persist-'))
const databasePath = path.join(testDirectory, 'persist.sqlite')
process.env.DATABASE_PATH = databasePath

const [{ default: app }, { createDatabase }] = await Promise.all([
  import('../app.js'),
  import('../db/database.js'),
])

test('teams and player details persist across a backend restart', async () => {
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

  let teamId
  let playerId
  try {
    const team = await request('/teams', post({
      name: 'Restart Rovers',
      shortName: 'RRO',
      color: '#22aa55',
      city: 'Restartville',
      homeGround: 'Reboot Oval',
    }))
    assert.equal(team.status, 201)
    teamId = team.body.id

    const player = await request('/players', post({
      teamId,
      name: 'Casey Wire',
      role: 'all-rounder',
      jerseyNumber: 23,
      battingStyle: 'Left-hand bat',
      bowlingStyle: 'Left-arm orthodox',
      isCaptain: true,
      isWicketkeeper: false,
    }))
    assert.equal(player.status, 201)
    playerId = player.body.id

    // Edit both records the way the UI does.
    const editedTeam = await request(`/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Restart Rovers XI', city: 'Restartville' }),
    })
    assert.equal(editedTeam.status, 200)
    const editedPlayer = await request(`/players/${playerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bowlingStyle: 'Slow left-arm', isCaptain: true }),
    })
    assert.equal(editedPlayer.status, 200)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    const { database } = await import('../db/database.js')
    database.close()
  }

  // Simulate a backend restart: reopen the same file with a fresh connection.
  const reopened = createDatabase(databasePath)
  try {
    const team = reopened.prepare('SELECT * FROM teams WHERE id = ?').get(teamId)
    assert.equal(team.name, 'Restart Rovers XI')
    assert.equal(team.short_name, 'RRO')
    assert.equal(team.color, '#22aa55')
    assert.equal(team.home_ground, 'Reboot Oval')

    const player = reopened.prepare('SELECT * FROM players WHERE id = ?').get(playerId)
    assert.equal(player.name, 'Casey Wire')
    assert.equal(player.team_id, teamId)
    assert.equal(player.role, 'all-rounder')
    assert.equal(player.jersey_number, 23)
    assert.equal(player.batting_style, 'Left-hand bat')
    assert.equal(player.bowling_style, 'Slow left-arm')
    assert.equal(player.is_captain, 1)
    assert.equal(player.is_wicketkeeper, 0)
  } finally {
    reopened.close()
    rmSync(testDirectory, { recursive: true, force: true })
  }
})
