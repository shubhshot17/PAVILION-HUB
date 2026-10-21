import { tournaments } from '../models/index.js'
import { createResourceController } from './resourceController.js'
import { validateTournament } from './validators.js'

export default createResourceController({ store: tournaments, validate: validateTournament })
