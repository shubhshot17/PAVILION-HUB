﻿import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

const testDirectory = mkdtempSync(path.join(tmpdir(), 'pavilion-match-setup-'))
const databasePath = path.join(testDirectory, 'matches.sqlite')
process.env.DATABASE_PATH = databasePath
const [{ default: app }, { createDatabase }] = await Promise.all([
  import('../app.js'),
  import('../db/database.js'),
])

test('creates, validates, lists, and persists match setup and playing XIs', async () => {
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
  const patch = (body) => ({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  let match
  let titled
  try {
    const home = await request('/teams', post({ name: 'Dynamic Home XI' }))
    const away = await request('/teams', post({ name: 'Dynamic Away XI' }))
    assert.equal(home.status, 201)
    assert.equal(away.status, 201)

    const createRoster = async (teamId, prefix) => Promise.all(
      Array.from({ length: 11 }, (_, index) => request('/players', post({
        teamId,
        name: `${prefix} Player ${index + 1}`,
        role: index === 10 ? 'wicket-keeper' : 'all-rounder',
        ...(index === 0 ? { isCaptain: true } : {}),
        ...(index === 10 ? { isWicketkeeper: true } : {}),
      }))),
    )
    const homeRoster = await createRoster(home.body.id, 'Home')
    const awayRoster = await createRoster(away.body.id, 'Away')
    assert.ok(homeRoster.every((player) => player.status === 201))
    assert.ok(awayRoster.every((player) => player.status === 201))

    const homeIds = homeRoster.map((player) => player.body.id)
    const awayIds = awayRoster.map((player) => player.body.id)
    const setup = {
      oversPerInnings: 10,
      tossWinnerTeamId: away.body.id,
      tossDecision: 'field',
      playingXIs: [
        { teamId: home.body.id, playerIds: homeIds, captainId: homeIds[0], wicketkeeperId: homeIds[10] },
        { teamId: away.body.id, playerIds: awayIds, captainId: awayIds[0], wicketkeeperId: awayIds[10] },
      ],
    }
    const baseMatch = {
      format: 'T10',
      venue: 'Community Oval',
      date: '2026-10-22T15:00:00.000Z',
      status: 'upcoming',
      teams: [{ id: home.body.id }, { id: away.body.id }],
      setup,
    }

    const sameTeam = await request('/matches', post({
      ...baseMatch,
      teams: [{ id: home.body.id }, { id: home.body.id }],
    }))
    assert.equal(sameTeam.status, 400)
    const invalidXi = await request('/matches', post({
      ...baseMatch,
      setup: {
        ...setup,
        playingXIs: [
          setup.playingXIs[0],
          { ...setup.playingXIs[1], playerIds: [homeIds[0], ...awayIds.slice(1)] },
        ],
      },
    }))
    assert.equal(invalidXi.status, 400)
    const invalidCaptain = await request('/matches', post({
      ...baseMatch,
      setup: {
        ...setup,
        playingXIs: [
          { ...setup.playingXIs[0], captainId: 'not-in-the-xi' },
          setup.playingXIs[1],
        ],
      },
    }))
    assert.equal(invalidCaptain.status, 400)
    const invalidOvers = await request('/matches', post({
      ...baseMatch,
      setup: { ...setup, oversPerInnings: 11 },
    }))
    assert.equal(invalidOvers.status, 400)
    const longTitle = await request('/matches', post({
      ...baseMatch,
      title: 'x'.repeat(121),
    }))
    assert.equal(longTitle.status, 400)
    const badTitle = await request('/matches', post({
      ...baseMatch,
      title: 42,
    }))
    assert.equal(badTitle.status, 400)

    // A titled 5-over match, saved exactly as the UI sends it.
    titled = await request('/matches', post({
      ...baseMatch,
      title: 'Sunday friendly',
      setup: { ...setup, oversPerInnings: 5, tossDecision: 'bat' },
    }))
    assert.equal(titled.status, 201)
    assert.equal(titled.body.title, 'Sunday friendly')
    assert.equal(titled.body.setup.oversPerInnings, 5)
    assert.equal(titled.body.setup.tossDecision, 'bat')

    const created = await request('/matches', post(baseMatch))
    assert.equal(created.status, 201)
    match = created.body
    assert.equal(match.setup.oversPerInnings, 10)
    assert.equal(match.setup.tossWinnerTeamId, away.body.id)
    assert.equal(match.setup.tossDecision, 'field')
    assert.deepEqual(new Set(match.setup.playingXIs.map((xi) => xi.playerIds.length)), new Set([11]))

    const listed = await request('/matches')
    assert.equal(listed.status, 200)
    assert.equal(listed.body.find((item) => item.id === match.id).setup.oversPerInnings, 10)
    const fetched = await request(`/matches/${match.id}`)
    assert.deepEqual(fetched.body.setup, match.setup)

    const updatedSetup = { ...setup, oversPerInnings: 5, tossDecision: 'bat' }
    const updated = await request(`/matches/${match.id}`, patch({
      ...baseMatch,
      title: 'Sunday friendly',
      setup: updatedSetup,
    }))
    assert.equal(updated.status, 200)
    assert.equal(updated.body.setup.oversPerInnings, 5)
    assert.equal(updated.body.setup.tossDecision, 'bat')
    assert.equal(updated.body.title, 'Sunday friendly')

    const publicTournaments = await request('/tournaments')
    assert.deepEqual(publicTournaments.body, [])

    // The match list shows every saved match with its status â€” including the
    // titled one â€” and no seeded/demo rows are present.
    const listedAgain = await request('/matches')
    assert.equal(listedAgain.body.length, 2)
    const titledRow = listedAgain.body.find((row) => row.id === titled.body.id)
    assert.equal(titledRow.title, 'Sunday friendly')
    assert.equal(titledRow.status, 'upcoming')
    assert.ok(!('scores' in titledRow))
    assert.equal(titledRow.isDemo, false)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }

  const reopened = createDatabase(databasePath)
  try {
    const savedSetup = reopened.prepare('SELECT * FROM match_setup WHERE match_id = ?').get(match.id)
    assert.equal(savedSetup.overs_per_innings, 5)
    assert.equal(savedSetup.toss_decision, 'bat')
    assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM match_players WHERE match_id = ?')
      .get(match.id).count, 22)
    assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM matches WHERE id = ?').get(match.id).count, 1)

    const titledRow = reopened.prepare('SELECT title FROM matches WHERE id = ?').get(titled.body.id)
    assert.equal(titledRow.title, 'Sunday friendly')
    assert.ok(titledRow)
  } finally {
    reopened.close()
    // Close the shared connection and clean up after the last test in the
    // file so nothing leaks into other suites.
    const { database } = await import('../db/database.js')
    database.close()
    rmSync(testDirectory, { recursive: true, force: true })
  }
})
