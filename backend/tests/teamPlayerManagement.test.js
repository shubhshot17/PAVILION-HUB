import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

const testDirectory = mkdtempSync(path.join(tmpdir(), 'pavilion-teams-test-'))
process.env.DATABASE_PATH = path.join(testDirectory, 'teams.sqlite')
const { default: app } = await import('../app.js')

test('team and player CRUD validates input, persists records, and protects references', async () => {
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
    assert.deepEqual((await request('/teams')).body, [])

    const createdTeam = await request('/teams', post({
      name: 'Harbor Cricket Club',
      city: 'Harbor City',
      homeGround: 'Harbor Oval',
    }))
    assert.equal(createdTeam.status, 201)
    assert.equal(createdTeam.body.name, 'Harbor Cricket Club')
    assert.equal(createdTeam.body.shortName, 'HCC')
    assert.equal(createdTeam.body.city, 'Harbor City')
    assert.equal(createdTeam.body.homeGround, 'Harbor Oval')

    const teamList = await request('/teams')
    assert.equal(teamList.status, 200)
    assert.equal(teamList.body.length, 1)
    assert.equal(teamList.body[0].id, createdTeam.body.id)

    const duplicateTeam = await request('/teams', post({ name: ' harbor cricket club ' }))
    assert.equal(duplicateTeam.status, 409)
    const invalidTeam = await request('/teams', post({ name: '   ' }))
    assert.equal(invalidTeam.status, 400)

    const editedTeam = await request(`/teams/${createdTeam.body.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Harbor United', shortName: 'HU', city: 'North Harbor' }),
    })
    assert.equal(editedTeam.status, 200)
    assert.equal(editedTeam.body.name, 'Harbor United')
    assert.equal(editedTeam.body.shortName, 'HU')
    assert.equal(editedTeam.body.homeGround, 'Harbor Oval')

    const createdPlayer = await request('/players', post({
      teamId: createdTeam.body.id,
      name: 'Jordan Lee',
      role: 'batter',
      jerseyNumber: 18,
      isCaptain: true,
      isWicketkeeper: true,
    }))
    assert.equal(createdPlayer.status, 201)
    assert.equal(createdPlayer.body.isCaptain, true)
    assert.equal(createdPlayer.body.isWicketkeeper, true)

    const playerList = await request(`/players?teamId=${createdTeam.body.id}`)
    assert.equal(playerList.status, 200)
    assert.equal(playerList.body.length, 1)
    assert.equal(playerList.body[0].id, createdPlayer.body.id)

    const duplicatePlayer = await request('/players', post({
      teamId: createdTeam.body.id,
      name: ' jordan lee ',
    }))
    assert.equal(duplicatePlayer.status, 409)
    const invalidPlayer = await request('/players', post({
      teamId: createdTeam.body.id,
      name: 'Invalid Jersey',
      jerseyNumber: -1,
    }))
    assert.equal(invalidPlayer.status, 400)
    const duplicateCaptain = await request('/players', post({
      teamId: createdTeam.body.id,
      name: 'Another Captain',
      isCaptain: true,
    }))
    assert.equal(duplicateCaptain.status, 409)

    const editedPlayer = await request(`/players/${createdPlayer.body.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Jordan A. Lee', jerseyNumber: 7, isCaptain: false }),
    })
    assert.equal(editedPlayer.status, 200)
    assert.equal(editedPlayer.body.name, 'Jordan A. Lee')
    assert.equal(editedPlayer.body.jerseyNumber, 7)
    assert.equal(editedPlayer.body.isCaptain, false)
    assert.equal(editedPlayer.body.isWicketkeeper, true)

    const teamProfile = await request(`/teams/${createdTeam.body.id}/profile`)
    assert.equal(teamProfile.status, 200)
    assert.equal(teamProfile.body.players[0].name, 'Jordan A. Lee')
    assert.equal(teamProfile.body.players[0].isWicketkeeper, true)

    const blockedTeamDelete = await request(`/teams/${createdTeam.body.id}`, { method: 'DELETE' })
    assert.equal(blockedTeamDelete.status, 409)
    assert.match(blockedTeamDelete.body.error.message, /players/)

    const deletedPlayer = await request(`/players/${createdPlayer.body.id}`, { method: 'DELETE' })
    assert.equal(deletedPlayer.status, 204)
    assert.deepEqual((await request(`/players?teamId=${createdTeam.body.id}`)).body, [])

    const deletedTeam = await request(`/teams/${createdTeam.body.id}`, { method: 'DELETE' })
    assert.equal(deletedTeam.status, 204)
    assert.deepEqual((await request('/teams')).body, [])
    assert.equal((await request(`/teams/${createdTeam.body.id}`)).status, 404)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    const { database } = await import('../db/database.js')
    database.close()
    rmSync(testDirectory, { recursive: true, force: true })
  }
})
