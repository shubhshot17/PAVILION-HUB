import { Router } from 'express'
import { createResourceRouter } from './resourceRoutes.js'
import controller from '../controllers/matchesController.js'
import { partnerships, setMatchResult } from '../models/tournament.js'
import { HttpError } from '../middleware/errorHandler.js'
import { validateMatchResult, validatePartnership } from '../controllers/validators.js'
import { scoringSessions } from '../models/index.js'

const router = createResourceRouter(controller)

function requireScoringBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }
}

router.get('/:id/scoring', (req, res) => {
  const session = scoringSessions.get(req.params.id)
  if (!session) throw new HttpError(404, 'Match not found')
  res.status(200).json(session)
})

router.post('/:id/scoring/start', (req, res) => {
  requireScoringBody(req.body)
  const session = scoringSessions.start(req.params.id, req.body)
  if (!session) throw new HttpError(404, 'Match not found')
  res.status(201).json(session)
})

router.post('/:id/scoring/deliveries', (req, res) => {
  requireScoringBody(req.body)
  const session = scoringSessions.recordDelivery(req.params.id, req.body)
  if (!session) throw new HttpError(404, 'Match not found')
  res.status(201).json(session)
})

router.post('/:id/scoring/bowler', (req, res) => {
  requireScoringBody(req.body)
  const session = scoringSessions.chooseBowler(req.params.id, req.body)
  if (!session) throw new HttpError(404, 'Match not found')
  res.status(200).json(session)
})

router.post('/:id/scoring/undo', (req, res) => {
  requireScoringBody(req.body)
  const session = scoringSessions.undo(req.params.id, req.body)
  if (!session) throw new HttpError(404, 'Match not found')
  res.status(200).json(session)
})

// ── Match result (set winner, POTM, tie/abandoned) ────────────
router.patch('/:id/result', (req, res) => {
  validateMatchResult(req.body)
  const updated = setMatchResult(req.params.id, req.body)
  if (!updated) throw new HttpError(404, 'Match not found')
  res.status(200).json(updated)
})

// ── Partnerships ──────────────────────────────────────────────
// inningsId passed as query: /api/matches/:id/partnerships?inningsId=xxx
router.get('/:id/partnerships', (req, res) => {
  if (!req.query.inningsId) throw new HttpError(400, 'inningsId query param is required')
  res.status(200).json(partnerships.list(req.query.inningsId))
})

router.post('/:id/partnerships', (req, res) => {
  if (!req.body.inningsId) throw new HttpError(400, 'inningsId is required')
  validatePartnership(req.body)
  const p = partnerships.upsert(req.body.inningsId, req.body)
  res.status(201).json(p)
})

export default router
