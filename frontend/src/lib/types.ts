/* Shapes returned by the PAVILION HUB API. */

export type MatchStatus = 'upcoming' | 'live' | 'completed' | 'abandoned'
export type PlayerRole = 'batter' | 'bowler' | 'all-rounder' | 'wicket-keeper'
export type ExtraType = 'wide' | 'noball' | 'bye' | 'legbye'
export type WicketType = 'bowled' | 'caught' | 'lbw' | 'runout' | 'stumped' | 'hitwicket' | 'retired'

export const PLAYER_ROLES: { value: PlayerRole; label: string }[] = [
  { value: 'batter', label: 'Batter' },
  { value: 'bowler', label: 'Bowler' },
  { value: 'all-rounder', label: 'All-rounder' },
  { value: 'wicket-keeper', label: 'Wicket-keeper' },
]

export interface Team {
  id: string
  name: string
  shortName: string
  color: string
  city?: string
  playerCount?: number
}

export interface Player {
  id: string
  teamId: string
  name: string
  role: PlayerRole
  jerseyNumber?: number
  battingStyle?: string
  bowlingStyle?: string
}

export interface InningsScore {
  teamId: string
  runs: number
  wickets: number
  legalBalls: number
  allOut: boolean
}

export interface MatchResult {
  winnerId: string | null
  tie: boolean
  text: string
}

export interface MatchSummary {
  id: string
  title: string | null
  tournamentId: string | null
  tournamentName: string | null
  venue: string | null
  date: string
  overs: number
  status: MatchStatus
  teamA: Team
  teamB: Team
  toss: { winnerId: string; decision: 'bat' | 'bowl' } | null
  scores: InningsScore[]
  result: MatchResult | null
}

export interface BattingEntry {
  playerId: string
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  out: boolean
  dismissal: string | null
  strikeRate: number
}

export interface BowlingEntry {
  playerId: string
  name: string
  legalBalls: number
  overs: string
  runs: number
  wickets: number
  maidens: number
  wides: number
  noBalls: number
  economy: number
}

export interface Innings {
  battingTeamId: string
  bowlingTeamId: string
  runs: number
  wickets: number
  legalBalls: number
  overs: string
  runRate: number
  extras: { wides: number; noBalls: number; byes: number; legByes: number; total: number }
  allOut: boolean
  complete: boolean
  target: number | null
  batting: BattingEntry[]
  bowling: BowlingEntry[]
  fallOfWickets: { wicket: number; runs: number; overs: string; playerId: string; name: string }[]
  overHistory: { number: number; bowlerId: string; bowlerName: string; runs: number; balls: string[] }[]
}

export interface LiveState {
  inningsIndex: number
  strikerId: string | null
  nonStrikerId: string | null
  bowlerId: string | null
  needsBatter: boolean
  needsBowler: boolean
  inningsComplete: boolean
  awaitingNextInnings: boolean
  previousBowlerId: string | null
  currentOver: string[]
  target: number | null
  runsNeeded: number | null
  ballsLeft: number
  requiredRunRate: number | null
}

export interface MatchDetail extends MatchSummary {
  tournamentShareCode: string | null
  squads: Record<string, Player[]>
  playingXI: Record<string, string[]> | null
  innings: Innings[]
  live: LiveState | null
}

export interface StandingRow {
  teamId: string
  name: string
  shortName: string
  color: string
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
  points: number
  netRunRate: number
}

export interface LeaderRow {
  playerId: string
  name: string
  teamId: string
  teamShortName: string
  teamColor: string
  value: number
  detail: string
}

export interface Leaders {
  mostRuns: LeaderRow[]
  mostWickets: LeaderRow[]
  mostSixes: LeaderRow[]
  bestStrikeRate: LeaderRow[]
  bestEconomy: LeaderRow[]
}

export interface Tournament {
  id: string
  name: string
  season?: string
  city?: string
  ground?: string
  organizer?: string
  overs: number
  startDate?: string
  endDate?: string
  shareCode: string
  teamIds: string[]
  teamCount?: number
  matchCount?: number
  liveCount?: number
}

export interface TournamentDetail extends Tournament {
  teams: Team[]
  matches: MatchSummary[]
  standings: StandingRow[]
  leaders: Leaders
}

export interface TeamDetail extends Team {
  players: Player[]
  matches: MatchSummary[]
}

export interface PlayerProfile {
  player: Player
  team: Team
  stats: {
    matches: number
    batting: {
      innings: number; runs: number; balls: number; fours: number; sixes: number; notOuts: number
      highest: number; highestNotOut: boolean; fifties: number; hundreds: number
      average: number | null; strikeRate: number
    }
    bowling: {
      innings: number; legalBalls: number; overs: string; runs: number; wickets: number; maidens: number
      best: { wickets: number; runs: number } | null; economy: number; average: number | null
    }
  }
  recent: {
    matchId: string
    date: string
    status: MatchStatus
    opponent: Team
    result: string | null
    batting: { runs: number; balls: number; out: boolean; dismissal: string | null } | null
    bowling: { overs: string; runs: number; wickets: number } | null
  }[]
}

export interface Dashboard {
  live: MatchSummary[]
  upcoming: MatchSummary[]
  recent: MatchSummary[]
  counts: { tournaments: number; teams: number; players: number; matches: number }
}

export interface BallInput {
  runs: number
  extra?: ExtraType | null
  wicket?: { type: WicketType; playerOutId: string; fielderId?: string } | null
}
