import { teams } from '../models/index.js'
import { HttpError } from '../middleware/errorHandler.js'
import { createResourceController } from './resourceController.js'
import { validateTeam } from './validators.js'

function validateUniqueTeam(data) {
  validateTeam(data)
  if (teams.findDuplicateName(data.name, data.id)) {
    throw new HttpError(409, 'A team with this name already exists')
  }
}

export default createResourceController({ store: teams, validate: validateUniqueTeam })
