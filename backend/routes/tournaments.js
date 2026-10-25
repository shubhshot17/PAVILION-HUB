import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { db, newId } from '../db/mongo.js'
import { HttpError } from '../middleware/errorHandler.js'
import { computeStandings } from '../lib/standings.js'
import { aggregateStats, leaderboards } from '../lib/stats.js'
import { body, defined, integer, isoDate, notFound, text } from '../lib/validate.js'
import { computeMatches, describePlayer, summarize, teamApi, tournamentApi } from '../services/context.js'

const router = Router()

/** Short, unguessable code used in the public share link (/t/<code>). */
export const shareCode = () => randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 8).toLowerCase()

function tournamentFields(data, partial) {
  return defined({
    name: text(data, 'name', { required: !partial, max: 80 }),
    season: text(data, 'season', { max: 20 }),
    city: text(data, 'city'),
    ground: text(data, 'ground'),
    overs: integer(data, 'overs', 1, 50) ?? (partial ? undefined : 20),
    startDate: isoDate(data, 'startDate'),
    endDate: isoDate(data, 'endDate'),
    organizer: text(data, 'organizer'),
  })
}

async function teamIdsFrom(data) {
  if (data.teamIds === undefined) return undefined
  if (!Array.isArray(data.teamIds)) throw new HttpError(400, 'teamIds must be a list')
  const ids = [...new Set(data.teamIds.map(String))]
  if (await db().teams.countDocuments({ _id: { $in: ids } }) !== ids.length) {
    throw new HttpError(400, 'Every team must exist')
  }
  return ids
}

export async function tournamentDetail(tournament) {
  const [teams, matches, { computed, playersById, teamsById }] = await Promise.all([
    db().teams.find({ _id: { $in: tournament.teamIds ?? [] } }).sort({ name: 1 }).toArray(),
    db().matches.find({ tournamentId: tournament._id }).sort({ date: 1 }).toArray(),
    computeMatches({ tournamentId: tournament._id }),
  ])
  const apiTeams = teams.map(teamApi)
  return {
    ...tournamentApi(tournament),
    teams: apiTeams,
    matches: await summarize(matches),
    standings: computeStandings(apiTeams, matches),
    leaders: leaderboards(aggregateStats(computed), describePlayer(playersById, teamsById)),
  }
}

router.get('/', async (_req, res) => {
  const [tournaments, counts] = await Promise.all([
    db().tournaments.find().sort({ createdAt: -1 }).toArray(),
    db().matches.aggregate([{
      $group: {
        _id: '$tournamentId',
        matches: { $sum: 1 },
        live: { $sum: { $cond: [{ $eq: ['$status', 'live'] }, 1, 0] } },
      },
    }]).toArray(),
  ])
  const countsById = new Map(counts.map((row) => [row._id, row]))
  res.json(tournaments.map((tournament) => ({
    ...tournamentApi(tournament),
    teamCount: tournament.teamIds?.length ?? 0,
    matchCount: countsById.get(tournament._id)?.matches ?? 0,
    liveCount: countsById.get(tournament._id)?.live ?? 0,
  })))
})

router.post('/', async (req, res) => {
  const data = body(req)
  const tournament = {
    _id: newId(),
    ...tournamentFields(data, false),
    teamIds: await teamIdsFrom(data) ?? [],
    shareCode: shareCode(),
    createdAt: new Date().toISOString(),
  }
  await db().tournaments.insertOne(tournament)
  res.status(201).json(await tournamentDetail(tournament))
})

/** Public read-only view used by the share link. */
router.get('/code/:code', async (req, res) => {
  const tournament = notFound(await db().tournaments.findOne({ shareCode: req.params.code }), 'Tournament')
  res.json(await tournamentDetail(tournament))
})

router.get('/:id', async (req, res) => {
  res.json(await tournamentDetail(notFound(await db().tournaments.findOne({ _id: req.params.id }), 'Tournament')))
})

router.patch('/:id', async (req, res) => {
  notFound(await db().tournaments.findOne({ _id: req.params.id }), 'Tournament')
  const data = body(req)
  await db().tournaments.updateOne({ _id: req.params.id }, {
    $set: defined({ ...tournamentFields(data, true), teamIds: await teamIdsFrom(data) }),
  })
  res.json(await tournamentDetail(await db().tournaments.findOne({ _id: req.params.id })))
})

router.delete('/:id', async (req, res) => {
  notFound(await db().tournaments.findOne({ _id: req.params.id }), 'Tournament')
  const matchIds = (await db().matches.find({ tournamentId: req.params.id }).project({ _id: 1 }).toArray())
    .map((match) => match._id)
  await db().balls.deleteMany({ matchId: { $in: matchIds } })
  await db().matches.deleteMany({ tournamentId: req.params.id })
  await db().tournaments.deleteOne({ _id: req.params.id })
  res.status(204).end()
})

router.post('/:id/teams', async (req, res) => {
  notFound(await db().tournaments.findOne({ _id: req.params.id }), 'Tournament')
  const teamId = text(body(req), 'teamId', { required: true, max: 40 })
  notFound(await db().teams.findOne({ _id: teamId }), 'Team')
  await db().tournaments.updateOne({ _id: req.params.id }, { $addToSet: { teamIds: teamId } })
  res.json(await tournamentDetail(await db().tournaments.findOne({ _id: req.params.id })))
})

router.delete('/:id/teams/:teamId', async (req, res) => {
  notFound(await db().tournaments.findOne({ _id: req.params.id }), 'Tournament')
  const { teamId } = req.params
  if (await db().matches.countDocuments({ tournamentId: req.params.id, $or: [{ teamAId: teamId }, { teamBId: teamId }] })) {
    throw new HttpError(409, 'This team has matches in the tournament')
  }
  await db().tournaments.updateOne({ _id: req.params.id }, { $pull: { teamIds: teamId } })
  res.json(await tournamentDetail(await db().tournaments.findOne({ _id: req.params.id })))
})

export default router
