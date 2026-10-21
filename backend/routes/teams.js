import { Router } from 'express'
import { createResourceRouter } from './resourceRoutes.js'
import controller from '../controllers/teamsController.js'
import { getTeamProfile } from '../models/tournament.js'
import { HttpError } from '../middleware/errorHandler.js'

const router = createResourceRouter(controller)

// Team profile: team metadata + player list + recent match history
router.get('/:id/profile', (req, res) => {
  const profile = getTeamProfile(req.params.id)
  if (!profile) throw new HttpError(404, 'Team not found')
  res.status(200).json(profile)
})

export default router
