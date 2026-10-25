import { Router } from 'express'
import { db, newId } from '../db/mongo.js'
import { HttpError } from '../middleware/errorHandler.js'
import { body, color, defined, notFound, text } from '../lib/validate.js'
import { playerApi, summarize, teamApi } from '../services/context.js'

const router = Router()
const palette = ['#F97316', '#0EA5E9', '#22C55E', '#E11D48', '#8B5CF6', '#EAB308', '#14B8A6', '#EC4899']

function teamFields(data, partial) {
  const name = text(data, 'name', { required: !partial, max: 60 })
  const shortName = text(data, 'shortName', { max: 5 })
  return defined({
    name,
    shortName: shortName?.toUpperCase() ?? (partial ? undefined : name.replace(/[^A-Za-z ]/g, '').split(/\s+/)
      .map((word) => word[0]).join('').slice(0, 3).toUpperCase() || name.slice(0, 3).toUpperCase()),
    color: color(data, 'color'),
    city: text(data, 'city'),
  })
}

router.get('/', async (_req, res) => {
  const [teams, counts] = await Promise.all([
    db().teams.find().sort({ name: 1 }).toArray(),
    db().players.aggregate([{ $group: { _id: '$teamId', count: { $sum: 1 } } }]).toArray(),
  ])
  const countByTeam = new Map(counts.map((row) => [row._id, row.count]))
  res.json(teams.map((team) => ({ ...teamApi(team), playerCount: countByTeam.get(team._id) ?? 0 })))
})

router.post('/', async (req, res) => {
  const fields = teamFields(body(req), false)
  const team = {
    _id: newId(),
    color: palette[(await db().teams.countDocuments()) % palette.length],
    ...fields,
    createdAt: new Date().toISOString(),
  }
  await db().teams.insertOne(team)
  res.status(201).json({ ...teamApi(team), playerCount: 0 })
})

router.get('/:id', async (req, res) => {
  const team = notFound(await db().teams.findOne({ _id: req.params.id }), 'Team')
  const [players, matches] = await Promise.all([
    db().players.find({ teamId: team._id }).sort({ name: 1 }).toArray(),
    db().matches.find({ $or: [{ teamAId: team._id }, { teamBId: team._id }] }).sort({ date: -1 }).limit(20).toArray(),
  ])
  res.json({ ...teamApi(team), players: players.map(playerApi), matches: await summarize(matches) })
})

router.patch('/:id', async (req, res) => {
  notFound(await db().teams.findOne({ _id: req.params.id }), 'Team')
  await db().teams.updateOne({ _id: req.params.id }, { $set: teamFields(body(req), true) })
  res.json(teamApi(await db().teams.findOne({ _id: req.params.id })))
})

router.delete('/:id', async (req, res) => {
  notFound(await db().teams.findOne({ _id: req.params.id }), 'Team')
  if (await db().matches.countDocuments({ $or: [{ teamAId: req.params.id }, { teamBId: req.params.id }] })) {
    throw new HttpError(409, 'This team has matches; delete those matches first')
  }
  await db().players.deleteMany({ teamId: req.params.id })
  await db().tournaments.updateMany({}, { $pull: { teamIds: req.params.id } })
  await db().teams.deleteOne({ _id: req.params.id })
  res.status(204).end()
})

export default router
