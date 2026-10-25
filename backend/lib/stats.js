/* Career / tournament stats rolled up from computed scorecards, so they always
   match what the scorecards show. */

import { formatOvers, runRate } from './scoring.js'

const round2 = (value) => Math.round(value * 100) / 100

export function emptyStats(playerId) {
  return {
    playerId,
    matches: 0,
    batting: {
      innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0, notOuts: 0,
      highest: 0, highestNotOut: false, fifties: 0, hundreds: 0, average: null, strikeRate: 0,
    },
    bowling: {
      innings: 0, legalBalls: 0, overs: '0.0', runs: 0, wickets: 0, maidens: 0,
      best: null, economy: 0, average: null,
    },
  }
}

/**
 * @param computedMatches [{ match, innings }] where innings come from computeMatch
 * @returns Map<playerId, stats>
 */
export function aggregateStats(computedMatches) {
  const stats = new Map()
  const get = (playerId) => {
    if (!stats.has(playerId)) stats.set(playerId, emptyStats(playerId))
    return stats.get(playerId)
  }

  for (const { match, innings } of computedMatches) {
    for (const playerIds of Object.values(match.playingXI ?? {})) {
      for (const playerId of playerIds) get(playerId).matches += 1
    }
    for (const inn of innings) {
      for (const entry of inn.batting) {
        const batting = get(entry.playerId).batting
        batting.innings += 1
        batting.runs += entry.runs
        batting.balls += entry.balls
        batting.fours += entry.fours
        batting.sixes += entry.sixes
        if (!entry.out) batting.notOuts += 1
        if (entry.runs > batting.highest || (entry.runs === batting.highest && !entry.out)) {
          batting.highest = entry.runs
          batting.highestNotOut = !entry.out
        }
        if (entry.runs >= 100) batting.hundreds += 1
        else if (entry.runs >= 50) batting.fifties += 1
      }
      for (const entry of inn.bowling) {
        const bowling = get(entry.playerId).bowling
        bowling.innings += 1
        bowling.legalBalls += entry.legalBalls
        bowling.runs += entry.runs
        bowling.wickets += entry.wickets
        bowling.maidens += entry.maidens
        if (!bowling.best || entry.wickets > bowling.best.wickets
          || (entry.wickets === bowling.best.wickets && entry.runs < bowling.best.runs)) {
          bowling.best = { wickets: entry.wickets, runs: entry.runs }
        }
      }
    }
  }

  for (const entry of stats.values()) {
    const { batting, bowling } = entry
    const outs = batting.innings - batting.notOuts
    batting.average = outs ? round2(batting.runs / outs) : null
    batting.strikeRate = batting.balls ? round2((batting.runs * 100) / batting.balls) : 0
    bowling.overs = formatOvers(bowling.legalBalls)
    bowling.economy = runRate(bowling.runs, bowling.legalBalls)
    bowling.average = bowling.wickets ? round2(bowling.runs / bowling.wickets) : null
  }
  return stats
}

/** Top-10 tables for a tournament / the whole app. `describe(playerId)` adds name and team. */
export function leaderboards(stats, describe) {
  const all = [...stats.values()].map((entry) => ({ ...entry, ...describe(entry.playerId) }))
    .filter((entry) => entry.name)
  const top = (list, sort, pick) => list.sort(sort).slice(0, 10).map((entry) => ({
    playerId: entry.playerId,
    name: entry.name,
    teamId: entry.teamId,
    teamShortName: entry.teamShortName,
    teamColor: entry.teamColor,
    ...pick(entry),
  }))

  return {
    mostRuns: top(all.filter((e) => e.batting.innings), (a, b) => b.batting.runs - a.batting.runs
      || b.batting.strikeRate - a.batting.strikeRate,
    (e) => ({ value: e.batting.runs, detail: `${e.batting.innings} inn · SR ${e.batting.strikeRate}` })),
    mostWickets: top(all.filter((e) => e.bowling.wickets), (a, b) => b.bowling.wickets - a.bowling.wickets
      || a.bowling.economy - b.bowling.economy,
    (e) => ({ value: e.bowling.wickets, detail: `${e.bowling.overs} ov · Econ ${e.bowling.economy}` })),
    mostSixes: top(all.filter((e) => e.batting.sixes), (a, b) => b.batting.sixes - a.batting.sixes,
      (e) => ({ value: e.batting.sixes, detail: `${e.batting.fours} fours` })),
    bestStrikeRate: top(all.filter((e) => e.batting.balls >= 10), (a, b) => b.batting.strikeRate - a.batting.strikeRate,
      (e) => ({ value: e.batting.strikeRate, detail: `${e.batting.runs} runs off ${e.batting.balls}` })),
    bestEconomy: top(all.filter((e) => e.bowling.legalBalls >= 12), (a, b) => a.bowling.economy - b.bowling.economy,
      (e) => ({ value: e.bowling.economy, detail: `${e.bowling.overs} ov · ${e.bowling.wickets} wkts` })),
  }
}
