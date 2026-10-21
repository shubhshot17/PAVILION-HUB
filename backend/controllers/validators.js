import { HttpError } from '../middleware/errorHandler.js'

const formats = ['T20', 'ODI', 'Test', 'T10']
const matchStatuses = ['live', 'upcoming', 'completed', 'abandoned']
const scoringEventTypes = ['run', 'boundary', 'wicket', 'wide', 'no-ball', 'bye', 'leg-bye']
const playerRoles = ['batter', 'bowler', 'all-rounder', 'wicket-keeper']
const wicketTypes = ['bowled', 'caught', 'lbw', 'run-out', 'stumped', 'hit-wicket', 'retired-out']

function objectBody(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }
}

function requiredString(data, field) {
  if (typeof data[field] !== 'string' || !data[field].trim()) {
    throw new HttpError(400, `${field} must be a non-empty string`)
  }
}

function enumValue(data, field, allowed) {
  if (!allowed.includes(data[field])) {
    throw new HttpError(400, `${field} must be one of: ${allowed.join(', ')}`)
  }
}

export function validateMatch(data) {
  objectBody(data)
  for (const field of ['tournament', 'venue', 'date']) {
    requiredString(data, field)
  }
  if (Number.isNaN(Date.parse(data.date))) {
    throw new HttpError(400, 'date must be a valid date string')
  }
  enumValue(data, 'format', formats)
  enumValue(data, 'status', matchStatuses)
  if (!Array.isArray(data.teams) || data.teams.length !== 2
    || data.teams.some((team) => !team || typeof team.id !== 'string' || !team.id.trim())) {
    throw new HttpError(400, 'teams must contain exactly two team objects with an id')
  }
  if (data.teams[0].id === data.teams[1].id) {
    throw new HttpError(400, 'A match must contain two different teams')
  }
}

export function validateScoringEvent(data) {
  objectBody(data)
  requiredString(data, 'matchId')
  for (const field of ['innings', 'over', 'ball', 'runs']) {
    if (!Number.isInteger(data[field]) || data[field] < 0) {
      throw new HttpError(400, `${field} must be a non-negative integer`)
    }
  }
  if (data.innings < 1 || data.innings > 4) {
    throw new HttpError(400, 'innings must be between 1 and 4')
  }
  if (data.ball < 1 || data.ball > 6) {
    throw new HttpError(400, 'ball must be between 1 and 6')
  }
  enumValue(data, 'eventType', scoringEventTypes)
  if (data.eventType === 'wicket') {
    enumValue(data, 'wicketType', wicketTypes)
    requiredString(data, 'playerOutId')
  } else if (data.wicketType !== undefined || data.playerOutId !== undefined) {
    throw new HttpError(400, 'wicketType and playerOutId are only valid for wicket events')
  }
  if (data.eventType === 'boundary' && ![4, 6].includes(data.runs)) {
    throw new HttpError(400, 'boundary events must score four or six batter runs')
  }
  if (data.legalBall !== undefined && typeof data.legalBall !== 'boolean') {
    throw new HttpError(400, 'legalBall must be a boolean')
  }
  if (['wide', 'no-ball'].includes(data.eventType) && data.runs < 1) {
    throw new HttpError(400, `${data.eventType} events must record at least one extra run`)
  }
}

export function validateTeam(data) {
  objectBody(data)
  for (const field of ['name', 'shortName', 'color']) {
    requiredString(data, field)
  }
}

export function validatePlayer(data) {
  objectBody(data)
  requiredString(data, 'teamId')
  requiredString(data, 'name')
  if (data.role !== undefined) {
    enumValue(data, 'role', playerRoles)
  }
  if (data.jerseyNumber !== undefined
    && (!Number.isInteger(data.jerseyNumber) || data.jerseyNumber < 0)) {
    throw new HttpError(400, 'jerseyNumber must be a non-negative integer')
  }
}

export function validateTournament(data) {
  objectBody(data)
  requiredString(data, 'name')
  requiredString(data, 'season')
  enumValue(data, 'format', formats)
  if (typeof data.isActive !== 'boolean') {
    throw new HttpError(400, 'isActive must be a boolean')
  }
  if (data.tournamentType !== undefined) {
    enumValue(data, 'tournamentType', ['round_robin', 'knockout', 'round_robin_knockout'])
  }
  for (const field of ['oversPerInnings', 'winPoints', 'tiePoints', 'noResultPoints']) {
    if (data[field] !== undefined && (!Number.isInteger(data[field]) || data[field] < 0)) {
      throw new HttpError(400, `${field} must be a non-negative integer`)
    }
  }
}

export function validateFixture(data) {
  objectBody(data)
  requiredString(data, 'homeTeamId')
  requiredString(data, 'awayTeamId')
  requiredString(data, 'scheduledAt')
  requiredString(data, 'venue')
  if (Number.isNaN(Date.parse(data.scheduledAt))) {
    throw new HttpError(400, 'scheduledAt must be a valid date string')
  }
  if (data.status !== undefined) {
    enumValue(data, 'status', ['scheduled', 'postponed', 'cancelled', 'completed'])
  }
  if (data.roundNumber !== undefined && (!Number.isInteger(data.roundNumber) || data.roundNumber < 1)) {
    throw new HttpError(400, 'roundNumber must be a positive integer')
  }
}

export function validateMatchResult(data) {
  objectBody(data)
  if (data.isTie !== undefined && typeof data.isTie !== 'boolean') {
    throw new HttpError(400, 'isTie must be a boolean')
  }
  if (data.isAbandoned !== undefined && typeof data.isAbandoned !== 'boolean') {
    throw new HttpError(400, 'isAbandoned must be a boolean')
  }
  if (data.result !== undefined && (typeof data.result !== 'string' || !data.result.trim())) {
    throw new HttpError(400, 'result must be a non-empty string when provided')
  }
}

export function validateRegistration(data) {
  objectBody(data)
  requiredString(data, 'teamId')
}

export function validatePartnership(data) {
  objectBody(data)
  requiredString(data, 'batter1Id')
  requiredString(data, 'batter2Id')
  if (!Number.isInteger(data.wicketNumber) || data.wicketNumber < 1 || data.wicketNumber > 11) {
    throw new HttpError(400, 'wicketNumber must be an integer between 1 and 11')
  }
  if (!Number.isInteger(data.runs) || data.runs < 0) {
    throw new HttpError(400, 'runs must be a non-negative integer')
  }
  if (!Number.isInteger(data.balls) || data.balls < 0) {
    throw new HttpError(400, 'balls must be a non-negative integer')
  }
}
