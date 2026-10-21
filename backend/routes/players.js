import { Router } from 'express'
import { createResourceRouter } from './resourceRoutes.js'
import controller from '../controllers/playersController.js'
import { getPlayerStats } from '../models/tournament.js'
import { HttpError } from '../middleware/errorHandler.js'

const router = createResourceRouter(controller)

// Player stats: batting/bowling aggregates + POTM count + recent innings
router.get('/:id/stats', (req, res) => {
  const stats = getPlayerStats(req.params.id)
  if (!stats) throw new HttpError(404, 'Player not found')
  res.status(200).json(stats)
})

export default router
