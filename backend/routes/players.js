import { Router } from 'express'
import { db, newId } from '../db/mongo.js'
import { HttpError } from '../middleware/errorHandler.js'
import { aggregateStats, emptyStats } from '../lib/stats.js'
import { body, defined, integer, notFound, oneOf, text } from '../lib/validate.js'
import { computeMatches, playerApi, teamApi } from '../services/context.js'

export const PLAYER_ROLES = ['batter', 'bowler', 'all-rounder', 'wicket-keeper']
const router = Router()

function playerFields(data, partial) {
  return defined({
    name: text(data, 'name', { required: !partial, max: 60 }),
    role: oneOf(data, 'role', PLAYER_ROLES) ?? (partial ? undefined : 'batter'),
    jerseyNumber: integer(data, 'jerseyNumber', 0, 999),
    battingStyle: text(data, 'battingStyle'),
    bowlingStyle: text(data, 'bowlingStyle'),
  })
}

router.get('/', async (req, res) => {
  const filter = req.query.teamId ? { teamId: String(req.query.teamId) } : {}
  const players = await db().players.find(filter).sort({ name: 1 }).toArray()
  res.json(players.map(playerApi))
})

router.post('/', async (req, res) => {
  const data = body(req)
  const teamId = text(data, 'teamId', { required: true, max: 40 })
  if (!await db().teams.findOne({ _id: teamId })) throw new HttpError(400, 'teamId must reference an existing team')
  const player = { _id: newId(), teamId, ...playerFields(data, false), createdAt: new Date().toISOString() }
  await db().players.insertOne(player)
  res.status(201).json(playerApi(player))
})

/** Player profile with career (or one tournament's) batting and bowling stats. */
router.get('/:id', async (req, res) => {
  const player = notFound(await db().players.findOne({ _id: req.params.id }), 'Player')
  const filter = { $or: [{ teamAId: player.teamId }, { teamBId: player.teamId }] }
  if (req.query.tournamentId) filter.tournamentId = String(req.query.tournamentId)
  const { computed, teamsById } = await computeMatches(filter)
  const played = computed.filter(({ match }) => match.playingXI?.[player.teamId]?.includes(player._id))
  const stats = aggregateStats(played).get(player._id) ?? emptyStats(player._id)
  const recent = played
    .sort((a, b) => b.match.date.localeCompare(a.match.date))
    .slice(0, 10)
    .map(({ match, innings, result }) => {
      const opponentId = match.teamAId === player.teamId ? match.teamBId : match.teamAId
      const batting = innings.flatMap((inn) => inn.batting).find((entry) => entry.playerId === player._id) ?? null
      const bowling = innings.flatMap((inn) => inn.bowling).find((entry) => entry.playerId === player._id) ?? null
      return {
        matchId: match._id,
        date: match.date,
        status: match.status,
        opponent: teamApi(teamsById.get(opponentId)),
        result: result?.text ?? null,
        batting: batting && { runs: batting.runs, balls: batting.balls, out: batting.out, dismissal: batting.dismissal },
        bowling: bowling && { overs: bowling.overs, runs: bowling.runs, wickets: bowling.wickets },
      }
    })
  const team = await db().teams.findOne({ _id: player.teamId })
  res.json({
    player: playerApi(player),
    team: teamApi(team),
    stats,
    recent,
  })
})

router.patch('/:id', async (req, res) => {
  notFound(await db().players.findOne({ _id: req.params.id }), 'Player')
  await db().players.updateOne({ _id: req.params.id }, { $set: playerFields(body(req), true) })
  res.json(playerApi(await db().players.findOne({ _id: req.params.id })))
})

router.delete('/:id', async (req, res) => {
  notFound(await db().players.findOne({ _id: req.params.id }), 'Player')
  const used = await db().balls.findOne({
    $or: [{ strikerId: req.params.id }, { nonStrikerId: req.params.id }, { bowlerId: req.params.id }],
  })
  if (used) throw new HttpError(409, 'This player has match records and cannot be deleted')
  await db().players.deleteOne({ _id: req.params.id })
  res.status(204).end()
})

export default router
