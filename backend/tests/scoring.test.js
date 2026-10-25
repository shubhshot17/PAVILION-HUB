import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ballLabel, computeInnings, computeMatch, nextCrease } from '../lib/scoring.js'
import { computeStandings } from '../lib/standings.js'
import { aggregateStats } from '../lib/stats.js'

const name = (id) => id.toUpperCase()
const ball = (fields) => ({ strikerId: 's', nonStrikerId: 'n', bowlerId: 'b', runs: 0, extra: null, wicket: null, ...fields })
const innings = (balls, opts = {}) => computeInnings(balls, {
  battingTeamId: 'A', bowlingTeamId: 'B', xiSize: 11, maxBalls: 12, name, ...opts,
})

test('credits runs, extras and balls faced correctly', () => {
  const inn = innings([
    ball({ runs: 4 }),
    ball({ extra: 'wide', runs: 0 }),
    ball({ extra: 'noball', runs: 6 }),
    ball({ extra: 'legbye', runs: 1 }),
    ball({ strikerId: 'n', nonStrikerId: 's', runs: 1 }),
  ])
  assert.equal(inn.runs, 4 + 1 + 7 + 1 + 1)
  assert.equal(inn.legalBalls, 3)
  assert.deepEqual(inn.extras, { wides: 1, noBalls: 1, byes: 0, legByes: 1, total: 3 })
  const striker = inn.batting.find((entry) => entry.playerId === 's')
  assert.deepEqual([striker.runs, striker.balls, striker.fours, striker.sixes], [10, 3, 1, 1])
  const bowler = inn.bowling[0]
  assert.deepEqual([bowler.runs, bowler.legalBalls, bowler.wides, bowler.noBalls], [13, 3, 1, 1])
})

test('rotates strike on odd runs and at the end of an over, and frees the bowler', () => {
  assert.deepEqual(nextCrease(ball({ runs: 1 }), 1), { strikerId: 'n', nonStrikerId: 's', bowlerId: 'b' })
  assert.deepEqual(nextCrease(ball({ runs: 2 }), 2), { strikerId: 's', nonStrikerId: 'n', bowlerId: 'b' })
  assert.deepEqual(nextCrease(ball({ runs: 0 }), 6), { strikerId: 'n', nonStrikerId: 's', bowlerId: null })
  assert.deepEqual(nextCrease(ball({ extra: 'wide', runs: 0 }), 6), { strikerId: 's', nonStrikerId: 'n', bowlerId: 'b' })
  assert.deepEqual(
    nextCrease(ball({ wicket: { type: 'bowled', playerOutId: 's' } }), 3),
    { strikerId: null, nonStrikerId: 'n', bowlerId: 'b' },
  )
})

test('records dismissals, fall of wickets and bowler credit', () => {
  const inn = innings([
    ball({ runs: 2 }),
    ball({ wicket: { type: 'caught', playerOutId: 's', fielderId: 'f' } }),
    ball({ strikerId: 'x', runs: 1, wicket: { type: 'runout', playerOutId: 'n', fielderId: 'f' } }),
  ])
  assert.equal(inn.wickets, 2)
  assert.equal(inn.batting.find((e) => e.playerId === 's').dismissal, 'c F b B')
  assert.equal(inn.batting.find((e) => e.playerId === 'n').dismissal, 'run out (F)')
  assert.equal(inn.bowling[0].wickets, 1, 'run outs are not credited to the bowler')
  assert.deepEqual(inn.fallOfWickets.map((f) => [f.wicket, f.runs, f.overs]), [[1, 2, '0.2'], [2, 3, '0.3']])
  assert.equal(ballLabel(ball({ wicket: { type: 'bowled', playerOutId: 's' } })), 'W')
  assert.equal(ballLabel(ball({ extra: 'wide', runs: 2 })), 'Wd+2')
})

test('counts maidens and completes an innings on overs, all out or target', () => {
  const maiden = Array.from({ length: 6 }, () => ball({}))
  assert.equal(innings(maiden).bowling[0].maidens, 1)
  assert.equal(innings(maiden).complete, false)
  assert.equal(innings([...maiden, ...maiden]).complete, true)
  assert.equal(innings([ball({ wicket: { type: 'bowled', playerOutId: 's' } })], { xiSize: 2 }).complete, true)
  assert.equal(innings([ball({ runs: 6 })], { target: 5 }).complete, true)
})

test('decides results by runs, wickets or tie', () => {
  const match = {
    overs: 1,
    status: 'live',
    playingXI: { A: Array(11).fill(0), B: Array(11).fill(0) },
    innings: [{ battingTeamId: 'A', bowlingTeamId: 'B' }, { battingTeamId: 'B', bowlingTeamId: 'A' }],
  }
  const teamName = (id) => `Team ${id}`
  const first = Array.from({ length: 6 }, () => ball({ innings: 0, runs: 1 }))
  const chased = computeMatch(match, [...first, ball({ innings: 1, runs: 6 }), ball({ innings: 1, runs: 1 })], { name, teamName })
  assert.equal(chased.result.text, 'Team B won by 10 wickets')
  const defended = computeMatch(match, [...first, ...Array.from({ length: 6 }, () => ball({ innings: 1 }))], { name, teamName })
  assert.equal(defended.result.text, 'Team A won by 6 runs')
  const tied = computeMatch(match, [...first, ...Array.from({ length: 6 }, () => ball({ innings: 1, runs: 1 }))], { name, teamName })
  assert.equal(tied.result.text, 'Match tied')
  assert.equal(computeMatch(match, first, { name, teamName }).live.target, 7)
})

test('a wide at the start of an over shows in the current over', () => {
  const match = {
    overs: 2, status: 'live', live: { strikerId: 'n', nonStrikerId: 's', bowlerId: 'c' },
    playingXI: { A: Array(11).fill(0) }, innings: [{ battingTeamId: 'A', bowlingTeamId: 'B' }],
  }
  const over = Array.from({ length: 6 }, () => ball({ innings: 0 }))
  const ended = computeMatch(match, over, { name, teamName: (id) => id }).live
  assert.deepEqual([ended.currentOver, ended.previousBowlerId], [[], 'b'])
  const next = computeMatch(match, [...over, ball({ innings: 0, bowlerId: 'c', extra: 'wide' })], { name, teamName: (id) => id }).live
  assert.deepEqual([next.currentOver, next.previousBowlerId], [['Wd'], null])
})

test('points table awards 2 per win and computes net run rate', () => {
  const teams = [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }]
  const table = computeStandings(teams, [{
    teamAId: 'A', teamBId: 'B', overs: 10, status: 'completed', result: { winnerId: 'A', tie: false },
    scores: [{ teamId: 'A', runs: 100, legalBalls: 60, allOut: false }, { teamId: 'B', runs: 80, legalBalls: 30, allOut: true }],
  }])
  assert.deepEqual(table.map((row) => [row.teamId, row.points, row.netRunRate]), [['A', 2, 2], ['B', 0, -2]])
})

test('aggregates batting and bowling career stats', () => {
  const inn = innings([ball({ runs: 4 }), ball({ runs: 6 }), ball({ wicket: { type: 'bowled', playerOutId: 's' } })])
  const stats = aggregateStats([{ match: { playingXI: { A: ['s', 'n'], B: ['b'] } }, innings: [inn] }])
  assert.equal(stats.get('s').batting.runs, 10)
  assert.equal(stats.get('s').batting.average, 10)
  assert.equal(stats.get('s').batting.strikeRate, 333.33)
  assert.equal(stats.get('b').bowling.wickets, 1)
  assert.deepEqual(stats.get('b').bowling.best, { wickets: 1, runs: 10 })
  assert.equal(stats.get('n').batting.notOuts, 1)
})
