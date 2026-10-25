/* Pure cricket scoring rules. No I/O: every scorecard, crease position and
   result is derived from the ordered list of balls, so undo is just "remove
   the last ball and recompute". */

export const EXTRA_TYPES = ['wide', 'noball', 'bye', 'legbye']
export const WICKET_TYPES = ['bowled', 'caught', 'lbw', 'runout', 'stumped', 'hitwicket', 'retired']
const BOWLER_WICKETS = new Set(['bowled', 'caught', 'lbw', 'stumped', 'hitwicket'])

export const isLegal = (ball) => ball.extra !== 'wide' && ball.extra !== 'noball'
const isPenaltyExtra = (ball) => ball.extra === 'wide' || ball.extra === 'noball'
export const teamRuns = (ball) => ball.runs + (isPenaltyExtra(ball) ? 1 : 0)
const bowlerRuns = (ball) => (ball.extra === 'bye' || ball.extra === 'legbye' ? 0 : teamRuns(ball))
const countsAsWicket = (ball) => Boolean(ball.wicket) && ball.wicket.type !== 'retired'

export const formatOvers = (legalBalls) => `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`
const round2 = (value) => Math.round(value * 100) / 100
export const runRate = (runs, legalBalls) => (legalBalls ? round2((runs * 6) / legalBalls) : 0)

export function ballLabel(ball) {
  const r = ball.runs
  let label
  switch (ball.extra) {
    case 'wide': label = r ? `Wd+${r}` : 'Wd'; break
    case 'noball': label = r ? `Nb+${r}` : 'Nb'; break
    case 'bye': label = `${r}B`; break
    case 'legbye': label = `${r}Lb`; break
    default: label = String(r)
  }
  if (!ball.wicket) return label
  if (ball.wicket.type === 'retired') return 'RH'
  return !ball.extra && !r ? 'W' : `${label} W`
}

function dismissalText(ball, name) {
  const bowler = name(ball.bowlerId)
  const fielder = ball.wicket.fielderId ? name(ball.wicket.fielderId) : null
  switch (ball.wicket.type) {
    case 'bowled': return `b ${bowler}`
    case 'caught':
      return ball.wicket.fielderId === ball.bowlerId ? `c & b ${bowler}` : `c ${fielder ?? 'fielder'} b ${bowler}`
    case 'lbw': return `lbw b ${bowler}`
    case 'runout': return fielder ? `run out (${fielder})` : 'run out'
    case 'stumped': return `st ${fielder ?? 'keeper'} b ${bowler}`
    case 'hitwicket': return `hit wicket b ${bowler}`
    default: return 'retired hurt'
  }
}

/** Crease after a ball: rotate on odd runs, clear the dismissed batter, swap ends and free the bowler at over end. */
export function nextCrease(ball, legalBallsAfter) {
  let { strikerId, nonStrikerId, bowlerId } = ball
  if (ball.runs % 2 === 1) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId]
  }
  if (ball.wicket) {
    if (ball.wicket.playerOutId === strikerId) strikerId = null
    else if (ball.wicket.playerOutId === nonStrikerId) nonStrikerId = null
  }
  if (isLegal(ball) && legalBallsAfter % 6 === 0) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId]
    bowlerId = null
  }
  return { strikerId, nonStrikerId, bowlerId }
}

/**
 * Builds one innings' scorecard.
 * @param balls balls of this innings in delivery order
 * @param opts { battingTeamId, bowlingTeamId, xiSize, maxBalls, target, closed, name(id) }
 */
export function computeInnings(balls, opts) {
  const { name } = opts
  const batting = new Map()
  const bowling = new Map()
  const overs = []
  const fallOfWickets = []
  const extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 }
  let runs = 0
  let wickets = 0
  let legalBalls = 0

  const batter = (playerId) => {
    if (!batting.has(playerId)) {
      batting.set(playerId, {
        playerId, name: name(playerId), runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: null,
      })
    }
    return batting.get(playerId)
  }
  const bowler = (playerId) => {
    if (!bowling.has(playerId)) {
      bowling.set(playerId, {
        playerId, name: name(playerId), legalBalls: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noBalls: 0,
      })
    }
    return bowling.get(playerId)
  }

  for (const ball of balls) {
    const striker = batter(ball.strikerId)
    const nonStriker = batter(ball.nonStrikerId)
    for (const entry of [striker, nonStriker]) {
      if (entry.dismissal === 'retired hurt') entry.dismissal = null // returned to the crease
    }
    const figures = bowler(ball.bowlerId)
    const overIndex = Math.floor(legalBalls / 6)
    if (!overs[overIndex]) {
      overs[overIndex] = { number: overIndex + 1, bowlerId: ball.bowlerId, bowlerName: name(ball.bowlerId), runs: 0, legalBalls: 0, balls: [] }
    }
    const over = overs[overIndex]

    runs += teamRuns(ball)
    if (ball.extra !== 'wide') striker.balls += 1
    if (!ball.extra || ball.extra === 'noball') {
      striker.runs += ball.runs
      if (ball.runs === 4) striker.fours += 1
      if (ball.runs === 6) striker.sixes += 1
    }
    figures.runs += bowlerRuns(ball)
    over.runs += bowlerRuns(ball)
    if (isLegal(ball)) {
      figures.legalBalls += 1
      over.legalBalls += 1
      legalBalls += 1
    }
    if (ball.extra === 'wide') { figures.wides += 1; extras.wides += 1 + ball.runs }
    if (ball.extra === 'noball') { figures.noBalls += 1; extras.noBalls += 1 }
    if (ball.extra === 'bye') extras.byes += ball.runs
    if (ball.extra === 'legbye') extras.legByes += ball.runs
    over.balls.push(ballLabel(ball))

    if (ball.wicket) {
      const out = batter(ball.wicket.playerOutId)
      out.dismissal = dismissalText(ball, name)
      if (countsAsWicket(ball)) {
        wickets += 1
        out.out = true
        if (BOWLER_WICKETS.has(ball.wicket.type)) figures.wickets += 1
        fallOfWickets.push({
          wicket: wickets, runs, overs: formatOvers(legalBalls), playerId: out.playerId, name: out.name,
        })
      }
    }
  }

  for (const over of overs) {
    if (over.legalBalls === 6 && over.runs === 0) bowling.get(over.bowlerId).maidens += 1
  }
  extras.total = extras.wides + extras.noBalls + extras.byes + extras.legByes

  const allOut = wickets >= Math.max(1, opts.xiSize - 1)
  const targetReached = Boolean(opts.target) && runs >= opts.target
  const complete = Boolean(opts.closed) || allOut || legalBalls >= opts.maxBalls || targetReached

  return {
    battingTeamId: opts.battingTeamId,
    bowlingTeamId: opts.bowlingTeamId,
    runs,
    wickets,
    legalBalls,
    overs: formatOvers(legalBalls),
    runRate: runRate(runs, legalBalls),
    extras,
    allOut,
    complete,
    target: opts.target ?? null,
    batting: [...batting.values()].map((entry) => ({
      ...entry,
      strikeRate: entry.balls ? round2((entry.runs * 100) / entry.balls) : 0,
    })),
    bowling: [...bowling.values()].map((entry) => ({
      ...entry,
      overs: formatOvers(entry.legalBalls),
      economy: runRate(entry.runs, entry.legalBalls),
    })),
    fallOfWickets,
    overHistory: overs,
  }
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/**
 * Full match picture from the match document and all of its balls.
 * `teamName(id)` and `name(playerId)` resolve display names.
 */
export function computeMatch(match, balls, { name, teamName }) {
  const maxBalls = match.overs * 6
  const innings = []
  for (const [index, meta] of (match.innings ?? []).entries()) {
    innings.push(computeInnings(balls.filter((ball) => ball.innings === index), {
      battingTeamId: meta.battingTeamId,
      bowlingTeamId: meta.bowlingTeamId,
      xiSize: match.playingXI?.[meta.battingTeamId]?.length ?? 11,
      maxBalls,
      closed: meta.closed,
      target: index === 1 ? innings[0].runs + 1 : null,
      name,
    }))
  }

  let result = null
  if (innings.length === 2 && innings[1].complete) {
    const [first, second] = innings
    if (second.runs > first.runs) {
      const xi = match.playingXI?.[second.battingTeamId]?.length ?? 11
      result = {
        winnerId: second.battingTeamId,
        tie: false,
        text: `${teamName(second.battingTeamId)} won by ${plural(xi - 1 - second.wickets, 'wicket')}`,
      }
    } else if (first.runs > second.runs) {
      result = {
        winnerId: first.battingTeamId,
        tie: false,
        text: `${teamName(first.battingTeamId)} won by ${plural(first.runs - second.runs, 'run')}`,
      }
    } else {
      result = { winnerId: null, tie: true, text: 'Match tied' }
    }
  }

  let live = null
  if (match.status === 'live' && innings.length) {
    const index = innings.length - 1
    const current = innings[index]
    const crease = match.live ?? {}
    const lastOver = current.overHistory.at(-1)
    const overJustEnded = lastOver?.legalBalls === 6
    live = {
      inningsIndex: index,
      strikerId: crease.strikerId ?? null,
      nonStrikerId: crease.nonStrikerId ?? null,
      bowlerId: crease.bowlerId ?? null,
      needsBatter: !current.complete && (!crease.strikerId || !crease.nonStrikerId),
      needsBowler: !current.complete && !crease.bowlerId,
      inningsComplete: current.complete,
      awaitingNextInnings: current.complete && index === 0,
      previousBowlerId: overJustEnded ? lastOver?.bowlerId ?? null : null,
      currentOver: lastOver && !overJustEnded ? lastOver.balls : [],
      target: current.target,
      runsNeeded: current.target ? Math.max(0, current.target - current.runs) : null,
      ballsLeft: maxBalls - current.legalBalls,
      requiredRunRate: current.target ? runRate(Math.max(0, current.target - current.runs), maxBalls - current.legalBalls) : null,
    }
  }

  return { innings, result, live }
}
