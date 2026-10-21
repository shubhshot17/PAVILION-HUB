import { players, teams } from '../models/index.js'
import { HttpError } from '../middleware/errorHandler.js'
import { createResourceController } from './resourceController.js'
import { validatePlayer } from './validators.js'

function validatePlayerTeam(data) {
  validatePlayer(data)
  if (!teams.get(data.teamId)) {
    throw new HttpError(400, 'teamId must reference an existing team')
  }
  if (players.findDuplicateName(data.teamId, data.name, data.id)) {
    throw new HttpError(409, 'A player with this name already exists on this team')
  }
  const teammates = players.list().filter((player) => (
    player.teamId === data.teamId && player.id !== data.id
  ))
  if (data.jerseyNumber !== undefined && data.jerseyNumber !== null
    && teammates.some((player) => player.jerseyNumber === data.jerseyNumber)) {
    throw new HttpError(409, 'This jersey number is already assigned on this team')
  }
  if (data.isCaptain && teammates.some((player) => player.isCaptain)) {
    throw new HttpError(409, 'A team can have only one captain')
  }
  if (data.isWicketkeeper && teammates.some((player) => player.isWicketkeeper)) {
    throw new HttpError(409, 'A team can have only one wicketkeeper')
  }
}

export default createResourceController({
  store: players,
  validate: validatePlayerTeam,
})
