/* ============================================================
   PAVILION HUB — Shared TypeScript types
   These describe the shape of data used across the app.
   ============================================================ */

export type MatchStatus = 'live' | 'upcoming' | 'completed' | 'abandoned'

export type MatchFormat = 'T20' | 'ODI' | 'Test' | 'T10'

export type TournamentType = 'round_robin' | 'knockout' | 'round_robin_knockout'

export interface TeamScore {
  teamId: string
  runs: number
  wickets: number
  overs: number
  declared?: boolean
}

export interface MatchPlayingXI {
  teamId: string
  playerIds: string[]
  captainId: string
  wicketkeeperId: string
  captainName?: string | null
  wicketkeeperName?: string | null
  selectedPlayers?: { id: string; name: string }[]
}

export interface MatchSetup {
  oversPerInnings: number
  tossWinnerTeamId: string
  tossDecision: 'bat' | 'field'
  playingXIs: MatchPlayingXI[]
}

export interface Match {
  id: string
  tournament: string
  tournamentId?: string
  format: MatchFormat
  venue: string
  date: string // ISO string, e.g. "2026-10-20T14:00:00"
  status: MatchStatus
  teams: [Team, Team]
  /** Present when status is 'live' or 'completed' */
  scores?: [TeamScore, TeamScore]
  /** Which innings is currently in progress (live matches only) */
  currentInnings?: 0 | 1
  /** Short summary line, e.g. "Team A won by 5 wickets" */
  result?: string
  isTie?: boolean
  isAbandoned?: boolean
  winTeamId?: string
  playerOfTheMatchId?: string
  isDemo?: boolean
  setup?: MatchSetup
}

export interface Scorecard {
  match: Match
  innings: {
    innings: number
    battingTeam: Team
    bowlingTeam: Team
    runs: number
    wickets: number
    legalBalls: number
    battingFigures: {
      playerId: string
      name: string
      runs: number
      ballsFaced: number
      fours: number
      sixes: number
      dismissal: string | null
    }[]
    bowlingFigures: {
      playerId: string
      name: string
      legalBalls: number
      runsConceded: number
      wickets: number
      wides: number
      noBalls: number
    }[]
    events: ScoringEvent[]
  }[]
}

export interface ScoringEvent {
  id: string
  matchId: string
  innings: number
  over: number
  ball: number
  runs: number
  eventType: string
  batterRuns: number
  extraRuns: number
  extrasType: string | null
  legalBall: boolean
  sequence: number
  recordedAt: string
  batterId?: string
  bowlerId?: string
  nonStrikerId?: string
  wicketType?: string
  playerOutId?: string
  delivery?: {
    runsOffBat: number
    extraType?: 'wide' | 'noball' | 'bye' | 'legbye' | 'penalty'
    extraRuns?: number
    secondaryExtraType?: 'bye' | 'legbye'
    wicket?: {
      type: string
      dismissedPlayerId: string
      battersCrossed?: boolean
    }
  }
}

export interface Team {
  id: string
  name: string
  shortName: string
  color: string // accent color used for the team badge
  city?: string
  homeGround?: string
  isDemo?: boolean
}

/** Allowed playing roles — mirrored by the backend validator. */
export const PLAYER_ROLES = ['batter', 'bowler', 'all-rounder', 'wicket-keeper'] as const

export type PlayerRole = (typeof PLAYER_ROLES)[number]

/** Suggested values for the free-text style fields (any text is allowed). */
export const BATTING_STYLES = [
  'Right-hand bat',
  'Left-hand bat',
] as const

export const BOWLING_STYLES = [
  'Right-arm fast',
  'Right-arm medium',
  'Right-arm off-break',
  'Right-arm leg-break',
  'Left-arm fast',
  'Left-arm medium',
  'Left-arm orthodox',
  'Left-arm wrist-spin',
  'Does not bowl',
] as const

export interface Player {
  id: string
  teamId: string
  name: string
  role: PlayerRole
  jerseyNumber?: number
  battingStyle?: string
  bowlingStyle?: string
  isCaptain?: boolean
  isWicketkeeper?: boolean
  isActive?: boolean
  isDemo?: boolean
}

export interface Tournament {
  id: string
  name: string
  season: string
  format: MatchFormat
  isActive: boolean
  tournamentType?: TournamentType
  oversPerInnings?: number
  winPoints?: number
  tiePoints?: number
  noResultPoints?: number
  isDemo?: boolean
}

export interface StandingRow {
  teamId: string
  teamName: string
  shortName: string
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
  drawn?: number
  points: number
  netRunRate: number
}

export interface Fixture {
  id: string
  tournamentId: string
  homeTeam: Team
  awayTeam: Team
  scheduledAt: string
  venue: string
  status: 'scheduled' | 'postponed' | 'cancelled' | 'completed'
  stage: string
  roundNumber: number
  bracketSlot?: number | null
  linkedMatchId?: string | null
  isDemo?: boolean
}

export interface Registration {
  id: string
  tournamentId: string
  teamId: string
  teamName: string
  shortName: string
  color: string
  isDemo?: boolean
  status: 'registered' | 'withdrawn' | 'disqualified'
  registeredAt: string
}

export interface BracketRound {
  stage: string
  matches: {
    id: string
    stage: string
    roundNumber: number
    bracketSlot?: number | null
    scheduledAt: string
    venue: string
    homeTeam: { id: string; name: string; shortName: string }
    awayTeam: { id: string; name: string; shortName: string }
    status: string
    matchStatus?: string
    matchResult?: string
    winTeamId?: string
  }[]
}

export interface BattingStats {
  innings: number
  runs: number
  balls: number
  fours: number
  sixes: number
  highestScore: number
  fifties: number
  hundreds: number
  average: number | null
  strikeRate: number | null
}

export interface BowlingStats {
  innings: number
  balls: number
  runs: number
  wickets: number
  wides: number
  noBalls: number
  economy: number | null
  average: number | null
}

export interface PlayerStats {
  player: Player
  teamName: string
  teamShort: string
  teamColor: string
  batting: BattingStats
  bowling: BowlingStats
  playerOfTheMatch: number
  recentBatting: {
    matchId: string
    date: string
    opponent: string
    runs: number
    balls: number
    fours: number
    sixes: number
    dismissal?: string
  }[]
}

export interface TeamProfile {
  id: string
  name: string
  shortName: string
  color: string
  city?: string
  homeGround?: string
  isDemo?: boolean
  players: Player[]
  recentMatches: {
    id: string
    status: string
    result?: string
    date: string
    isAbandoned: boolean
    isTie: boolean
    won: boolean
    tournament: string
    format: string
    opponents: Team[]
  }[]
}

export interface DashboardData {
  liveMatches: Match[]
  upcoming: Match[]
  recent: Match[]
  standings: StandingRow[]
  teamCount: number
}

export interface AppNavItem {
  id: string
  label: string
  icon: 'dashboard' | 'live' | 'matches' | 'tournaments' | 'teams' | 'stats' | 'ai'
}
