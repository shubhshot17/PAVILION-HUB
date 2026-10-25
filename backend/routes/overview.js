import { Router } from 'express'
import { db } from '../db/mongo.js'
import { aggregateStats, leaderboards } from '../lib/stats.js'
import { computeMatches, describePlayer, summarize } from '../services/context.js'

const router = Router()

router.get('/dashboard', async (_req, res) => {
  const [live, upcoming, recent, tournaments, teams, players, matches] = await Promise.all([
    db().matches.find({ status: 'live' }).sort({ date: -1 }).toArray(),
    db().matches.find({ status: 'upcoming' }).sort({ date: 1 }).limit(6).toArray(),
    db().matches.find({ status: { $in: ['completed', 'abandoned'] } }).sort({ date: -1 }).limit(6).toArray(),
    db().tournaments.countDocuments(),
    db().teams.countDocuments(),
    db().players.countDocuments(),
    db().matches.countDocuments(),
  ])
  res.json({
    live: await summarize(live),
    upcoming: await summarize(upcoming),
    recent: await summarize(recent),
    counts: { tournaments, teams, players, matches },
  })
})

/** Leaderboards across every match. */
router.get('/stats', async (_req, res) => {
  const { computed, playersById, teamsById } = await computeMatches({})
  res.json(leaderboards(aggregateStats(computed), describePlayer(playersById, teamsById)))
})

export default router
