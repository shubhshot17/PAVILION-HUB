import { Router } from 'express'
import { db } from '../db/mongo.js'
import { body } from '../lib/validate.js'
import { summarize } from '../services/context.js'
import {
  abandonMatch, createMatch, deleteMatch, endInnings, matchDetail, recordBall,
  setCrease, startMatch, startNextInnings, undoBall, updateMatch,
} from '../services/matches.js'

const router = Router()

router.get('/', async (req, res) => {
  const filter = {}
  if (req.query.tournamentId) filter.tournamentId = String(req.query.tournamentId)
  if (req.query.status) filter.status = String(req.query.status)
  if (req.query.teamId) filter.$or = [{ teamAId: String(req.query.teamId) }, { teamBId: String(req.query.teamId) }]
  const matches = await db().matches.find(filter).sort({ date: -1 }).limit(200).toArray()
  res.json(await summarize(matches))
})

router.post('/', async (req, res) => res.status(201).json(await createMatch(body(req))))
router.get('/:id', async (req, res) => res.json(await matchDetail(req.params.id)))
router.patch('/:id', async (req, res) => res.json(await updateMatch(req.params.id, body(req))))
router.delete('/:id', async (req, res) => {
  await deleteMatch(req.params.id)
  res.status(204).end()
})

router.post('/:id/start', async (req, res) => res.json(await startMatch(req.params.id, body(req))))
router.patch('/:id/crease', async (req, res) => res.json(await setCrease(req.params.id, body(req))))
router.post('/:id/balls', async (req, res) => res.status(201).json(await recordBall(req.params.id, body(req))))
router.delete('/:id/balls/last', async (req, res) => res.json(await undoBall(req.params.id)))
router.post('/:id/next-innings', async (req, res) => res.json(await startNextInnings(req.params.id, body(req))))
router.post('/:id/end-innings', async (req, res) => res.json(await endInnings(req.params.id)))
router.post('/:id/abandon', async (req, res) => res.json(await abandonMatch(req.params.id)))

export default router
