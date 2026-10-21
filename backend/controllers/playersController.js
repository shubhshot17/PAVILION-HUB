import { players, teams } from '../models/index.js'
import { HttpError } from '../middleware/errorHandler.js'
import { createResourceController } from './resourceController.js'
import { validatePlayer } from './validators.js'

function validatePlayerTeam(data) {
  validatePlayer(data)
  if (!teams.get(data.teamId)) {
    throw new HttpError(400, 'teamId must reference an existing team')
  }
}

export default createResourceController({
  store: players,
  validate: validatePlayerTeam,
})
