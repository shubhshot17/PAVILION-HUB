import { teams } from '../models/index.js'
import { createResourceController } from './resourceController.js'
import { validateTeam } from './validators.js'

export default createResourceController({ store: teams, validate: validateTeam })
