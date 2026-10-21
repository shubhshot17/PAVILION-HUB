import { Router } from 'express'
import { createResourceRouter } from './resourceRoutes.js'
import controller from '../controllers/matchesController.js'
import { partnerships, setMatchResult } from '../models/tournament.js'
import { HttpError } from '../middleware/errorHandler.js'
import { validateMatchResult, validatePartnership } from '../controllers/validators.js'

const router = createResourceRouter(controller)

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
