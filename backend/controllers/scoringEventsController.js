import { matches, scoringEvents } from '../models/index.js'
import { HttpError } from '../middleware/errorHandler.js'
import { createResourceController } from './resourceController.js'
import { validateScoringEvent } from './validators.js'

function validateEventMatch(data) {
  validateScoringEvent(data)
  if (!matches.get(data.matchId)) {
    throw new HttpError(400, 'matchId must reference an existing match')
  }
}

export default createResourceController({
  store: scoringEvents,
  validate: validateEventMatch,
})
