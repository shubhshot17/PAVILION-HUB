/* Loading and shaping helpers shared by the routes, stats and seed. */

import { db, toApi } from '../db/mongo.js'
import { computeMatch } from '../lib/scoring.js'

export const teamApi = (team) => team && {
  id: team._id,
  name: team.name,
  shortName: team.shortName,
  color: team.color,
  ...(team.city ? { city: team.city } : {}),
}

export const playerApi = (player) => player && {
  id: player._id,
  teamId: player.teamId,
  name: player.name,
  role: player.role,
  ...(player.jerseyNumber !== undefined ? { jerseyNumber: player.jerseyNumber } : {}),
  ...(player.battingStyle ? { battingStyle: player.battingStyle } : {}),
  ...(player.bowlingStyle ? { bowlingStyle: player.bowlingStyle } : {}),
}

export function tournamentApi(tournament) {
  const { teamIds, ...rest } = toApi(tournament)
  return { ...rest, teamIds: teamIds ?? [] }
}

export async function lookups(teamIds) {
  const [teams, players] = await Promise.all([
    db().teams.find({ _id: { $in: teamIds } }).toArray(),
    db().players.find({ teamId: { $in: teamIds } }).sort({ name: 1 }).toArray(),
  ])
  const teamsById = new Map(teams.map((team) => [team._id, team]))
  const playersById = new Map(players.map((player) => [player._id, player]))
  return {
    teamsById,
    playersById,
    names: {
      name: (id) => playersById.get(id)?.name ?? 'Unknown player',
      teamName: (id) => teamsById.get(id)?.name ?? 'Unknown team',
    },
  }
}

/** Light match shape used by every list and card. */
export function matchSummary(match, teamsById, tournamentsById = new Map()) {
  return {
    id: match._id,
    title: match.title ?? null,
    tournamentId: match.tournamentId ?? null,
    tournamentName: tournamentsById.get(match.tournamentId)?.name ?? null,
    venue: match.venue ?? null,
    date: match.date,
    overs: match.overs,
    status: match.status,
    teamA: teamApi(teamsById.get(match.teamAId)) ?? { id: match.teamAId, name: 'Deleted team', shortName: '?', color: '#94a3b8' },
    teamB: teamApi(teamsById.get(match.teamBId)) ?? { id: match.teamBId, name: 'Deleted team', shortName: '?', color: '#94a3b8' },
    toss: match.toss ?? null,
    scores: match.scores ?? [],
    result: match.result ?? null,
  }
}

export async function summarize(matches) {
  const teamIds = [...new Set(matches.flatMap((match) => [match.teamAId, match.teamBId]))]
  const tournamentIds = [...new Set(matches.map((match) => match.tournamentId).filter(Boolean))]
  const [teams, tournaments] = await Promise.all([
    db().teams.find({ _id: { $in: teamIds } }).toArray(),
    db().tournaments.find({ _id: { $in: tournamentIds } }).project({ name: 1 }).toArray(),
  ])
  const teamsById = new Map(teams.map((team) => [team._id, team]))
  const tournamentsById = new Map(tournaments.map((tournament) => [tournament._id, tournament]))
  return matches.map((match) => matchSummary(match, teamsById, tournamentsById))
}

/** Matches plus their balls, computed into scorecards in one pass (used for stats). */
export async function computeMatches(filter) {
  const matches = await db().matches.find({ ...filter, status: { $in: ['live', 'completed'] } }).toArray()
  const teamIds = [...new Set(matches.flatMap((match) => [match.teamAId, match.teamBId]))]
  const [balls, context] = await Promise.all([
    db().balls.find({ matchId: { $in: matches.map((match) => match._id) } }).sort({ seq: 1 }).toArray(),
    lookups(teamIds),
  ])
  const ballsByMatch = Map.groupBy(balls, (ball) => ball.matchId)
  return {
    ...context,
    computed: matches.map((match) => ({
      match,
      ...computeMatch(match, ballsByMatch.get(match._id) ?? [], context.names),
    })),
  }
}

export function describePlayer(playersById, teamsById) {
  return (playerId) => {
    const player = playersById.get(playerId)
    const team = player && teamsById.get(player.teamId)
    return player ? {
      name: player.name,
      teamId: player.teamId,
      teamShortName: team?.shortName ?? '',
      teamColor: team?.color ?? '#94a3b8',
    } : {}
  }
}
