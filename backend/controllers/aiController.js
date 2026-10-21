import { config } from '../config.js'
import { HttpError } from '../middleware/errorHandler.js'

function validateObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }
}

function validateString(body, field) {
  if (typeof body[field] !== 'string' || !body[field].trim() || body[field].length > 120) {
    throw new HttpError(400, `${field} must be a non-empty string of at most 120 characters`)
  }
}

function validateInteger(body, field, minimum, maximum) {
  if (!Number.isInteger(body[field]) || body[field] < minimum || body[field] > maximum) {
    throw new HttpError(400, `${field} must be an integer between ${minimum} and ${maximum}`)
  }
}

function validateStrength(body, field) {
  if (!Number.isFinite(body[field]) || body[field] < 0 || body[field] > 1) {
    throw new HttpError(400, `${field} must be a number between 0 and 1`)
  }
}

function validateRate(body, field) {
  if (!Number.isFinite(body[field]) || body[field] < 0 || body[field] > 60) {
    throw new HttpError(400, `${field} must be a number between 0 and 60`)
  }
}

function validateWinProbability(body) {
  validateObject(body)
  validateInteger(body, 'runs', 0, 500)
  validateInteger(body, 'wickets', 0, 10)
  validateInteger(body, 'legalBallsRemaining', 0, 120)
  validateInteger(body, 'target', 1, 400)
  validateRate(body, 'requiredRunRate')
  validateRate(body, 'currentRunRate')
  validateString(body, 'venue')
  validateStrength(body, 'battingTeamStrength')
  validateStrength(body, 'bowlingTeamStrength')
}

function validateFirstInningsProjection(body) {
  validateObject(body)
  validateInteger(body, 'runs', 0, 500)
  validateInteger(body, 'wickets', 0, 10)
  validateInteger(body, 'legalBalls', 0, 120)
  validateString(body, 'venue')
  validateStrength(body, 'teamStrength')
}

async function proxyPrediction(path, req, res) {
  let response
  const pythonPayload = path === '/predict/win-probability'
    ? {
        runs: req.body.runs,
        wickets: req.body.wickets,
        legal_balls_remaining: req.body.legalBallsRemaining,
        target: req.body.target,
        required_run_rate: req.body.requiredRunRate,
        current_run_rate: req.body.currentRunRate,
        venue: req.body.venue,
        batting_team_strength: req.body.battingTeamStrength,
        bowling_team_strength: req.body.bowlingTeamStrength,
      }
    : {
        runs: req.body.runs,
        wickets: req.body.wickets,
        legal_balls: req.body.legalBalls,
        venue: req.body.venue,
        team_strength: req.body.teamStrength,
      }
  try {
    response = await fetch(new URL(path, config.aiServiceUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(pythonPayload),
      signal: AbortSignal.timeout(config.aiServiceTimeoutMs),
    })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new HttpError(504, 'AI prediction service timed out')
    }
    throw new HttpError(503, 'AI prediction service is unavailable')
  }

  if (!response.ok) {
    throw new HttpError(response.status >= 500 ? 503 : 502, 'AI prediction service could not complete the request')
  }

  let prediction
  try {
    prediction = await response.json()
  } catch {
    throw new HttpError(502, 'AI prediction service returned an invalid response')
  }
  if (!prediction || typeof prediction !== 'object' || Array.isArray(prediction)
    || typeof prediction.qualification !== 'string'
    || typeof prediction.data_source !== 'string'
    || typeof prediction.model_version !== 'string') {
    throw new HttpError(502, 'AI prediction service returned an invalid response')
  }

  if (path === '/predict/win-probability') {
    if (!Number.isFinite(prediction.batting_team_win_probability)
      || prediction.batting_team_win_probability < 0
      || prediction.batting_team_win_probability > 1
      || prediction.probability_is_calibrated !== false) {
      throw new HttpError(502, 'AI prediction service returned an invalid response')
    }
    return res.status(200).json({
      battingTeamWinProbability: prediction.batting_team_win_probability,
      probabilityIsCalibrated: false,
      qualification: prediction.qualification,
      dataSource: prediction.data_source,
      modelVersion: prediction.model_version,
    })
  }

  if (!Number.isInteger(prediction.projected_total)
    || !Number.isInteger(prediction.approximate_low)
    || !Number.isInteger(prediction.approximate_high)
    || prediction.approximate_low < 0
    || prediction.approximate_low > prediction.projected_total
    || prediction.projected_total > prediction.approximate_high
    || prediction.approximate_high > 400
    || prediction.range_is_calibrated !== false) {
    throw new HttpError(502, 'AI prediction service returned an invalid response')
  }
  return res.status(200).json({
    projectedTotal: prediction.projected_total,
    approximateLow: prediction.approximate_low,
    approximateHigh: prediction.approximate_high,
    rangeIsCalibrated: false,
    qualification: prediction.qualification,
    dataSource: prediction.data_source,
    modelVersion: prediction.model_version,
  })
}

export function winProbability(req, res) {
  validateWinProbability(req.body)
  return proxyPrediction('/predict/win-probability', req, res)
}

export function firstInningsProjection(req, res) {
  validateFirstInningsProjection(req.body)
  return proxyPrediction('/predict/first-innings-score', req, res)
}
