import { matches } from '../models/index.js'
import { createResourceController } from './resourceController.js'
import { HttpError } from '../middleware/errorHandler.js'
import { validateMatch } from './validators.js'

const controller = createResourceController({ store: matches, validate: validateMatch })

controller.scorecard = (req, res) => {
  const scorecard = matches.scorecard(req.params.id)
  if (!scorecard) {
    throw new HttpError(404, 'Match not found')
  }
  res.status(200).json(scorecard)
}

export default controller
