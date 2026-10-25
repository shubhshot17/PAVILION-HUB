import { describe, expect, it } from 'vitest'
import { initials, matchStatusLine, overs } from './format'
import type { MatchSummary } from './types'

const team = (id: string, shortName: string) => ({ id, name: `${shortName} XI`, shortName, color: '#000000' })
const base: MatchSummary = {
  id: 'm', title: null, tournamentId: null, tournamentName: null, venue: null, date: new Date().toISOString(),
  overs: 10, status: 'live', teamA: team('a', 'AAA'), teamB: team('b', 'BBB'), toss: null, scores: [], result: null,
}

describe('format helpers', () => {
  it('formats overs from legal balls', () => {
    expect(overs(0)).toBe('0.0')
    expect(overs(17)).toBe('2.5')
    expect(overs(60)).toBe('10.0')
  })

  it('builds initials', () => {
    expect(initials('Rohan Sharma')).toBe('RS')
    expect(initials('Zaid')).toBe('Z')
  })

  it('describes a chase, the toss, and a result', () => {
    expect(matchStatusLine({
      ...base,
      scores: [
        { teamId: 'a', runs: 80, wickets: 3, legalBalls: 60, allOut: false },
        { teamId: 'b', runs: 50, wickets: 2, legalBalls: 42, allOut: false },
      ],
    })).toBe('BBB need 31 off 18 balls')
    expect(matchStatusLine({ ...base, toss: { winnerId: 'a', decision: 'bowl' } })).toBe('AAA won the toss and chose to bowl')
    expect(matchStatusLine({ ...base, status: 'completed', result: { winnerId: 'a', tie: false, text: 'AAA won by 5 runs' } }))
      .toBe('AAA won by 5 runs')
  })
})
