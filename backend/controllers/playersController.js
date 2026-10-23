import { players, teams } from '../models/index.js'
import { database } from '../db/database.js'
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
  // Changing team via PATCH must not leave the player attached to a match XI
  // of the old team.
  if (data.id) {
    const existing = players.get(data.id)
    if (existing && existing.teamId !== data.teamId) {
      const inMatch = database.prepare(`
        SELECT 1 FROM match_players WHERE player_id = ? LIMIT 1
      `).get(data.id)
      if (inMatch) {
        throw new HttpError(409, 'A player already selected in a match cannot change team')
      }
    }
  }
  const teammates = players.list().filter((player) => (
    player.teamId === data.teamId && player.id !== data.id
  ))
  if (data.jerseyNumber !== undefined && data.jerseyNumber !== null
    && teammates.some((player) => player.jerseyNumber === data.jerseyNumber)) {
    throw new HttpError(409, 'This jersey number is already assigned on this team')
  }
  if (data.isCaptain && teammates.some((player) => player.isCaptain)) {
    throw new HttpError(409, 'This team already has a captain; clear the current captain before assigning a new one')
  }
  if (data.isWicketkeeper && teammates.some((player) => player.isWicketkeeper)) {
    throw new HttpError(409, 'This team already has a wicketkeeper; clear the current wicketkeeper before assigning a new one')
  }
}

export default createResourceController({
  store: players,
  validate: validatePlayerTeam,
})
