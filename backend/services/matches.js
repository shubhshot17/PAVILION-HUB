/* Match lifecycle and ball-by-ball scoring. Routes and the seed script both go
   through these functions so mock data follows exactly the same rules. */

import { db, newId } from '../db/mongo.js'
import { HttpError } from '../middleware/errorHandler.js'
import { computeMatch, EXTRA_TYPES, isLegal, nextCrease, WICKET_TYPES } from '../lib/scoring.js'
import { defined, integer, isoDate, notFound, oneOf, text } from '../lib/validate.js'
import { lookups, matchSummary, playerApi } from './context.js'

async function load(matchId) {
  const match = notFound(await db().matches.findOne({ _id: matchId }), 'Match')
  const [balls, context] = await Promise.all([
    db().balls.find({ matchId }).sort({ seq: 1 }).toArray(),
    lookups([match.teamAId, match.teamBId]),
  ])
  return { match, balls, ...context, ...computeMatch(match, balls, context.names) }
}

export async function matchDetail(matchId) {
  const { match, teamsById, playersById, innings, live } = await load(matchId)
  const tournament = match.tournamentId
    ? await db().tournaments.findOne({ _id: match.tournamentId }, { projection: { name: 1, shareCode: 1 } })
    : null
  const squads = Object.fromEntries([match.teamAId, match.teamBId].map((teamId) => [
    teamId,
    [...playersById.values()].filter((player) => player.teamId === teamId).map(playerApi),
  ]))
  return {
    ...matchSummary(match, teamsById, new Map(tournament ? [[tournament._id, tournament]] : [])),
    tournamentShareCode: tournament?.shareCode ?? null,
    squads,
    playingXI: match.playingXI ?? null,
    innings,
    live,
  }
}

/** Saves the derived score, result and status after any scoring change. */
async function refresh(matchId) {
  const { match, innings, result } = await load(matchId)
  const scores = innings.map((inn) => ({
    teamId: inn.battingTeamId, runs: inn.runs, wickets: inn.wickets, legalBalls: inn.legalBalls, allOut: inn.allOut,
  }))
  const update = { scores, result, updatedAt: new Date().toISOString() }
  if (match.status === 'live' && result) {
    Object.assign(update, { status: 'completed', live: null })
  }
  await db().matches.updateOne({ _id: matchId }, { $set: update })
  return matchDetail(matchId)
}

async function requireTeams(teamAId, teamBId) {
  if (!teamAId || !teamBId || teamAId === teamBId) {
    throw new HttpError(400, 'Pick two different teams')
  }
  const count = await db().teams.countDocuments({ _id: { $in: [teamAId, teamBId] } })
  if (count !== 2) throw new HttpError(400, 'Both teams must exist')
}

export async function createMatch(data, extra = {}) {
  const teamAId = text(data, 'teamAId', { required: true, max: 40 })
  const teamBId = text(data, 'teamBId', { required: true, max: 40 })
  await requireTeams(teamAId, teamBId)
  const tournamentId = text(data, 'tournamentId', { max: 40 }) ?? null
  let overs = integer(data, 'overs', 1, 50)
  if (tournamentId) {
    const tournament = notFound(await db().tournaments.findOne({ _id: tournamentId }), 'Tournament')
    overs ??= tournament.overs
  }
  const now = new Date().toISOString()
  const match = {
    _id: newId(),
    tournamentId,
    title: text(data, 'title') ?? null,
    teamAId,
    teamBId,
    venue: text(data, 'venue') ?? null,
    date: isoDate(data, 'date') ?? now,
    overs: overs ?? 20,
    status: 'upcoming',
    toss: null,
    playingXI: null,
    innings: [],
    live: null,
    scores: [],
    result: null,
    createdAt: now,
    updatedAt: now,
    ...extra,
  }
  await db().matches.insertOne(match)
  return matchDetail(match._id)
}

export async function updateMatch(matchId, data) {
  const match = notFound(await db().matches.findOne({ _id: matchId }), 'Match')
  if (match.status !== 'upcoming') throw new HttpError(409, 'Only upcoming matches can be edited')
  const update = defined({
    title: text(data, 'title'),
    venue: text(data, 'venue'),
    date: isoDate(data, 'date'),
    overs: integer(data, 'overs', 1, 50),
    teamAId: text(data, 'teamAId', { max: 40 }),
    teamBId: text(data, 'teamBId', { max: 40 }),
  })
  if (update.teamAId || update.teamBId) {
    await requireTeams(update.teamAId ?? match.teamAId, update.teamBId ?? match.teamBId)
  }
  await db().matches.updateOne({ _id: matchId }, { $set: { ...update, updatedAt: new Date().toISOString() } })
  return matchDetail(matchId)
}

export async function deleteMatch(matchId) {
  notFound(await db().matches.findOne({ _id: matchId }), 'Match')
  await db().balls.deleteMany({ matchId })
  await db().matches.deleteOne({ _id: matchId })
}

function validateCrease(data, battingXI, bowlingXI, { unavailableBatters = [], previousBowlerId = null, partial = false } = {}) {
  const pick = (field) => text(data, field, { required: !partial, max: 40 }) ?? null
  const crease = { strikerId: pick('strikerId'), nonStrikerId: pick('nonStrikerId'), bowlerId: pick('bowlerId') }
  if (crease.strikerId && crease.strikerId === crease.nonStrikerId) {
    throw new HttpError(400, 'Striker and non-striker must be different')
  }
  for (const id of [crease.strikerId, crease.nonStrikerId].filter(Boolean)) {
    if (!battingXI.includes(id)) throw new HttpError(400, 'Batters must be in the batting playing XI')
    if (unavailableBatters.includes(id)) throw new HttpError(400, 'That batter is already out')
  }
  if (crease.bowlerId && !bowlingXI.includes(crease.bowlerId)) throw new HttpError(400, 'Bowler must be in the bowling playing XI')
  if (crease.bowlerId && crease.bowlerId === previousBowlerId) throw new HttpError(400, 'A bowler cannot bowl two overs in a row')
  return crease
}

export async function startMatch(matchId, data) {
  const { match, playersById } = await load(matchId)
  if (match.status !== 'upcoming') throw new HttpError(409, 'Match has already started')
  const tossWinnerId = oneOf(data, 'tossWinnerId', [match.teamAId, match.teamBId], { required: true })
  const tossDecision = oneOf(data, 'tossDecision', ['bat', 'bowl'], { required: true })
  const xi = data.playingXI ?? {}
  const playingXI = {}
  for (const teamId of [match.teamAId, match.teamBId]) {
    const ids = [...new Set(Array.isArray(xi[teamId]) ? xi[teamId] : [])]
    if (ids.length < 2 || ids.length > 15) throw new HttpError(400, 'Each playing XI needs 2 to 15 players')
    if (ids.some((id) => playersById.get(id)?.teamId !== teamId)) {
      throw new HttpError(400, 'Playing XI players must belong to their team')
    }
    playingXI[teamId] = ids
  }
  const other = tossWinnerId === match.teamAId ? match.teamBId : match.teamAId
  const battingTeamId = tossDecision === 'bat' ? tossWinnerId : other
  const bowlingTeamId = battingTeamId === match.teamAId ? match.teamBId : match.teamAId
  const live = validateCrease(data, playingXI[battingTeamId], playingXI[bowlingTeamId])
  await db().matches.updateOne({ _id: matchId }, {
    $set: {
      status: 'live',
      toss: { winnerId: tossWinnerId, decision: tossDecision },
      playingXI,
      innings: [{ battingTeamId, bowlingTeamId, closed: false }],
      live,
      updatedAt: new Date().toISOString(),
    },
  })
  return refresh(matchId)
}

function currentInnings(state) {
  if (state.match.status !== 'live' || !state.live) throw new HttpError(409, 'Match is not live')
  const meta = state.match.innings[state.live.inningsIndex]
  return {
    meta,
    computed: state.innings[state.live.inningsIndex],
    battingXI: state.match.playingXI[meta.battingTeamId],
    bowlingXI: state.match.playingXI[meta.bowlingTeamId],
  }
}

/** Picks a new batter / bowler or swaps strike. Missing fields keep the current crease. */
export async function setCrease(matchId, data) {
  const state = await load(matchId)
  const { computed, battingXI, bowlingXI } = currentInnings(state)
  if (state.live.inningsComplete) throw new HttpError(409, 'Innings is complete')
  const merged = {
    strikerId: data.strikerId ?? state.live.strikerId,
    nonStrikerId: data.nonStrikerId ?? state.live.nonStrikerId,
    bowlerId: data.bowlerId ?? state.live.bowlerId,
  }
  const outIds = computed.batting.filter((entry) => entry.out).map((entry) => entry.playerId)
  const live = validateCrease(merged, battingXI, bowlingXI, {
    unavailableBatters: outIds,
    previousBowlerId: data.bowlerId ? state.live.previousBowlerId : null,
    partial: true,
  })
  await db().matches.updateOne({ _id: matchId }, { $set: { live, updatedAt: new Date().toISOString() } })
  return matchDetail(matchId)
}

export async function recordBall(matchId, data) {
  const state = await load(matchId)
  const { computed, bowlingXI } = currentInnings(state)
  const { live } = state
  if (live.inningsComplete) throw new HttpError(409, 'Innings is complete')
  if (live.needsBatter || live.needsBowler) throw new HttpError(409, 'Select the batters and bowler first')

  const runs = integer(data, 'runs', 0, 7, { required: true })
  const extra = oneOf(data, 'extra', EXTRA_TYPES) ?? null
  if ((extra === 'bye' || extra === 'legbye') && runs === 0) throw new HttpError(400, 'Byes need at least 1 run')

  let wicket = null
  if (data.wicket) {
    const type = oneOf(data.wicket, 'type', WICKET_TYPES, { required: true })
    const playerOutId = oneOf(data.wicket, 'playerOutId', [live.strikerId, live.nonStrikerId], { required: true })
    const fielderId = text(data.wicket, 'fielderId', { max: 40 })
    if (fielderId && !bowlingXI.includes(fielderId)) throw new HttpError(400, 'Fielder must be in the fielding XI')
    if (playerOutId === live.nonStrikerId && !['runout', 'retired'].includes(type)) {
      throw new HttpError(400, 'The non-striker can only be run out or retire')
    }
    if (extra === 'wide' && !['runout', 'stumped', 'retired'].includes(type)) {
      throw new HttpError(400, 'Only run out or stumped is possible on a wide')
    }
    if (extra === 'noball' && !['runout', 'retired'].includes(type)) {
      throw new HttpError(400, 'Only run out is possible on a no-ball')
    }
    wicket = defined({ type, playerOutId, fielderId })
  }

  const ball = {
    _id: newId(),
    matchId,
    innings: live.inningsIndex,
    seq: (state.balls.at(-1)?.seq ?? 0) + 1,
    strikerId: live.strikerId,
    nonStrikerId: live.nonStrikerId,
    bowlerId: live.bowlerId,
    runs,
    extra,
    wicket,
    createdAt: new Date().toISOString(),
    ...(state.match.isMock ? { isMock: true } : {}),
  }
  await db().balls.insertOne(ball)
  const crease = nextCrease(ball, computed.legalBalls + (isLegal(ball) ? 1 : 0))
  await db().matches.updateOne({ _id: matchId }, { $set: { live: crease } })
  return refresh(matchId)
}

export async function undoBall(matchId) {
  const state = await load(matchId)
  if (!['live', 'completed'].includes(state.match.status)) throw new HttpError(409, 'Nothing to undo')
  const last = state.balls.at(-1)
  if (!last) throw new HttpError(409, 'No balls to undo')
  // Undoing into an earlier innings also drops the innings that started after it.
  const innings = state.match.innings.slice(0, last.innings + 1)
  innings[last.innings] = { ...innings[last.innings], closed: false }
  await db().balls.deleteOne({ _id: last._id })
  await db().matches.updateOne({ _id: matchId }, {
    $set: {
      status: 'live',
      result: null,
      innings,
      live: { strikerId: last.strikerId, nonStrikerId: last.nonStrikerId, bowlerId: last.bowlerId },
    },
  })
  return refresh(matchId)
}

export async function startNextInnings(matchId, data) {
  const state = await load(matchId)
  if (!state.live?.awaitingNextInnings) throw new HttpError(409, 'The first innings is not finished')
  const first = state.match.innings[0]
  const meta = { battingTeamId: first.bowlingTeamId, bowlingTeamId: first.battingTeamId, closed: false }
  const live = validateCrease(data, state.match.playingXI[meta.battingTeamId], state.match.playingXI[meta.bowlingTeamId])
  await db().matches.updateOne({ _id: matchId }, { $push: { innings: meta }, $set: { live } })
  return refresh(matchId)
}

/** Closes the current innings early (declaration, rain, time). */
export async function endInnings(matchId) {
  const state = await load(matchId)
  currentInnings(state)
  await db().matches.updateOne({ _id: matchId }, {
    $set: { [`innings.${state.live.inningsIndex}.closed`]: true, live: { strikerId: null, nonStrikerId: null, bowlerId: null } },
  })
  return refresh(matchId)
}

export async function abandonMatch(matchId) {
  const match = notFound(await db().matches.findOne({ _id: matchId }), 'Match')
  if (match.status === 'completed') throw new HttpError(409, 'Match is already completed')
  await db().matches.updateOne({ _id: matchId }, {
    $set: { status: 'abandoned', live: null, result: { winnerId: null, tie: false, text: 'No result' } },
  })
  return matchDetail(matchId)
}
