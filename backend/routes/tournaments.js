import { Router } from 'express'
import { createResourceRouter } from './resourceRoutes.js'
import controller from '../controllers/tournamentsController.js'
import { fixtures, registrations } from '../models/tournament.js'
import { computeStandings, computeBracket } from '../lib/pointsEngine.js'
import { HttpError } from '../middleware/errorHandler.js'
import {
  validateFixture,
  validateRegistration,
} from '../controllers/validators.js'

const router = createResourceRouter(controller)

// ── Standings (computed live from DB) ────────────────────────
router.get('/:id/standings', (req, res) => {
  const rows = computeStandings(req.params.id)
  res.status(200).json(rows)
})

// ── Knockout bracket ──────────────────────────────────────────
router.get('/:id/bracket', (req, res) => {
  const rounds = computeBracket(req.params.id)
  res.status(200).json(rounds)
})

// ── Fixtures ──────────────────────────────────────────────────
router.get('/:id/fixtures', (req, res) => {
  res.status(200).json(fixtures.list(req.params.id))
})

router.post('/:id/fixtures', (req, res) => {
  validateFixture(req.body)
  const fixture = fixtures.create({ ...req.body, tournamentId: req.params.id })
  res.status(201).json(fixture)
})

router.patch('/:id/fixtures/:fid', (req, res) => {
  const updated = fixtures.update(req.params.fid, req.body)
  if (!updated) throw new HttpError(404, 'Fixture not found')
  res.status(200).json(updated)
})

router.delete('/:id/fixtures/:fid', (req, res) => {
  if (!fixtures.remove(req.params.fid)) throw new HttpError(404, 'Fixture not found')
  res.status(204).end()
})

// ── Registrations ─────────────────────────────────────────────
router.get('/:id/registrations', (req, res) => {
  res.status(200).json(registrations.list(req.params.id))
})

router.post('/:id/registrations', (req, res) => {
  validateRegistration(req.body)
  const reg = registrations.register(req.params.id, req.body.teamId)
  res.status(201).json(reg)
})

router.delete('/:id/registrations/:rid', (req, res) => {
  if (!registrations.withdraw(req.params.rid)) throw new HttpError(404, 'Registration not found')
  res.status(204).end()
})

export default router
