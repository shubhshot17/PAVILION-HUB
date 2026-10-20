/* ============================================================
   PAVILION HUB — Shared TypeScript types
   These describe the shape of data used across the app.
   ============================================================ */

export type MatchStatus = 'live' | 'upcoming' | 'completed' | 'abandoned'

export type MatchFormat = 'T20' | 'ODI' | 'Test' | 'T10'

export interface TeamScore {
  teamId: string
  runs: number
  wickets: number
  overs: number
  declared?: boolean
}

export interface Match {
  id: string
  tournament: string
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
}

export interface Team {
  id: string
  name: string
  shortName: string
  color: string // accent color used for the team badge
}

export interface Tournament {
  id: string
  name: string
  season: string
  format: MatchFormat
  isActive: boolean
}

export interface StandingRow {
  teamId: string
  teamName: string
  shortName: string
  played: number
  won: number
  lost: number
  drawn: number
  points: number
  netRunRate: number
}

export interface DashboardData {
  liveMatches: Match[]
  upcoming: Match[]
  recent: Match[]
  standings: StandingRow[]
}

export interface AppNavItem {
  id: string
  label: string
  icon: 'dashboard' | 'live' | 'matches' | 'tournaments' | 'teams' | 'stats' | 'ai'
}
