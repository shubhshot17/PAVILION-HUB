import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

const testDirectory = mkdtempSync(path.join(tmpdir(), 'pavilion-ai-proxy-'))
process.env.DATABASE_PATH = path.join(testDirectory, 'test.sqlite')
process.env.AI_SERVICE_URL = 'http://127.0.0.1:1'

const [{ default: app }, { config }, { database }] = await Promise.all([
  import('../app.js'),
  import('../config.js'),
  import('../db/database.js'),
])

const winPayload = {
  runs: 92,
  wickets: 3,
  legalBallsRemaining: 42,
  target: 171,
  requiredRunRate: 11.29,
  currentRunRate: 7.08,
  venue: 'Westport Oval',
  battingTeamStrength: 0.6,
  bowlingTeamStrength: 0.55,
}

test('proxies validated predictions server-side and handles downstream failures', async () => {
  let behavior = 'success'
  let lastPayload
  const upstream = createServer((request, response) => {
    response.on('error', () => {})
    void (async () => {
      if (behavior === 'slow') {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      if (response.destroyed) {
        return
      }
      if (behavior === 'error') {
        response.writeHead(500, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ detail: 'Internal model failure' }))
        return
      }
      if (behavior === 'invalid-json') {
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end('{bad')
        return
      }

      let requestBody = ''
      for await (const chunk of request) {
        requestBody += chunk
      }
      const payload = JSON.parse(requestBody)
      lastPayload = payload
      response.writeHead(200, { 'Content-Type': 'application/json' })
      if (request.url === '/predict/win-probability') {
        response.end(JSON.stringify({
          batting_team_win_probability: 0.57,
          probability_is_calibrated: false,
          qualification: 'synthetic experimental output',
          data_source: 'synthetic',
          model_version: 'test-model',
        }))
      } else {
        response.end(JSON.stringify({
          projected_total: 168,
          approximate_low: 150,
          approximate_high: 186,
          range_is_calibrated: false,
          qualification: 'synthetic experimental output',
          data_source: 'synthetic',
          model_version: 'test-model',
        }))
      }
    })().catch((error) => {
      if (!response.destroyed) {
        response.destroy(error)
      }
    })
  })
  await new Promise((resolve, reject) => {
    upstream.once('error', reject)
    upstream.listen(0, '127.0.0.1', resolve)
  })

  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/ai`

  async function request(endpoint, payload = winPayload) {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
    return { response, body: await response.json() }
  }

  const originalTimeout = config.aiServiceTimeoutMs
  try {
    config.aiServiceUrl = `http://127.0.0.1:${upstream.address().port}`
    const success = await request('/win-probability')
    assert.equal(success.response.status, 200)
    assert.equal(lastPayload.runs, winPayload.runs)
    assert.equal(lastPayload.legal_balls_remaining, winPayload.legalBallsRemaining)
    assert.equal('legalBallsRemaining' in lastPayload, false)
    assert.equal(success.body.battingTeamWinProbability, 0.57)
    assert.equal(success.body.probabilityIsCalibrated, false)

    const invalidInput = await request('/win-probability', {
      ...winPayload,
      wickets: 11,
    })
    assert.equal(invalidInput.response.status, 400)

    const scorePrediction = await request('/first-innings-score', {
      runs: 124,
      wickets: 4,
      legalBalls: 90,
      venue: 'Westport Oval',
      teamStrength: 0.65,
    })
    assert.equal(scorePrediction.response.status, 200)
    assert.equal(scorePrediction.body.projectedTotal, 168)

    behavior = 'error'
    const unavailable = await request('/win-probability')
    assert.equal(unavailable.response.status, 503)
    assert.equal(JSON.stringify(unavailable.body).includes('Internal model failure'), false)

    behavior = 'invalid-json'
    const invalidResponse = await request('/win-probability')
    assert.equal(invalidResponse.response.status, 502)

    behavior = 'slow'
    config.aiServiceTimeoutMs = 10
    const timedOut = await request('/win-probability')
    assert.equal(timedOut.response.status, 504)

    config.aiServiceUrl = 'http://127.0.0.1:1'
    const connectionFailure = await request('/win-probability')
    assert.equal(connectionFailure.response.status, 503)
  } finally {
    config.aiServiceTimeoutMs = originalTimeout
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await new Promise((resolve) => upstream.close(resolve))
    database.close()
    rmSync(testDirectory, { recursive: true, force: true })
  }
})
