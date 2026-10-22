/* ============================================================
   PAVILION HUB — Cricket scoring engine (pure, testable)
   ------------------------------------------------------------
   No React, no DOM, no I/O. The UI drives this module by
   appending DeliveryEvents to a MatchState and receives new
   immutable state back. Undo is just: pop the last event and
   replay the whole history (so undo is always safe/reversible).
   ============================================================ */

export type ExtrasType = 'wide' | 'noball' | 'bye' | 'legbye' | 'penalty'
export type WicketType =
  | 'bowled'
  | 'caught'
  | 'lbw'
  | 'runout'
  | 'stumped'
  | 'hitwicket'
  | 'caughtfielder' // caught & bowled / fielder's catch variants collapsed
  | 'other'

export interface DeliveryEvent {
  /** Batter-facing runs (excludes extras credited to team only) */
  runsOffBat: number
  /** For wides/no-balls, additional runs beyond the automatic penalty. */
  extraType?: ExtrasType
  extraRuns?: number
  /** A no-ball can also have bye or leg-bye runs instead of runs credited off the bat. */
  secondaryExtraType?: 'bye' | 'legbye'
  /** wicket information; the dismissed batter may differ from strikers if run out */
  wicket?: {
    type: WicketType
    dismissedPlayerId: string
    /** For a run-out, whether batters crossed before the wicket was broken. */
    battersCrossed?: boolean
    /** on a run-out both batters can be dismissed in theory; UI supports one per event */
  }
  /** optional note, e.g. "misfield" — informational only */
  note?: string
}

export interface PlayerFigures {
  playerId: string
  runs: number
  balls: number // legal balls faced (batters) / bowled (bowler)
  fours: number
  sixes: number
  dots: number
  // bowler-only
  wickets: number
  wides: number
  noBalls: number
  maidens: number
}

export interface InningsState {
  battingTeamId: string
  bowlingTeamId: string
  runs: number
  wickets: number
  legalBalls: number
  extras: { total: number; wides: number; noBalls: number; byes: number; legByes: number; penalty: number }
  /** over-by-over history: each entry = deliveries in that over */
  overs: DeliveryEvent[][]
  deliveries: (DeliveryEvent & { overIndex: number; ballIndex: number })[]
  strikerId: string
  nonStrikerId: string
  bowlerId: string
  batterFigures: Record<string, PlayerFigures>
  bowlerFigures: Record<string, PlayerFigures>
  /** ids of batters who are out or yet to bat */
  outIds: string[]
  battingOrder: string[]
  /** per-over bowler ids; index === over number */
  overBowlers: string[]
  completed: boolean
}

export interface MatchState {
  teamA: { id: string; name: string; players: { id: string; name: string }[] }
  teamB: { id: string; name: string; players: { id: string; name: string }[] }
  totalOvers: number
  tossWinnerId: string
  tossDecision: 'bat' | 'bowl'
  /** index 0 = first innings */
  innings: InningsState[]
  currentInningsIndex: number
  result?: string
}

/* ---------------- setup ---------------- */

export function createInnings(
  battingTeam: MatchState['teamA'],
  bowlingTeam: MatchState['teamA'],
  battingOrder: string[],
  bowlerId: string,
  strikerId: string,
  nonStrikerId: string,
): InningsState {
  const figures = (playerId: string): PlayerFigures => ({
    playerId, runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0,
    wickets: 0, wides: 0, noBalls: 0, maidens: 0,
  })
  return {
    battingTeamId: battingTeam.id,
    bowlingTeamId: bowlingTeam.id,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
    overs: [[]],
    deliveries: [],
    strikerId,
    nonStrikerId,
    bowlerId,
    batterFigures: { [strikerId]: figures(strikerId), [nonStrikerId]: figures(nonStrikerId) },
    bowlerFigures: { [bowlerId]: figures(bowlerId) },
    outIds: [],
    battingOrder,
    overBowlers: [bowlerId],
    completed: false,
  }
}

export function createMatch(
  teamA: MatchState['teamA'],
  teamB: MatchState['teamB'],
  totalOvers: number,
  tossWinnerId: string,
  tossDecision: 'bat' | 'bowl',
  firstInnings: InningsState,
): MatchState {
  const battingFirst = tossDecision === 'bat' ? tossWinnerId
    : tossWinnerId === teamA.id ? teamB.id : teamA.id
  firstInnings.battingTeamId = battingFirst
  firstInnings.bowlingTeamId = battingFirst === teamA.id ? teamB.id : teamA.id
  return {
    teamA, teamB, totalOvers, tossWinnerId, tossDecision,
    innings: [firstInnings],
    currentInningsIndex: 0,
  }
}

/* ---------------- helpers ---------------- */

const FOUR = 4
const SIX = 6

function ensureBatter(inn: InningsState, id: string): PlayerFigures {
  if (!inn.batterFigures[id]) {
    inn.batterFigures[id] = {
      playerId: id, runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0,
      wickets: 0, wides: 0, noBalls: 0, maidens: 0,
    }
  }
  return inn.batterFigures[id]
}

function ensureBowler(inn: InningsState, id: string): PlayerFigures {
  if (!inn.bowlerFigures[id]) {
    inn.bowlerFigures[id] = {
      playerId: id, runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0,
      wickets: 0, wides: 0, noBalls: 0, maidens: 0,
    }
  }
  return inn.bowlerFigures[id]
}

/** Is the current over (last entry in overs) complete at 6 legal balls? */
export function isOverComplete(inn: InningsState): boolean {
  const over = inn.overs[inn.overs.length - 1]
  return over.filter((d) => isLegalDelivery(d)).length >= 6
}

export function isLegalDelivery(d: DeliveryEvent): boolean {
  return d.extraType !== 'wide' && d.extraType !== 'noball'
}

/** Overs display like "16.2" (16 completed overs, 2 legal balls). */
export function oversDisplay(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`
}

export function runRate(runs: number, legalBalls: number): number {
  if (legalBalls === 0) return 0
  return runs / (legalBalls / 6)
}

/**
 * Strike rotation. Rules applied:
 *  - Odd number of runs (including byes/leg-byes run, and the 1-run penalty
 *    run of a wide/no-ball when additional runs are run... simplified: only
 *    batting-end runs and byes/legbyes rotate strike) → swap striker.
 *  - End of over → swap striker.
 *  - A dismissal removes the dismissed batter; if the striker was dismissed
 *    the new batter takes strike; if the non-striker was dismissed, strike
 *    stays (unless the over also ends, which is handled after).
 * Wides and no-balls never count as legal balls but DO rotate strike for the
 * extra runs run (via bye-like addRuns rotation when extraRuns % 2 === 1).
 */
function rotateStrike(inn: InningsState, swap: boolean) {
  if (!swap) return
  const t = inn.strikerId
  inn.strikerId = inn.nonStrikerId
  inn.nonStrikerId = t
}

/** Total runs credited to the team score for a delivery. */
export function deliveryTeamRuns(d: DeliveryEvent): number {
  let runs = d.runsOffBat
  if (d.extraType === 'wide' || d.extraType === 'noball') {
    // 1 penalty run by definition + any additional runs (usually 0)
    runs += 1 + (d.extraRuns ?? 0)
  } else if (d.extraType === 'bye' || d.extraType === 'legbye') {
    runs += d.extraRuns ?? 0
  } else if (d.extraType === 'penalty') {
    runs += d.extraRuns ?? 5
  }
  return runs
}

/** Bowler is charged for wides, no-balls and runs off the bat (not byes/leg-byes/penalty). */
export function deliveryBowlerRuns(d: DeliveryEvent): number {
  let runs = d.runsOffBat
  if (d.extraType === 'wide' || d.extraType === 'noball') {
    runs += 1 + (d.secondaryExtraType ? 0 : (d.extraRuns ?? 0))
  }
  return runs
}

/** Batter is credited runs off the bat only (see batter figures block in applyDelivery). */

/** Runs that cause batter-end rotation: off the bat, byes, leg-byes, and additional runs on wide/noball. */
function rotationRuns(d: DeliveryEvent): number {
  let runs = d.runsOffBat
  if (d.extraType === 'bye' || d.extraType === 'legbye') runs += d.extraRuns ?? 0
  if (d.extraType === 'wide' || d.extraType === 'noball') runs += d.extraRuns ?? 0
  return runs
}

/* ---------------- target calculation ---------------- */

export interface TargetInfo {
  target: number | null
  runsNeeded: number | null
  ballsRemaining: number | null
  requiredRunRate: number | null
}

export function calculateTarget(state: MatchState): TargetInfo {
  const i = state.currentInningsIndex
  if (i === 0) return { target: null, runsNeeded: null, ballsRemaining: null, requiredRunRate: null }
  const first = state.innings[0]
  const second = state.innings[1]
  const target = first.runs + 1
  const runsNeeded = Math.max(0, target - second.runs)
  const totalBalls = state.totalOvers * 6
  const ballsRemaining = Math.max(0, totalBalls - second.legalBalls)
  const rrr = ballsRemaining > 0 ? (runsNeeded / ballsRemaining) * 6 : 0
  return { target, runsNeeded, ballsRemaining, requiredRunRate: rrr }
}

/** Has any innings reached a natural end? */
export function isInningsOver(state: MatchState, inn: InningsState): boolean {
  const oversLimit = state.totalOvers * 6
  const allOut = inn.wickets >= 10
  const noBattersLeft = inn.outIds.length >= Math.max(0, inn.battingOrder.length - 1)
  return inn.completed || allOut || noBattersLeft || inn.legalBalls >= oversLimit
}

/* ---------------- event application ---------------- */

/**
 * Applies one delivery. Mutates a fresh structural copy of the innings
 * (we shallow-copy the innings object so React state updates are clean).
 */
export function applyDelivery(state: MatchState, event: DeliveryEvent): MatchState {
  const next: MatchState = structuredCloneNext(state)
  const inn = next.innings[next.currentInningsIndex]
  if (next.result || inn.completed) {
    throw new Error('Cannot score a delivery after the innings or match has ended.')
  }
  if (!Number.isInteger(event.runsOffBat) || event.runsOffBat < 0
    || (event.extraRuns !== undefined
      && (!Number.isInteger(event.extraRuns) || event.extraRuns < 0))) {
    throw new Error('Runs must be non-negative integers.')
  }
  if (event.extraRuns !== undefined && event.extraType === undefined) {
    throw new Error('Extra runs require an extra type.')
  }
  if (event.extraType !== undefined
    && event.extraType !== 'noball' && event.runsOffBat > 0) {
    throw new Error('Runs off the bat are only valid on a no-ball when an extra is selected.')
  }
  if (event.secondaryExtraType !== undefined
    && (event.extraType !== 'noball'
      || !['bye', 'legbye'].includes(event.secondaryExtraType)
      || event.runsOffBat > 0)) {
    throw new Error('A secondary bye or leg-bye can only accompany a no-ball.')
  }
  if (event.wicket
    && ![inn.strikerId, inn.nonStrikerId].includes(event.wicket.dismissedPlayerId)) {
    throw new Error('The dismissed batter must be at the crease.')
  }
  if (event.wicket && event.wicket.type !== 'runout'
    && event.wicket.type !== 'other' && event.wicket.dismissedPlayerId !== inn.strikerId) {
    throw new Error('Only a run-out or retired dismissal can dismiss the non-striker.')
  }
  if (event.wicket && event.extraType === 'noball'
    && !['runout', 'other'].includes(event.wicket.type)) {
    throw new Error('A no-ball only permits a run-out or retired dismissal.')
  }
  if (event.wicket && event.extraType === 'wide'
    && !['runout', 'stumped', 'hitwicket', 'other'].includes(event.wicket.type)) {
    throw new Error('A wide only permits a run-out, stumping, hit wicket, or retired dismissal.')
  }
  if (event.wicket && ['bye', 'legbye'].includes(event.extraType ?? '')
    && !['runout', 'stumped', 'hitwicket', 'other'].includes(event.wicket.type)) {
    throw new Error('A bye or leg-bye only permits a run-out, stumping, hit wicket, or retired dismissal.')
  }
  if (event.wicket && inn.wickets >= 10) {
    throw new Error('The batting side is already all out.')
  }
  if (event.wicket && event.wicket.type !== 'runout' && event.runsOffBat > 0) {
    throw new Error('Runs off the bat on a wicket delivery are only supported for run-outs.')
  }
  applyDeliveryToInnings(inn, event)
  checkInningsTransition(next, inn)
  return next
}

function structuredCloneNext(state: MatchState): MatchState {
  return JSON.parse(JSON.stringify(state)) as MatchState
}

function applyDeliveryToInnings(inn: InningsState, event: DeliveryEvent) {
  const over = inn.overs[inn.overs.length - 1]
  over.push(event)
  inn.deliveries.push({
    ...event,
    overIndex: inn.overs.length - 1,
    ballIndex: over.length - 1,
  })

  const legal = isLegalDelivery(event)
  const teamRuns = deliveryTeamRuns(event)

  // team score & extras ledger
  inn.runs += teamRuns
  if (event.extraType) {
    inn.extras.total += teamRuns - event.runsOffBat
    if (event.extraType === 'wide') inn.extras.wides += 1 + (event.extraRuns ?? 0)
    if (event.extraType === 'noball') {
      inn.extras.noBalls += 1 + (event.secondaryExtraType ? 0 : (event.extraRuns ?? 0))
    }
    if (event.extraType === 'bye') inn.extras.byes += event.extraRuns ?? 0
    if (event.extraType === 'legbye') inn.extras.legByes += event.extraRuns ?? 0
    if (event.secondaryExtraType === 'bye') inn.extras.byes += event.extraRuns ?? 0
    if (event.secondaryExtraType === 'legbye') inn.extras.legByes += event.extraRuns ?? 0
    if (event.extraType === 'penalty') inn.extras.penalty += event.extraRuns ?? 5
  }

  // batter figures
  const strikerFig = ensureBatter(inn, inn.strikerId)
  if (event.runsOffBat > 0) {
    strikerFig.runs += event.runsOffBat
    if (event.runsOffBat === FOUR) strikerFig.fours += 1
    if (event.runsOffBat === SIX) strikerFig.sixes += 1
  }
  if (legal || event.extraType === 'noball') {
    strikerFig.balls += 1
    if (legal && event.runsOffBat === 0 && !event.extraType) strikerFig.dots += 1
  }

  // bowler figures
  const bowlerFig = ensureBowler(inn, inn.bowlerId)
  if (legal) bowlerFig.balls += 1
  bowlerFig.runs += deliveryBowlerRuns(event)
  if (event.extraType === 'wide') bowlerFig.wides += 1
  if (event.extraType === 'noball') bowlerFig.noBalls += 1

  // strike rotation from runs (runs happen before the dismissal completes)
  const rr = rotationRuns(event)
  rotateStrike(inn, rr % 2 === 1)

  // wicket — handled AFTER rotation so run-outs credit the correct end:
  // if the dismissed player is the (post-rotation) striker, the new batter
  // takes strike; otherwise they join at the non-striker's end.
  if (event.wicket) {
    if (event.wicket.type === 'runout' && event.wicket.battersCrossed) {
      rotateStrike(inn, true)
    }
    inn.wickets += 1
    if (!inn.outIds.includes(event.wicket.dismissedPlayerId)) {
      inn.outIds.push(event.wicket.dismissedPlayerId)
    }
    // bowler gets credit except run-outs and unspecified dismissals
    if (event.wicket.type !== 'runout' && event.wicket.type !== 'other') {
      bowlerFig.wickets += 1
    }
    handleNewBatter(inn, event.wicket.dismissedPlayerId)
  }

  // legal ball bookkeeping & over completion
  if (legal) {
    inn.legalBalls += 1
    if (isOverComplete(inn)) {
      completeOver(inn)
    }
  }
}

/** Bring the next batter in after a dismissal. Chooses the next player in
 *  batting order who is neither out nor currently at the crease. */
function handleNewBatter(inn: InningsState, dismissedId: string) {
  const busy = new Set([inn.strikerId, inn.nonStrikerId])
  busy.delete(dismissedId)
  const nextId = inn.battingOrder.find(
    (pid) => !inn.outIds.includes(pid) && !busy.has(pid),
  )
  if (!nextId) return // all out — innings end check will fire
  if (dismissedId === inn.strikerId) {
    inn.strikerId = nextId
  } else {
    inn.nonStrikerId = nextId
  }
  ensureBatter(inn, nextId)
}

/** End-of-over housekeeping: swap strike, start a new over bucket, and pick
 *  the next bowler if provided via state (UI sets it after the over). */
function completeOver(inn: InningsState) {
  const bowlerFig = ensureBowler(inn, inn.bowlerId)
  // maiden: bowler conceded 0 in this over
  const overRuns = inn.overs[inn.overs.length - 1].reduce(
    (sum, d) => sum + deliveryBowlerRuns(d), 0,
  )
  if (overRuns === 0) bowlerFig.maidens += 1

  rotateStrike(inn, true) // end of over → batters swap ends
  inn.overs.push([]) // start new over bucket
}

/**
 * Choose the bowler for the over about to start. Same bowler cannot bowl
 * consecutive overs. The UI stores the per-over bowler list on the innings
 * so undo/replay stays deterministic.
 */
export function setBowler(state: MatchState, bowlerId: string): MatchState {
  const next: MatchState = structuredCloneNext(state)
  const inn = next.innings[next.currentInningsIndex]
  if (next.result || inn.completed) {
    throw new Error('Cannot change the bowler after the innings or match has ended.')
  }
  if (!bowlerId) {
    throw new Error('A bowler must be selected.')
  }
  if (inn.overs[inn.overs.length - 1].length > 0) {
    throw new Error('Cannot change bowler mid-over.')
  }
  if (inn.overBowlers.length >= 1 && inn.overBowlers[inn.overBowlers.length - 1] === bowlerId) {
    throw new Error('A bowler cannot bowl two overs in a row.')
  }
  const maximumOversPerBowler = Math.ceil(next.totalOvers / 5)
  if (inn.overBowlers.filter((id) => id === bowlerId).length >= maximumOversPerBowler) {
    throw new Error(`A bowler cannot bowl more than ${maximumOversPerBowler} overs in this match.`)
  }
  inn.overBowlers.push(bowlerId)
  inn.bowlerId = bowlerId
  ensureBowler(inn, bowlerId)
  return next
}

/* ---------------- innings transitions ---------------- */

function checkInningsTransition(state: MatchState, inn: InningsState) {
  if (isInningsOver(state, inn)) {
    inn.completed = true
    if (state.currentInningsIndex === 0) {
      const team = state.teamA.id === inn.battingTeamId ? state.teamA : state.teamB
      const other = state.teamA.id === inn.battingTeamId ? state.teamB : state.teamA
      const order = other.players.map((p) => p.id)
      const shell = createInnings(other, team, order, '', order[0] ?? '', order[1] ?? '')
      shell.battingTeamId = other.id
      shell.bowlingTeamId = team.id
      shell.battingOrder = order
      shell.overBowlers = []
      const openers = order.slice(0, 2)
      shell.strikerId = openers[0] ?? ''
      shell.nonStrikerId = openers[1] ?? ''
      shell.bowlerId = ''
      state.innings.push(shell)
      state.currentInningsIndex = 1
    } else {
      finishMatch(state)
    }
  }
  // chase completed early?
  if (state.currentInningsIndex === 1) {
    const first = state.innings[0]
    const second = state.innings[1]
    if (!second.completed && second.runs > first.runs) {
      second.completed = true
      finishMatch(state)
    }
  }
}

export function finishMatch(state: MatchState) {
  const first = state.innings[0]
  const second = state.innings[1]
  if (!second) return
  const nameOf = (id: string) => (state.teamA.id === id ? state.teamA.name : state.teamB.name)
  if (second.runs > first.runs) {
    const wktsLeft = 10 - second.wickets
    state.result = `${nameOf(second.battingTeamId)} won by ${wktsLeft} wicket${wktsLeft === 1 ? '' : 's'}`
  } else if (second.runs < first.runs) {
    state.result = `${nameOf(first.battingTeamId)} won by ${first.runs - second.runs} run${first.runs - second.runs === 1 ? '' : 's'}`
  } else {
    state.result = 'Match tied'
  }
}

/* ---------------- undo ---------------- */

/**
 * Rebuilds state by replaying all deliveries except the last one.
 * Because replay is deterministic, undo is always exact — even across
 * over completions, strike changes and innings transitions.
 */
export interface BowlerSelection {
  afterDeliveryCount: number
  bowlerId: string
}

export function undoLastDelivery(
  setup: MatchSetup,
  delivered: DeliveryEvent[],
  bowlerSelections: BowlerSelection[] = [],
): MatchState {
  const replay = delivered.slice(0, -1)
  let state = buildInitialState(setup)
  let selectionIndex = 0

  while (bowlerSelections[selectionIndex]?.afterDeliveryCount === 0) {
    state = setBowler(state, bowlerSelections[selectionIndex].bowlerId)
    selectionIndex += 1
  }

  for (const [index, delivery] of replay.entries()) {
    state = applyDelivery(state, delivery)
    while (bowlerSelections[selectionIndex]?.afterDeliveryCount === index + 1) {
      state = setBowler(state, bowlerSelections[selectionIndex].bowlerId)
      selectionIndex += 1
    }
  }
  return state
}

export interface MatchSetup {
  teamA: MatchState['teamA']
  teamB: MatchState['teamB']
  totalOvers: number
  tossWinnerId: string
  tossDecision: 'bat' | 'bowl'
  openers: [string, string]
  firstBowler: string
  battingOrder: string[]
}

export function buildInitialState(setup: MatchSetup): MatchState {
  const battingFirstId = setup.tossDecision === 'bat'
    ? setup.tossWinnerId
    : setup.tossWinnerId === setup.teamA.id ? setup.teamB.id : setup.teamA.id
  const bat = setup.teamA.id === battingFirstId ? setup.teamA : setup.teamB
  const bowl = setup.teamA.id === battingFirstId ? setup.teamB : setup.teamA
  const inn = createInnings(bat, bowl, setup.battingOrder, setup.firstBowler, setup.openers[0], setup.openers[1])
  return createMatch(setup.teamA, setup.teamB, setup.totalOvers, setup.tossWinnerId, setup.tossDecision, inn)
}
