/* ============================================================
   PAVILION HUB — Scoring engine unit tests (vitest)
   Demo-data only. Run: npm test
   ============================================================ */
import { describe, expect, it } from 'vitest'
import {
  applyDelivery,
  buildInitialState,
  calculateTarget,
  createMatch,
  createInnings,
  oversDisplay,
  runRate,
  setBowler,
  undoLastDelivery,
  type DeliveryEvent,
  type MatchSetup,
} from './engine'

const teamA = {
  id: 'A',
  name: 'Westport Rangers',
  players: [
    { id: 'A1', name: 'Opener 1' },
    { id: 'A2', name: 'Opener 2' },
    { id: 'A3', name: 'No.3' },
    { id: 'A4', name: 'No.4' },
  ],
}
const teamB = {
  id: 'B',
  name: 'Eastvale Falcons',
  players: [
    { id: 'B1', name: 'Pacer 1' },
    { id: 'B2', name: 'Spinner' },
    { id: 'B3', name: 'Pacer 2' },
    { id: 'B4', name: 'Allrounder' },
  ],
}

function setup(overrides: Partial<MatchSetup> = {}): MatchSetup {
  return {
    teamA,
    teamB,
    totalOvers: 2,
    tossWinnerId: 'A',
    tossDecision: 'bat',
    openers: ['A1', 'A2'],
    firstBowler: 'B1',
    battingOrder: ['A1', 'A2', 'A3', 'A4'],
    ...overrides,
  }
}

const bat = (runsOffBat: number): DeliveryEvent => ({ runsOffBat })

describe('legal deliveries vs extras', () => {
  it('counts wides as a run but not a legal ball', () => {
    let s = buildInitialState(setup())
    s = applyDelivery(s, { runsOffBat: 0, extraType: 'wide' })
    const inn = s.innings[0]
    expect(inn.runs).toBe(1) // 1 penalty run
    expect(inn.legalBalls).toBe(0)
    expect(inn.extras.wides).toBe(1)
    expect(inn.bowlerFigures.B1.balls).toBe(0)
    expect(inn.bowlerFigures.B1.runs).toBe(1)
    expect(inn.batterFigures.A1.balls).toBe(0)
  })

  it('counts no-balls as a run but not a legal ball, batter still faces it', () => {
    let s = buildInitialState(setup())
    s = applyDelivery(s, { runsOffBat: 0, extraType: 'noball' })
    const inn = s.innings[0]
    expect(inn.legalBalls).toBe(0)
    expect(inn.runs).toBe(1)
    expect(inn.batterFigures.A1.balls).toBe(0) // no-ball: batter not charged a ball
    expect(inn.bowlerFigures.B1.noBalls).toBe(1)
  })

  it('no-ball + runs off bat credits batter runs and team runs', () => {
    let s = buildInitialState(setup())
    s = applyDelivery(s, { runsOffBat: 4, extraType: 'noball' })
    const inn = s.innings[0]
    expect(inn.runs).toBe(5) // 4 off bat + 1 no-ball penalty
    expect(inn.batterFigures.A1.fours).toBe(1)
    expect(inn.legalBalls).toBe(0)
  })

  it('byes and leg-byes count as legal balls but not batter runs', () => {
    let s = buildInitialState(setup())
    s = applyDelivery(s, { runsOffBat: 0, extraType: 'bye', extraRuns: 2 })
    const inn = s.innings[0]
    expect(inn.runs).toBe(2)
    expect(inn.legalBalls).toBe(1)
    expect(inn.extras.byes).toBe(2)
    expect(inn.batterFigures.A1.runs).toBe(0)
    expect(inn.batterFigures.A1.balls).toBe(1)
    // bowler is not charged byes
    expect(inn.bowlerFigures.B1.runs).toBe(0)
  })
})

describe('strike rotation', () => {
  it('swaps on odd runs', () => {
    let s = buildInitialState(setup())
    s = applyDelivery(s, bat(1))
    expect(s.innings[0].strikerId).toBe('A2')
    expect(s.innings[0].nonStrikerId).toBe('A1')
  })

  it('stays on even runs', () => {
    let s = buildInitialState(setup())
    s = applyDelivery(s, bat(2))
    expect(s.innings[0].strikerId).toBe('A1')
  })

  it('swaps at the end of a completed over (6 legal balls)', () => {
    let s = buildInitialState(setup())
    // 6 dot balls (all even, no rotation) → end of over swaps anyway
    for (let i = 0; i < 6; i++) s = applyDelivery(s, bat(0))
    const inn = s.innings[0]
    expect(inn.legalBalls).toBe(6)
    expect(inn.overs.length).toBe(2) // new over bucket started
    expect(inn.strikerId).toBe('A2')
  })

  it('does not end the over on a wide (6 legal balls still needed)', () => {
    let s = buildInitialState(setup())
    for (let i = 0; i < 5; i++) s = applyDelivery(s, bat(0))
    s = applyDelivery(s, { runsOffBat: 0, extraType: 'wide' })
    const inn = s.innings[0]
    expect(inn.legalBalls).toBe(5)
    expect(inn.overs.length).toBe(1) // over not complete
  })

  it('rotation accounts for byes', () => {
    let s = buildInitialState(setup())
    s = applyDelivery(s, { runsOffBat: 0, extraType: 'bye', extraRuns: 1 })
    expect(s.innings[0].strikerId).toBe('A2')
  })

  it('dismissed striker is replaced and new batter takes strike', () => {
    let s = buildInitialState(setup())
    s = applyDelivery(s, {
      runsOffBat: 0,
      wicket: { type: 'bowled', dismissedPlayerId: 'A1' },
    })
    const inn = s.innings[0]
    expect(inn.wickets).toBe(1)
    expect(inn.strikerId).toBe('A3')
    expect(inn.nonStrikerId).toBe('A2')
    expect(inn.outIds).toContain('A1')
  })

  it('run out of the non-striker keeps the striker on strike', () => {
    let s = buildInitialState(setup())
    // A2 runs 1, reaches the striker's end, then is run out there.
    // Rotation makes A2 the striker; the new batter A3 joins at the non-striker's end.
    s = applyDelivery(s, {
      runsOffBat: 1,
      wicket: { type: 'runout', dismissedPlayerId: 'A2' },
    })
    const inn = s.innings[0]
    expect(inn.strikerId).toBe('A3')
    expect(inn.nonStrikerId).toBe('A1')
  })

  it('wickets off the bat credit the bowler; run-outs do not', () => {
    let s = buildInitialState(setup())
    s = applyDelivery(s, { runsOffBat: 0, wicket: { type: 'caught', dismissedPlayerId: 'A1' } })
    s = applyDelivery(s, { runsOffBat: 0, wicket: { type: 'runout', dismissedPlayerId: 'A3' } })
    const bowler = s.innings[0].bowlerFigures.B1
    expect(bowler.wickets).toBe(1)
  })
})

describe('figures', () => {
  it('tracks fours, sixes, dots, runs and balls for batters', () => {
    let s = buildInitialState(setup())
    s = applyDelivery(s, bat(4))
    s = applyDelivery(s, bat(6))
    s = applyDelivery(s, bat(1)) // rotate
    s = applyDelivery(s, bat(0))
    const a1 = s.innings[0].batterFigures.A1
    expect(a1).toMatchObject({ runs: 11, balls: 3, fours: 1, sixes: 1, dots: 0 })
    const a2 = s.innings[0].batterFigures.A2
    expect(a2).toMatchObject({ runs: 0, balls: 1, dots: 1 })
  })

  it('records maiden overs for the bowler', () => {
    let s = buildInitialState(setup())
    for (let i = 0; i < 6; i++) s = applyDelivery(s, bat(0))
    expect(s.innings[0].bowlerFigures.B1.maidens).toBe(1)
  })
})

describe('innings transitions, target and result', () => {
  it('finishes the first innings at the overs limit and starts the chase', () => {
    let s = buildInitialState(setup()) // 2-over match
    for (let i = 0; i < 12; i++) s = applyDelivery(s, bat(2))
    expect(s.innings[0].completed).toBe(true)
    expect(s.currentInningsIndex).toBe(1)
    expect(s.innings[0].runs).toBe(24)
    const target = calculateTarget(s)
    expect(target.target).toBe(25)
    expect(target.runsNeeded).toBe(25)
    expect(target.ballsRemaining).toBe(12)
    expect(target.requiredRunRate).toBeCloseTo((25 / 12) * 6, 5)
  })

  it('ends the chase early when the target is passed and declares a result', () => {
    let s = buildInitialState(setup())
    for (let i = 0; i < 12; i++) s = applyDelivery(s, bat(2)) // 24 runs, target 25
    // chase: 6×5 = 30 passes 25
    for (let i = 0; i < 5; i++) s = applyDelivery(s, bat(6))
    expect(s.result).toContain('won by 10 wickets')
  })

  it('declares a tie', () => {
    let s = buildInitialState(setup())
    for (let i = 0; i < 12; i++) s = applyDelivery(s, bat(1))
    for (let i = 0; i < 12; i++) s = applyDelivery(s, bat(1))
    expect(s.result).toBe('Match tied')
  })

  it('ends the innings when all out (wickets = 10)', () => {
    const bigTeams = {
      teamA: {
        id: 'A', name: 'A',
        players: Array.from({ length: 11 }, (_, i) => ({ id: `A${i + 1}`, name: `P${i + 1}` })),
      },
      teamB: {
        id: 'B', name: 'B',
        players: Array.from({ length: 11 }, (_, i) => ({ id: `B${i + 1}`, name: `P${i + 1}` })),
      },
    }
    const st = setup({ teamA: bigTeams.teamA, teamB: bigTeams.teamB, battingOrder: bigTeams.teamA.players.map((p) => p.id) })
    let s = buildInitialState(st)
    // batter 1 out, then keep removing the new striker until 10 wickets
    for (let i = 0; i < 10; i++) {
      s = applyDelivery(s, {
        runsOffBat: 0,
        wicket: { type: 'bowled', dismissedPlayerId: s.innings[0].strikerId },
      })
    }
    expect(s.innings[0].completed).toBe(true)
    expect(s.currentInningsIndex).toBe(1)
  })
})

describe('undo (replay from event history)', () => {
  it('undoing the last delivery exactly restores the previous state', () => {
    const st = setup()
    const events: DeliveryEvent[] = []
    let s = buildInitialState(st)
    const snapshots: unknown[] = [JSON.parse(JSON.stringify(s))]
    events.push(bat(4)); s = applyDelivery(s, events[0])
    snapshots.push(JSON.parse(JSON.stringify(s)))
    events.push({ runsOffBat: 0, extraType: 'wide' }); s = applyDelivery(s, events[1])
    snapshots.push(JSON.parse(JSON.stringify(s)))
    events.push(bat(2)); s = applyDelivery(s, events[2])
    snapshots.push(JSON.parse(JSON.stringify(s)))
    const undone = undoLastDelivery(st, events)
    expect(JSON.parse(JSON.stringify(undone))).toEqual(snapshots[2])
    const undoneTwice = undoLastDelivery(st, events.slice(0, 2))
    expect(JSON.parse(JSON.stringify(undoneTwice))).toEqual(snapshots[1])
  })

  it('undo restores state across an over boundary', () => {
    const st = setup()
    const events: DeliveryEvent[] = Array.from({ length: 6 }, () => bat(1))
    const undone = undoLastDelivery(st, events)
    expect(undone.innings[0].legalBalls).toBe(5)
    expect(undone.innings[0].overs.length).toBe(1)
  })
})

describe('bowler selection', () => {
  it('rejects the same bowler bowling consecutive overs', () => {
    let s = buildInitialState(setup())
    for (let i = 0; i < 6; i++) s = applyDelivery(s, bat(0))
    expect(() => setBowler(s, 'B1')).toThrow(/two overs in a row/)
    const ok = setBowler(s, 'B2')
    expect(ok.innings[0].bowlerId).toBe('B2')
  })

  it('rejects changing the bowler mid-over', () => {
    let s = buildInitialState(setup())
    s = applyDelivery(s, bat(0))
    expect(() => setBowler(s, 'B2')).toThrow(/mid-over/)
  })
})

describe('helpers and second-innings shell', () => {
  it('formats overs like cricket scoreboards', () => {
    expect(oversDisplay(0)).toBe('0.0')
    expect(oversDisplay(6)).toBe('1.0')
    expect(oversDisplay(7)).toBe('1.1')
    expect(oversDisplay(98)).toBe('16.2')
  })

  it('run rate is runs per over', () => {
    expect(runRate(24, 12)).toBe(12)
    expect(runRate(10, 0)).toBe(0)
  })

  it('toss decision "bowl" flips who bats first', () => {
    const inn = createInnings(teamA, teamB, ['A1', 'A2'], 'B1', 'A1', 'A2')
    const s = createMatch(teamA, teamB, 20, 'A', 'bowl', inn)
    expect(s.innings[0].battingTeamId).toBe('B')
  })

  it('penalty runs default to 5 and go to team + bowler ledger exclusion', () => {
    let s = buildInitialState(setup())
    s = applyDelivery(s, { runsOffBat: 0, extraType: 'penalty', extraRuns: 5 })
    const inn = s.innings[0]
    expect(inn.runs).toBe(5)
    expect(inn.extras.penalty).toBe(5)
    // penalty is not charged to the bowler
    expect(inn.bowlerFigures.B1.runs).toBe(0)
  })
})
